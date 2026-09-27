/**
 * A catalogue page, read from its address alone — never fetched: the id
 * travels in the path for every source we know, and loading an arbitrary
 * user-supplied URL server-side would be an open door to SSRF.
 */
export type CatalogLink =
  | { source: "tmdb"; type: "MOVIE" | "SERIES"; id: string }
  | { source: "imdb"; id: string }
  | { source: "anilist"; id: string }
  | { source: "myanimelist"; id: string }
  | { source: "igdb"; slug: string }
  | { source: "steam"; appId: string }
  | { source: "openlibrary-work"; id: string }
  | { source: "openlibrary-edition"; id: string }
  | { source: "isbn"; isbn: string }
  | { source: "musicbrainz-release-group"; id: string }
  | { source: "musicbrainz-release"; id: string };

const MBID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Host (without "www." / "m.") → path patterns, first match wins.
const RULES: Record<
  string,
  { pattern: RegExp; link: (m: RegExpExecArray) => CatalogLink }[]
> = {
  "themoviedb.org": [
    {
      pattern: /^\/movie\/(\d+)/,
      link: (m) => ({ source: "tmdb", type: "MOVIE", id: m[1] }),
    },
    {
      pattern: /^\/tv\/(\d+)/,
      link: (m) => ({ source: "tmdb", type: "SERIES", id: m[1] }),
    },
  ],
  "imdb.com": [
    {
      pattern: /^\/(?:[a-z]{2}\/)?title\/(tt\d+)/,
      link: (m) => ({ source: "imdb", id: m[1] }),
    },
  ],
  "anilist.co": [
    {
      pattern: /^\/anime\/(\d+)/,
      link: (m) => ({ source: "anilist", id: m[1] }),
    },
  ],
  "myanimelist.net": [
    {
      pattern: /^\/anime\/(\d+)/,
      link: (m) => ({ source: "myanimelist", id: m[1] }),
    },
  ],
  "igdb.com": [
    {
      pattern: /^\/games\/([a-z0-9-]+)/,
      link: (m) => ({ source: "igdb", slug: m[1] }),
    },
  ],
  "store.steampowered.com": [
    {
      pattern: /^\/app\/(\d+)/,
      link: (m) => ({ source: "steam", appId: m[1] }),
    },
  ],
  "openlibrary.org": [
    {
      pattern: /^\/works\/(OL\d+W)/,
      link: (m) => ({ source: "openlibrary-work", id: m[1] }),
    },
    {
      pattern: /^\/books\/(OL\d+M)/,
      link: (m) => ({ source: "openlibrary-edition", id: m[1] }),
    },
    {
      pattern: /^\/isbn\/([0-9Xx-]{10,17})/,
      link: (m) => ({ source: "isbn", isbn: m[1].replace(/-/g, "") }),
    },
  ],
  "musicbrainz.org": [
    {
      pattern: new RegExp(`^/release-group/(${MBID})`),
      link: (m) => ({ source: "musicbrainz-release-group", id: m[1] }),
    },
    {
      pattern: new RegExp(`^/release/(${MBID})`),
      link: (m) => ({ source: "musicbrainz-release", id: m[1] }),
    },
  ],
};

export function parseCatalogLink(raw: string): CatalogLink | null {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  // Own keys only: a host like "__proto__" must not reach Object.prototype.
  if (!Object.hasOwn(RULES, host)) return null;

  for (const rule of RULES[host]) {
    const match = rule.pattern.exec(url.pathname);
    if (match) return rule.link(match);
  }

  return null;
}
