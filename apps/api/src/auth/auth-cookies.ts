import type { AuthTokensDto } from "@loomkeep/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

const ACCESS_COOKIE = "loomkeep_access";
const REFRESH_COOKIE = "loomkeep_refresh";
const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function cookieAttributes(path: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

function cookie(
  name: string,
  value: string,
  path: string,
  maxAge: number,
): string {
  return `${name}=${value}; ${cookieAttributes(path, maxAge)}`;
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: AuthTokensDto,
): void {
  reply.header("Set-Cookie", [
    cookie(ACCESS_COOKIE, tokens.accessToken, "/api", ACCESS_MAX_AGE_SECONDS),
    cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      "/api/auth",
      REFRESH_MAX_AGE_SECONDS,
    ),
  ]);
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.header("Set-Cookie", [
    cookie(ACCESS_COOKIE, "", "/api", 0),
    cookie(REFRESH_COOKIE, "", "/api/auth", 0),
  ]);
}

export function readAuthCookie(
  request: FastifyRequest,
  name: string,
): string | null {
  const raw = request.headers.cookie;
  if (!raw) return null;

  const pair = raw
    .split(";")
    .find((part) => part.trim().startsWith(`${name}=`));
  return pair ? pair.trim().slice(name.length + 1) : null;
}

export function readAccessCookie(request: FastifyRequest): string | null {
  return readAuthCookie(request, ACCESS_COOKIE);
}

export function readRefreshCookie(request: FastifyRequest): string | null {
  return readAuthCookie(request, REFRESH_COOKIE);
}
