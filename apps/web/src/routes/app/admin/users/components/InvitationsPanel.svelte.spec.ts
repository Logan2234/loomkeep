import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { AdminInvitationDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import InvitationsPanel from "./InvitationsPanel.svelte";

const CAMILLE = {
  id: "u-camille",
  username: "camille",
  displayName: "Camille Roux",
  avatarUrl: null,
};

const USED: AdminInvitationDto = {
  id: "inv-1",
  email: null,
  label: "Club ciné",
  maxUses: 5,
  useCount: 1,
  status: "pending",
  expiresAt: "2026-10-20T12:00:00.000Z",
  revokedAt: null,
  emailedAt: null,
  createdAt: "2026-09-28T12:00:00.000Z",
  createdByName: "Logan",
  redeemedBy: [CAMILLE],
};

describe("InvitationsPanel", () => {
  it("opens the account of someone who used an invitation", async () => {
    server.use(
      http.get(apiUrl("/admin/invitations"), () =>
        HttpResponse.json({ items: [USED], hasMore: false }),
      ),
    );
    const onOpenUser = vi.fn();
    renderWithQuery(InvitationsPanel, {
      onInvite: vi.fn(),
      onRenewed: vi.fn(),
      onOpenUser,
    });

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /Camille Roux/ }));

    expect(onOpenUser).toHaveBeenCalledWith(CAMILLE);
  });
});
