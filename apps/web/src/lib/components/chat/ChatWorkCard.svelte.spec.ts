import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageWorkDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import ChatWorkCard from "./ChatWorkCard.svelte";

const OUTER_WILDS: MessageWorkDto = {
  kind: "GAME",
  title: "Outer Wilds",
  imageUrl: null,
  href: "/app/games/11737",
  year: 2019,
  inLibrary: false,
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

  it("adds the work to the library, to play", async () => {
    let added: unknown = null;
    server.use(
      http.put(apiUrl("/games"), async ({ request }) => {
        added = await request.json();
        return HttpResponse.json({});
      }),
    );
    auth.user = { enabledDomains: ["GAMES"] } as unknown as UserDto;
    const user = userEvent.setup();
    renderWithQuery(ChatWorkCard, { work: OUTER_WILDS });

    await user.click(
      screen.getByRole("button", {
        name: m.chat_work_add({ title: "Outer Wilds" }),
      }),
    );

    await waitFor(() =>
      expect(added).toEqual({
        source: "IGDB",
        sourceId: "11737",
        status: "BACKLOG",
      }),
    );
    expect(
      await screen.findByRole("img", { name: m.chat_work_in_library() }),
    ).toBeTruthy();
  });

  it("offers no Add for a work already tracked", () => {
    auth.user = { enabledDomains: ["GAMES"] } as unknown as UserDto;
    renderWithQuery(ChatWorkCard, {
      work: { ...OUTER_WILDS, inLibrary: true },
    });

    expect(
      screen.queryByRole("button", {
        name: m.chat_work_add({ title: "Outer Wilds" }),
      }),
    ).toBe(null);
  });

  // The page of a domain the viewer turned off wouldn't open.
  it("warns instead of linking when the work's domain is off", () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    renderWithQuery(ChatWorkCard, { work: OUTER_WILDS });

    expect(screen.queryByRole("link")).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.common_work_domain_off({ domain: m.common_Games() }),
      }),
    ).toBeTruthy();
  });
});
