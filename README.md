# tv-cinema-v2

React 19 + TypeScript + Vite + GSAP ScrollTrigger landing rebuilt from Figma
`emJiewWvxtniMYCtgHFDN7` (main `102:14253`, videos `72:1037`).

**Live (GitHub Pages):** https://mariyaarsenova211296-max.github.io/tv-cinema-v2/  
**Repo:** https://github.com/mariyaarsenova211296-max/tv-cinema-v2

## Run

```sh
npm ci
npm run dev -- --port 5173
# → http://127.0.0.1:5173/tv-cinema-v2/
```

`base: '/tv-cinema-v2/'` for project Pages.

## Breath TZ

| State | Driver | Timecode |
| --- | --- | --- |
| SCROLL_APPROACH | SCRUB | `0 → 1.0s` |
| AUTO_PLAY | PLAY @1× | `1.0 → 7.0s` |
| HOLD_RIDER | Freeze | `@7.0s` |
| SCROLL_OUTRO | SCRUB | `7 → end` |
| UTPs | Static | RGB → DLG |

## Video map

| File | Figma | Mode |
| --- | --- | --- |
| `v1-hero.mp4` | `102:19080` | PLAY |
| `breath-story.mp4` | `72:1038` (interim) | SCRUB+PLAY |
| `v3-to-sound.mp4` | `72:1039` | SCRUB (ref) |
| `v4-sound.mp4` | `102:19079` | PLAY |
| `v5-ambience.mp4` | `100:2499` | PLAY |
| remote | `102:19081` | **missing MP4** |

Fonts: SB Sans Display self-hosted in `public/fonts/` (copied from tv-cinema, not modified there).
