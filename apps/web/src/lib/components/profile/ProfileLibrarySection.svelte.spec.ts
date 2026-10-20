import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import type { ProfileDomainStatDto, UserDto } from "@loomkeep/shared";
import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import ProfileLibrarySection from "./ProfileLibrarySection.svelte";

const stat = (
  domain: ProfileDomainStatDto["domain"],
  count: number,
): ProfileDomainStatDto => ({ domain, visible: true, count, favorites: 0 });

const DOMAINS = [
  stat("MEDIA", 12),
  stat("GAMES", 4),
  stat("BOOKS", 3),
  stat("MUSIC", 7),
];

afterEach(() => {
  auth.user = null;
});

describe("ProfileLibrarySection", () => {
  it("lists only the viewer's domains, in their order", () => {
    auth.user = {
      enabledDomains: ["MEDIA", "BOOKS"],
      domainOrder: ["BOOKS", "MEDIA"],
    } as unknown as UserDto;
    render(ProfileLibrarySection, { domains: DOMAINS, selfManage: true });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app/books",
      "/app/media",
    ]);
    expect(screen.queryByText(m.common_Games())).toBe(null);
    // The bar's total leaves the hidden domains out too.
    expect(screen.getByText(`15 ${m.library_title_many()}`)).toBeTruthy();
  });

  it("shows a coming-soon domain the viewer opted into", () => {
    auth.user = {
      enabledDomains: ["MEDIA", "BOARDGAMES"],
      domainOrder: [],
    } as unknown as UserDto;
    render(ProfileLibrarySection, { domains: DOMAINS, selfManage: true });

    expect(screen.getByText(m.common_Boardgames())).toBeTruthy();
    expect(screen.getByText(m.common_coming_soon())).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
