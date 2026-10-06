import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UpdateUserRequestDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import AlertGrid from "./AlertGrid.svelte";

let patched: UpdateUserRequestDto | null;

beforeEach(() => {
  patched = null;
  auth.user = {
    id: "u1",
    alertPrefs: { COMMENT_REPLY: { push: true } },
  } as unknown as UserDto;
  server.use(
    http.patch(apiUrl("/users/me"), async ({ request }) => {
      patched = (await request.json()) as UpdateUserRequestDto;
      return HttpResponse.json({
        ...auth.user,
        alertPrefs: patched.alertPrefs,
      });
    }),
  );
});

const props = {
  anchor: "activity-alerts",
  title: "Activity",
  description: "",
  columns: ["bell", "push"] as ("bell" | "push")[],
  groups: [
    {
      label: "Comments",
      alerts: [
        { key: "COMMENT_REPLY" as const, label: "Replies" },
        { key: "COMMENT_REACTIONS" as const, label: "Reactions" },
      ],
    },
    {
      label: "Follows",
      alerts: [{ key: "FOLLOW" as const, label: "New followers" }],
    },
  ],
};

const pushSwitch = (label: string) =>
  screen.queryByRole<HTMLButtonElement>("switch", {
    name: `${label} · ${m.settings_communications_push()}`,
  });

describe("AlertGrid", () => {
  it("shows each alert's own choice, falling back to its default", () => {
    renderWithQuery(AlertGrid, props);

    expect(pushSwitch("Replies")?.getAttribute("aria-checked")).toBe("true");
    expect(pushSwitch("New followers")?.getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("offers no push for an alert that never pushes", () => {
    renderWithQuery(AlertGrid, props);

    expect(pushSwitch("Reactions")).toBeNull();
  });

  it("saves just the flipped alert and channel", async () => {
    const user = userEvent.setup();
    renderWithQuery(AlertGrid, props);

    await user.click(pushSwitch("New followers")!);

    await waitFor(() =>
      expect(patched).toEqual({ alertPrefs: { FOLLOW: { push: true } } }),
    );
  });

  it("names each section for the rows under it", () => {
    renderWithQuery(AlertGrid, props);

    expect(screen.getByRole("rowheader", { name: "Comments" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Follows" })).toBeTruthy();
  });

  it("keeps the push choices but locks them while no device receives push", () => {
    renderWithQuery(AlertGrid, { ...props, pushBlocked: true });

    const replies = pushSwitch("Replies")!;
    expect(replies.disabled).toBe(true);
    expect(replies.getAttribute("aria-checked")).toBe("true");
  });
});
