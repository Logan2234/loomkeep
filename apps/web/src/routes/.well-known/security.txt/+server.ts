import { GITHUB_REPO_URL } from "#lib/constants/external-links.js";
import type { RequestHandler } from "./$types";

const SECURITY_CONTACT_EMAIL = "contact@loomkeep.app";

// RFC 9116 wants Expires less than a year out so a forgotten file goes
// stale. The text lives in the code, so it is as current as the deploy
// serving it: the date moves with each request rather than with a reminder.
const EXPIRES_IN_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Where to report a vulnerability in Loomkeep itself — the same answer on a
 * self-hosted instance, which runs this code.
 */
export const GET: RequestHandler = ({ url, setHeaders }) => {
  const body = [
    `Contact: ${GITHUB_REPO_URL}/security/advisories/new`,
    `Contact: mailto:${SECURITY_CONTACT_EMAIL}`,
    `Expires: ${new Date(Date.now() + EXPIRES_IN_MS).toISOString()}`,
    "Preferred-Languages: en, fr",
    `Canonical: ${url.origin}/.well-known/security.txt`,
    `Policy: ${GITHUB_REPO_URL}/security/policy`,
    "",
  ].join("\n");

  setHeaders({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "public, max-age=86400",
  });

  return new Response(body);
};
