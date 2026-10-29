import { createHmac, timingSafeEqual } from "node:crypto";

export interface WidgetClaims {
  userId: string;
  /** The app's session (`RefreshToken.id`): the token dies with it. */
  sessionId: string;
}

// The access-token secret, but never its value: a key derived for this use
// only, so a widget token can't be mistaken for anything else it signs.
function signingKey(): Buffer {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return createHmac("sha256", secret).update("home-screen-widget").digest();
}

const signature = (payload: string): Buffer =>
  createHmac("sha256", signingKey()).update(payload).digest();

/**
 * What the Android app's widgets (MOB-20) send instead of a session. It has
 * no expiry of its own: the session it names expires, rotates or is signed
 * out, and the token with it.
 */
export function signWidgetToken(claims: WidgetClaims): string {
  const payload = Buffer.from(
    JSON.stringify({ userId: claims.userId, sessionId: claims.sessionId }),
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

/** The token's claims, or null when it was tampered with. */
export function verifyWidgetToken(token: string): WidgetClaims | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;

  const expected = signature(payload);
  const provided = Buffer.from(sig, "base64url");

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  return JSON.parse(
    Buffer.from(payload, "base64url").toString(),
  ) as WidgetClaims;
}
