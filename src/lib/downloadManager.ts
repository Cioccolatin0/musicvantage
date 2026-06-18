const DB_NAME = "musicvantage-offline";
const DB_VERSION = 2;
const META_STORE = "metadata";
const CACHE_NAME = "offline-audio-v1";

export type DownloadedTrack = {
  trackId: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  thumbnail: string;
  duration?: string;
  durationSeconds?: number;
  downloadedAt: number;
  size: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: "trackId" });
        store.createIndex("downloadedAt", "downloadedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveMetadata(track: DownloadedTrack): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      const store = tx.objectStore(META_STORE);
      store.put(track);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
}

function deleteMetadata(trackId: string): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      const store = tx.objectStore(META_STORE);
      store.delete(trackId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
}

function getAllMetadata(): Promise<DownloadedTrack[]> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const tracks = req.result as DownloadedTrack[];
        tracks.sort((a, b) => b.downloadedAt - a.downloadedAt);
        resolve(tracks);
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  });
}

function getMetadata(trackId: string): Promise<DownloadedTrack | undefined> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(trackId);
      req.onsuccess = () => { db.close(); resolve(req.result ?? undefined); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  });
}

function audioCacheUrl(trackId: string): string {
  return `/offline-audio/${trackId}`;
}

async function ensureCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function storeAudioInCache(trackId: string, blob: Blob): Promise<void> {
  const cache = await ensureCache();
  if (!cache) throw new Error("Cache API non disponibile");

  try {
    const response = new Response(blob, {
      headers: {
        "Content-Type": blob.type || "audio/mpeg",
        "Content-Length": blob.size.toString(),
      },
    });
    await cache.put(audioCacheUrl(trackId), response);
  } catch (cacheErr) {
    // iOS PWA Cache API may fail for large files - try with a smaller cache name
    try {
      const fallbackCache = await caches.open("offline-audio-fallback-v1");
      const response = new Response(blob, {
        headers: {
          "Content-Type": blob.type || "audio/mpeg",
          "Content-Length": blob.size.toString(),
        },
      });
      await fallbackCache.put(audioCacheUrl(trackId), response);
    } catch {
      throw new Error("Impossibile salvare l'audio per l'ascolto offline. Spazio insufficiente.");
    }
  }
}

async function getAudioFromCache(trackId: string): Promise<Blob | null> {
  try {
    // Try main cache first, then fallback
    for (const cacheName of [CACHE_NAME, "offline-audio-fallback-v1"]) {
      const cache = await caches.open(cacheName);
      const response = await cache.match(audioCacheUrl(trackId));
      if (response) return await response.blob();
    }
    return null;
  } catch {
    return null;
  }
}

async function removeAudioFromCache(trackId: string): Promise<void> {
  for (const cacheName of [CACHE_NAME, "offline-audio-fallback-v1"]) {
    try {
      const cache = await caches.open(cacheName);
      await cache.delete(audioCacheUrl(trackId));
    } catch {}
  }
}

export async function downloadTrack(
  track: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration?: string;
    durationSeconds?: number;
    artistId?: string;
    album?: string;
    albumId?: string;
  },
  onProgress?: (pct: number) => void
): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/audio-proxy/${track.id}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Impossibile scaricare il brano");
  }

  let blob: Blob;

  // Try streaming read first (shows progress), fall back to blob if streaming fails
  try {
    const reader = response.body!.getReader();
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.round((received / contentLength) * 100));
      }
    }

    blob = new Blob(chunks as BlobPart[], { type: response.headers.get("content-type") || "audio/mpeg" });
  } catch {
    // Streaming failed (common on iOS PWA) - try reading as blob directly
    if (onProgress) onProgress(50);
    blob = await response.blob();
    if (onProgress) onProgress(100);
  }

  await storeAudioInCache(track.id, blob);

  await saveMetadata({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    artistId: track.artistId,
    album: track.album,
    albumId: track.albumId,
    thumbnail: track.thumbnail,
    duration: track.duration,
    durationSeconds: track.durationSeconds,
    downloadedAt: Date.now(),
    size: blob.size,
  });
}

export async function removeDownload(trackId: string): Promise<void> {
  await removeAudioFromCache(trackId);
  await deleteMetadata(trackId);
}

export async function getDownloadedTracks(): Promise<DownloadedTrack[]> {
  return getAllMetadata();
}

export async function isDownloaded(trackId: string): Promise<boolean> {
  const meta = await getMetadata(trackId);
  return !!meta;
}

export async function getTotalDownloadSize(): Promise<number> {
  const tracks = await getAllMetadata();
  return tracks.reduce((sum, t) => sum + (t.size || 0), 0);
}

export async function getOfflineAudioBlob(trackId: string): Promise<Blob | null> {
  return getAudioFromCache(trackId);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDownloadDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
