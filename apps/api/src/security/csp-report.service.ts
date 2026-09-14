import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/node";

/** One violation, reduced to the three fields that identify what to fix. */
export interface CspViolation {
  /** The directive that would have blocked it, e.g. "script-src-elem". */
  directive: string;
  /** What was blocked, origin-only — see `stripUrl`. */
  blockedUri: string;
  /** The page it happened on, origin + path. */
  documentUri: string;
}

/**
 * How long a given violation stays "already seen" — one report per distinct
 * violation per window, however many browsers hit it. Violations repeat on
 * every page load by nature, so without this the signal is drowned by its own
 * volume and the error tracker's quota goes with it.
 */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

/** Bounds the dedupe map: a report is attacker-controlled input, so it can't grow freely. */
const MAX_TRACKED_VIOLATIONS = 500;

@Injectable()
export class CspReportService {
  private readonly seen = new Map<string, number>();

  /**
   * Parses a report and, the first time a distinct violation is seen in the
   * window, notifies — `notify` logs it, and it also reaches GlitchTip when a
   * DSN is configured (a no-op otherwise, see instrument.ts).
   */
  record(body: unknown, notify: (violation: CspViolation) => void): void {
    const violation = parseViolation(body);
    if (!violation) return;

    const key = `${violation.directive}|${violation.blockedUri}|${violation.documentUri}`;
    if (!this.shouldReport(key)) return;

    notify(violation);
    Sentry.captureMessage(
      `CSP: ${violation.directive} would block ${violation.blockedUri}`,
      { level: "warning", tags: { cspDirective: violation.directive } },
    );
  }

  private shouldReport(key: string): boolean {
    const now = Date.now();

    for (const [seenKey, at] of this.seen) {
      if (now - at > DEDUPE_WINDOW_MS) this.seen.delete(seenKey);
    }

    if (this.seen.has(key)) return false;
    // Full map: drop the report rather than evict, so a flood of new keys
    // can't push the real, recurring violations out of the window.
    if (this.seen.size >= MAX_TRACKED_VIOLATIONS) return false;

    this.seen.set(key, now);
    return true;
  }
}

/**
 * Reads both shapes browsers send: the legacy `{ "csp-report": {...} }` body
 * and the Reporting API's `{ type, body: {...} }` envelope (which also arrives
 * as an array). Returns null for anything unrecognisable — this is
 * unauthenticated input, so nothing here may throw.
 */
function parseViolation(body: unknown): CspViolation | null {
  const payload = Array.isArray(body) ? body[0] : body;
  if (!isRecord(payload)) return null;

  const report = isRecord(payload["csp-report"])
    ? payload["csp-report"]
    : isRecord(payload.body)
      ? payload.body
      : payload;

  const directive =
    str(report["effective-directive"]) ??
    str(report.effectiveDirective) ??
    str(report["violated-directive"]) ??
    str(report.violatedDirective);
  const blockedUri = str(report["blocked-uri"]) ?? str(report.blockedURL);
  const documentUri = str(report["document-uri"]) ?? str(report.documentURL);

  if (!directive) return null;

  return {
    directive,
    blockedUri: stripUrl(blockedUri) ?? "inline",
    documentUri: stripUrl(documentUri) ?? "unknown",
  };
}

/**
 * Origin + path only. A reported URL carries whatever was in the page's
 * address bar, query string included — which on this app can mean a reset
 * token or a calendar token. Those must not land in the logs.
 */
function stripUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    // "inline", "eval", "data" and friends aren't URLs — keep them as-is.
    return value.slice(0, 200);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
