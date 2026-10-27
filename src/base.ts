/** Vite `base` — `/` locally, `/tv-cinema/` on GitHub Pages. */
export const BASE = import.meta.env.BASE_URL;

/** Join a public asset path with the deploy base (accepts with or without leading `/`). */
export function asset(path: string): string {
  const value = String(path);
  // Leave absolute / data / blob URLs untouched (e.g. test fixtures).
  if (/^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|blob):/i.test(value)) return value;
  return `${BASE}${value.replace(/^\//, '')}`;
}
