import { chatDrafts } from "#lib/chat/chat.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { tick } from "svelte";
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
          text?: string;
          spoiler: boolean;
          work?: string;
        };
        sent.push(body);
        return HttpResponse.json({
          id: "m1",
          conversationId: "cv1",
          authorId: "me",
          mine: true,
          text: body.text ?? null,
          spoiler: body.spoiler,
          edited: false,
          deleted: false,
          deletedByAdmin: false,
          reactions: [],
          myReaction: null,
          works: [],
          pinned: false,
          forwarded: false,
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

function renderComposer(oneditlast = vi.fn()) {
  renderWithQuery(ChatComposer, {
    conversationId: "cv1",
    peerName: "Léa",
    oncanceledit: vi.fn(),
    oneditlast,
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

  it("attaches the work /reco finds, and sends it with the message", async () => {
    server.use(
      http.get(apiUrl("/catalog/search"), () =>
        HttpResponse.json({ items: [], hasMore: false }),
      ),
      http.get(apiUrl("/games/search"), () =>
        HttpResponse.json({
          results: [
            {
              source: "IGDB",
              sourceId: "11737",
              title: "Outer Wilds",
              year: 2019,
              coverUrl: null,
              isAdult: false,
            },
          ],
        }),
      ),
      http.get(apiUrl("/books/search"), () =>
        HttpResponse.json({ results: [] }),
      ),
      http.get(apiUrl("/music/search"), () =>
        HttpResponse.json({ results: [] }),
      ),
    );
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "/reco outer");
    const result = await screen.findByRole("option", { name: /Outer Wilds/ });
    await user.click(result);

    expect(box.value).toBe("");
    await user.type(box, "Celui-là{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([
        { text: "Celui-là", spoiler: false, work: "/app/games/11737" },
      ]),
    );
  });

  it("previews each of the first links", async () => {
    server.use(
      http.get(apiUrl("/links/resolve"), ({ request }) => {
        const url = new URL(request.url).searchParams.get("url") ?? "";
        return HttpResponse.json({
          match: { domain: "GAMES", href: new URL(url).pathname },
        });
      }),
      http.get(apiUrl("/games/igdb/:id"), ({ params }) =>
        HttpResponse.json({
          source: "IGDB",
          sourceId: params.id,
          title: params.id === "1" ? "Outer Wilds" : "Hades",
          year: 2019,
          coverUrl: null,
          isAdult: false,
        }),
      ),
    );
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(
      box,
      "https://loomkeep.app/app/games/1 et https://loomkeep.app/app/games/2",
    );

    await screen.findByText("Outer Wilds", {}, { timeout: 2000 });
    expect(screen.getByText("Hades")).toBeTruthy();
  });

  it("brings in the next link when one of the first three is turned down", async () => {
    const titles: Record<string, string> = {
      "1": "Outer Wilds",
      "2": "Hades",
      "3": "Celeste",
      "4": "Tunic",
    };
    server.use(
      http.get(apiUrl("/links/resolve"), ({ request }) => {
        const url = new URL(request.url).searchParams.get("url") ?? "";
        return HttpResponse.json({
          match: { domain: "GAMES", href: new URL(url).pathname },
        });
      }),
      http.get(apiUrl("/games/igdb/:id"), ({ params }) =>
        HttpResponse.json({
          source: "IGDB",
          sourceId: params.id,
          title: titles[params.id as string],
          year: 2019,
          coverUrl: null,
          isAdult: false,
        }),
      ),
    );
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(
      box,
      [1, 2, 3, 4]
        .map((id) => `https://loomkeep.app/app/games/${id}`)
        .join(" "),
    );
    await screen.findByText("Celeste", {}, { timeout: 2000 });
    expect(screen.queryByText("Tunic")).toBe(null);

    await user.click(
      screen.getAllByRole("button", { name: m.chat_link_preview_remove() })[0],
    );

    await screen.findByText("Tunic", {}, { timeout: 2000 });
    expect(screen.queryByText("Outer Wilds")).toBe(null);
  });

  it("previews a work link, and sends it plain once its card is turned down", async () => {
    server.use(
      http.get(apiUrl("/links/resolve"), () =>
        HttpResponse.json({
          match: { domain: "GAMES", href: "/app/games/11737" },
        }),
      ),
      http.get(apiUrl("/games/igdb/11737"), () =>
        HttpResponse.json({
          source: "IGDB",
          sourceId: "11737",
          title: "Outer Wilds",
          year: 2019,
          coverUrl: null,
          isAdult: false,
        }),
      ),
    );
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "Regarde https://loomkeep.app/app/games/11737");
    await screen.findByText("Outer Wilds", {}, { timeout: 2000 });
    await user.click(
      screen.getByRole("button", { name: m.chat_link_preview_remove() }),
    );
    expect(screen.queryByText("Outer Wilds")).toBe(null);
    await user.type(box, "{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([
        {
          text: "Regarde https://loomkeep.app/app/games/11737",
          spoiler: false,
          skipLinks: ["https://loomkeep.app/app/games/11737"],
        },
      ]),
    );
  });

  it("mentions a work with #, and sends it as a token", async () => {
    server.use(
      http.get(apiUrl("/catalog/search"), () =>
        HttpResponse.json({
          items: [
            {
              source: "TMDB",
              sourceId: "95396",
              type: "SERIES",
              title: "Severance",
              year: 2022,
              posterUrl: null,
              isAdult: false,
            },
          ],
          hasMore: false,
        }),
      ),
      http.get(apiUrl("/games/search"), () =>
        HttpResponse.json({ results: [] }),
      ),
      http.get(apiUrl("/books/search"), () =>
        HttpResponse.json({ results: [] }),
      ),
      http.get(apiUrl("/music/search"), () =>
        HttpResponse.json({ results: [] }),
      ),
    );
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "Regarde #seve");
    await user.click(await screen.findByRole("option", { name: /Severance/ }));
    expect(box.value).toBe("Regarde #Severance ");
    // The browser reports the caret moving after the insertion: the search
    // mustn't come back for the mention just made.
    box.focus();
    document.dispatchEvent(new Event("selectionchange"));
    await tick();
    expect(screen.queryByText(m.chat_reco_prompt())).toBe(null);
    expect(screen.queryByRole("listbox")).toBe(null);
    await user.type(box, "S01E09{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([
        {
          text: "Regarde #[Severance](/app/media/series/95396) S01E09",
          spoiler: false,
        },
      ]),
    );
  });

  it("edits the last message on ↑ in an empty field only", async () => {
    const user = userEvent.setup();
    const oneditlast = vi.fn();
    const box = renderComposer(oneditlast);

    await user.type(box, "a{ArrowUp}");
    expect(oneditlast).not.toHaveBeenCalled();

    await user.clear(box);
    await user.keyboard("{ArrowUp}");
    expect(oneditlast).toHaveBeenCalledTimes(1);
  });

  it("takes bold off with the shortcut that put it on", async () => {
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "un mot");
    box.setSelectionRange(3, 6);
    await user.keyboard("{Control>}b{/Control}");
    expect(box.value).toBe("un **mot**");

    await user.keyboard("{Control>}b{/Control}");
    expect(box.value).toBe("un mot");
  });

  it("wraps the selection in the shortcut's marker", async () => {
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "La fin");
    box.setSelectionRange(3, 6);
    await user.keyboard("{Control>}{Shift>}s{/Shift}{/Control}");

    expect(box.value).toBe("La ||fin||");
  });

  it("strikes with Ctrl+Shift+X and marks code with Ctrl+E", async () => {
    const user = userEvent.setup();
    const box = renderComposer();

    await user.type(box, "La fin");
    box.setSelectionRange(3, 6);
    await user.keyboard("{Control>}{Shift>}x{/Shift}{/Control}");
    expect(box.value).toBe("La ~~fin~~");

    box.setSelectionRange(5, 8);
    await user.keyboard("{Control>}e{/Control}");
    expect(box.value).toBe("La ~~`fin`~~");
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
