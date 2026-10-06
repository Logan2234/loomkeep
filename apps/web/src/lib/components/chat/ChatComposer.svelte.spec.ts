import { chatDrafts } from "#lib/chat/chat.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatComposer from "./ChatComposer.svelte";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock("#lib/realtime/socket.js", () => ({ socket: { emit } }));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

let sent: unknown[] = [];

beforeEach(() => {
  sent = [];
  emit.mockClear();
  chatDrafts.clear();
  layout.compact = false;
  server.use(
    http.post(
      apiUrl("/chat/conversations/cv1/messages"),
      async ({ request }) => {
        const body = (await request.json()) as {
          text: string;
          spoiler: boolean;
        };
        sent.push(body);
        return HttpResponse.json({
          id: "m1",
          conversationId: "cv1",
          authorId: "me",
          mine: true,
          text: body.text,
          spoiler: body.spoiler,
          edited: false,
          deleted: false,
          deletedByAdmin: false,
          reactions: [],
          myReaction: null,
          createdAt: "2026-10-07T10:00:00.000Z",
          updatedAt: "2026-10-07T10:00:00.000Z",
        } satisfies MessageDto);
      },
    ),
  );
});

afterEach(() => {
  layout.compact = true;
});

function renderComposer() {
  renderWithQuery(ChatComposer, {
    conversationId: "cv1",
    peerName: "Léa",
    oncanceledit: vi.fn(),
  });
  return screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: m.chat_message_label(),
  });
}

describe("ChatComposer", () => {
  it("offers the commands on /, and sends a /spoiler message masked", async () => {
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "/");
    expect(screen.getByRole("option", { name: /\/spoiler/ })).toBeTruthy();

    await user.keyboard("{Enter}");
    expect(box.value).toBe("/spoiler ");

    await user.type(box, "Mark reste{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([{ text: "Mark reste", spoiler: true }]),
    );
    expect(box.value).toBe("");
  });

  it("wraps the selection in the shortcut's marker", async () => {
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "La fin");
    box.setSelectionRange(3, 6);
    await user.keyboard("{Control>}{Shift>}s{/Shift}{/Control}");

    expect(box.value).toBe("La ||fin||");
  });

  // On a phone, Enter writes a new line: the send button sits right there.
  it("keeps Enter for new lines on the compact shell", async () => {
    layout.compact = true;
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "Salut{Enter}");

    expect(sent).toEqual([]);
    expect(box.value).toBe("Salut\n");
  });
});
