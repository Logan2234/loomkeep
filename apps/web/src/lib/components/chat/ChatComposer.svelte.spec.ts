import { chatDrafts } from "#lib/chat/chat.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { fieldText, focusField, selectInField } from "#lib/test/field.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type {
  ListVisibility,
  MessageDto,
  MyListDto,
  MyReviewDto,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { tick } from "svelte";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
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
          work?: string;
          review?: string;
          list?: string;
          spoiler?: boolean;
        };
        sent.push(body);
        return HttpResponse.json({
          id: "m1",
          conversationId: "cv1",
          authorId: "me",
          mine: true,
          text: body.text ?? null,
          spoiler: body.spoiler ?? false,
          edited: false,
          deleted: false,
          deletedByAdmin: false,
          reactions: [],
          myReaction: null,
          works: [],
          review: null,
          list: null,
          gone: null,
          poll: null,
          saga: null,
          pick: null,
          where: false,
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

function review(id: string, title: string, rating: number) {
  return {
    id,
    targetType: "MEDIA",
    targetId: `media-${id}`,
    rating,
    text: "Plus lente, plus ambitieuse.",
    visibility: "FRIENDS",
    spoilerTag: false,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    author: null,
    voteScore: 0,
    myVote: null,
    byFriend: false,
    target: { title, imageUrl: null, href: "/app/media/series/95396" },
  } satisfies MyReviewDto;
}

function list(id: string, title: string, visibility: ListVisibility) {
  return {
    id,
    title,
    description: null,
    kind: "RANKED",
    visibility,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-08T10:00:00.000Z",
    author: {
      id: "me",
      username: "me",
      displayName: "Moi",
      profileAccess: "PUBLIC",
      avatarUrl: null,
    },
    itemCount: 13,
    previewImageUrls: [],
    role: "OWNER",
  } satisfies MyListDto;
}

async function renderComposer(oneditlast = vi.fn()) {
  renderWithQuery(ChatComposer, {
    conversationId: "cv1",
    peerName: "Léa",
    oncanceledit: vi.fn(),
    oneditlast,
  });
  const box = await screen.findByRole("textbox", {
    name: m.chat_message_label(),
  });
  await focusField(box);
  return box;
}

describe("ChatComposer", () => {
  it("offers the commands on /, and sends a /spoiler message masked", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/", { skipClick: true });
    expect(screen.getByRole("option", { name: /\/spoiler/ })).toBeTruthy();

    await user.keyboard("{Enter}");
    expect(fieldText(box)).toBe("/spoiler ");

    await user.type(box, "Mark reste{Enter}", { skipClick: true });

    await waitFor(() =>
      expect(sent).toEqual([{ text: "Mark reste", spoiler: true }]),
    );
    expect(fieldText(box)).toBe("");
  });

  it("attaches the work /reco finds, and sends it with the message", async () => {
    server.use(
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [
            {
              kind: "GAME",
              title: "Outer Wilds",
              imageUrl: null,
              href: "/app/games/11737",
              year: 2019,
              isAdult: false,
              status: null,
            },
          ],
          unavailable: [],
        }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/reco outer", { skipClick: true });
    const result = await screen.findByRole("option", { name: /Outer Wilds/ });
    await user.click(result);

    expect(fieldText(box)).toBe("");
    await user.type(box, "Celui-là{Enter}", { skipClick: true });

    await waitFor(() =>
      expect(sent).toEqual([
        { text: "Celui-là", spoiler: false, work: "/app/games/11737" },
      ]),
    );
  });

  it("offers what the instance knows before the catalogues answer, 18+ left out", async () => {
    const hit = (title: string, href: string, isAdult = false) => ({
      kind: "GAME",
      title,
      imageUrl: null,
      href,
      year: 2019,
      isAdult,
      status: null,
    });
    const answer = (...items: ReturnType<typeof hit>[]) =>
      HttpResponse.json({ items, unavailable: [] });
    let catalogsAnswer!: (response: Response) => void;
    server.use(
      http.get(apiUrl("/search/works"), ({ request }) =>
        new URL(request.url).searchParams.get("scope") === "local"
          ? answer(
              hit("Outer Limits", "/app/games/1", true),
              hit("Outer Wilds", "/app/games/11737"),
            )
          : new Promise<Response>((resolve) => (catalogsAnswer = resolve)),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/reco outer", { skipClick: true });

    expect(
      await screen.findByRole("option", { name: /Outer Wilds/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Outer Limits/ })).toBe(null);

    catalogsAnswer(answer(hit("Outer Worlds", "/app/games/7")));
    expect(
      await screen.findByRole("option", { name: /Outer Worlds/ }),
    ).toBeTruthy();
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
    const box = await renderComposer();

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
    const box = await renderComposer();

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
    const box = await renderComposer();

    await user.type(box, "Regarde https://loomkeep.app/app/games/11737", {
      skipClick: true,
    });
    await screen.findByText("Outer Wilds", {}, { timeout: 2000 });
    await user.click(
      screen.getByRole("button", { name: m.chat_link_preview_remove() }),
    );
    expect(screen.queryByText("Outer Wilds")).toBe(null);
    // Back into the field, the button having taken the focus.
    await focusField(box);
    await user.type(box, "{Enter}", { skipClick: true });

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
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [
            {
              kind: "SERIES",
              title: "Severance",
              imageUrl: null,
              href: "/app/media/series/95396",
              year: 2022,
              isAdult: false,
              status: null,
            },
          ],
          unavailable: [],
        }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "Regarde #seve", { skipClick: true });
    await user.click(await screen.findByRole("option", { name: /Severance/ }));
    expect(fieldText(box)).toBe("Regarde #Severance ");
    // The browser reports the caret moving after the insertion: the search
    // mustn't come back for the mention just made.
    box.focus();
    document.dispatchEvent(new Event("selectionchange"));
    await tick();
    expect(screen.queryByText(m.chat_reco_prompt())).toBe(null);
    expect(screen.queryByRole("listbox")).toBe(null);
    await user.type(box, "S01E09{Enter}", { skipClick: true });

    await waitFor(() =>
      expect(sent).toEqual([
        {
          text: "Regarde #[Severance](/app/media/series/95396) S01E09",
          spoiler: false,
        },
      ]),
    );
  });

  it("attaches one of the viewer's reviews with /review", async () => {
    server.use(
      http.get(apiUrl("/reviews/me"), () =>
        HttpResponse.json([
          review("r1", "Severance", 8.5),
          review("r2", "Outer Wilds", 10),
        ]),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/review sev", { skipClick: true });
    expect(screen.queryByRole("option", { name: /Outer Wilds/ })).toBe(null);
    await user.keyboard("{Enter}");

    expect(fieldText(box)).toBe("");
    expect(screen.getByText("Severance")).toBeTruthy();
    await user.type(box, "Mon avis{Enter}", { skipClick: true });

    await waitFor(() =>
      expect(sent).toEqual([
        { text: "Mon avis", spoiler: false, review: "r1" },
      ]),
    );
  });

  it("shares a list with /list, a private one left out", async () => {
    server.use(
      http.get(apiUrl("/lists/editable"), () =>
        HttpResponse.json([
          list("l1", "Plaisirs coupables", "PRIVATE"),
          list("l2", "Octobre qui fait peur", "FRIENDS"),
        ]),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/list ", { skipClick: true });
    const hidden = await screen.findByRole("option", {
      name: /Plaisirs coupables/,
    });
    expect(hidden.getAttribute("aria-disabled")).toBe("true");
    expect(hidden.textContent).toContain(m.chat_list_private({ name: "Léa" }));

    // Enter goes to the first list Léa may open.
    await user.keyboard("{Enter}{Enter}");

    await waitFor(() => expect(sent).toEqual([{ spoiler: false, list: "l2" }]));
  });

  it("completes an emoji from its :shortcode:", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "Trop :popc", { skipClick: true });
    expect(screen.getByRole("listbox", { name: m.chat_emoji() })).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(fieldText(box)).toBe("Trop 🍿 ");

    // Typed whole, the code turns into its emoji on its own.
    await user.type(box, "et :fire:", { skipClick: true });
    expect(fieldText(box)).toBe("Trop 🍿 et 🔥");
  });

  it("leaves a time alone: no emoji after a digit's colon", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "à 12:30", { skipClick: true });
    expect(screen.queryByRole("listbox")).toBe(null);
  });

  it("writes a /poll: the question in the field, a work among the options", async () => {
    server.use(
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [
            {
              kind: "SERIES",
              title: "Severance",
              imageUrl: null,
              href: "/app/media/series/95396",
              year: 2022,
              isAdult: false,
              status: null,
            },
          ],
          unavailable: [],
        }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/poll", { skipClick: true });
    await user.keyboard("{Enter}");
    expect(screen.getByText(m.chat_poll_builder())).toBeTruthy();
    await user.type(box, "On regarde quoi ?", { skipClick: true });

    await user.type(
      screen.getByRole("textbox", {
        name: m.chat_poll_option_label({ number: 1 }),
      }),
      "#seve",
    );
    await user.click(await screen.findByRole("option", { name: /Severance/ }));
    // One option is not a poll.
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: m.common_send() })
        .disabled,
    ).toBe(true);
    await user.type(
      screen.getByRole("textbox", {
        name: m.chat_poll_option_label({ number: 2 }),
      }),
      "Un vieux Pixar",
    );
    await user.click(screen.getByRole("button", { name: m.common_send() }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          poll: {
            question: "On regarde quoi ?",
            options: [
              { work: "/app/media/series/95396" },
              { text: "Un vieux Pixar" },
            ],
          },
        },
      ]),
    );
  });

  it("caps a /poll at five options", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/poll", { skipClick: true });
    await user.keyboard("{Enter}");

    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: m.chat_poll_add() }));
    }

    expect(screen.queryByRole("button", { name: m.chat_poll_add() })).toBe(
      null,
    );
    expect(screen.getByText(m.chat_poll_max({ max: 5 }))).toBeTruthy();
  });

  it("draws with /pick once a domain is picked, from the pile or what's in common", async () => {
    const draws: unknown[] = [];
    server.use(
      http.post(apiUrl("/chat/conversations/cv1/pick"), async ({ request }) => {
        const body = (await request.json()) as { shared: boolean };
        draws.push(body);
        return HttpResponse.json({
          work: {
            kind: "MOVIE",
            title: body.shared ? "Dune : Deuxième partie" : "Perfect Days",
            imageUrl: null,
            href: body.shared
              ? "/app/media/movie/693134"
              : "/app/media/movie/976893",
            year: 2023,
            inLibrary: true,
          },
          reel: [],
          mine: 6,
          shared: 3,
        });
      }),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/pick", { skipClick: true });
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("option", { name: /\/pick video/ }),
    ).toBeTruthy();
    // No domain, no message.
    await user.keyboard("{Escape}");
    await user.type(box, "/pick ", { skipClick: true });
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Perfect Days")).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: m.chat_pick_scope_shared({ count: 3 }),
      }),
    );
    expect(await screen.findByText("Dune : Deuxième partie")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: m.common_send() }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          spoiler: false,
          pick: {
            domain: "MEDIA",
            shared: true,
            work: "/app/media/movie/693134",
          },
        },
      ]),
    );
    expect(draws).toEqual([
      { domain: "MEDIA", shared: false },
      { domain: "MEDIA", shared: true },
    ]);
  });

  it("rolls through the pile before landing on the draw, sendable only then", async () => {
    server.use(
      http.post(apiUrl("/chat/conversations/cv1/pick"), () =>
        HttpResponse.json({
          work: {
            kind: "MOVIE",
            title: "Perfect Days",
            imageUrl: null,
            href: "/app/media/movie/976893",
            year: 2023,
            inLibrary: true,
          },
          reel: [{ title: "Shōgun", imageUrl: null }],
          mine: 2,
          shared: 0,
        }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();
    const send = () => screen.getByRole("button", { name: m.common_send() });
    // The reel only turns for those who let things move.
    document.documentElement.classList.remove("a11y-reduce-motion");
    onTestFinished(() =>
      document.documentElement.classList.add("a11y-reduce-motion"),
    );

    await user.type(box, "/pick ", { skipClick: true });
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Shōgun")).toBeTruthy();
    expect(send()).toHaveProperty("disabled", true);
    await waitFor(() => expect(send()).toHaveProperty("disabled", false), {
      timeout: 3000,
    });
    expect(screen.getByText("Perfect Days")).toBeTruthy();
  });

  it("looks only for films and series with /where", async () => {
    const hit = (kind: string, title: string, href: string) => ({
      kind,
      title,
      imageUrl: null,
      href,
      year: 2024,
      isAdult: false,
      status: null,
    });
    server.use(
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [
            hit("GAME", "Dune: Awakening", "/app/games/250616"),
            hit("ANIME", "Dune: The Anime", "/app/media/anime/1"),
            hit("MOVIE", "Dune : Deuxième partie", "/app/media/movie/693134"),
          ],
          unavailable: [],
        }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/where dune", { skipClick: true });
    await screen.findByRole("option", { name: /Deuxième partie/ });
    expect(screen.queryByRole("option", { name: /Awakening/ })).toBe(null);
    expect(screen.queryByRole("option", { name: /The Anime/ })).toBe(null);
    await user.keyboard("{Enter}{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([
        { spoiler: false, where: "/app/media/movie/693134" },
      ]),
    );
  });

  it("shares one of the viewer's sagas with /saga", async () => {
    const sagas = (key: string, title: string) => ({
      inProgress: [
        {
          key,
          title,
          members: [{ title, posterUrl: null, coverUrl: null }],
          next: null,
          seen: 1,
          released: 3,
          lastActivityAt: "2026-10-01T00:00:00.000Z",
          finishedAt: null,
        },
      ],
      waiting: [],
      finished: [],
    });
    server.use(
      http.get(apiUrl("/library/sagas"), () =>
        HttpResponse.json(sagas("TMDB:119", "Le Seigneur des anneaux")),
      ),
      http.get(apiUrl("/games/sagas"), () =>
        HttpResponse.json(sagas("IGDB:6", "The Witcher")),
      ),
      http.get(apiUrl("/books/sagas"), () =>
        HttpResponse.json({ inProgress: [], waiting: [], finished: [] }),
      ),
    );
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "/saga witch", { skipClick: true });
    await user.click(
      await screen.findByRole("option", { name: /The Witcher/ }),
    );
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(sent).toEqual([
        { spoiler: false, saga: { domain: "GAMES", key: "IGDB:6" } },
      ]),
    );
  });

  it("edits the last message on ↑ in an empty field only", async () => {
    const user = userEvent.setup();
    const oneditlast = vi.fn();
    const box = await renderComposer(oneditlast);

    await user.type(box, "a{ArrowUp}", { skipClick: true });
    expect(oneditlast).not.toHaveBeenCalled();

    await user.clear(box);
    await user.keyboard("{ArrowUp}");
    expect(oneditlast).toHaveBeenCalledTimes(1);
  });

  it("takes bold off with the shortcut that put it on", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "un mot", { skipClick: true });
    selectInField(box, 3, 6);
    await user.keyboard("{Control>}b{/Control}");
    expect(fieldText(box)).toBe("un **mot**");

    await user.keyboard("{Control>}b{/Control}");
    expect(fieldText(box)).toBe("un mot");
  });

  it("wraps the selection in the shortcut's marker", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "La fin", { skipClick: true });
    selectInField(box, 3, 6);
    await user.keyboard("{Control>}{Shift>}s{/Shift}{/Control}");

    expect(fieldText(box)).toBe("La ||fin||");
  });

  it("strikes with Ctrl+Shift+X and marks code with Ctrl+E", async () => {
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "La fin", { skipClick: true });
    selectInField(box, 3, 6);
    await user.keyboard("{Control>}{Shift>}x{/Shift}{/Control}");
    expect(fieldText(box)).toBe("La ~~fin~~");

    selectInField(box, 5, 8);
    await user.keyboard("{Control>}e{/Control}");
    expect(fieldText(box)).toBe("La ~~`fin`~~");
  });

  // On a phone, Enter writes a new line: the send button sits right there.
  it("keeps Enter for new lines on the compact shell", async () => {
    layout.compact = true;
    const user = userEvent.setup();
    const box = await renderComposer();

    await user.type(box, "Salut{Enter}", { skipClick: true });

    expect(sent).toEqual([]);
    expect(fieldText(box)).toBe("Salut\n");
  });
});
