import { vi } from "vitest";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { BooksController } from "../books/books.controller";
import { GamesController } from "../games/games.controller";
import { LibraryController } from "../library/library.controller";
import { MusicController } from "../music/music.controller";
import type { ListEntriesFilters } from "./entry-lifecycle.util";

const viewer: JwtPayload = { sub: "viewer", email: "viewer@example.com" };
const gate = { assertEnabled: vi.fn().mockResolvedValue(undefined) };

describe("library pagination boundaries", () => {
  const libraries = () => {
    const service = {
      listEntries: vi.fn((_userId: string, _filters: ListEntriesFilters) =>
        Promise.resolve({ items: [], hasMore: false }),
      ),
    };
    return {
      service,
      controllers: [
        new BooksController(
          null!,
          service as never,
          null!,
          null!,
          gate as never,
          null!,
        ),
        new GamesController(
          null!,
          service as never,
          null!,
          null!,
          gate as never,
        ),
        new MusicController(null!, service as never, gate as never),
      ],
      media: new LibraryController(service as never, gate as never, null!),
    };
  };

  it.each(["abc", "Infinity", "-3", "0"])(
    "normalizes invalid page %s and caps the library limit",
    async (page) => {
      const { service, controllers, media } = libraries();

      for (const controller of controllers) {
        await controller.listEntries(
          viewer,
          "book",
          "true",
          ["PLANNED"],
          "title",
          "asc",
          page,
          "9999",
          "fr",
        );
      }

      await media.listEntries(
        viewer,
        "book",
        "true",
        ["PLANNED"],
        ["MOVIE"],
        "title",
        "asc",
        page,
        "9999",
        "fr",
      );
      expect(service.listEntries).toHaveBeenCalledTimes(4);

      for (const [, filters] of service.listEntries.mock.calls) {
        expect(filters).toMatchObject({
          page: 1,
          limit: 200,
          q: "book",
          favorite: true,
          statuses: ["PLANNED"],
          lang: "fr",
        });
      }
    },
  );

  it("normalizes session pages before they reach Prisma", () => {
    const sessions = { list: vi.fn() };
    const books = new BooksController(
      null!,
      null!,
      null!,
      sessions as never,
      gate as never,
      null!,
    );
    const games = new GamesController(
      null!,
      null!,
      sessions as never,
      null!,
      gate as never,
    );
    books.listSessions(viewer, "entry", "abc");
    games.listSessions(viewer, "entry", "Infinity");
    expect(sessions.list.mock.calls).toEqual([
      ["viewer", "entry", 1],
      ["viewer", "entry", 1],
    ]);
  });
});
