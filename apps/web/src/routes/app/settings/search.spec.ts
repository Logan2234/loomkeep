import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./nav";
import { fold, searchSettings } from "./search";

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

  it("only searches the sections it is given", () => {
    const visible = SETTINGS_SECTIONS.filter((s) => !s.social);

    expect(searchSettings("ghost", visible)).toEqual([]);
  });
});
