import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { MyListDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddToListModal from "./AddToListModal.svelte";

const author = (displayName: string) => ({
  id: displayName,
  username: displayName.toLowerCase(),
  displayName,
  profileAccess: "PUBLIC",
  avatarUrl: null,
});

function list(
  id: string,
  title: string,
  role: "OWNER" | "EDITOR" = "OWNER",
): MyListDto {
  return {
    id,
    title,
    description: null,
    kind: "COLLECTION",
    visibility: "PRIVATE",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    author: author(role === "OWNER" ? "Bob" : "Camille"),
    itemCount: 3,
    previewImageUrls: [],
    role,
  } as MyListDto;
}

let lists: MyListDto[];
let membership: Record<string, string>;
const created = vi.fn();
const added = vi.fn();

beforeEach(() => {
  lists = [
    list("noel", "Films de Noël"),
    list("sf", "Top SF"),
    list("camille", "À voir avec Camille", "EDITOR"),
  ];
  membership = { sf: "item-sf" };
  created.mockClear();
  added.mockClear();
  server.use(
    http.get(apiUrl("/lists/editable"), () => HttpResponse.json(lists)),
    http.get(apiUrl("/lists/me/membership"), () =>
      HttpResponse.json(membership),
    ),
    http.post(apiUrl("/lists"), async ({ request }) => {
      const body = (await request.json()) as { title: string };
      created(body);
      const fresh = list("new", body.title);
      lists = [fresh, ...lists];
      return HttpResponse.json(fresh, { status: 201 });
    }),
    http.post(apiUrl("/lists/:id/items"), ({ params }) => {
      added(params.id);
      membership = { ...membership, [params.id as string]: "item-new" };
      return HttpResponse.json({ id: "item-new" }, { status: 201 });
    }),
  );
});

function renderModal() {
  renderWithQuery(AddToListModal, {
    targetType: "MEDIA",
    targetId: "dune",
    onClose: vi.fn(),
  });
  return userEvent.setup();
}

const switchNames = (section: HTMLElement) =>
  within(section)
    .getAllByRole("switch")
    .map((s) => s.getAttribute("aria-label"));

describe("AddToListModal", () => {
  it("splits own and shared lists, the ones holding the work first", async () => {
    renderModal();

    const mine = (
      await screen.findByRole("heading", { name: m.lists_title() })
    ).closest("section")!;
    const shared = screen
      .getByRole("heading", { name: m.add_to_list_shared() })
      .closest("section")!;

    expect(switchNames(mine)).toEqual(["Top SF", "Films de Noël"]);
    expect(switchNames(shared)).toEqual(["À voir avec Camille"]);
    expect(
      within(mine)
        .getByRole("switch", { name: "Top SF" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("adds the work when a list is switched on", async () => {
    const user = renderModal();

    await user.click(
      await screen.findByRole("switch", { name: "Films de Noël" }),
    );

    await waitFor(() => expect(added).toHaveBeenCalledWith("noel"));
  });

  it("offers to create a list the search doesn't find, with the work in it", async () => {
    const user = renderModal();
    await screen.findByRole("switch", { name: "Top SF" });

    await user.type(
      screen.getByRole("searchbox", { name: m.add_to_list_search() }),
      "Pépites 2024",
    );
    await user.click(
      screen.getByRole("button", {
        name: m.add_to_list_create({ title: "Pépites 2024" }),
      }),
    );

    await waitFor(() => expect(added).toHaveBeenCalledWith("new"));
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Pépites 2024" }),
    );
  });

  it("doesn't offer to create a list that already exists", async () => {
    const user = renderModal();
    await screen.findByRole("switch", { name: "Top SF" });

    await user.type(
      screen.getByRole("searchbox", { name: m.add_to_list_search() }),
      "top sf",
    );

    expect(
      screen.queryByRole("button", {
        name: m.add_to_list_create({ title: "top sf" }),
      }),
    ).toBeNull();
  });
});
