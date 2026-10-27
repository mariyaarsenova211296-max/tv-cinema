# Sber TV

React 19 + TypeScript + Vite. Лендинг собран с нуля на `main` по макету Figma `emJiewWvxtniMYCtgHFDN7` (узел `1:1105`, видео `1:2018`).

## Запуск

Нужен Node.js 22.12+ и npm.

```sh
npm ci
npm run dev -- --port 5173
```

Открыть `http://127.0.0.1:5173/tv-cinema/` (Vite `base: '/tv-cinema/'` для GitHub Pages). `…/review.html` — статус материалов. Навигация `01–06` внизу слева — только технический предпросмотр.

```sh
npm run build
npm run preview -- --port 4173
# → http://127.0.0.1:4173/tv-cinema/
```

**Публичный URL (после включения Pages):** https://mariyaarsenova211296-max.github.io/tv-cinema/  
Workflow: `.github/workflows/deploy-pages.yml` (build + deploy on push to `main`).

## Экраны

| Экран | Реализация |
| --- | --- |
| 1 | Чёрный фон, меню и CTA из Figma. CTA закреплена снизу с отступом `--bottom-space`. |
| 2 | Шесть отдельных экспортов карточек, горизонтальный скролл, пропорции и порядок как в макете. Заголовок «Здесь есть чем насладиться». |
| 3 | Текст «Задержите дыхание», появление и scale общего медиаслоя. |
| 4 | Видео 1 играет по собственному времени и зациклено, пока сцена активна. |
| 4 → 5 | Видео 2 перематывается прогрессом скролла в обе стороны. |
| 5 | Конец видео 2 + dual-image маска Miniled / RGB-miniled (старт 50%, мышь/тач/клавиатура). Меняется только содержимое экрана ТВ. |
| 5 → 6 | Видео 3 перематывается скроллом. |
| 6 | Видео 4 + тексты Dolby Atmos / пространственный звук; повтор по конфигу. |

Конфиг: `src/config.ts` (дистанции, масштабы, тайминги текста, playback). Контент Figma: `public/design.json`. Ассеты: `public/assets/**`, видео: `public/media/**`.

Scroll-driven таймлайн — sticky viewport + расчёт фаз (эквивалент ScrollTrigger); GSAP ScrollTrigger используется для появления карточек экрана 2. `muted` + `playsInline`, постеры, preload ближайших роликов, `prefers-reduced-motion` → статичные постеры и кнопка ручного запуска.

## Проверка

```sh
npm run dev -- --port 5173
# в другом терминале:
npm test
```

## Открытые отклонения / недостающие материалы

См. `VALIDATION.md` и `/review.html`. Кратко: **SB Sans Display** самохостится в `public/fonts/` (Thin–Bold); **SB Sans Text** в поставке не было. URL покупки в макете нет (`#buy`); стык видео 1→2 и петля видео 1 не бесшовные в исходниках; углы экрана для сравнения измерены по кадру video-2 и ждут подтверждения дизайна.
