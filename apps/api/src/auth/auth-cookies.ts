import type { AuthTokensDto } from "@loomkeep/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ACCESS_COOKIE = "loomkeep_access";
const REFRESH_COOKIE = "loomkeep_refresh";
const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const INITIALIZATION_VECTOR_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;

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
  const cookieValue = value ? encryptCookieValue(value) : "";
  return `${name}=${cookieValue}; ${cookieAttributes(path, maxAge)}`;
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

function readAuthCookie(request: FastifyRequest, name: string): string | null {
  const raw = request.headers.cookie;
  if (!raw) return null;

  const pair = raw
    .split(";")
    .find((part) => part.trim().startsWith(`${name}=`));
  return pair ? decryptCookieValue(pair.trim().slice(name.length + 1)) : null;
}

function encryptCookieValue(value: string): string {
  const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    cookieEncryptionKey(),
    initializationVector,
  );
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return Buffer.concat([
    initializationVector,
    authenticationTag,
    ciphertext,
  ]).toString("base64url");
}

function decryptCookieValue(value: string): string | null {
  try {
    const encrypted = Buffer.from(value, "base64url");

    if (
      encrypted.length <=
      INITIALIZATION_VECTOR_BYTES + AUTHENTICATION_TAG_BYTES
    ) {
      return null;
    }

    const initializationVector = encrypted.subarray(
      0,
      INITIALIZATION_VECTOR_BYTES,
    );
    const authenticationTag = encrypted.subarray(
      INITIALIZATION_VECTOR_BYTES,
      INITIALIZATION_VECTOR_BYTES + AUTHENTICATION_TAG_BYTES,
    );
    const ciphertext = encrypted.subarray(
      INITIALIZATION_VECTOR_BYTES + AUTHENTICATION_TAG_BYTES,
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cookieEncryptionKey(),
      initializationVector,
    );
    decipher.setAuthTag(authenticationTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function cookieEncryptionKey(): Buffer {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      "JWT secrets are required to encrypt authentication cookies",
    );
  }

  return createHash("sha256")
    .update(accessSecret)
    .update("\0")
    .update(refreshSecret)
    .digest();
}

export function readAccessCookie(request: FastifyRequest): string | null {
  return readAuthCookie(request, ACCESS_COOKIE);
}

export function readRefreshCookie(request: FastifyRequest): string | null {
  return readAuthCookie(request, REFRESH_COOKIE);
}
