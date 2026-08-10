// SPA mode: the API is a separate service and auth lives in the browser
// (localStorage tokens), so server-side rendering has nothing to render.
// Scoped to /app (and the other signed-in-adjacent groups) rather than the
// root layout, so the public landing and legal pages can still be prerendered.
export const ssr = false;
