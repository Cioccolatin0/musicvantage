#!/usr/bin/env python3
"""
YouTube Music API proxy using ytmusicapi (innertube).
Supports both CLI mode (via args) and worker mode (via stdin JSON lines).
"""
import sys
import json
import re
import time
import os
import threading
import traceback
import subprocess
import concurrent.futures
import requests
from ytmusicapi import YTMusic

# No Spotify SDK needed - we use the embed page's anonymous token

_yt = None

# Persistent disk cache for search results
_SEARCH_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".search_cache.json")
_search_disk_cache: dict = {}
_search_disk_cache_lock = threading.Lock()
_SEARCH_CACHE_TTL = 30 * 60 * 1000  # 30 minutes on disk
_MAX_DISK_CACHE = 500

def _load_search_cache():
    global _search_disk_cache
    try:
        if os.path.exists(_SEARCH_CACHE_FILE):
            with open(_SEARCH_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Filter expired entries
                now = time.time() * 1000
                _search_disk_cache = {k: v for k, v in data.items() if v.get("expiry", 0) > now}
    except Exception:
        _search_disk_cache = {}

def _save_search_cache():
    try:
        with open(_SEARCH_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_search_disk_cache, f, ensure_ascii=False)
    except Exception:
        pass


def clear_search_cache():
    """Clear the on-disk search cache and in-memory cache.

    This is used by the server admin endpoint to invalidate cached search
    results without restarting the python worker.
    """
    global _search_disk_cache
    try:
        with _search_disk_cache_lock:
            _search_disk_cache.clear()
        try:
            if os.path.exists(_SEARCH_CACHE_FILE):
                os.remove(_SEARCH_CACHE_FILE)
        except Exception:
            # best-effort: ignore filesystem errors
            pass
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}

def _get_cached_search(query: str):
    key = query.lower().strip()
    with _search_disk_cache_lock:
        entry = _search_disk_cache.get(key)
        if entry and entry.get("expiry", 0) > time.time() * 1000:
            return entry["data"]
    return None

def _set_cached_search(query: str, data):
    key = query.lower().strip()
    with _search_disk_cache_lock:
        _search_disk_cache[key] = {
            "data": data,
            "expiry": time.time() * 1000 + _SEARCH_CACHE_TTL
        }
        # Trim cache if too large
        if len(_search_disk_cache) > _MAX_DISK_CACHE:
            sorted_keys = sorted(_search_disk_cache.keys(), 
                key=lambda k: _search_disk_cache[k].get("expiry", 0))
            for k in sorted_keys[:100]:
                del _search_disk_cache[k]
        # Save periodically (every 10 writes)
        if len(_search_disk_cache) % 10 == 0:
            _save_search_cache()

# Load cache on startup
_load_search_cache()

YT_DLP_CMD = None
for candidate in [["yt-dlp"], [sys.executable, "-m", "yt_dlp"]]:
    try:
        subprocess.run(candidate + ["--version"], capture_output=True, timeout=5)
        YT_DLP_CMD = candidate
        break
    except Exception:
        continue

SEARCH_TIMEOUT = 8

_shared_pool = None
_timeout_pool = None
def _get_pool():
    global _shared_pool
    if _shared_pool is None:
        _shared_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    return _shared_pool

def _get_timeout_pool():
    global _timeout_pool
    if _timeout_pool is None:
        _timeout_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    return _timeout_pool

def _run_with_timeout(fn, *args, **kwargs):
    """Run any function with a timeout. Returns result or default on timeout."""
    fut = _get_timeout_pool().submit(fn, *args, **kwargs)
    try:
        return fut.result(timeout=SEARCH_TIMEOUT)
    except concurrent.futures.TimeoutError:
        return None

def get_yt():
    global _yt
    if _yt is None:
        s = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=1)
        s.mount("https://", adapter)
        _yt = YTMusic(requests_session=s)
        # Pre-warm: trigger lazy visitor ID fetch so first real search is fast
        try:
            _ = _yt.base_headers
        except Exception:
            pass
    return _yt

def search(query: str, filter_type: str = None):
    yt = get_yt()
    results = {"tracks": [], "artists": [], "albums": []}

    if filter_type == "songs" or filter_type is None:
        try:
            songs = yt.search(query, filter="songs", limit=25)
            for s in songs:
                results["tracks"].append({
                    "id": s.get("videoId", ""),
                    "title": s.get("title", ""),
                    "artist": ", ".join([a.get("name", "") for a in s.get("artists", [])]),
                    "artistId": s.get("artists", [{}])[0].get("id", "") if s.get("artists") else "",
                    "album": s.get("album", {}).get("name", "") if s.get("album") else "",
                    "albumId": s.get("album", {}).get("id", "") if s.get("album") else "",
                    "duration": s.get("duration", ""),
                    "durationSeconds": s.get("duration_seconds", 0),
                    "thumbnail": get_best_thumbnail(s.get("thumbnails", []), s.get("videoId", "")),
                    "type": "track"
                })
        except Exception as e:
            pass

    if filter_type == "artists" or filter_type is None:
        try:
            artists = yt.search(query, filter="artists", limit=10)
            for a in artists:
                results["artists"].append({
                    "id": a.get("browseId", ""),
                    "name": a.get("artist", a.get("title", "")),
                    "thumbnail": get_best_thumbnail(a.get("thumbnails", [])),
                    "subscribers": a.get("subscribers", ""),
                    "type": "artist"
                })
        except Exception as e:
            pass

    if filter_type == "albums" or filter_type is None:
        try:
            albums = yt.search(query, filter="albums", limit=10)
            for al in albums:
                results["albums"].append({
                    "id": al.get("browseId", ""),
                    "title": al.get("title", ""),
                    "artist": ", ".join([a.get("name", "") for a in al.get("artists", [])]),
                    "artistId": al.get("artists", [{}])[0].get("id", "") if al.get("artists") else "",
                    "year": al.get("year", ""),
                    "thumbnail": get_best_thumbnail(al.get("thumbnails", [])),
                    "type": "album"
                })
        except Exception as e:
            pass

    return results

def search_videos(query: str, limit: int = 6):
    yt = get_yt()
    videos = []
    try:
        results = yt.search(query, filter="videos", limit=limit)
        for v in results:
            if v.get("videoId"):
                videos.append({
                    "id": v.get("videoId", ""),
                    "title": v.get("title", ""),
                    "artist": ", ".join([a.get("name", "") for a in v.get("artists", [])]) if v.get("artists") else v.get("channel", {}).get("name", ""),
                    "thumbnail": get_best_thumbnail(v.get("thumbnails", []), v.get("videoId", "")),
                    "duration": v.get("duration", ""),
                    "viewCount": v.get("views", ""),
                    "type": "video"
                })
    except Exception:
        pass
    return videos

def get_home():
    yt = get_yt()
    result = {"trending": [], "newAlbums": [], "featuredArtists": []}

    try:
        home = _run_with_timeout(yt.get_home, 4)
        for section in home:
            title = section.get("title", "").lower()
            contents = section.get("contents", [])
            if any(k in title for k in ["trending", "top", "hot", "chart", "popular"]):
                for item in contents[:8]:
                    if item.get("videoId"):
                        result["trending"].append({
                            "id": item.get("videoId", ""),
                            "title": item.get("title", ""),
                            "artist": ", ".join([a.get("name", "") for a in item.get("artists", [])]),
                            "thumbnail": get_best_thumbnail(item.get("thumbnails", []), item.get("videoId", "")),
                            "duration": item.get("duration", ""),
                            "type": "track"
                        })
            elif any(k in title for k in ["album", "new release", "nuovi", "release"]):
                for item in contents[:6]:
                    if item.get("browseId"):
                        result["newAlbums"].append({
                            "id": item.get("browseId", ""),
                            "title": item.get("title", ""),
                            "artist": ", ".join([a.get("name", "") for a in item.get("artists", [])]),
                            "year": item.get("year", ""),
                            "thumbnail": get_best_thumbnail(item.get("thumbnails", [])),
                            "type": "album"
                        })
            elif any(k in title for k in ["artist", "artista", "recommended"]):
                for item in contents[:6]:
                    if item.get("browseId"):
                        result["featuredArtists"].append({
                            "id": item.get("browseId", ""),
                            "name": item.get("title", ""),
                            "thumbnail": get_best_thumbnail(item.get("thumbnails", [])),
                            "type": "artist"
                        })
    except Exception as e:
        pass

    if not result["trending"]:
        try:
            songs_result = _run_with_timeout(yt.search, "top hits 2025", filter="songs", limit=10)
            songs = songs_result if songs_result and isinstance(songs_result, list) else []
            for s in songs:
                result["trending"].append({"id": s.get("videoId",""), "title": s.get("title",""), "artist": ", ".join([a.get("name","") for a in s.get("artists",[])]), "thumbnail": get_best_thumbnail(s.get("thumbnails",[]), s.get("videoId","")), "duration": s.get("duration",""), "type": "track"})
        except:
            pass

    if not result["newAlbums"]:
        try:
            albums_result = _run_with_timeout(yt.search, "new album 2025", filter="albums", limit=6)
            albums = albums_result if albums_result and isinstance(albums_result, list) else []
            for al in albums:
                result["newAlbums"].append({"id": al.get("browseId",""), "title": al.get("title",""), "artist": ", ".join([a.get("name","") for a in al.get("artists",[])]), "year": al.get("year",""), "thumbnail": get_best_thumbnail(al.get("thumbnails",[])), "type": "album"})
        except:
            pass

    if not result["featuredArtists"]:
        try:
            artists_result = _run_with_timeout(yt.search, "popular artists 2025", filter="artists", limit=6)
            artists = artists_result if artists_result and isinstance(artists_result, list) else []
            for a in artists:
                result["featuredArtists"].append({"id": a.get("browseId",""), "name": a.get("artist", a.get("title","")), "thumbnail": get_best_thumbnail(a.get("thumbnails",[])), "type": "artist"})
        except:
            pass

    return result

def get_artist(artist_id: str):
    yt = get_yt()
    try:
        artist = yt.get_artist(artist_id)
    except Exception as e:
        return {"error": str(e)}

    result = {
        "id": artist_id,
        "name": artist.get("name", ""),
        "description": artist.get("description", ""),
        "views": artist.get("views", ""),
        "subscribers": artist.get("subscribers", ""),
        "thumbnail": get_best_thumbnail(artist.get("thumbnails", [])),
        "topSongs": [], "albums": [], "singles": [],
        "relatedArtists": [], "videos": [], "playlists": []
    }

    songs_data = artist.get("songs", {})
    if songs_data and songs_data.get("results"):
        for s in songs_data["results"][:10]:
            result["topSongs"].append({
                "id": s.get("videoId", ""), "title": s.get("title", ""), "artist": result["name"],
                "album": s.get("album", {}).get("name", "") if s.get("album") else "",
                "albumId": s.get("album", {}).get("id", "") if s.get("album") else "",
                "duration": s.get("duration", ""), "thumbnail": get_best_thumbnail(s.get("thumbnails", []), s.get("videoId", "")), "type": "track"
            })

    albums_data = artist.get("albums", {})
    if albums_data and albums_data.get("results"):
        for al in albums_data["results"][:10]:
            result["albums"].append({"id": al.get("browseId",""), "title": al.get("title",""), "year": al.get("year",""), "artist": result["name"], "thumbnail": get_best_thumbnail(al.get("thumbnails",[])), "type": "album"})

    singles_data = artist.get("singles", {})
    if singles_data and singles_data.get("results"):
        for s in singles_data["results"][:8]:
            result["singles"].append({"id": s.get("browseId",""), "title": s.get("title",""), "year": s.get("year",""), "artist": result["name"], "thumbnail": get_best_thumbnail(s.get("thumbnails",[])), "type": "album"})

    related_data = artist.get("related", {})
    if related_data and related_data.get("results"):
        for ra in related_data["results"][:6]:
            result["relatedArtists"].append({
                "id": ra.get("browseId", ""),
                "name": ra.get("artist", ra.get("title", "")),
                "thumbnail": get_best_thumbnail(ra.get("thumbnails", [])),
                "type": "artist"
            })

    videos_data = artist.get("videos", {})
    if videos_data and videos_data.get("results"):
        for v in videos_data["results"][:6]:
            result["videos"].append({
                "id": v.get("videoId", ""),
                "title": v.get("title", ""),
                "artist": result["name"],
                "thumbnail": get_best_thumbnail(v.get("thumbnails", []), v.get("videoId", "")),
                "duration": v.get("duration", ""),
                "viewCount": v.get("views", ""),
                "type": "track"
            })

    playlists_data = artist.get("playlists", {})
    if playlists_data and playlists_data.get("results"):
        for p in playlists_data["results"][:6]:
            result["playlists"].append({
                "id": p.get("browseId", ""),
                "title": p.get("title", ""),
                "artist": result["name"],
                "thumbnail": get_best_thumbnail(p.get("thumbnails", [])),
                "type": "album"
            })

    return result

def get_album(album_id: str):
    yt = get_yt()
    try:
        album = yt.get_album(album_id)
    except Exception as e:
        return {"error": str(e)}

    result = {
        "id": album_id, "title": album.get("title", ""),
        "artist": ", ".join([a.get("name", "") for a in album.get("artists", [])]),
        "artistId": album.get("artists", [{}])[0].get("id", "") if album.get("artists") else "",
        "year": album.get("year", ""), "description": album.get("description", ""),
        "trackCount": album.get("trackCount", 0), "duration": album.get("duration", ""),
        "thumbnail": get_best_thumbnail(album.get("thumbnails", [])), "tracks": []
    }

    for i, t in enumerate(album.get("tracks", [])):
        result["tracks"].append({
            "id": t.get("videoId", ""), "title": t.get("title", ""),
            "artist": ", ".join([a.get("name", "") for a in t.get("artists", [])]) or result["artist"],
            "duration": t.get("duration", ""), "durationSeconds": t.get("duration_seconds", 0),
            "trackNumber": i + 1, "thumbnail": result["thumbnail"],
            "album": result["title"], "albumId": album_id, "type": "track"
        })

    return result

def get_audio_url(video_id: str):
    if YT_DLP_CMD is None:
        return {"error": "yt-dlp not available"}
    url = f"https://www.youtube.com/watch?v={video_id}"
    # Try multiple format options in case one fails
    format_opts = [
        ["-f", "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio"],
        ["-f", "bestaudio"],
        ["-f", "worstaudio"],
    ]
    last_error = ""
    for fmt in format_opts:
        cmd = YT_DLP_CMD + ["--no-warnings", "--get-url", "--no-playlist"] + fmt + [url]
        for attempt in range(2):
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                if result.returncode == 0:
                    audio_url = result.stdout.strip().split('\n')[0]
                    if audio_url:
                        return {"url": audio_url, "videoId": video_id}
                else:
                    last_error = result.stderr.strip()
            except subprocess.TimeoutExpired:
                last_error = "Timeout getting audio URL"
            except Exception as e:
                last_error = str(e)
    return {"error": last_error}

def _parse_lrc(lrc_text: str):
    lines = []
    for line in lrc_text.split("\n"):
        m = re.findall(r'\[(\d+):(\d+)\.(\d+)\](.*)', line)
        if m:
            mins, secs, centis, text = m[0]
            start = int(mins) * 60 + int(secs) + int(centis) / 100
            text = text.strip()
            if text:
                lines.append({"text": text, "start": round(start, 2), "duration": 0})
    for i in range(len(lines) - 1):
        lines[i]["duration"] = round(lines[i + 1]["start"] - lines[i]["start"], 2)
    if lines:
        lines[-1]["duration"] = 3.0
    return lines

def _fetch_lrclib(title: str, artist: str, album: str, duration: int):
    try:
        params = {}
        if artist:
            params["artist_name"] = artist
        if title:
            params["track_name"] = title
        if album:
            params["album_name"] = album
        if duration:
            params["duration"] = duration
        if not params:
            return None
        resp = requests.get("https://lrclib.net/api/get", params=params, timeout=3)
        if resp.status_code == 200:
            data = resp.json()
            synced = data.get("syncedLyrics")
            if synced:
                return {"lyrics": _parse_lrc(synced), "source": "lrclib.net", "hasTimestamps": True}
            plain = data.get("plainLyrics")
            if plain:
                return {"lyrics": plain, "source": "lrclib.net", "hasTimestamps": False}
    except Exception:
        pass
    return None

def _yt_with_timeout(fn, timeout=10):
    result = [None]
    done = [False]
    def worker():
        try:
            result[0] = fn()
        except Exception:
            pass
        done[0] = True
    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=timeout)
    if not done[0]:
        return None
    return result[0]

def get_lyrics(video_id: str, title: str = "", artist: str = "", album: str = "", duration: int = 0):
    """
    Fetch lyrics using lrclib first (fast) and fall back to ytmusicapi if needed.
    Implement an adaptive timeout strategy and simple caching to reduce delays
    on repeated requests. Some tracks have slow or missing YouTube Music
    lyric lookups; prefer lrclib and only query ytmusicapi when lrclib fails.
    """
    # First attempt: lrclib (fast, third-party) with short timeout
    try:
        # A small guarded call to lrclib; it's usually quick and gives timestamps
        # when available. Wrap in _run_with_timeout to avoid blocking the worker
        # thread if lrclib stalls for some reason.
        r = _run_with_timeout(lambda: _fetch_lrclib(title, artist, album, duration))
        if r and r.get("lyrics"):
            return r
    except Exception:
        pass

    # Second attempt: try ytmusicapi watch -> lyrics but with adaptive smaller timeouts
    try:
        yt = get_yt()
        watch = _yt_with_timeout(lambda: yt.get_watch_playlist(video_id), timeout=4)
        if watch:
            browse_id = watch.get("lyrics")
            if browse_id:
                # Try to fetch lyrics with a smaller timeout first, then a longer if needed
                data = _yt_with_timeout(lambda: yt.get_lyrics(browse_id), timeout=6)
                if data:
                    if data.get("hasTimestamps"):
                        lines = data.get("lyrics", [])
                        result_lines = []
                        for l in lines:
                            # l may be an object or dict
                            try:
                                start = getattr(l, "start", l.get("start") if isinstance(l, dict) else 0)
                                text = getattr(l, "text", l.get("text") if isinstance(l, dict) else str(l))
                                dur = getattr(l, "duration", l.get("duration") if isinstance(l, dict) else 0)
                            except Exception:
                                start = 0; text = str(l); dur = 0
                            result_lines.append({"text": text, "start": start, "duration": dur})
                        return {"lyrics": result_lines, "source": data.get("source", "ytmusic"), "hasTimestamps": True}
                    else:
                        text = data.get("lyrics", "")
                        if text:
                            return {"lyrics": text, "source": data.get("source", "ytmusic"), "hasTimestamps": False}
    except Exception:
        pass

    # Last-resort: return no lyrics quickly to avoid blocking the UI
    return {"lyrics": None, "source": None, "hasTimestamps": False}

def detect_platform(url: str):
    if "open.spotify.com" in url or "spotify.com" in url:
        return "spotify"
    if "music.apple.com" in url or "apple.com" in url:
        return "apple_music"
    if "music.amazon.com" in url or "amazon." in url and "/music" in url:
        return "amazon_music"
    if "music.youtube.com" in url or "youtube.com/playlist" in url:
        return "youtube_music"
    return None

def extract_ytmusic_playlist_id(url: str):
    import re
    m = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', url)
    if m:
        return m.group(1)
    m = re.search(r'browse/(VL[a-zA-Z0-9_-]+)', url)
    if m:
        return m.group(1)
    return None

def import_ytmusic_playlist(playlist_id: str):
    yt = get_yt()
    try:
        pl = yt.get_playlist(playlist_id, limit=None)
    except Exception as e:
        return {"error": f"Errore nel recupero della playlist YouTube Music: {str(e)[:200]}"}

    raw = pl.get("tracks", [])
    if not raw:
        return {"error": "Nessun brano trovato nella playlist YouTube Music."}

    found = []
    for t in raw:
        vid = t.get("videoId", "")
        if not vid:
            continue
        found.append({
            "id": vid,
            "title": t.get("title", ""),
            "artist": ", ".join([a.get("name", "") for a in t.get("artists", [])]),
            "artistId": t.get("artists", [{}])[0].get("id", "") if t.get("artists") else "",
            "album": t.get("album", {}).get("name", "") if t.get("album") else "",
            "albumId": t.get("album", {}).get("id", "") if t.get("album") else "",
            "duration": t.get("duration", ""),
            "durationSeconds": t.get("duration_seconds", 0),
            "thumbnail": get_best_thumbnail(t.get("thumbnails", []) or t.get("thumbnail", []), t.get("videoId", "")),
            "type": "track"
        })

    return {"tracks": found, "errors": [], "total": len(raw), "found": len(found)}

def _spotify_parse_embed_page(playlist_id: str):
    """Fetch Spotify embed page and extract tracks + token from __NEXT_DATA__."""
    try:
        r = requests.get(
            f"https://open.spotify.com/embed/playlist/{playlist_id}",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15
        )
        if r.status_code != 200:
            print(f"[Spotify] Embed page returned {r.status_code}", file=sys.stderr)
            return None, None, 0, ""

        m = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
        if not m:
            print("[Spotify] __NEXT_DATA__ not found in embed page", file=sys.stderr)
            return None, None, 0, ""

        data = json.loads(m.group(1))
        state = data.get("props", {}).get("pageProps", {}).get("state", {})

        # Extract any access token (anonymous or not)
        token = None
        session = state.get("settings", {}).get("session", {})
        if session.get("accessToken"):
            token = session["accessToken"]
        if not token:
            # Try alternative locations for the token
            for key in ("accessToken", "token"):
                token = state.get(key) or state.get("session", {}).get(key)

        # Extract tracks and metadata from the embed page state
        tracks = []
        total_tracks = 0
        playlist_name = ""
        playlist_thumbnail = ""

        # Path 1 (most common): state.data.entity.trackList
        entity = state.get("data", {}).get("entity") or {}
        playlist_name = entity.get("name") or entity.get("title", "")
        cover_art = entity.get("coverArt") or {}
        cover_sources = cover_art.get("sources") or []
        if cover_sources:
            playlist_thumbnail = cover_sources[0].get("url", "")
        raw_track_list = entity.get("trackList") or []
        if raw_track_list:
            # Handle both list format and object format ({items: [...], totalCount: N})
            if isinstance(raw_track_list, dict):
                track_items = raw_track_list.get("items", [])
                total_tracks = raw_track_list.get("totalCount") or 0
            else:
                track_items = raw_track_list
                total_tracks = entity.get("totalCount") or 0
            # Convert embed track format to match API format: {"track": {"id": ..., "name": ..., "artists": [...], "duration_ms": ...}}
            for item in track_items:
                uri = item.get("uri", "")
                tid = uri.replace("spotify:track:", "") if uri else ""
                artists = []
                subtitle = item.get("subtitle", "")
                if subtitle:
                    for name in subtitle.split(","):
                        name = name.strip()
                        if name:
                            artists.append({"name": name})
                tracks.append({
                    "track": {
                        "id": tid,
                        "uri": uri,
                        "name": item.get("title", ""),
                        "artists": artists,
                        "album": {"name": ""},
                        "duration_ms": item.get("duration", 0),
                    }
                })
            if not total_tracks:
                total_tracks = len(track_items)

        # Path 2: state.playlist → tracks in the playlist object
        if not tracks:
            playlist = state.get("playlist") or {}
            if playlist.get("tracks"):
                raw = playlist["tracks"].get("items") or []
                for item in raw:
                    if isinstance(item, dict) and "track" in item:
                        tracks.append(item)
                total_tracks = playlist["tracks"].get("total") or len(tracks)

        # Path 3: state.entities.playlists.{id}
        if not tracks:
            entities = state.get("entities") or {}
            pl = entities.get("playlists", {}).get(playlist_id) or {}
            if pl.get("tracks"):
                raw = pl["tracks"].get("items") or []
                for item in raw:
                    if isinstance(item, dict) and "track" in item:
                        tracks.append(item)
                total_tracks = pl["tracks"].get("total") or len(tracks)

        # Ensure total_tracks reflects the real playlist size, not just loaded tracks
        if entity.get("totalCount") and total_tracks < entity["totalCount"]:
            total_tracks = entity["totalCount"]
        # Fallback: check Path 2/Path 3 data for the real total even when Path 1 succeeded
        if not total_tracks or (tracks and total_tracks <= len(tracks)):
            pl_state = state.get("playlist", {})
            if pl_state.get("tracks", {}).get("total"):
                total_tracks = pl_state["tracks"]["total"]
            else:
                pl_entity = state.get("entities", {}).get("playlists", {}).get(playlist_id, {})
                if pl_entity.get("tracks", {}).get("total"):
                    total_tracks = pl_entity["tracks"]["total"]

        return tracks, token, total_tracks, playlist_name, playlist_thumbnail
    except Exception:
        return None, None, 0, "", ""

def _spotify_normalize_tracks(raw_items):
    """Normalize track items to always have {'track': {...}} format."""
    result = []
    seen = set()
    for item in raw_items or []:
        if not isinstance(item, dict):
            continue
        if "track" in item:
            track = item["track"]
        else:
            track = item
            item = {"track": track}
        tid = track.get("id") or track.get("uri", "")
        if tid and tid not in seen:
            seen.add(tid)
            result.append(item)
    return result

def _spotify_fetch_via_ytdlp(playlist_id: str):
    """Fetch all tracks from Spotify using yt-dlp as fallback."""
    if YT_DLP_CMD is None:
        return None
    try:
        url = f"https://open.spotify.com/playlist/{playlist_id}"
        print(f"[Spotify yt-dlp] Running: {' '.join(YT_DLP_CMD)} --flat-playlist ... {url}", file=sys.stderr)
        result = subprocess.run(
            YT_DLP_CMD + ["--flat-playlist", "--dump-json", "--skip-download", "--no-warnings", url],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            print(f"[Spotify yt-dlp] Failed (code {result.returncode}): {result.stderr[:300]}", file=sys.stderr)
            return None
        raw = []
        for line in result.stdout.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                raw.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        if not raw:
            return None
        # Convert yt-dlp output to internal format: {"track": {"id": ..., "name": ..., "artists": [...], "album": {...}}}
        converted = []
        seen = set()
        for t in raw:
            tid = t.get("id", "")
            if not tid or tid in seen:
                continue
            seen.add(tid)
            artists = []
            artist_str = t.get("artist", t.get("uploader", ""))
            if artist_str:
                for name in artist_str.split(";"):
                    name = name.strip()
                    if name:
                        artists.append({"name": name})
            album_name = t.get("album", t.get("album_title", ""))
            converted.append({
                "track": {
                    "id": tid,
                    "uri": f"spotify:track:{tid}",
                    "name": t.get("title", ""),
                    "artists": artists,
                    "album": {"name": album_name} if album_name else {},
                    "duration_ms": t.get("duration", 0) or 0,
                }
            })
        return converted
    except Exception:
        return None

def _spotify_fetch_tracks(playlist_id: str, max_retries: int = 3):
    """Fetch all tracks from Spotify, extracting from embed page directly when possible.
    Falls back to yt-dlp if the embed/API approach can't get all tracks.
    Returns (tracks_or_None, error_or_None, playlist_name, playlist_thumb)."""
    embed_tracks, token, embed_total, playlist_name, playlist_thumb = _spotify_parse_embed_page(playlist_id)
    total_known = embed_total or 0
    print(f"[Spotify] Embed page: tracks={len(embed_tracks) if embed_tracks else 0}, token={'yes' if token else 'no'}, total={total_known}", file=sys.stderr)

    # Normalize embed tracks early
    all_tracks = _spotify_normalize_tracks(embed_tracks)

    # Query the real playlist total from the API (embed total is often capped at 100)
    if token:
        try:
            r = requests.get(
                f"https://api.spotify.com/v1/playlists/{playlist_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "Mozilla/5.0",
                },
                timeout=15
            )
            if r.status_code == 200:
                real_total = r.json().get("tracks", {}).get("total", 0)
                if real_total > total_known:
                    total_known = real_total
            elif r.status_code in (401, 403):
                # Token expired, get a fresh one
                new_token = _spotify_parse_embed_page(playlist_id)[1]
                if new_token:
                    token = new_token
        except Exception:
            pass

    # If embed page gave us ALL tracks (verified by API total), return immediately
    if all_tracks and total_known > 0 and len(all_tracks) >= total_known:
        return all_tracks, None, playlist_name, playlist_thumb

    # Try API pagination with anonymous token if we have it
    if token:
        api_headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "Mozilla/5.0",
            "Origin": "https://open.spotify.com",
            "Referer": f"https://open.spotify.com/embed/playlist/{playlist_id}",
        }

        offset = len(all_tracks)
        limit = 50
        rate_limited = False
        auth_failed = False

        for attempt in range(max_retries):
            rate_limited = False
            auth_failed = False
            try:
                while True:
                    if total_known > 0 and offset >= total_known:
                        break
                    r = requests.get(
                        f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit={limit}&offset={offset}",
                        headers=api_headers,
                        timeout=15
                    )
                    if r.status_code == 429:
                        retry_after = int(r.headers.get("Retry-After", 5))
                        if retry_after > 30:
                            rate_limited = True
                            break
                        time.sleep(min(retry_after, 5))
                        continue
                    if r.status_code in (401, 403):
                        auth_failed = True
                        break
                    if r.status_code != 200:
                        break

                    data = r.json()
                    items = data.get("items", [])
                    if not items:
                        break
                    all_tracks.extend(_spotify_normalize_tracks(items))
                    total_known = data.get("total") or total_known
                    offset += limit
                    # Refresh token periodically to prevent expiration during long paginations
                    if len(all_tracks) % 200 == 0 and len(all_tracks) > 0:
                        try:
                            new_token = _spotify_parse_embed_page(playlist_id)[1]
                            if new_token:
                                api_headers["Authorization"] = f"Bearer {new_token}"
                        except Exception:
                            pass

                if rate_limited or auth_failed:
                    if attempt < max_retries - 1:
                        time.sleep(10 if rate_limited else 3)
                        new_token = _spotify_parse_embed_page(playlist_id)[1]
                        if new_token:
                            api_headers["Authorization"] = f"Bearer {new_token}"
                        continue
                else:
                    break
            except Exception:
                if all_tracks and attempt >= max_retries - 1:
                    break
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                if not all_tracks:
                    yt = _spotify_fetch_via_ytdlp(playlist_id)
                    if yt:
                        return yt, None, playlist_name, playlist_thumb
                    return None, "Errore di connessione a Spotify.", "", ""

    # Check if API pagination got all tracks
    if all_tracks and total_known > 0 and len(all_tracks) >= total_known:
        return all_tracks, None, playlist_name, playlist_thumb

    # Fallback: use yt-dlp when embed+API couldn't fetch all tracks
    print(f"[Spotify] Trying yt-dlp fallback (got {len(all_tracks)} tracks so far)...", file=sys.stderr)
    yt_tracks = _spotify_fetch_via_ytdlp(playlist_id)
    if yt_tracks:
        print(f"[Spotify] yt-dlp returned {len(yt_tracks)} tracks", file=sys.stderr)
        return yt_tracks, None, playlist_name, playlist_thumb

    # Return whatever we got from embed/API
    if all_tracks:
        return all_tracks, None, playlist_name, playlist_thumb
    return None, "Impossibile ottenere i brani della playlist Spotify. L'embed page potrebbe aver cambiato struttura o yt-dlp non è installato.", "", ""

def import_spotify_playlist(url: str):
    m = re.search(r'playlist[/=]([a-zA-Z0-9]+)', url)
    if not m:
        return {"error": "URL Spotify non valido. Assicurati che il link contenga '/playlist/' seguito dall'ID."}
    playlist_id = m.group(1)
    if len(playlist_id) < 5:
        return {"error": f"ID playlist troppo corto ('{playlist_id}'). Il link potrebbe essere troncato. Incolla l'intero URL."}

    print(f"[Spotify Import] Starting import for playlist_id={playlist_id}", file=sys.stderr)
    raw_tracks, err, pl_name, pl_thumb = _spotify_fetch_tracks(playlist_id)
    if err:
        print(f"[Spotify Import] Fetch failed: {err}", file=sys.stderr)
        return {"error": err}
    if not raw_tracks:
        return {"error": "La playlist è vuota o non è stato possibile leggerne i brani."}
    print(f"[Spotify Import] Fetched {len(raw_tracks)} tracks from Spotify, searching on YouTube Music...", file=sys.stderr)

    yt = get_yt()
    pool = _get_pool()

    def _search_track(item):
        t = item.get("track")
        if not t or not t.get("id"):
            return None
        title = t.get("name", "")
        artists = ", ".join([a.get("name", "") for a in t.get("artists", [])])
        album = t.get("album", {}) or {}
        duration_ms = t.get("duration_ms", 0) or 0

        queries = [f"{title} {artists}" if artists else title, title]
        title_words = title.split()[:3]
        first_artist = artists.split(",")[0].strip() if artists else ""
        if first_artist and title_words:
            queries.append(f"{' '.join(title_words)} {first_artist}")

        for q in queries:
            for attempt in range(2):
                try:
                    songs_result = _run_with_timeout(yt.search, q, filter="songs", limit=1)
                    songs = [songs_result] if songs_result and isinstance(songs_result, list) else songs_result or []
                    if songs and songs[0].get("videoId"):
                        s = songs[0]
                        return {
                            "id": s.get("videoId", ""),
                            "title": s.get("title", title),
                            "artist": ", ".join([a.get("name", "") for a in s.get("artists", [])]) or artists,
                            "artistId": s.get("artists", [{}])[0].get("id", "") if s.get("artists") else "",
                            "album": s.get("album", {}).get("name", "") if s.get("album") else album.get("name", ""),
                            "albumId": s.get("album", {}).get("id", "") if s.get("album") else album.get("id", ""),
                            "duration": s.get("duration", ""),
                            "durationSeconds": s.get("duration_seconds", 0) or duration_ms // 1000,
                            "thumbnail": get_best_thumbnail(s.get("thumbnails", []), s.get("videoId", "")),
                            "type": "track"
                        }
                except Exception:
                    pass
                if attempt == 0:
                    time.sleep(1)
        return None

    future_to_idx = {}
    for idx, item in enumerate(raw_tracks):
        if item.get("track") and item["track"].get("id"):
            future_to_idx[pool.submit(_search_track, item)] = idx

    results = {}
    for future in concurrent.futures.as_completed(future_to_idx):
        idx = future_to_idx[future]
        results[idx] = future.result()

    found = []
    errors = []
    for idx in range(len(raw_tracks)):
        r = results.get(idx)
        if r:
            found.append(r)
        else:
            item = raw_tracks[idx]
            t = item.get("track", {})
            title = t.get("name", "") if t else ""
            artists = ", ".join([a.get("name", "") for a in t.get("artists", [])]) if t else ""
            errors.append(f"{title} - {artists}")

    return {"tracks": found, "errors": errors, "total": len(raw_tracks), "found": len(found), "playlistName": pl_name, "playlistThumbnail": pl_thumb}

def import_playlist(url: str):
    platform = detect_platform(url)
    if not platform:
        return {"error": "URL non supportato. Usa link da Spotify, Apple Music, Amazon Music o YouTube Music."}

    # Use ytmusicapi directly for YouTube Music
    if platform == "youtube_music":
        pl_id = extract_ytmusic_playlist_id(url)
        if pl_id:
            return import_ytmusic_playlist(pl_id)
        return {"error": "Impossibile estrarre l'ID della playlist YouTube Music."}

    # Use embedded anonymous token for Spotify (no login required)
    if platform == "spotify":
        # Pre-check yt-dlp availability since it's the fallback for Spotify
        if YT_DLP_CMD is not None:
            try:
                subprocess.run(YT_DLP_CMD + ["--version"], capture_output=True, timeout=5)
            except Exception:
                pass
        return import_spotify_playlist(url)

    if YT_DLP_CMD is None:
        return {"error": "yt-dlp not available. Non è possibile importare questa playlist."}
    try:
        result = subprocess.run(
            YT_DLP_CMD + ["--flat-playlist", "--dump-json", "--skip-download", "--no-warnings", url],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            err_msg = result.stderr.strip()[:500]
            if "DRM" in err_msg:
                return {"error": "Il link contiene contenuti protetti da DRM. Prova con un link YouTube Music direttamente."}
            return {"error": f"yt-dlp error: {err_msg}"}

        raw_tracks = []
        for line in result.stdout.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                raw_tracks.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        if not raw_tracks:
            return {"error": "Nessun brano trovato nella playlist."}

        yt = get_yt()
        pool = _get_pool()

        def _search_ytdlp_track(t):
            title = t.get("title", "")
            artist = t.get("artist", t.get("uploader", t.get("channel", "")))
            query = f"{title} {artist}" if artist else title
            try:
                songs = yt.search(query, filter="songs", limit=1)
                if songs and songs[0].get("videoId"):
                    s = songs[0]
                    return {
                        "id": s.get("videoId", ""),
                        "title": s.get("title", title),
                        "artist": ", ".join([a.get("name", "") for a in s.get("artists", [])]) or artist,
                        "artistId": s.get("artists", [{}])[0].get("id", "") if s.get("artists") else "",
                        "album": s.get("album", {}).get("name", "") if s.get("album") else "",
                        "albumId": s.get("album", {}).get("id", "") if s.get("album") else "",
                        "duration": s.get("duration", ""),
                        "durationSeconds": s.get("duration_seconds", 0),
                        "thumbnail": get_best_thumbnail(s.get("thumbnails", []), s.get("videoId", "")),
                        "type": "track"
                    }
            except Exception:
                pass
            return None

        future_to_idx = {}
        for idx, t in enumerate(raw_tracks):
            future_to_idx[pool.submit(_search_ytdlp_track, t)] = idx

        results = {}
        for future in concurrent.futures.as_completed(future_to_idx):
            idx = future_to_idx[future]
            results[idx] = future.result()

        found = []
        errors = []
        for idx in range(len(raw_tracks)):
            r = results.get(idx)
            if r:
                found.append(r)
            else:
                t = raw_tracks[idx]
                title = t.get("title", "")
                artist = t.get("artist", t.get("uploader", t.get("channel", "")))
                errors.append(f"{title} {artist}" if artist else title)

        return {"tracks": found, "errors": errors, "total": len(raw_tracks), "found": len(found)}

    except subprocess.TimeoutExpired:
        return {"error": "Timeout durante l'importazione della playlist (60s)"}
    except Exception as e:
        return {"error": str(e)[:500]}

def get_best_thumbnail(thumbnails: list, video_id: str = "") -> str:
    if not thumbnails:
        if video_id:
            return f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
        return ""
    # thumbnails can be a list of dicts or sometimes a single dict
    if isinstance(thumbnails, dict):
        thumbnails = [thumbnails]
    # Filter out entries without url
    valid = [t for t in thumbnails if t.get("url")]
    if not valid:
        if video_id:
            return f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
        return ""
    largest = max(valid, key=lambda x: x.get("width", 0) or 0)
    url = largest.get("url", "")
    # Ensure absolute URL
    if url.startswith("//"):
        url = "https:" + url
    return url

def _search_songs(yt, query):
    """Search songs for search_all - runs in thread pool."""
    tracks = []
    try:
        songs = yt.search(query, filter="songs", limit=25)
        for s in songs:
            tracks.append({
                "id": s.get("videoId", ""),
                "title": s.get("title", ""),
                "artist": ", ".join([a.get("name", "") for a in s.get("artists", [])]),
                "artistId": s.get("artists", [{}])[0].get("id", "") if s.get("artists") else "",
                "album": s.get("album", {}).get("name", "") if s.get("album") else "",
                "albumId": s.get("album", {}).get("id", "") if s.get("album") else "",
                "duration": s.get("duration", ""),
                "durationSeconds": s.get("duration_seconds", 0),
                "thumbnail": get_best_thumbnail(s.get("thumbnails", [])),
                "type": "track"
            })
    except Exception:
        pass
    return tracks

def _search_songs_limited(yt, query):
    """Lightweight song search for suggestions - fewer results, faster."""
    tracks = []
    try:
        songs = yt.search(query, filter="songs", limit=5)
        for s in songs:
            tracks.append({
                "id": s.get("videoId", ""),
                "title": s.get("title", ""),
                "artist": ", ".join([a.get("name", "") for a in s.get("artists", [])]),
                "artistId": s.get("artists", [{}])[0].get("id", "") if s.get("artists") else "",
                "album": s.get("album", {}).get("name", "") if s.get("album") else "",
                "albumId": s.get("album", {}).get("id", "") if s.get("album") else "",
                "duration": s.get("duration", ""),
                "durationSeconds": s.get("duration_seconds", 0),
                "thumbnail": get_best_thumbnail(s.get("thumbnails", [])),
                "type": "track"
            })
    except Exception:
        pass
    return tracks

def _search_artists_limited(yt, query):
    """Lightweight artist search for suggestions - fewer results, faster."""
    artists = []
    try:
        raw = yt.search(query, filter="artists", limit=3)
        for a in raw:
            artists.append({
                "id": a.get("browseId", ""),
                "name": a.get("artist", a.get("title", "")),
                "thumbnail": get_best_thumbnail(a.get("thumbnails", [])),
                "subscribers": a.get("subscribers", ""),
                "type": "artist"
            })
    except Exception:
        pass
    return artists

def _search_artists(yt, query):
    """Search artists for search_all."""
    artists = []
    try:
        raw = yt.search(query, filter="artists", limit=10)
        for a in raw:
            artists.append({
                "id": a.get("browseId", ""),
                "name": a.get("artist", a.get("title", "")),
                "thumbnail": get_best_thumbnail(a.get("thumbnails", [])),
                "subscribers": a.get("subscribers", ""),
                "type": "artist"
            })
    except Exception:
        pass
    return artists

def _search_albums(yt, query):
    """Search albums for search_all."""
    albums = []
    try:
        raw = yt.search(query, filter="albums", limit=10)
        for al in raw:
            albums.append({
                "id": al.get("browseId", ""),
                "title": al.get("title", ""),
                "artist": ", ".join([a.get("name", "") for a in al.get("artists", [])]),
                "artistId": al.get("artists", [{}])[0].get("id", "") if al.get("artists") else "",
                "year": al.get("year", ""),
                "thumbnail": get_best_thumbnail(al.get("thumbnails", [])),
                "type": "album"
            })
    except Exception:
        pass
    return albums

def search_all(query: str):
    """Single function that fetches songs, artists, and albums in parallel."""
    # Check disk cache first
    cached = _get_cached_search(query)
    if cached is not None:
        return cached

    yt = get_yt()
    results = {"tracks": [], "artists": [], "albums": []}

    pool = _get_pool()
    f_songs = pool.submit(_search_songs, yt, query)
    f_artists = pool.submit(_search_artists, yt, query)
    f_albums = pool.submit(_search_albums, yt, query)
    # additional broader queries to surface related artist/album matches
    f_songs_alt = pool.submit(_search_songs, yt, query + " official")
    f_artists_alt = pool.submit(_search_artists, yt, query + " official")

    for f in [f_songs, f_artists, f_albums, f_songs_alt, f_artists_alt]:
        try:
            f.result(timeout=SEARCH_TIMEOUT)
        except concurrent.futures.TimeoutError:
            pass

    # merge deduplicated results, prefer primary queries first
    def merge_unique(primary, *others, key=lambda x: x.get('id')):
        seen = set()
        out = []
        for arr in (primary, ) + others:
            if not arr: continue
            for it in arr:
                k = key(it)
                if not k: continue
                if k in seen: continue
                seen.add(k)
                out.append(it)
        return out

    results["tracks"] = merge_unique(f_songs.result() if f_songs.done() else [], f_songs_alt.result() if f_songs_alt.done() else [])
    results["artists"] = merge_unique(f_artists.result() if f_artists.done() else [], f_artists_alt.result() if f_artists_alt.done() else [])
    results["albums"] = merge_unique(f_albums.result() if f_albums.done() else [])

    # Save to disk cache
    _set_cached_search(query, results)
    return results


def search_quick(query: str):
    """Lightweight search for autocomplete suggestions - only songs+artists, no 'official' variants, lower limits."""
    cached = _get_cached_search(query)
    if cached is not None:
        return cached

    yt = get_yt()
    results = {"tracks": [], "artists": [], "albums": []}

    pool = _get_pool()
    f_songs = pool.submit(_search_songs_limited, yt, query)
    f_artists = pool.submit(_search_artists_limited, yt, query)

    for f in [f_songs, f_artists]:
        try:
            f.result(timeout=SEARCH_TIMEOUT)
        except concurrent.futures.TimeoutError:
            pass

    results["tracks"] = f_songs.result() if f_songs.done() else []
    results["artists"] = f_artists.result() if f_artists.done() else []

    _set_cached_search(query, results)
    return results


def search_suggestions_fast(query: str):
    """Ultra-fast autocomplete: uses YouTube's native search_suggestions endpoint (single POST)."""
    yt = get_yt()
    try:
        suggestions = yt.get_search_suggestions(query, detailed_runs=False)
        return {"suggestions": suggestions[:10]}
    except Exception:
        return {"suggestions": []}

def handle_request(action: str, args: dict):
    if action == "search":
        return search(args.get("query", ""), args.get("filter"))
    elif action == "search_all":
        return search_all(args.get("query", ""))
    elif action == "search_quick":
        return search_quick(args.get("query", ""))
    elif action == "search_suggestions_fast":
        return search_suggestions_fast(args.get("query", ""))
    elif action == "prefetch":
        queries = args.get("queries", [])
        # Search in parallel using lightweight search (search_quick) instead of search_all
        yt = get_yt()
        def _prefetch_one(q):
            cached = _get_cached_search(q)
            if cached is None:
                search_quick(q)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            pool.map(_prefetch_one, queries[:6])
        return {"ok": True, "cached": len(queries[:6])}
    elif action == "home":
        return get_home()
    elif action == "artist":
        return get_artist(args.get("id", ""))
    elif action == "album":
        return get_album(args.get("id", ""))
    elif action == "audio_url":
        return get_audio_url(args.get("videoId", ""))
    elif action == "import_playlist":
        return import_playlist(args.get("url", ""))
    elif action == "search_videos":
        return search_videos(args.get("query", ""), args.get("limit", 6))
    elif action == "get_lyrics":
        return get_lyrics(
            args.get("videoId", ""),
            title=args.get("title", ""),
            artist=args.get("artist", ""),
            album=args.get("album", ""),
            duration=args.get("duration", 0),
        )
    elif action == "clear_search_cache":
        return clear_search_cache()
    elif action == "ping":
        return {"pong": True}
    else:
        return {"error": f"Unknown action: {action}"}

def cli_mode():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: ytmusic_api.py <action> <args_json>"}))
        sys.exit(1)
    action = sys.argv[1]
    try:
        args = json.loads(sys.argv[2])
    except:
        args = {}
    try:
        result = handle_request(action, args)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))

def worker_mode():
    pre_warmed = False
    import threading
    _stdout_lock = threading.Lock()

    def _handle_one(msg):
        try:
            result = handle_request(msg["action"], msg["args"])
            response = json.dumps({"id": msg["id"], "result": result}, ensure_ascii=False)
            with _stdout_lock:
                sys.stdout.write(response + "\n")
                sys.stdout.flush()
        except Exception as e:
            error_response = json.dumps({"id": msg.get("id", 0), "error": str(e)[:500]}, ensure_ascii=False)
            with _stdout_lock:
                sys.stdout.write(error_response + "\n")
                sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)

            if not pre_warmed:
                _ = get_yt()
                pre_warmed = True

            threading.Thread(target=_handle_one, args=(msg,), daemon=True).start()
        except Exception as e:
            error_response = json.dumps({"id": 0, "error": str(e)[:500]}, ensure_ascii=False)
            with _stdout_lock:
                sys.stdout.write(error_response + "\n")
                sys.stdout.flush()
    _save_search_cache()

if __name__ == "__main__":
    if "--worker" in sys.argv:
        worker_mode()
    else:
        cli_mode()
