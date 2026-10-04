import { localDateInput } from "$lib/date";
import type { ApiKeyDto, ApiKeyResource, ApiKeyScope } from "@loomkeep/shared";

export type ExpirationChoice = "30" | "90" | "365" | "custom" | "never";
export const DEFAULT_EXPIRATION: ExpirationChoice = "90";

/** Below this, a key's expiration is flagged in the list. */
const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * The `expiresAt` to send for a choice. A custom date expires at the end of
 * that day, local time, so picking "tomorrow" never yields a key that dies
 * in a few hours.
 */
export function expiresAtFor(
  choice: ExpirationChoice,
  customDate: string,
  now = new Date(),
): string | null {
  if (choice === "never") return null;

  if (choice === "custom") {
    const [year, month, day] = customDate.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59).toISOString();
  }

  return new Date(now.getTime() + Number(choice) * DAY_MS).toISOString();
}

/** The earliest date the custom picker offers: tomorrow, as `YYYY-MM-DD`. */
export function minCustomDate(now = new Date()): string {
  const tomorrow = new Date(now.getTime() + DAY_MS);
  return localDateInput(tomorrow);
}

export type ExpiryState = "never" | "active" | "soon" | "expired";

export function expiryState(
  key: Pick<ApiKeyDto, "expiresAt">,
  now = new Date(),
): ExpiryState {
  if (!key.expiresAt) return "never";
  const left = new Date(key.expiresAt).getTime() - now.getTime();
  if (left <= 0) return "expired";
  return left < EXPIRING_SOON_DAYS * DAY_MS ? "soon" : "active";
}

/** The endpoint an example calls: the first one the key can read. */
const EXAMPLE_PATHS: Record<ApiKeyResource, string> = {
  library: "/v1/library?phase=IN_PROGRESS",
  lists: "/v1/lists",
  calendar: "/v1/calendar",
  stats: "/v1/stats/summary",
  reviews: "/v1/reviews",
  profile: "/v1/profile",
  notifications: "/v1/notifications",
  export: "/v1/export",
};

export const EXAMPLE_LANGUAGES = ["curl", "JavaScript", "Python"] as const;
export type ExampleLanguage = (typeof EXAMPLE_LANGUAGES)[number];

export function exampleSnippets(
  apiUrl: string,
  secret: string,
  scopes: ApiKeyScope[],
): Record<ExampleLanguage, string> {
  const resource = (scopes[0]?.split(":")[0] ?? "library") as ApiKeyResource;
  const url = `${apiUrl}${EXAMPLE_PATHS[resource]}`;
  return {
    curl: `curl -H "Authorization: Bearer ${secret}" \\n  "${url}"`,
    JavaScript: `const res = await fetch("${url}", {\n  headers: { Authorization: "Bearer ${secret}" },\n});\nconsole.log(await res.json());`,
    Python: `import requests\n\nres = requests.get(\n    "${url}",\n    headers={"Authorization": "Bearer ${secret}"},\n)\nprint(res.json())`,
  };
}

/** Ready-made keys: a name and the resources their use case needs. */
export const RECIPES = [
  { id: "backup", resources: ["export"] },
  { id: "releases", resources: ["calendar"] },
  { id: "script", resources: ["library", "lists", "stats"] },
] as const satisfies readonly {
  id: string;
  resources: readonly ApiKeyResource[];
}[];
export type Recipe = (typeof RECIPES)[number];
