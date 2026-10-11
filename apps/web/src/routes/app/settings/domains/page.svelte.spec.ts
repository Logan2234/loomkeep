import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import DomainsPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
afterEach(() => {
  auth.user = null;
});

it("preserves all tiles while the dragged domain has a placeholder", async () => {
  auth.user = {
    enabledDomains: ["MEDIA", "GAMES"],
    domainOrder: [],
  } as unknown as UserDto;
  server.use(
    http.get(apiUrl("/library/domain-counts"), () => HttpResponse.json({})),
  );
  renderWithQuery(DomainsPage, {});
  const handle = screen.getAllByLabelText(m.common_reorder())[0];
  const zone = handle.closest(".grid")!;
  await fireEvent(
    zone,
    new CustomEvent("consider", {
      detail: {
        info: { source: "pointer", trigger: "dragStarted" },
        items: [
          {
            id: "id:dnd-shadow-placeholder-0000",
            domain: "MEDIA",
            isDndShadowItem: true,
          },
          ...["GAMES", "BOOKS", "MUSIC", "PODCASTS", "BOARDGAMES"].map(
            (id) => ({ id, domain: id }),
          ),
        ],
      },
    }),
  );
  await waitFor(() =>
    expect(screen.getAllByLabelText(m.common_reorder())).toHaveLength(6),
  );
  expect(screen.getByText(m.common_Media())).toBeTruthy();
});
