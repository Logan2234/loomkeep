// SDK-independent so the API and browser enforce the same policy.
const FILTERED = "[Filtered]";
const PRIVATE_FIELD =
  /^(?:authorization|headers|cookies?|setcookie|password.*|passphrase|.*token|.*secret|.*apikey|credential.*|email|phone|address|body|content|text|comment|description|query|search|params|variables|vars|mfacode|otp|verificationcode|recoverycodes?|backupcodes?|codeverifier)$/i;

function scrubTelemetryText(value: string): string {
  return (
    value
      // URLs in error messages can include signed links, credentials or searches.
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (url) => {
        try {
          const parsed = new URL(url);
          parsed.username = "";
          parsed.password = "";
          parsed.search = "";
          parsed.hash = "";
          return parsed.toString();
        } catch {
          return FILTERED;
        }
      })
      .replace(/\bBearer\s+[^\s,;"']+/gi, `Bearer ${FILTERED}`)
      .replace(/\blk_[A-Za-z0-9_-]+\b/g, FILTERED)
      .replace(
        /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        FILTERED,
      )
      .replace(
        /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        FILTERED,
      )
      .replace(
        /\b(password|passphrase|token|access_token|refresh_token|secret|api_key|otp|mfa_code|cookie|authorization)(["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        `$1$2${FILTERED}`,
      )
  );
}

function scrub(
  value: unknown,
  ancestors = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (typeof value === "string") return scrubTelemetryText(value);
  if (!value || typeof value !== "object") return value;
  if (depth > 12 || ancestors.has(value)) return FILTERED;

  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => scrub(item, ancestors, depth + 1))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          PRIVATE_FIELD.test(key.replace(/[-_]/g, ""))
            ? FILTERED
            : typeof item === "string" &&
                /^(?:url|href|from|to|filename|abs_path)$/i.test(key)
              ? scrubTelemetryText(item).split(/[?#]/, 1)[0]
              : scrub(item, ancestors, depth + 1),
        ]),
      );
  ancestors.delete(value);
  return result;
}

export function scrubSentryBreadcrumb<T>(breadcrumb: T): T {
  return scrub(breadcrumb) as T;
}

export function scrubSentryEvent<T>(event: T): T {
  const cleaned = scrub(event) as Record<string, unknown>;
  const request = cleaned.request as Record<string, unknown> | undefined;

  if (request) {
    // Manual setContext/setExtra/setUser calls bypass automatic SDK settings.
    delete request.headers;
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    delete request.env;

    if (typeof request.url === "string") {
      request.url = request.url.split(/[?#]/, 1)[0];
    }
  }

  const user = cleaned.user as Record<string, unknown> | undefined;

  if (user) cleaned.user = user.id === undefined ? undefined : { id: user.id };

  return cleaned as T;
}

/** Keep both API/browser observations; suppress repeats within each SDK client. */
export function createSentryEventFilter() {
  const seenErrors = new WeakSet<object>();
  const requestIds = new Map<string, number>();

  return <T>(event: T, hint?: { originalException?: unknown }): T | null => {
    const contexts = (
      event as { contexts?: { loomkeep?: { requestId?: unknown } } }
    ).contexts;
    const requestId = contexts?.loomkeep?.requestId;
    const original = hint?.originalException;
    const now = Date.now();

    for (const [id, timestamp] of requestIds) {
      if (now - timestamp > 60_000) requestIds.delete(id);
    }

    if (typeof requestId === "string") {
      if (requestIds.has(requestId)) return null;
      requestIds.set(requestId, now);

      if (requestIds.size > 1000) {
        const first = requestIds.keys().next().value;

        if (first !== undefined) requestIds.delete(first);
      }
    } else if (
      original &&
      typeof original === "object" &&
      seenErrors.has(original)
    ) {
      return null;
    }

    if (original && typeof original === "object") seenErrors.add(original);

    return scrubSentryEvent(event);
  };
}
