import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { type Mock, vi } from "vitest";
import type { BookItemService } from "../books/book-item.service";
import type { OpenLibraryProvider } from "../books/providers/open-library.provider";
import type { MediaItemService } from "../catalog/media-item.service";
import type { AnilistProvider } from "../catalog/providers/anilist.provider";
import type { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { AppException } from "../common/app.exception";
import type { GameItemService } from "../games/game-item.service";
import type { IgdbProvider } from "../games/providers/igdb.provider";
import { LinkResolverService } from "../links/link-resolver.service";
import type { MusicItemService } from "../music/music-item.service";
import type { MusicBrainzProvider } from "../music/providers/musicbrainz.provider";
import { ChatWorkService } from "./chat-work.service";
import type { ChatService } from "./chat.service";

function setup() {
  const config = {
    get: (key: string) =>
      key === "WEB_ORIGIN" ? "https://tracker.example.org" : undefined,
  } as unknown as ConfigService;
  const links = new LinkResolverService(
    config,
    {} as TmdbProvider,
    {} as AnilistProvider,
    {} as IgdbProvider,
    {} as OpenLibraryProvider,
    {} as MusicBrainzProvider,
  );
  const chat = { replaceLinkedWorks: vi.fn() } as unknown as ChatService;
  const media = {
    upsertFromSource: vi.fn(
      async (_source: string, sourceId: string, type: string) => ({
        id: `media-${sourceId}`,
        type,
        title: sourceId === "1" ? "Interdit" : "Severance",
        posterUrl: "https://image.tmdb.org/t/p/w342/poster.jpg",
        releaseDate: new Date("2022-02-18"),
        isAdult: sourceId === "1",
      }),
    ),
  } as unknown as MediaItemService;
  const games = {
    upsertFromSource: vi.fn(async (_source: string, sourceId: string) => ({
      id: `game-${sourceId}`,
      title: "Outer Wilds",
      coverUrl: null,
      releaseDate: null,
      isAdult: false,
    })),
  } as unknown as GameItemService;

  return {
    service: new ChatWorkService(
      chat,
      links,
      media,
      games,
      {} as BookItemService,
      {} as MusicItemService,
    ),
    chat,
    media,
  };
}

describe("ChatWorkService", () => {
  it("makes a card from a work page, caching the work like a tracked one", async () => {
    const { service, media } = setup();

    await expect(service.required("/app/media/anime/21")).resolves.toEqual({
      targetType: "MEDIA",
      targetId: "media-21",
      kind: "ANIME",
      title: "Severance",
      imageUrl: "https://image.tmdb.org/t/p/w342/poster.jpg",
      href: "/app/media/anime/21",
      year: 2022,
    });
    expect(media.upsertFromSource).toHaveBeenCalledWith(
      "ANILIST",
      "21",
      "ANIME",
    );
  });

  // The recipient may not allow 18+ titles: no poster lands in their thread.
  it("never makes a card of an 18+ title", async () => {
    const { service } = setup();

    await expect(service.required("/app/media/movie/1")).rejects.toMatchObject({
      code: ErrorCode.ChatWorkNotFound,
    } satisfies Partial<AppException>);
  });

  it("turns the work links of a text into cards, at most three, once each", async () => {
    const { service, chat } = setup();

    service.refreshLinkedWorks(
      "m1",
      [
        "https://tracker.example.org/app/games/7",
        "https://tracker.example.org/app/games/7",
        "https://example.com/pas-une-oeuvre",
        "https://tracker.example.org/app/games/8",
        "https://tracker.example.org/app/games/9",
        "https://tracker.example.org/app/games/10.",
      ].join(" "),
    );

    await vi.waitFor(() => expect(chat.replaceLinkedWorks).toHaveBeenCalled());
    const [, cards] = (chat.replaceLinkedWorks as Mock).mock.calls[0];
    expect(cards.map((c: { href: string }) => c.href)).toEqual([
      "/app/games/7",
      "/app/games/8",
      "/app/games/9",
    ]);
  });
});
