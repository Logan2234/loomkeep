import { chat } from "#lib/chat/chat.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentsPanel from "./CommentsPanel.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("#lib/realtime/socket.js", () => ({
  joinRealtimeRoom: () => () => {},
  onRealtimeEvent: () => () => {},
}));

afterEach(() => {
  appConfig.chatEnabled = false;
  chat.close();
  chat.activeWork = null;
});

describe("CommentsPanel", () => {
  it("opens the work's discussion in Messages once they're on", async () => {
    appConfig.chatEnabled = true;
    server.use(
      http.get(apiUrl("/comments/MEDIA/m1/count"), () =>
        HttpResponse.json({ count: 4 }),
      ),
    );
    renderWithQuery(CommentsPanel, {
      targetType: "MEDIA",
      targetId: "m1",
      title: "Severance",
      revealSpoilersByDefault: true,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: m.media_comments_title({ target: "Severance" }),
      }),
    );

    expect(chat.open).toBe(true);
    expect(chat.tab).toBe("works");
    expect(chat.activeWork).toMatchObject({
      targetType: "MEDIA",
      targetId: "m1",
      revealSpoilers: true,
    });
    expect(screen.queryByRole("dialog")).toBe(null);
  });
});
