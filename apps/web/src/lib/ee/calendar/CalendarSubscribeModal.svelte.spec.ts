import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import CalendarSubscribeModal from "./CalendarSubscribeModal.svelte";

describe("CalendarSubscribeModal", () => {
  it("copies the premieres calendar link, fed by the same token", async () => {
    server.use(
      http.get(apiUrl("/users/me/calendar-token"), () =>
        HttpResponse.json({ token: "tok" }),
      ),
    );
    // After setup: user-event installs its own clipboard stub.
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderWithQuery(CalendarSubscribeModal, { onclose: () => {} });

    await screen.findByText(m.calendar_premieres_feed_title());
    const [, premieresButton] = screen.getAllByRole("button", {
      name: m.common_copy_link(),
    });
    await user.click(premieresButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        apiUrl("/library/premieres.ics?token=tok"),
      ),
    );
  });
});
