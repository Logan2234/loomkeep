import { createHmac } from "node:crypto";

interface WidgetTokenPayload {
  sub: string;
  email: string;
  name: string;
  /** Unix seconds. */
  exp: number;
}

/**
 * Signs a Quackback widget "Verified identity only" SSO token — their own
 * minimal JWT-shaped format (HS256, base64url header.payload.signature),
 * verified against QUACKBACK_WIDGET_SECRET on their side. Hand-rolled
 * rather than going through @nestjs/jwt: a different signing audience and
 * secret from the app's own access/refresh tokens.
 */
export function signWidgetToken(
  payload: WidgetTokenPayload,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}
