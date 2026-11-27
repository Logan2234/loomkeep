import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import InviteFriendModal from "./InviteFriendModal.svelte";

const LINK = "https://app.example.com/register?invite=abc";
const NEW_LINK = "https://app.example.com/register?invite=xyz";

describe("InviteFriendModal", () => {
  it("copies the member's link and says how many joined with it", async () => {
    server.use(
      http.get(apiUrl("/users/me/invitation"), () =>
        HttpResponse.json({ url: LINK, joinedCount: 2 }),
      ),
    );
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderWithQuery(InviteFriendModal, { onclose: () => {} });

    await screen.findByText(LINK);
    expect(
      screen.getByText(m.chat_invite_joined_many({ count: 2 })),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: m.common_copy_link() }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
  });

  it("asks before renewing, then copies the new link", async () => {
    let renewed = false;
    server.use(
      http.get(apiUrl("/users/me/invitation"), () =>
        HttpResponse.json({ url: renewed ? NEW_LINK : LINK, joinedCount: 0 }),
      ),
      http.post(apiUrl("/users/me/invitation/renew"), () => {
        renewed = true;
        return HttpResponse.json({ url: NEW_LINK, joinedCount: 0 });
      }),
    );
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderWithQuery(InviteFriendModal, { onclose: () => {} });

    await screen.findByText(LINK);
    await user.click(
      screen.getByRole("button", { name: m.chat_invite_renew() }),
    );
    expect(screen.getByText(m.chat_invite_renew_confirm())).toBeTruthy();
    expect(renewed).toBe(false);

    await user.click(
      screen.getByRole("button", { name: m.chat_invite_renew() }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(NEW_LINK));
    await screen.findByText(NEW_LINK);
  });
});
