import { appConfig } from "#lib/config.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { RecommendWorkRequestDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareWorkModal from "./ShareWorkModal.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
}));

const SEVERANCE = {
  kind: "SERIES" as const,
  title: "Severance",
  imageUrl: null,
  href: "/app/media/series/95396",
  year: 2022,
};

const friend = (id: string, username: string, displayName: string) => ({
  id,
  username,
  displayName,
  avatarUrl: null,
});

let sent: RecommendWorkRequestDto[] = [];

beforeEach(() => {
  sent = [];
  appConfig.chatEnabled = true;
  server.use(
    http.get(apiUrl("/chat/friends"), () =>
      HttpResponse.json([
        friend("u1", "lea", "Léa"),
        friend("u2", "malo", "Malo"),
      ]),
    ),
    http.get(apiUrl("/chat/conversations"), () =>
      HttpResponse.json({
        items: [{ id: "cv1", peer: friend("u2", "malo", "Malo") }],
        hasMore: false,
      }),
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

describe("ShareWorkModal", () => {
  it("puts the friend written to last first, and sends to the friends picked", async () => {
    const user = userEvent.setup();
    renderWithQuery(ShareWorkModal, { work: SEVERANCE, onclose: vi.fn() });

    const group = await screen.findByRole("group", {
      name: m.share_work_send_to(),
    });
    await waitFor(() =>
      expect(group.textContent?.indexOf("Malo")).toBeLessThan(
        group.textContent?.indexOf("Léa") ?? 0,
      ),
    );

    await user.click(screen.getByRole("button", { name: /Léa/ }));
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

  // An 18+ title never becomes a card: the link and the QR code remain.
  it("only offers the link for a work that can't be sent", () => {
    renderWithQuery(ShareWorkModal, {
      work: SEVERANCE,
      sendable: false,
      onclose: vi.fn(),
    });

    expect(screen.queryByRole("group", { name: m.share_work_send_to() })).toBe(
      null,
    );
    expect(
      screen.getByRole("button", { name: new RegExp(m.common_copy_link()) }),
    ).toBeTruthy();
  });
});
