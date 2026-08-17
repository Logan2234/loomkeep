const SIMKL_AUTHORIZE_URL = "https://simkl.com/oauth/authorize";

/**
 * Where Simkl redirects the browser back to once the user approves consent —
 * must match the URI registered on the Simkl app byte-for-byte (see
 * https://simkl.com/settings/developer/), so both the initial redirect and the
 * later token exchange build it the exact same way.
 */
export function simklRedirectUri(webOrigin: string): string {
  return `${webOrigin}/app/settings/import/simkl/callback`;
}

/** The URL to send the browser to, to start Simkl's OAuth consent flow. */
export function simklAuthorizeUrl(clientId: string, webOrigin: string): string {
  const url = new URL(SIMKL_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", simklRedirectUri(webOrigin));
  return url.toString();
}
