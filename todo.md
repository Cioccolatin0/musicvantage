# MusicStream TODO

## Backend
- [x] Script Python per API YouTube Music (innertube/ytmusicapi)
- [x] Endpoint tRPC: ricerca brani/artisti/album
- [x] Endpoint tRPC: home trending/nuovi album/artisti consigliati
- [x] Endpoint tRPC: dettaglio artista (biografia, discografia, brani popolari)
- [x] Endpoint tRPC: dettaglio album (tracklist, copertina)
- [x] Timeout manuale per chiamate Python (30s con SIGKILL)
- [x] Streaming audio: YouTube IFrame API (yt-dlp bloccato da bot check YouTube 2026)

## Frontend
- [x] Layout dark mode con accenti viola/rosa neon e tipografia bold
- [x] Navbar con barra di ricerca funzionante
- [x] Home page con trending, album recenti, artisti consigliati (dati reali)
- [x] Pagina risultati ricerca con tab Tutti/Brani/Artisti/Album
- [x] Pagina dettaglio Artista (banner, top songs, discografia, singoli)
- [x] Pagina dettaglio Album (copertina, tracklist completa, descrizione)
- [x] Player musicale persistente in basso con YouTube IFrame API
- [x] Controlli player: play/pausa, avanti, indietro, barra avanzamento, volume, mute
- [x] Coda di riproduzione client-side (QueueDrawer)
- [x] Routing con wouter
- [x] TrackCard, ArtistCard, AlbumCard riutilizzabili
- [x] PlayerContext con gestione stato globale

## Test
- [x] Ricerca funzionante: 20 brani, 13 artisti, 20 album per "Taylor Swift"
- [x] Pagina artista: Taylor Swift - 63.2M iscritti, top songs, discografia aggiornata 2026
- [x] Pagina album: reputation - 15 brani, tracklist completa
- [x] Player: riproduzione avviata al click su brano (YouTube IFrame API)
- [x] Home: trending brani, nuovi album, artisti consigliati con dati reali

## Note Tecniche
- yt-dlp: YouTube blocca le richieste non autenticate come bot nel 2026.
  La riproduzione audio avviene tramite YouTube IFrame API (embed ufficiale).
  Il video è nascosto, si sente solo l'audio. Alternativa: accedere con account Google.


## Redesign UI Spotify (Completato)
- [x] Palette colori sofisticata (grigio neutro, accenti verdi Spotify, meno neon)
- [x] CSS minimalista con spacing generoso
- [x] Navbar leggera e trasparente con blur
- [x] Card sottili con hover effect elegante
- [x] Home page con layout simile a Spotify
- [x] Player ridisegnato (più compatto e elegante con accenti verdi)
- [x] Pagina ricerca con layout Spotify-like
- [x] Pagina artista con hero section leggera
- [x] Pagina album con design minimalista
- [x] Animazioni fluide (cubic-bezier 0.23, 1, 0.32, 1)
- [x] Micro-interazioni (hover, click feedback, soft glow)


## Redesign Pagine Rimanenti (Completato)
- [x] Ridisegnare SearchResults.tsx con layout Spotify-like
- [x] Ridisegnare ArtistPage.tsx con hero section leggera
- [x] Ridisegnare AlbumPage.tsx con design minimalista
- [x] Applicare animazioni fade/scale/slide ai componenti
- [x] Verificare visivamente tutte le pagine dopo redesign


## Autenticazione e Libreria Utente (In Progress)
- [ ] Schema DB: tabelle playlists, favorites, listening_history
- [ ] Backend API tRPC: CRUD playlist, add/remove favorites, get library
- [ ] Pagina Libreria con tab: Playlist, Favoriti, Cronologia
- [ ] Button "Aggiungi ai favoriti" nel player e nelle card
- [ ] Button "Aggiungi a playlist" nel player e nelle card
- [ ] Sincronizzazione favoriti/playlist con il player
- [ ] Ottimizzazione mobile: layout responsive, menu collapsibile
- [ ] Gesture swipe per il player su mobile
- [ ] Test completo su desktop e mobile
