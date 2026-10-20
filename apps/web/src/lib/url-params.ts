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

export function enumParam<K extends string, F extends K | null>(
  params: Pick<URLSearchParams, "get">,
  key: string,
  allowed: readonly K[],
  fallback: F,
): K | F {
  const requested = params.get(key);
  return allowed.find((value) => value === requested) ?? fallback;
}
