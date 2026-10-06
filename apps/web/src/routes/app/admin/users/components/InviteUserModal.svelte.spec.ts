import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  ErrorCode,
  type AdminInvitationLinkDto,
  type CreateAdminInvitationRequestDto,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InviteUserModal from "./InviteUserModal.svelte";

const URL_WITH_TOKEN = "https://app.example.com/register?invite=raw-token";

let sent: CreateAdminInvitationRequestDto | null;

function linkFor(
  body: CreateAdminInvitationRequestDto,
  emailed: boolean,
): AdminInvitationLinkDto {
  return {
    url: URL_WITH_TOKEN,
    emailed,
    invitation: {
      id: "inv-1",
      email: body.email ?? null,
      label: body.label ?? null,
      maxUses: body.maxUses,
      useCount: 0,
      status: "pending",
      expiresAt: "2026-10-05T12:00:00.000Z",
      revokedAt: null,
      emailedAt: emailed ? "2026-09-28T12:00:00.000Z" : null,
      createdAt: "2026-09-28T12:00:00.000Z",
      createdByName: "Logan",
      redeemedBy: [],
    },
  };
}

function answerWith(emailed: boolean) {
  server.use(
    http.post(apiUrl("/admin/invitations"), async ({ request }) => {
      sent = (await request.json()) as CreateAdminInvitationRequestDto;
      return HttpResponse.json(linkFor(sent, emailed), { status: 201 });
    }),
  );
}

beforeEach(() => {
  sent = null;
});

function renderModal(initial: AdminInvitationLinkDto | null = null) {
  const props = $state({ onclose: vi.fn(), onCreated: vi.fn(), initial });
  const result = renderWithQuery(InviteUserModal, props);
  return { ...result, props, user: userEvent.setup() };
}

const submitButton = () =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: m.admin_invitations_create(),
  });

describe("InviteUserModal", () => {
  it("needs an address before an email invitation can be created", async () => {
    const { user } = renderModal();

    expect(submitButton().disabled).toBe(true);

    await user.type(
      screen.getByRole("textbox", { name: m.admin_invitations_email_label() }),
      "bob@example.com",
    );

    expect(submitButton().disabled).toBe(false);
  });

  it("sends an address-bound invitation and shows the mailed link", async () => {
    answerWith(true);
    const { user, props } = renderModal();

    await user.type(
      screen.getByRole("textbox", { name: m.admin_invitations_email_label() }),
      "bob@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: m.admin_invitations_validity_30() }),
    );
    await user.click(submitButton());

    expect(
      await screen.findByText(
        m.admin_invitations_emailed({ email: "bob@example.com" }),
      ),
    ).toBeTruthy();
    expect(sent).toEqual({
      email: "bob@example.com",
      maxUses: 1,
      validityDays: 30,
    });
    expect(
      screen.getByRole<HTMLInputElement>("textbox", {
        name: m.admin_invitations_link_label(),
      }).value,
    ).toBe(URL_WITH_TOKEN);
    expect(props.onCreated).toHaveBeenCalledOnce();
  });

  it("creates a multi-seat shareable link with a label", async () => {
    answerWith(false);
    const { user } = renderModal();

    await user.click(
      screen.getByRole("button", { name: m.admin_invitations_mode_link() }),
    );
    const more = await screen.findByRole("button", {
      name: m.admin_invitations_places_increase(),
    });
    await user.click(more);
    await user.click(more);
    await user.type(
      screen.getByRole("textbox", { name: /Libellé|Label/ }),
      "Famille",
    );
    await user.click(submitButton());

    await screen.findByText(m.admin_invitations_ready_title());
    expect(sent).toEqual({ label: "Famille", maxUses: 3, validityDays: 7 });
    expect(screen.queryByText(m.admin_invitations_not_emailed())).toBeNull();
  });

  it("warns when an address-bound invitation couldn't be mailed", async () => {
    answerWith(false);
    const { user } = renderModal();

    await user.type(
      screen.getByRole("textbox", { name: m.admin_invitations_email_label() }),
      "bob@example.com",
    );
    await user.click(submitButton());

    expect(
      await screen.findByText(m.admin_invitations_not_emailed()),
    ).toBeTruthy();
  });

  it("shows the API's refusal and stays on the form", async () => {
    server.use(
      http.post(apiUrl("/admin/invitations"), () =>
        HttpResponse.json(
          {
            statusCode: 409,
            code: ErrorCode.AdminInvitationEmailRegistered,
            message: "taken",
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderModal();

    await user.type(
      screen.getByRole("textbox", { name: m.admin_invitations_email_label() }),
      "taken@example.com",
    );
    await user.click(submitButton());

    expect(
      await screen.findByText(m.apierr_admin_invitation_email_registered()),
    ).toBeTruthy();
    expect(submitButton()).toBeTruthy();
  });

  it("opens straight on a renewed link and goes back to a blank form", async () => {
    const { user } = renderModal(
      linkFor({ maxUses: 5, validityDays: 7 }, false),
    );

    expect(screen.getByText(m.admin_invitations_renewed_title())).toBeTruthy();
    expect(
      screen.getByText(m.admin_invitations_places_count({ count: 5 })),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: m.admin_invitations_invite_another(),
      }),
    );

    await waitFor(() => expect(submitButton()).toBeTruthy());
  });
});
