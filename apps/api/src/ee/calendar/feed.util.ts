/** One aired episode, as a feed entry. */
interface ReleaseFeedEntry {
  /** A stable URI: a feed reader dedupes entries on it. */
  id: string;
  title: string;
  /** The work's page in the web app. */
  link: string;
  airDate: Date;
}

export interface ReleaseFeed {
  id: string;
  title: string;
  description: string;
  /** The web app, for readers that show a link to the site. */
  link: string;
  /** Newest first. */
  entries: ReleaseFeedEntry[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The feed changes when a new episode airs; with none in the window there is
// no better date than now.
function lastUpdated(feed: ReleaseFeed, now: Date): Date {
  return feed.entries[0]?.airDate ?? now;
}

/** Atom 1.0 (RFC 4287). */
export function buildAtomFeed(feed: ReleaseFeed, now = new Date()): string {
  const entries = feed.entries.map(
    (entry) => `  <entry>
    <id>${escapeXml(entry.id)}</id>
    <title>${escapeXml(entry.title)}</title>
    <updated>${entry.airDate.toISOString()}</updated>
    <link rel="alternate" href="${escapeXml(entry.link)}"/>
  </entry>`,
  );

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(feed.id)}</id>`,
    `  <title>${escapeXml(feed.title)}</title>`,
    `  <subtitle>${escapeXml(feed.description)}</subtitle>`,
    `  <updated>${lastUpdated(feed, now).toISOString()}</updated>`,
    `  <link rel="alternate" href="${escapeXml(feed.link)}"/>`,
    // Atom requires an author, on the feed or on every entry.
    "  <author><name>Loomkeep</name></author>",
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}

/** RSS 2.0, for the readers and tools that don't take Atom. */
export function buildRssFeed(feed: ReleaseFeed, now = new Date()): string {
  const items = feed.entries.map(
    (entry) => `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.link)}</link>
      <guid isPermaLink="false">${escapeXml(entry.id)}</guid>
      <pubDate>${entry.airDate.toUTCString()}</pubDate>
    </item>`,
  );

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(feed.link)}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <lastBuildDate>${lastUpdated(feed, now).toUTCString()}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
