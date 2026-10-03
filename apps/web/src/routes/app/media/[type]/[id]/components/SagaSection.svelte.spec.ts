import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { goto } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { toast } from "$lib/toast.svelte";
import type {
  EntryStatus,
  MediaSagaDto,
  SagaMemberDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SagaSection from "./SagaSection.svelte";

vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

const work = (
  sourceId: string,
  title: string,
  extra: Partial<SagaMemberDto> = {},
): SagaMemberDto => ({
  source: "ANILIST",
  sourceId,
  type: "ANIME",
  title,
  year: 2013,
  posterUrl: null,
  isAdult: false,
  releaseDate: "2013-04-07",
  format: "TV",
  episodes: 12,
  upcoming: false,
  status: null,
  ...extra,
});

const titans: MediaSagaDto = {
  key: "ANILIST:16498",
  title: "L'Attaque des Titans",
  members: [
    work("1", "Saison 1", { status: "COMPLETED" }),
    work("2", "Saison 2", { status: "COMPLETED" }),
    work("3", "Saison 3", { status: "COMPLETED" }),
    work("4", "Saison 3 Partie 2", { status: "WATCHING" }),
    work("5", "The Final Season"),
    work("6", "The Final Season Partie 2"),
    work("7", "Chapitres finaux", { upcoming: true, releaseDate: null }),
  ],
};

function serveSaga(saga: MediaSagaDto) {
  server.use(
    http.get(apiUrl("/media/anime/4/saga"), () => HttpResponse.json({ saga })),
  );
}

function renderSaga(entryStatus: EntryStatus | null = "WATCHING") {
  const props = $state({
    type: "ANIME" as const,
    sourceId: "4",
    entryStatus,
  });
  renderWithQuery(SagaSection, props);
  return props;
}

afterEach(() => {
  for (const item of toast.items) toast.dismiss(item.id);
});

describe("SagaSection", () => {
  it("counts only finished released works and draws a segment per work", async () => {
    serveSaga(titans);

    renderSaga();

    expect(await screen.findByText("L'Attaque des Titans")).toBeTruthy();
    expect(screen.getByText("/6")).toBeTruthy();
    expect(document.querySelectorAll("[data-saga-segment]")).toHaveLength(7);
    expect(screen.getByText(m.media_saga_here())).toBeTruthy();
  });

  it("colours each segment by status and makes the others links to their work", async () => {
    serveSaga({
      ...titans,
      members: titans.members.map((x) =>
        x.sourceId === "5" ? { ...x, status: "DROPPED" } : x,
      ),
    });

    renderSaga();

    const segment = await screen.findByRole("link", {
      name: "05 · The Final Season",
    });
    expect(segment.getAttribute("href")).toBe("/app/media/anime/5");
    expect(segment.querySelector(".bg-danger")).toBeTruthy();
    const here = document.querySelector(
      '[data-saga-segment][aria-current="true"]',
    );
    expect(here?.querySelector(".bg-accent")).toBeTruthy();
  });

  it("shows the works around the current one until the whole saga is asked for", async () => {
    serveSaga(titans);
    const user = userEvent.setup();

    renderSaga();

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).queryByText("Chapitres finaux")).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: m.media_saga_show_all({ count: 7 }),
      }),
    );

    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(7),
    );

    await user.click(screen.getByRole("button", { name: m.common_see_less() }));

    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(5),
    );
  });

  it("adds an untracked work to the watchlist", async () => {
    serveSaga(titans);
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/library"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "entry-5" });
      }),
    );
    const user = userEvent.setup();

    renderSaga();

    await user.click(
      await screen.findByRole("button", {
        name: m.media_saga_add_label({ title: "The Final Season" }),
      }),
    );

    await waitFor(() =>
      expect(body).toEqual({
        source: "ANILIST",
        sourceId: "5",
        type: "ANIME",
        status: "PLANNED",
      }),
    );
  });

  it("offers the next work the moment the current one is finished", async () => {
    serveSaga(titans);

    const props = renderSaga("WATCHING");
    await screen.findByText("L'Attaque des Titans");
    expect(toast.items).toHaveLength(0);

    props.entryStatus = "COMPLETED";
    flushSync();

    const [offer] = toast.items;
    expect(offer.message).toBe(
      m.media_saga_next_toast({ title: "The Final Season" }),
    );
    expect(offer.actions.map((a) => a.label)).toEqual([
      m.media_saga_next_add(),
      m.media_saga_next_open(),
    ]);

    toast.selectAction(offer.id, 1);
    expect(goto).toHaveBeenCalledWith("/app/media/anime/5");
  });
});
