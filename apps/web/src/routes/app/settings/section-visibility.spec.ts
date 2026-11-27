import { auth } from "#lib/auth.svelte.js";
import type { UserDto } from "@loomkeep/shared/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./nav";
import { isSectionVisible } from "./section-visibility";

const streaming = SETTINGS_SECTIONS.find((s) => s.slug === "streaming")!;

afterEach(() => {
  auth.user = null;
});

describe("isSectionVisible", () => {
  // "My services" holds the video platforms and the music services.
  it("shows my services while either video or music is on", () => {
    auth.user = { enabledDomains: ["BOOKS"] } as unknown as UserDto;
    expect(isSectionVisible(streaming)).toBe(false);

    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    expect(isSectionVisible(streaming)).toBe(true);

    auth.user = { enabledDomains: ["MUSIC"] } as unknown as UserDto;
    expect(isSectionVisible(streaming)).toBe(true);
  });
});
