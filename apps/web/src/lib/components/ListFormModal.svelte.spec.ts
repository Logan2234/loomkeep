import { appConfig } from "$lib/config.svelte";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListFormModal from "./ListFormModal.svelte";

afterEach(() => {
  appConfig.socialEnabled = false;
});

describe("ListFormModal", () => {
  it("creates a list with the kind and audience picked", async () => {
    appConfig.socialEnabled = true;
    const sent = vi.fn();
    server.use(
      http.post(apiUrl("/lists"), async ({ request }) => {
        const body = await request.json();
        sent(body);
        return HttpResponse.json({ id: "l1", ...(body as object) });
      }),
    );
    const onSaved = vi.fn();
    renderWithQuery(ListFormModal, { onClose: vi.fn(), onSaved });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(m.common_title()), "Top SF");
    await user.click(
      screen.getByRole("button", { name: new RegExp(m.lists_kind_ranked()) }),
    );
    await user.click(screen.getByRole("button", { name: m.common_public() }));

    expect(screen.getByText(m.lists_visibility_public_hint())).toBeTruthy();

    await user.click(screen.getByRole("button", { name: m.common_save() }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Top SF",
        kind: "RANKED",
        visibility: "PUBLIC",
      }),
    );
  });
});
