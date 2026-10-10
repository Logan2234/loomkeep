import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import { ErrorCode, type UserDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListPage from "./+page.svelte";

vi.mock("$app/state", () => ({
  page: {
    params: { id: "list" },
    url: new URL("http://localhost/app/lists/list"),
  },
}));
vi.mock("#lib/realtime/socket.js", () => ({
  joinRealtimeRoom: () => () => {},
  onRealtimeEvent: () => () => {},
}));
afterEach(() => {
  for (const item of toast.items) toast.dismiss(item.id);
  auth.user = null;
});

const items = ["first", "second"].map((id) => ({
  id,
  targetType: "BOOK",
  targetId: id,
  position: 0,
  addedAt: "2026-10-01T00:00:00Z",
  target: { title: id, imageUrl: null, href: null },
}));
const list = {
  id: "list",
  title: "Reading",
  kind: "RANKED",
  visibility: "PRIVATE",
  collaborative: false,
  viewerRole: "OWNER",
  items,
  updatedAt: "2026-10-04T00:00:00Z",
  owner: {
    id: "owner",
    username: "owner",
    displayName: "Owner",
    avatarUrl: null,
  },
  members: [],
};

describe("list action failures", () => {
  it("keeps an item and shows an error when removal fails", async () => {
    server.use(
      http.get(apiUrl("/lists/me/list"), () => HttpResponse.json(list)),
      http.delete(apiUrl("/lists/list/items/first"), () =>
        HttpResponse.json({ code: ErrorCode.InternalError }, { status: 500 }),
      ),
    );
    renderWithQuery(ListPage, {});
    const user = userEvent.setup();
    const buttons = await screen.findAllByRole("button", {
      name: m.list_item_remove(),
    });
    await user.click(buttons[0]);
    await waitFor(() =>
      expect(toast.items.some((item) => item.variant === "error")).toBe(true),
    );
    expect(screen.getAllByText("first").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(buttons[0].hasAttribute("disabled")).toBe(false),
    );
  });

  it.each([500, 409])(
    "reloads the list after a reorder returns %s",
    async (status) => {
      let reads = 0;
      server.use(
        http.get(apiUrl("/lists/me/list"), () => {
          reads++;
          return HttpResponse.json(list);
        }),
        http.put(apiUrl("/lists/list/items/order"), () =>
          HttpResponse.json({ code: ErrorCode.InternalError }, { status }),
        ),
      );
      renderWithQuery(ListPage, {});
      await screen.findAllByText("first");
      await fireEvent(
        screen.getByRole("list"),
        new CustomEvent("finalize", {
          detail: { items: [...items].reverse() },
        }),
      );
      await waitFor(() => expect(reads).toBe(2));
      expect(screen.getAllByRole("listitem")[0].textContent).toContain("first");
      if (status === 409)
        expect(screen.getByText(m.list_reorder_conflict())).toBeTruthy();
      else
        expect(toast.items.some((item) => item.variant === "error")).toBe(true);
    },
  );
});

describe("works of a domain the viewer turned off", () => {
  it("stay listed, with a warning instead of a link", async () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    server.use(
      http.get(apiUrl("/lists/me/list"), () =>
        HttpResponse.json({
          ...list,
          items: [
            {
              ...items[0],
              targetType: "MEDIA",
              target: { title: "Dune", imageUrl: null, href: "/app/media/1" },
            },
            {
              ...items[1],
              target: {
                title: "Neuromancer",
                imageUrl: null,
                href: "/app/books/2",
              },
            },
          ],
        }),
      ),
    );
    renderWithQuery(ListPage, {});
    await screen.findAllByText("Neuromancer");

    expect(
      screen.getByRole("link", { name: /Dune/ }).getAttribute("href"),
    ).toBe("/app/media/1");
    expect(screen.queryByRole("link", { name: /Neuromancer/ })).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.common_work_domain_off({ domain: m.common_Books() }),
      }),
    ).toBeTruthy();
  });
});
