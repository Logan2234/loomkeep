import { API_URL } from "#lib/api/client.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ArrFeedModal from "./ArrFeedModal.svelte";

function withToken() {
  server.use(
    http.get(apiUrl("/users/me/calendar-token"), () =>
      HttpResponse.json({ token: "tok" }),
    ),
  );
}

describe("ArrFeedModal", () => {
  it("gives the pile's Radarr and Sonarr links", async () => {
    withToken();
    renderWithQuery(ArrFeedModal, { onclose: () => {} });

    expect(
      await screen.findByText(`${API_URL}/library/radarr.json?token=tok`),
    ).toBeTruthy();
    expect(
      screen.getByText(`${API_URL}/library/sonarr.json?token=tok`),
    ).toBeTruthy();
    expect(screen.getByText(m.settings_arr_pile_movies())).toBeTruthy();
  });

  it("copies a list's own Sonarr link", async () => {
    withToken();
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderWithQuery(ArrFeedModal, {
      list: { id: "list-1", title: "Films à télécharger" },
      onclose: () => {},
    });

    await screen.findByText(m.settings_arr_list_series());
    const [, sonarrButton] = screen.getAllByRole("button", {
      name: m.common_copy_link(),
    });
    await user.click(sonarrButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${API_URL}/lists/list-1/sonarr.json?token=tok`,
      ),
    );
  });
});
