export function adminFilterHref(
  url: URL,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams(url.searchParams);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }

  const search = params.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
