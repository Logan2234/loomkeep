import { auth } from "#lib/auth.svelte.js";
import type { UserDto } from "@loomkeep/shared";
import { afterEach, describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./nav";
import { isSectionVisible } from "./section-visibility";

const streaming = SETTINGS_SECTIONS.find((s) => s.slug === "streaming")!;

afterEach(() => {
  auth.user = null;
});

describe("isSectionVisible", () => {
  // "Services" only feeds "Où regarder", a video page.
  it("hides the streaming services while the video domain is off", () => {
    auth.user = { enabledDomains: ["BOOKS"] } as unknown as UserDto;
    expect(isSectionVisible(streaming)).toBe(false);

    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    expect(isSectionVisible(streaming)).toBe(true);
  });
});
