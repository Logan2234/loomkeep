import { buildAtomFeed, buildRssFeed, type ReleaseFeed } from "./feed.util";

const feed: ReleaseFeed = {
  id: "urn:loomkeep:releases:user-1",
  title: "Loomkeep · New episodes",
  description: "The latest episodes of the shows you follow.",
  link: "https://loomkeep.app/app/calendar",
  entries: [
    {
      id: "urn:loomkeep:episode:ep-1",
      title: "Law & Order — S01E02 · <Pilot>",
      link: "https://loomkeep.app/app/media/series/1?a=1&b=2",
      airDate: new Date("2026-09-20T00:00:00Z"),
    },
  ],
};

const now = new Date("2026-09-24T12:00:00Z");

describe("buildAtomFeed", () => {
  it("renders an Atom feed dated by its newest episode", () => {
    const xml = buildAtomFeed(feed, now);

    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain("<id>urn:loomkeep:releases:user-1</id>");
    expect(xml).toContain("<updated>2026-09-20T00:00:00.000Z</updated>");
    expect(xml).toContain("<author><name>Loomkeep</name></author>");
    expect(xml).toContain("<id>urn:loomkeep:episode:ep-1</id>");
  });

  it("escapes titles and links, which come from the catalog", () => {
    const xml = buildAtomFeed(feed, now);

    expect(xml).toContain(
      "<title>Law &amp; Order — S01E02 · &lt;Pilot&gt;</title>",
    );
    expect(xml).toContain(
      'href="https://loomkeep.app/app/media/series/1?a=1&amp;b=2"',
    );
    expect(xml).not.toContain("<Pilot>");
  });

  it("falls back to now when no episode aired in the window", () => {
    const xml = buildAtomFeed({ ...feed, entries: [] }, now);

    expect(xml).toContain("<updated>2026-09-24T12:00:00.000Z</updated>");
    expect(xml).not.toContain("<entry>");
  });
});

describe("buildRssFeed", () => {
  it("renders an RSS 2.0 channel with RFC 822 dates and stable guids", () => {
    const xml = buildRssFeed(feed, now);

    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain(
      "<description>The latest episodes of the shows you follow.</description>",
    );
    expect(xml).toContain(
      '<guid isPermaLink="false">urn:loomkeep:episode:ep-1</guid>',
    );
    expect(xml).toContain("<pubDate>Sun, 20 Sep 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain(
      "<title>Law &amp; Order — S01E02 · &lt;Pilot&gt;</title>",
    );
  });
});
