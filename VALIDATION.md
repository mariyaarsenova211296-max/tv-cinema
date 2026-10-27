# Проверка

Проверено в Chromium Linux после подключения Figma MCP к файлу `emJiewWvxtniMYCtgHFDN7`.

```sh
npm ci
npm run build
npm run preview -- --port 4173
TEST_BASE_URL=http://127.0.0.1:4173 npm test
```

## Сделано

- [x] Структура шести экранов из Figma (меню, CTA, карточки, тексты 3/5/6).
- [x] Отдельный экспорт шести карточек экрана 2 в `public/assets/cards/`.
- [x] Иконки меню/CTA/сравнения в `public/assets/`.
- [x] Пара изображений сравнения Miniled / RGB-miniled + dual-image маска.
- [x] Четыре H.264 ролика с постерами (ранее подготовленные из узлов видео с теми же суффиксами файлов).
- [x] Scroll-driven режимы видео 2/3, loop видео 1 и 4, reduced-motion, mobile.
- [x] GSAP ScrollTrigger для появления карточек; фазы 3–6 — sticky timeline (эквивалент).

## Не отмечено как завершённое

- [ ] Лицензионные файлы **SB Sans Display / Text** — в среде нет; стоит Manrope fallback.
- [ ] Реальный URL магазина для CTA — в макете нет ссылки; сейчас `#buy`.
- [ ] Точная калибровка углов экрана (`comparison.corners`) дизайнером по финальному кадру.
- [ ] Бесшовный стык видео 1 → 2 и петля видео 1 (сюжеты исходников несовместимы).
- [ ] Safari / iOS / Firefox / физические устройства.
- [ ] Публичный хостинг preview URL.
