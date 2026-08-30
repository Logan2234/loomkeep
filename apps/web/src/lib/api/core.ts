import { env } from "$env/dynamic/public";
import type {
  ApiErrorBody,
  AuthTokensDto,
  PagedResult,
} from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import * as Sentry from "@sentry/sveltekit";
import { auth } from "../auth.svelte";
import { getLocale } from "../paraglide/runtime.js";

export const API_URL = env.PUBLIC_API_URL ?? "http://localhost:3000/api";

/**
 * `message` stays for debugging (console, error reporting) — it's the API's
 * dev-facing English text and must never be shown to the user directly. Use
 * resolveApiError() (./errors.ts) to get a translated, user-facing string.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: ErrorCode | null = null,
    readonly params?: Record<string, string | number>,
    readonly details?: ApiErrorBody["details"],
    readonly requestId?: string,
    /** Seconds to wait before retrying, parsed from a 429's Retry-After header. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set to false for auth endpoints. */
  withAuth?: boolean;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Accept-Language": getLocale(),
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.withAuth !== false && auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // The fetch itself failed (offline, DNS failure, VPS down) — there is no
    // HTTP response at all, so this never reaches the !response.ok branch
    // below. Most frequent failure mode on a PWA away from wifi.
    const error = new ApiError(
      0,
      "Network request failed",
      ErrorCode.NetworkOffline,
    );
    reportToGlitchTip(error);
    throw error;
  }

  // Expired access token: try one refresh, then replay the request.
  if (
    response.status === 401 &&
    options.withAuth !== false &&
    !retried &&
    auth.refreshToken
  ) {
    const refreshed = await tryRefresh();

    if (refreshed) {
      return request<T>(path, options, true);
    }

    auth.clear();
  }

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as Partial<ApiErrorBody> | null;
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader
      ? Number(retryAfterHeader)
      : undefined;
    const error = new ApiError(
      response.status,
      body?.message ?? `Request failed (${response.status})`,
      body?.code ?? null,
      body?.params,
      body?.details,
      body?.requestId,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
    reportToGlitchTip(error);
    throw error;
  }

  // Void-returning endpoints (POST/DELETE handlers with no return value) come
  // back as 200/201 with an empty body, not necessarily 204 — Nest doesn't
  // set 204 based on the handler's return type. `response.json()` throws on
  // an empty body, so check the actual text first rather than trusting the
  // status code.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// 5xx and network failures only: everything else (401/403/404/409/429) is an
// expected outcome and would be noise. Gated on the same DSN as
// hooks.client.ts, which is the only place Sentry.init() is called — without
// it these calls are no-ops, but the explicit check keeps the convention
// visible here too.
function reportToGlitchTip(error: ApiError): void {
  if (!env.PUBLIC_GLITCHTIP_WEB_DSN) return;

  if (error.status >= 500 || error.status === 0) {
    Sentry.captureException(error, { tags: { requestId: error.requestId } });
  }
}

/**
 * Drains every page of a paginated `list*` call into one array — for the few
 * call sites (search panels' "already tracked" lookup) that need the whole
 * library rather than a page of it.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PagedResult<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  for (;;) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (!result.hasMore) break;
    page++;
  }

  return items;
}

// Refresh tokens rotate: the presented one is consumed server-side on success.
// Concurrent 401s (e.g. a page firing several requests at once) must therefore
// share a single refresh — otherwise the first consumes the token and the rest
// replay the now-dead one, fail, and log the user out. This mutex holds the
// in-flight refresh so late callers await it instead of starting their own.
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    const { tokens } = await request<{ tokens: AuthTokensDto }>(
      "/auth/refresh",
      {
        method: "POST",
        body: { refreshToken: auth.refreshToken },
        withAuth: false,
      },
      true,
    );
    auth.setTokens(tokens);
    return true;
  } catch {
    return false;
  }
}
