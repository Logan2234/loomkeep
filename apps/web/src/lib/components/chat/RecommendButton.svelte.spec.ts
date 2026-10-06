import { appConfig } from "#lib/config.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { RecommendWorkRequestDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecommendButton from "./RecommendButton.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const SEVERANCE = {
  kind: "SERIES" as const,
  title: "Severance",
  imageUrl: null,
  href: "/app/media/series/95396",
  year: 2022,
};

let sent: RecommendWorkRequestDto[] = [];

beforeEach(() => {
  sent = [];
  appConfig.chatEnabled = true;
  server.use(
    http.get(apiUrl("/chat/friends"), () =>
      HttpResponse.json([
        { id: "u1", username: "lea", displayName: "Léa", avatarUrl: null },
        { id: "u2", username: "malo", displayName: "Malo", avatarUrl: null },
      ]),
    ),
    http.post(apiUrl("/chat/recommendations"), async ({ request }) => {
      sent.push((await request.json()) as RecommendWorkRequestDto);
      return HttpResponse.json({ sent: 2 });
    }),
  );
});

afterEach(() => {
  appConfig.chatEnabled = false;
});

describe("RecommendButton", () => {
  it("sends the work to the friends picked, with the note", async () => {
    const user = userEvent.setup();
    renderWithQuery(RecommendButton, { work: SEVERANCE });

    await user.click(screen.getByRole("button", { name: m.chat_recommend() }));
    await user.click(await screen.findByRole("button", { name: /Léa/ }));
    await user.click(screen.getByRole("button", { name: /Malo/ }));
    await user.type(
      screen.getByPlaceholderText(m.chat_recommend_note()),
      "La fin !",
    );
    await user.click(
      screen.getByRole("button", {
        name: m.chat_recommend_send_many({ count: 2 }),
      }),
    );

    await waitFor(() =>
      expect(sent).toEqual([
        {
          work: "/app/media/series/95396",
          usernames: ["lea", "malo"],
          text: "La fin !",
        },
      ]),
    );
  });

  it("isn't offered while Messages is off", () => {
    appConfig.chatEnabled = false;
    renderWithQuery(RecommendButton, { work: SEVERANCE });

    expect(screen.queryByRole("button", { name: m.chat_recommend() })).toBe(
      null,
    );
  });
});
