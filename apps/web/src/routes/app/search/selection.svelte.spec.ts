import { auth } from "#lib/auth/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/ui/toast-store.svelte.js";
import { ErrorCode } from "@loomkeep/shared/catalog";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

// In its own file: the page spec's other tests leave a debounced URL sync
// behind, which would switch this one's tab mid-test.
describe("Search page selection", () => {
  afterEach(() => {
    auth.user = null;
  });

  it("adds several results at once from selection mode", async () => {
    auth.user = {
      id: "user-1",
      enabledDomains: ["MEDIA", "GAMES"],
    } as unknown as typeof auth.user;
    const added: string[] = [];
    server.use(
      http.get(apiUrl("/games/search"), () =>
        HttpResponse.json({
          results: ["1020", "1021", "1022"].map((sourceId, index) => ({
            source: "IGDB",
            sourceId,
            title: `Zelda ${index + 1}`,
            year: 2017,
            coverUrl: null,
            isAdult: false,
          })),
        }),
      ),
      http.get(apiUrl("/games"), () =>
        HttpResponse.json({
          items: [{ id: "entry-3", game: { sourceId: "1022" } }],
          page: 1,
          limit: 50,
          hasMore: false,
        }),
      ),
      http.put(apiUrl("/games"), async ({ request }) => {
        const body = (await request.json()) as { sourceId: string };
        added.push(body.sourceId);
        return HttpResponse.json({ id: "entry", game: { id: "game-item" } });
      }),
      http.get(apiUrl("/*"), () => HttpResponse.json([])),
    );
    visit("/app/search?type=GAMES&query=zelda");
    const user = userEvent.setup();
    renderWithQuery(SearchPage, {});

    const first = await screen.findByRole(
      "link",
      { name: "Zelda 1" },
      { timeout: 4000 },
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Zelda 3" }).closest("[data-tracked]"),
      ).not.toBeNull(),
    );
    first.focus();
    await user.keyboard("x");
    await user.click(screen.getByRole("button", { name: "Zelda 2" }));
    // Already followed: neither action could do anything with it.
    await user.click(screen.getByRole("link", { name: "Zelda 3" }));

    expect(screen.getByRole("toolbar")).toHaveProperty(
      "textContent",
      expect.stringContaining(m.library_bulk_count_many({ count: 2 })),
    );
    await user.click(screen.getByRole("button", { name: m.common_add() }));

    await waitFor(() =>
      expect(toast.items.map((t) => t.message)).toContain(
        m.search_selection_added_many({ count: 2 }),
      ),
    );
    expect(added.sort()).toEqual(["1020", "1021"]);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("closes the list menu on Escape without leaving selection mode", async () => {
    auth.user = {
      id: "user-1",
      enabledDomains: ["GAMES"],
    } as unknown as typeof auth.user;
    server.use(
      http.get(apiUrl("/games/search"), () =>
        HttpResponse.json({
          results: [
            {
              source: "IGDB",
              sourceId: "1020",
              title: "Zelda",
              year: 2017,
              coverUrl: null,
              isAdult: false,
            },
          ],
        }),
      ),
      http.get(apiUrl("/games"), () =>
        HttpResponse.json({ items: [], page: 1, limit: 50, hasMore: false }),
      ),
      http.get(apiUrl("/lists/editable"), () =>
        HttpResponse.json([{ id: "list-1", title: "Coop" }]),
      ),
      http.get(apiUrl("/*"), () => HttpResponse.json([])),
    );
    visit("/app/search?type=GAMES&query=zelda");
    const user = userEvent.setup();
    renderWithQuery(SearchPage, {});

    const link = await screen.findByRole(
      "link",
      { name: "Zelda" },
      { timeout: 4000 },
    );
    link.focus();
    await user.keyboard("x");
    await user.click(
      screen.getByRole("button", { name: m.search_selection_list() }),
    );
    await screen.findByRole("menuitem", { name: "Coop" });

    await user.keyboard("{Escape}");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByRole("toolbar")).toBeTruthy();
  });

  it("adds the picks to a list, through the library, counting one already there as done", async () => {
    auth.user = {
      id: "user-1",
      enabledDomains: ["GAMES"],
    } as unknown as typeof auth.user;
    const listed: string[] = [];
    server.use(
      http.get(apiUrl("/games/search"), () =>
        HttpResponse.json({
          results: ["1020", "1021"].map((sourceId, index) => ({
            source: "IGDB",
            sourceId,
            title: `Zelda ${index + 1}`,
            year: 2017,
            coverUrl: null,
            isAdult: false,
          })),
        }),
      ),
      http.get(apiUrl("/games"), () =>
        HttpResponse.json({ items: [], page: 1, limit: 50, hasMore: false }),
      ),
      http.put(apiUrl("/games"), async ({ request }) => {
        const { sourceId } = (await request.json()) as { sourceId: string };
        return HttpResponse.json({ id: "e", game: { id: `item-${sourceId}` } });
      }),
      http.get(apiUrl("/lists/editable"), () =>
        HttpResponse.json([{ id: "list-1", title: "Coop" }]),
      ),
      http.post(apiUrl("/lists/list-1/items"), async ({ request }) => {
        const { targetId } = (await request.json()) as { targetId: string };
        if (targetId === "item-1021")
          return HttpResponse.json(
            { code: ErrorCode.ListItemAlreadyExists, message: "Already" },
            { status: 409 },
          );
        listed.push(targetId);
        return HttpResponse.json({});
      }),
      http.get(apiUrl("/*"), () => HttpResponse.json([])),
    );
    visit("/app/search?type=GAMES&query=zelda");
    const user = userEvent.setup();
    renderWithQuery(SearchPage, {});

    const first = await screen.findByRole(
      "link",
      { name: "Zelda 1" },
      { timeout: 4000 },
    );
    first.focus();
    await user.keyboard("x");
    await user.click(screen.getByRole("button", { name: "Zelda 2" }));
    await user.click(
      screen.getByRole("button", { name: m.search_selection_list() }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Coop" }));

    await waitFor(() =>
      expect(toast.items.map((t) => t.message)).toContain(
        m.search_selection_listed_many({ count: 2, list: "Coop" }),
      ),
    );
    expect(listed).toEqual(["item-1020"]);
  });
});
