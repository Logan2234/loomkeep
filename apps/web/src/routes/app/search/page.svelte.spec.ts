import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./+page.svelte";

const { scanNatively } = vi.hoisted(() => ({
  scanNatively: vi.fn(async () => null),
}));
vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
vi.mock("#lib/native/scan.js", () => ({
  isNativeScanAvailable: () => true,
  scanNatively,
}));

describe("Search page", () => {
  beforeEach(() => {
    scanNatively.mockClear();
    // The search panels' own queries aren't what these specs are about.
    server.use(http.get(apiUrl("/*"), () => HttpResponse.json([])));
    auth.user = {
      id: "user-1",
      enabledDomains: ["MEDIA", "BOOKS", "GAMES"],
    } as unknown as typeof auth.user;
  });
  afterEach(() => {
    auth.user = null;
  });

  it("opens the scanner when the Android widget's button links here", async () => {
    visit("/app/search?type=BOOKS&scan=1");

    renderWithQuery(SearchPage, {});

    await waitFor(() => expect(scanNatively).toHaveBeenCalledTimes(1));
  });

  it("follows the category of a new link while it's already open", async () => {
    visit("/app/search?type=GAMES");
    renderWithQuery(SearchPage, {});
    const active = (name: string) =>
      screen
        .getByRole("button", { name })
        .classList.contains("guichet-tab-active");
    await waitFor(() => expect(active(m.common_Games())).toBe(true));

    await goto("/app/search?type=BOOKS");

    await waitFor(() => expect(active(m.common_Books())).toBe(true));
  });

  it("doesn't scan on an ordinary visit", async () => {
    visit("/app/search?type=BOOKS");

    renderWithQuery(SearchPage, {});

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(scanNatively).not.toHaveBeenCalled();
  });
});
