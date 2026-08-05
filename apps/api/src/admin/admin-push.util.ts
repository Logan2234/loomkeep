import type { AdminPushUserAgentStatDto } from "@tracklore/shared";

/** Label used when the browser has no stored user-agent, or none we recognise. */
const UNKNOWN_LABEL = "Inconnu";

/**
 * Browser families, in probe order — the specific ones first, because every
 * Chromium derivative also carries "Chrome" in its user-agent (and Chrome
 * itself also carries "Safari"). First match wins.
 */
const FAMILIES: { label: string; token: string }[] = [
  { label: "Edge", token: "Edg/" },
  { label: "Samsung Internet", token: "SamsungBrowser" },
  { label: "Opera", token: "OPR/" },
  { label: "Firefox", token: "Firefox" },
  { label: "Chrome", token: "Chrome" },
  { label: "Safari", token: "Safari" },
];

/** The browser family one stored user-agent belongs to. */
export function userAgentFamily(userAgent: string | null): string {
  if (!userAgent) return UNKNOWN_LABEL;
  return (
    FAMILIES.find(({ token }) => userAgent.includes(token))?.label ??
    UNKNOWN_LABEL
  );
}

/**
 * Active subscriptions per browser family, most devices first. Ties break on the
 * label so the ranking doesn't reshuffle between two refreshes of the same data.
 */
export function groupByUserAgentFamily(
  userAgents: (string | null)[],
): AdminPushUserAgentStatDto[] {
  const counts = new Map<string, number>();

  for (const userAgent of userAgents) {
    const label = userAgentFamily(userAgent);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
