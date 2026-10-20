import { ErrorCode } from "@loomkeep/shared";
import { type Mock, vi } from "vitest";
import type { BookSagaService } from "../books/book-saga.service";
import type { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import type { GameSagaService } from "../games/game-saga.service";
import type { SagaService } from "../library/saga.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { FollowService } from "../social/follow.service";
import type { WorkFriendsService } from "../social/work-friends.service";
import { ChatCommandsService } from "./chat-commands.service";
import type { ChatWorkService, WorkCard } from "./chat-work.service";
import type { ChatService } from "./chat.service";

// The pile's item ids, straight into a film's page.
vi.mock("../common/work-href.util", () => ({
  resolveWorkHref: (_prisma: unknown, _type: string, id: string) =>
    Promise.resolve(`/app/media/movie/${id}`),
}));

const ME = "me";
const LEA = "lea";

const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  username: id,
  displayName: id,
  profileAccess: "PUBLIC",
  avatarUpdatedAt: null,
  ...extra,
});

const card = (targetId: string): WorkCard => ({
  targetType: "MEDIA",
  targetId,
  kind: "MOVIE",
  title: targetId,
  imageUrl: null,
  href: `/app/media/movie/${targetId}`,
  year: 2024,
});

function setup({ leaVisible = true } = {}) {
  const piles: Record<string, string[]> = {
    [ME]: ["dune", "perfect-days", "shogun"],
    [LEA]: ["dune", "perfect-days", "severance"],
  };
  const prisma = {
    libraryEntry: {
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        (piles[where.userId] ?? []).map((mediaItemId) => ({ mediaItemId })),
      ),
    },
    user: {
      findUniqueOrThrow: vi.fn(
        ({ select }: { select: Record<string, boolean> }) =>
          select.watchRegion ? { watchRegion: "FR" } : user(ME),
      ),
      findMany: vi.fn(),
    },
  } as unknown as PrismaService;
  const chat = {
    memberIds: vi.fn().mockResolvedValue([ME, LEA]),
    commandMessage: vi.fn(),
  } as unknown as ChatService;
  const works = {
    required: vi.fn((href: string) =>
      Promise.resolve(card(href.split("/").pop()!)),
    ),
  } as unknown as ChatWorkService;
  const friends = {
    friendsSharingLibrary: vi.fn((_viewer: string, ids: string[]) =>
      Promise.resolve(leaVisible ? ids.map((id) => user(id)) : []),
    ),
  } as unknown as WorkFriendsService;
  const follow = {
    listFriendIds: vi.fn().mockResolvedValue([LEA]),
  } as unknown as FollowService;
  const mediaSagas = { savedSaga: vi.fn() } as unknown as SagaService;
  const extras = { getExtras: vi.fn() };
  const media = {
    providerFor: vi.fn(() => extras),
  } as unknown as MediaItemService;

  const service = new ChatCommandsService(
    prisma,
    chat,
    works,
    friends,
    follow,
    mediaSagas,
    {} as GameSagaService,
    {} as BookSagaService,
    media,
  );
  return { service, prisma, chat, mediaSagas, extras };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe("ChatCommandsService", () => {
  describe("/pick", () => {
    it("draws in common only among the works everyone has in their pile", async () => {
      const { service } = setup();

      const result = await service.draw(ME, "cv1", "MEDIA", true);

      expect(result.mine).toBe(3);
      expect(result.shared).toBe(2);
      expect(["dune", "perfect-days"]).toContain(result.work?.title);
    });

    it("brings the rest of the pile along, for the draw to roll through", async () => {
      const { service } = setup();

      const result = await service.draw(ME, "cv1", "MEDIA", false);

      expect(result.reel.map((work) => work.title).sort()).toEqual(
        ["dune", "perfect-days", "shogun"]
          .filter((id) => id !== result.work?.title)
          .sort(),
      );
    });

    it("has nothing in common with a member whose library is hidden", async () => {
      const { service } = setup({ leaVisible: false });

      const result = await service.draw(ME, "cv1", "MEDIA", true);

      expect(result.shared).toBe(0);
      expect(result.work).toBeNull();
    });

    it("refuses to send a work that isn't in the pile it claims", async () => {
      const { service } = setup();

      await expectCode(
        service.pickedWork(ME, "cv1", "MEDIA", true, "/app/media/movie/shogun"),
        ErrorCode.ChatPickNotInPile,
      );
      await expect(
        service.pickedWork(
          ME,
          "cv1",
          "MEDIA",
          false,
          "/app/media/movie/shogun",
        ),
      ).resolves.toMatchObject({ count: 3 });
    });
  });

  describe("/where", () => {
    // AniList knows no streaming platform per country, unlike TMDB.
    it("only takes films and series", async () => {
      const { service } = setup();

      await expectCode(
        service.whereWork("/app/media/anime/97986"),
        ErrorCode.ChatWhereNotVideo,
      );
      await expect(
        service.whereWork("/app/media/series/1399"),
      ).resolves.toBeTruthy();
    });

    it("puts the platforms members have first, with the members who share them", async () => {
      const { service, prisma, chat, extras } = setup();
      (chat.commandMessage as Mock).mockResolvedValue({
        id: "m1",
        sagaDomain: null,
        sagaKey: null,
        whereWork: true,
        work: {
          targetType: "MEDIA",
          targetId: "x",
          href: "/app/media/movie/693134",
        },
        memberIds: [ME, LEA],
      });
      // Léa shares; the viewer doesn't, so isn't asked for.
      (prisma.user.findMany as Mock).mockResolvedValue([
        { ...user(LEA), watchProviderIds: [381] },
      ]);
      const provider = (id: number, name: string) => ({
        id,
        name,
        logoUrl: null,
      });
      extras.getExtras.mockResolvedValue({
        watchProviders: {
          region: "FR",
          flatrate: [provider(1899, "Max"), provider(381, "Canal+")],
          free: [],
          ads: [],
          rent: [provider(119, "Prime Video")],
          buy: [],
          link: "https://www.themoviedb.org/movie/693134/watch?locale=FR",
        },
      });

      const where = await service.where(ME, "m1", "fr-FR");

      expect(extras.getExtras).toHaveBeenCalledWith(
        "693134",
        "MOVIE",
        undefined,
        "FR",
      );
      expect(
        where.offers.map((o) => [
          o.provider.name,
          o.kind,
          o.members.map((m) => m.id),
        ]),
      ).toEqual([
        ["Canal+", "flatrate", [LEA]],
        ["Max", "flatrate", []],
        ["Prime Video", "rent", []],
      ]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [ME, LEA] }, chatShareWatchProviders: true },
        }),
      );
    });
  });

  describe("/saga", () => {
    const saga = (statuses: (string | null)[]) => ({
      key: "TMDB:120",
      title: "Le Seigneur des anneaux",
      members: statuses.map((status, i) => ({
        source: "TMDB",
        sourceId: String(120 + i),
        type: "MOVIE",
        title: `Film ${i + 1}`,
        posterUrl: null,
        upcoming: false,
        status,
      })),
    });

    it("gives each visible member's progress through the works", async () => {
      const { service, chat, mediaSagas } = setup();
      (chat.commandMessage as Mock).mockResolvedValue({
        id: "m1",
        sagaDomain: "MEDIA",
        sagaKey: "TMDB:120",
        whereWork: false,
        work: null,
        memberIds: [ME, LEA],
      });
      (mediaSagas.savedSaga as Mock).mockImplementation((userId: string) =>
        userId === ME
          ? saga(["COMPLETED", "WATCHING", null])
          : saga(["COMPLETED", "COMPLETED", "PLANNED"]),
      );

      const card = await service.saga(ME, "m1", "fr");

      // Read as saved, in the viewer's language: TMDB's base titles are English.
      expect(mediaSagas.savedSaga).toHaveBeenCalledWith(ME, "TMDB:120", "fr");

      expect(card.works.map((w) => w.href)).toEqual([
        "/app/media/movie/120",
        "/app/media/movie/121",
        "/app/media/movie/122",
      ]);
      expect(card.members.map((m) => [m.user.id, m.mine, m.steps])).toEqual([
        [ME, true, ["done", "active", "none"]],
        [LEA, false, ["done", "done", "none"]],
      ]);
    });

    it("leaves out a member whose library is hidden", async () => {
      const { service, chat, mediaSagas } = setup({ leaVisible: false });
      (chat.commandMessage as Mock).mockResolvedValue({
        id: "m1",
        sagaDomain: "MEDIA",
        sagaKey: "TMDB:120",
        whereWork: false,
        work: null,
        memberIds: [ME, LEA],
      });
      (mediaSagas.savedSaga as Mock).mockResolvedValue(saga(["COMPLETED"]));

      const card = await service.saga(ME, "m1");

      expect(card.members.map((m) => m.user.id)).toEqual([ME]);
    });
  });
});
