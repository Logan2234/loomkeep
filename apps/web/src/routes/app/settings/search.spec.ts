import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./nav";
import { fold, groupSearchHits, hitHref, searchSettings } from "./search";

describe("settings search", () => {
  it("ignores case and diacritics", () => {
    expect(fold("Confidentialité")).toBe("confidentialite");
  });

  it("returns nothing for an empty query", () => {
    expect(searchSettings("   ")).toEqual([]);
  });

  it("finds a control that lives inside a section it isn't named after", () => {
    const hits = searchSettings("fuseau");

    expect(hits).toHaveLength(1);
    expect(hits[0].section.slug).toBe("communications");
    expect(hits[0].entryLabel).not.toBeNull();
  });

  it("matches an English keyword on a French label", () => {
    expect(searchSettings("timezone")[0].section.slug).toBe("communications");
  });

  it("lists a matching section before the rows that also match", () => {
    const hits = searchSettings("email");

    expect(hits[0].section.slug).toBe("communications");
    expect(hits[0].entryLabel).toBeNull();
    expect(hits.some((hit) => hit.entryLabel !== null)).toBe(true);
  });

  it("points a row match at its anchor, and a section match at the page", () => {
    const [row] = searchSettings("fuseau");
    const [section] = searchSettings("import");

    expect(hitHref(row)).toBe("/app/settings/communications#timezone");
    expect(hitHref(section)).toBe("/app/settings/import");
  });

  it("only searches the sections it is given", () => {
    const visible = SETTINGS_SECTIONS.filter((s) => !s.social);

    expect(searchSettings("ghost", visible)).toEqual([]);
  });

  it("groups matching controls under their owning page", () => {
    const groups = groupSearchHits(searchSettings("email"));
    const mfa = groups.find(
      (group) => group.section.slug === "two-factor-authentication",
    );

    expect(mfa?.entries.map((entry) => entry.entryId)).toContain("mfa-email");
  });

  it("finds navigation skins and individual domain controls by their aliases", () => {
    const dock = searchSettings("dock").find(
      (hit) => hit.entryId === "nav-style",
    )!;
    const anime = searchSettings("anime").find(
      (hit) => hit.entryId === "domain-media",
    )!;

    expect(dock).toMatchObject({
      section: { slug: "appearance" },
      entryId: "nav-style",
    });
    expect(anime).toMatchObject({
      section: { slug: "domains" },
      entryId: "domain-media",
    });
  });

  it("points mobile destinations to the mobile navigation setting", () => {
    const [leaderboard] = searchSettings("leaderboard");

    expect(leaderboard).toMatchObject({
      section: { slug: "appearance" },
      entryId: "mobile-nav",
    });
  });

  it("indexes each import source as a result that lands on its card", () => {
    const letterboxd = searchSettings("letterboxd").find(
      (hit) => hit.entryId === "import-source-letterboxd",
    )!;

    expect(letterboxd).toMatchObject({
      section: { slug: "import" },
      entryId: "import-source-letterboxd",
    });
    expect(hitHref(letterboxd)).toBe(
      "/app/settings/import#import-source-letterboxd",
    );
  });

  it("indexes import history and the social block list as settings controls", () => {
    const history = searchSettings("historique").find(
      (hit) => hit.entryId === "import-history",
    )!;
    const blocked = searchSettings("muted").find(
      (hit) => hit.entryId === "blocked-users-list",
    )!;

    expect(history).toMatchObject({
      section: { slug: "import" },
      entryId: "import-history",
    });
    expect(hitHref(history)).toBe("/app/settings/import#import-history");
    expect(blocked).toMatchObject({
      section: { slug: "blocked-users" },
      entryId: "blocked-users-list",
    });
  });
});
