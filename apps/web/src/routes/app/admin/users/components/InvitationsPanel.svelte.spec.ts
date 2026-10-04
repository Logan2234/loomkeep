import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { page, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import type { AdminInvitationDto } from "@loomkeep/shared";
import { screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitationsPanel from "./InvitationsPanel.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

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

beforeEach(() => visit("/app/admin/users?tab=invitations"));

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

it("names the mobile renewal action and identifies the invitation before revoking it", async () => {
  server.use(
    http.get(apiUrl("/admin/invitations"), () =>
      HttpResponse.json({ items: [USED], hasMore: false }),
    ),
  );
  renderWithQuery(InvitationsPanel, {
    onInvite: vi.fn(),
    onRenewed: vi.fn(),
    onOpenUser: vi.fn(),
  });
  const renew = await screen.findByRole("button", {
    name: m.admin_invitations_renew(),
  });
  expect(renew.getAttribute("aria-label")).toBe(m.admin_invitations_renew());
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: m.admin_invitations_revoke() }));
  expect(
    within(screen.getByRole("dialog")).getByText(/Club ciné/),
  ).toBeTruthy();
});

it("sends invitation filters to the API and can reset an empty search", async () => {
  visit(
    "/app/admin/users?tab=invitations&invitationQ=missing&invitationStatus=expired",
  );
  const requests: URL[] = [];
  server.use(
    http.get(apiUrl("/admin/invitations"), ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return HttpResponse.json({
        items: url.searchParams.get("q") ? [] : [USED],
        hasMore: false,
      });
    }),
  );
  renderWithQuery(InvitationsPanel, {
    onInvite: vi.fn(),
    onRenewed: vi.fn(),
    onOpenUser: vi.fn(),
  });
  await screen.findByText(m.admin_invitations_filtered_empty());
  expect(requests[0].searchParams.get("q")).toBe("missing");
  expect(requests[0].searchParams.get("status")).toBe("expired");
  await userEvent
    .setup()
    .click(screen.getAllByRole("button", { name: m.admin_filters_reset() })[0]);
  await screen.findByText("Club ciné");
  expect(page.url.searchParams.get("tab")).toBe("invitations");
  expect(page.url.searchParams.has("invitationStatus")).toBe(false);
});

it.each([null, "camille@example.test"])(
  "renews only after confirmation (email: %s)",
  async (email) => {
    const invitation = { ...USED, email };
    const renewed = vi.fn();
    const request = vi.fn();
    server.use(
      http.get(apiUrl("/admin/invitations"), () =>
        HttpResponse.json({ items: [invitation], hasMore: false }),
      ),
      http.post(apiUrl("/admin/invitations/inv-1/renew"), () => {
        request();
        return HttpResponse.json({
          invitation,
          url: "https://example.test/invite/new",
          emailed: !!email,
        });
      }),
    );
    renderWithQuery(InvitationsPanel, {
      onInvite: vi.fn(),
      onRenewed: renewed,
      onOpenUser: vi.fn(),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: m.admin_invitations_renew() }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(m.admin_invitations_renew_warning(), {
        exact: false,
      }),
    ).toBeTruthy();
    if (email)
      expect(
        within(dialog).getByText(m.admin_invitations_renew_email({ email }), {
          exact: false,
        }),
      ).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: m.admin_invitations_renew() }),
    );
    await vi.waitFor(() =>
      expect(renewed).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://example.test/invite/new" }),
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
  },
);
