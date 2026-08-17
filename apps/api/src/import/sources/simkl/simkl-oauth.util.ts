/**
 * Where Simkl redirects the browser back to once the user approves consent —
 * must match the URI registered on the Simkl app byte-for-byte (see
 * https://simkl.com/settings/developer/). The web builds the authorize URL
 * itself (see the Simkl import page) using the exact same computation, so
 * this is only needed server-side for the token exchange.
 */
export function simklRedirectUri(webOrigin: string): string {
  return `${webOrigin}/app/settings/import/simkl/callback`;
}
