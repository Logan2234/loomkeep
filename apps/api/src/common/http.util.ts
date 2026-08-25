import { BadGatewayException, NotFoundException } from "@nestjs/common";

// A hung provider must not hold a request open indefinitely.
const TIMEOUT_MS = 10_000;

// Transient failures (429/5xx) get a couple of retries with backoff — a
// provider hiccup shouldn't surface as a user-facing error.
const MAX_ATTEMPTS = 3;

/**
 * Fetch JSON from an upstream catalogue provider, mapping the HTTP-response
 * outcomes every provider handles the same way: a 404 → NotFound (only when a
 * `notFoundMessage` is given — some providers never return 404), any other
 * non-2xx → BadGateway. Requests time out after 10s, and 429/5xx responses
 * are retried with backoff before giving up.
 *
 * The parsed body is returned as `T`. Providers wrapping their payload in an
 * envelope (GraphQL's `{ data, errors }`) pass that envelope as `T` and handle
 * their own in-band errors on top.
 */
export async function fetchJson<T>(
  url: string | URL,
  init: RequestInit,
  opts: { sourceLabel: string; notFoundMessage?: string },
): Promise<T> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs(null, attempt));
        continue;
      }

      throw new BadGatewayException(
        `${opts.sourceLabel} request failed: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (opts.notFoundMessage && response.status === 404) {
      throw new NotFoundException(opts.notFoundMessage);
    }

    if (response.ok) return (await response.json()) as T;

    lastStatus = response.status;
    const transient = response.status === 429 || response.status >= 500;

    if (transient && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMs(response.headers.get("Retry-After"), attempt));
      continue;
    }

    break;
  }

  throw new BadGatewayException(
    `${opts.sourceLabel} request failed with status ${lastStatus}`,
  );
}

/** `Retry-After` (seconds) when one is sent; else exponential backoff. */
function retryDelayMs(
  retryAfterHeader: string | null,
  attempt: number,
): number {
  const retryAfterSec = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return retryAfterSec * 1000;
  }

  return 500 * 2 ** (attempt - 1); // 500ms, then 1000ms.
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
