/** Vite `base` — `/` locally when overridden, `/tv-cinema-v2/` on GitHub Pages. */
export const BASE = import.meta.env.BASE_URL;

/** Join a public asset path with the deploy base. */
export function asset(path: string): string {
  const value = String(path);
  if (/^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|blob):/i.test(value)) return value;
  return `${BASE}${value.replace(/^\//, '')}`;
}
