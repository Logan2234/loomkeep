import type { ReadonlyURL } from "$app/state";

export function adminFilterHref(
  url: ReadonlyURL,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams(url.searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }

  const search = params.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
