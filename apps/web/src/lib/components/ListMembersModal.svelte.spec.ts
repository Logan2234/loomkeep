import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserSummaryDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListMembersModal from "./ListMembersModal.svelte";

const person = (username: string, displayName: string): UserSummaryDto => ({
  id: username,
  username,
  displayName,
  profileAccess: "PUBLIC",
  avatarUrl: null,
});

let members: { user: UserSummaryDto; createdAt: string }[];
let candidates: UserSummaryDto[];
const removed = vi.fn();

beforeEach(() => {
  members = [
    {
      user: person("camille", "Camille Roux"),
      createdAt: "2026-09-12T10:00:00Z",
    },
  ];
  candidates = [person("theo", "Théo Marchand")];
  removed.mockClear();
  server.use(
    http.get(apiUrl("/lists/l1/members"), () => HttpResponse.json(members)),
    http.get(apiUrl("/lists/l1/members/candidates"), () =>
      HttpResponse.json(candidates),
    ),
    http.post(apiUrl("/lists/l1/members"), async ({ request }) => {
      const { username } = (await request.json()) as { username: string };
      const friend = candidates.find((c) => c.username === username)!;
      candidates = candidates.filter((c) => c !== friend);
      members = [
        ...members,
        { user: friend, createdAt: "2026-10-03T10:00:00Z" },
      ];
      return HttpResponse.json({}, { status: 201 });
    }),
    http.delete(apiUrl("/lists/l1/members/:userId"), ({ params }) => {
      removed(params.userId);
      members = members.filter((member) => member.user.id !== params.userId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(apiUrl("/lists/me/l1"), () => HttpResponse.json({})),
  );
});

function renderModal() {
  renderWithQuery(ListMembersModal, {
    listId: "l1",
    owner: person("bob", "Bob Durand"),
    onClose: vi.fn(),
  });
  return userEvent.setup();
}

describe("ListMembersModal", () => {
  it("lists the owner and the editors on the team tab", async () => {
    renderModal();

    expect(await screen.findByText("Camille Roux")).toBeTruthy();
    expect(screen.getByText("Bob Durand")).toBeTruthy();
    expect(screen.getByText(m.list_members_owner())).toBeTruthy();
  });

  it("removes an editor only once confirmed", async () => {
    const user = renderModal();
    const card = (await screen.findByText("Camille Roux")).closest("li")!;

    await user.click(
      within(card).getByRole("button", { name: m.common_remove() }),
    );
    expect(removed).not.toHaveBeenCalled();

    const confirm = within(card).getAllByRole("button", {
      name: m.common_remove(),
    });
    await user.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(removed).toHaveBeenCalledWith("camille"));
  });

  it("marks a friend as added in place on the invite tab", async () => {
    const user = renderModal();
    await screen.findByText("Camille Roux");

    await user.click(
      screen.getByRole("button", { name: m.list_members_add_friend() }),
    );
    const theo = (await screen.findByText("Théo Marchand")).closest("li")!;
    await user.click(
      within(theo).getByRole("button", { name: m.common_add() }),
    );

    await waitFor(() =>
      expect(
        within(screen.getByText("Théo Marchand").closest("li")!).getByText(
          m.list_members_added(),
        ),
      ).toBeTruthy(),
    );
  });
});
