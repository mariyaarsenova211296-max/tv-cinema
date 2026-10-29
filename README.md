# Sber TV — alt rebuild (tv-cinema-v2)

Full greenfield rebuild served at **https://mariyaarsenova211296-max.github.io/tv-cinema/alt/**

Branch: `alt-gesture-scroll` · Vite `base: '/tv-cinema/alt/'`  
Scrub root (`main` → `/tv-cinema/`) is a separate tip and must not be overwritten by this branch.

## Run

```sh
npm ci
VITE_BASE=/tv-cinema/alt/ npm run build
npm run preview -- --port 4173
# → http://127.0.0.1:4173/tv-cinema/alt/
```

## Breath TZ

SCROLL_APPROACH SCRUB `0→1` · AUTO_PLAY `1→7` · HOLD `@7` · SCROLL_OUTRO SCRUB `7→end` · RGB→DLG UTPs on end frame.
