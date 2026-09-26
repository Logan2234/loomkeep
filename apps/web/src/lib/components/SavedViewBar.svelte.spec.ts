import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import {
  ErrorCode,
  type SavedViewDto,
  type SavedViewFiltersDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SavedViewBar from "./SavedViewBar.svelte";

const view = (
  id: string,
  name: string,
  filters: SavedViewFiltersDto,
  domain: SavedViewDto["domain"] = "BOOKS",
): SavedViewDto => ({
  id,
  name,
  domain,
  filters,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});

const READING = view("v1", "En cours", { statuses: ["READING"] });

let views: SavedViewDto[];
let calls: { method: string; path: string; body: unknown }[];

beforeEach(() => {
  views = [READING];
  calls = [];

  const record =
    (respond: (body: unknown, id?: string) => Response) =>
    async ({
      request,
      params,
    }: {
      request: Request;
      params: Record<string, unknown>;
    }) => {
      const text = await request.text();
      const body = text ? JSON.parse(text) : undefined;
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname.replace(/^\/api/, ""),
        body,
      });
      return respond(body, params.id as string | undefined);
    };

  server.use(
    http.get(apiUrl("/saved-views"), () => HttpResponse.json(views)),
    http.post(
      apiUrl("/saved-views"),
      record((body) => {
        const created = view("new", (body as SavedViewDto).name, {});
        views = [...views, { ...created, ...(body as object) }];
        return HttpResponse.json(created, { status: 201 });
      }),
    ),
    http.patch(
      apiUrl("/saved-views/:id"),
      record((body, id) => {
        views = views.map((v) =>
          v.id === id ? { ...v, ...(body as object) } : v,
        );
        return HttpResponse.json(views.find((v) => v.id === id));
      }),
    ),
    http.delete(
      apiUrl("/saved-views/:id"),
      record((_, id) => {
        views = views.filter((v) => v.id !== id);
        return new HttpResponse(null, { status: 200 });
      }),
    ),
  );
});

function renderBar(
  current: SavedViewFiltersDto = {},
  activeId: string | null = null,
) {
  const props = $state({
    domain: "BOOKS" as const,
    current,
    defaultSort: "addedAt",
    activeId,
    onApply: vi.fn(),
  });
  renderWithQuery(SavedViewBar, props);
  return { props, user: userEvent.setup() };
}

const chip = (name: string) => screen.findByRole("button", { name });
// The "Nouveau" badge joins its accessible name for 21 days after release.
const saveButtonName = new RegExp(`^${m.saved_view_save()}`);

describe("SavedViewBar", () => {
  it("stays out of the way with no view and untouched filters", async () => {
    views = [];
    renderBar();

    await waitFor(() => expect(calls).toEqual([]));
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("only lists the views of this library", async () => {
    views = [READING, view("v2", "Films du dimanche", {}, "MEDIA")];
    renderBar();

    expect(await chip("En cours")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Films du dimanche" }),
    ).toBeNull();
  });

  it("applies a view, and clears it on a second click", async () => {
    const { props, user } = renderBar();
    const reading = await chip("En cours");

    await user.click(reading);
    expect(props.onApply).toHaveBeenLastCalledWith({ statuses: ["READING"] });
    expect(reading.getAttribute("aria-pressed")).toBe("true");

    await user.click(reading);
    expect(props.onApply).toHaveBeenLastCalledWith({});
    expect(reading.getAttribute("aria-pressed")).toBe("false");
  });

  it("saves the current filters as a new view", async () => {
    const current = { statuses: ["READ"], favorite: true };
    const { user } = renderBar(current);

    await user.click(
      await screen.findByRole("button", { name: saveButtonName }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "  Coups de cœur  ");
    await user.click(
      within(dialog).getByRole("button", { name: m.common_save() }),
    );

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: "POST",
          path: "/saved-views",
          body: { name: "Coups de cœur", domain: "BOOKS", filters: current },
        },
      ]),
    );
    expect(await chip("Coups de cœur")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the name dialog open with the reason a save was refused", async () => {
    server.use(
      http.post(apiUrl("/saved-views"), () =>
        HttpResponse.json(
          {
            code: ErrorCode.LibrarySavedViewFreeQuotaExceeded,
            message: "quota",
          },
          { status: 403 },
        ),
      ),
    );
    const { user } = renderBar({ favorite: true });

    await user.click(
      await screen.findByRole("button", { name: saveButtonName }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Favoris");
    await user.click(
      within(dialog).getByRole("button", { name: m.common_save() }),
    );

    expect(
      await within(dialog).findByText(
        resolveApiError(
          new ApiError(403, "", ErrorCode.LibrarySavedViewFreeQuotaExceeded),
        ),
      ),
    ).toBeTruthy();
  });

  it("offers to update the view in use once the filters drift from it", async () => {
    const { props, user } = renderBar({ statuses: ["READING"] }, "v1");
    await chip("En cours");
    expect(
      screen.queryByText(m.saved_view_modified(), { exact: false }),
    ).toBeNull();

    props.current = { statuses: ["READING"], favorite: true };

    await user.click(
      await screen.findByRole("button", { name: m.saved_view_update() }),
    );

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: "PATCH",
          path: "/saved-views/v1",
          body: { filters: { statuses: ["READING"], favorite: true } },
        },
      ]),
    );
  });

  it("does not count a mere reordering of statuses as a change", async () => {
    views = [view("v1", "En cours", { statuses: ["READING", "READ"] })];
    renderBar({ statuses: ["READ", "READING"] }, "v1");

    await chip("En cours");
    expect(
      screen.queryByRole("button", { name: m.saved_view_update() }),
    ).toBeNull();
  });

  it("renames the view in use", async () => {
    const { user } = renderBar({ statuses: ["READING"] }, "v1");
    await chip("En cours");

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(screen.getByRole("menuitem", { name: m.common_rename() }));
    const input = within(screen.getByRole("dialog")).getByRole("textbox");
    expect((input as HTMLInputElement).value).toBe("En cours");
    await user.clear(input);
    await user.type(input, "À lire ce mois-ci");
    await user.click(screen.getByRole("button", { name: m.common_save() }));

    expect(await chip("À lire ce mois-ci")).toBeTruthy();
    expect(calls).toEqual([
      {
        method: "PATCH",
        path: "/saved-views/v1",
        body: { name: "À lire ce mois-ci" },
      },
    ]);
  });

  it("deletes the view in use after confirmation", async () => {
    const { user } = renderBar({ statuses: ["READING"] }, "v1");
    await chip("En cours");

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(screen.getByRole("menuitem", { name: m.common_delete() }));
    expect(
      screen.getByText(m.saved_view_delete_message({ name: "En cours" })),
    ).toBeTruthy();
    expect(calls).toEqual([]);

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: m.common_delete(),
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "En cours" })).toBeNull(),
    );
    expect(calls).toEqual([
      { method: "DELETE", path: "/saved-views/v1", body: undefined },
    ]);
  });
});
