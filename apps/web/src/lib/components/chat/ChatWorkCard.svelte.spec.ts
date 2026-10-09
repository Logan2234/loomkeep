import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageWorkDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import ChatWorkCard from "./ChatWorkCard.svelte";

const OUTER_WILDS: MessageWorkDto = {
  kind: "GAME",
  title: "Outer Wilds",
  imageUrl: null,
  href: "/app/games/11737",
  year: 2019,
};

afterEach(() => {
  auth.user = null;
});

describe("ChatWorkCard", () => {
  it("opens the work's page", () => {
    auth.user = { enabledDomains: ["MEDIA", "GAMES"] } as unknown as UserDto;
    renderWithQuery(ChatWorkCard, { work: OUTER_WILDS });

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/app/games/11737",
    );
  });

  // The page of a domain the viewer turned off wouldn't open.
  it("warns instead of linking when the work's domain is off", () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    renderWithQuery(ChatWorkCard, { work: OUTER_WILDS });

    expect(screen.queryByRole("link")).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.chat_work_domain_off({ domain: m.common_Games() }),
      }),
    ).toBeTruthy();
  });
});
