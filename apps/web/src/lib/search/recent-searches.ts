const KEY = "lk-recent-searches";
const MAX = 6;

export function readRecentSearches(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save(terms: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(terms));
  } catch {
    // Only a convenience: the list just doesn't outlive this page.
  }

  return terms;
}

/** Newest first, a term searched again moving back to the top. */
export function rememberSearch(term: string): string[] {
  const trimmed = term.trim();
  const others = readRecentSearches().filter(
    (t) => t.toLowerCase() !== trimmed.toLowerCase(),
  );
  return save(trimmed ? [trimmed, ...others].slice(0, MAX) : others);
}

export function forgetSearch(term: string): string[] {
  return save(readRecentSearches().filter((t) => t !== term));
}
