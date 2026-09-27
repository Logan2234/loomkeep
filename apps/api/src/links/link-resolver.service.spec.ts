import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { vi } from "vitest";
import type { OpenLibraryProvider } from "../books/providers/open-library.provider";
import type { AnilistProvider } from "../catalog/providers/anilist.provider";
import type { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { AppException } from "../common/app.exception";
import type { IgdbProvider } from "../games/providers/igdb.provider";
import type { MusicBrainzProvider } from "../music/providers/musicbrainz.provider";
import { LinkResolverService } from "./link-resolver.service";

function makeResolver(overrides: {
  tmdb?: Partial<TmdbProvider>;
  anilist?: Partial<AnilistProvider>;
  igdb?: Partial<IgdbProvider>;
  openLibrary?: Partial<OpenLibraryProvider>;
  musicBrainz?: Partial<MusicBrainzProvider>;
}) {
  return new LinkResolverService(
    (overrides.tmdb ?? {}) as TmdbProvider,
    (overrides.anilist ?? {}) as AnilistProvider,
    (overrides.igdb ?? {}) as IgdbProvider,
    (overrides.openLibrary ?? {}) as OpenLibraryProvider,
    (overrides.musicBrainz ?? {}) as MusicBrainzProvider,
  );
}

describe("LinkResolverService", () => {
  it("maps a link carrying Loomkeep's own route id without any lookup", async () => {
    const resolver = makeResolver({});

    await expect(
      resolver.resolve("https://www.themoviedb.org/tv/95396-severance"),
    ).resolves.toEqual({ domain: "MEDIA", href: "/app/media/series/95396" });
  });

  it("finds an IMDb title among series once no movie matches", async () => {
    const resolver = makeResolver({
      tmdb: {
        findMovieSummaryByImdbId: vi.fn().mockResolvedValue(null),
        findSeriesSummaryByImdbId: vi
          .fn()
          .mockResolvedValue({ type: "SERIES", sourceId: "95396" }),
      },
    });

    await expect(
      resolver.resolve("https://www.imdb.com/title/tt11280740/"),
    ).resolves.toEqual({ domain: "MEDIA", href: "/app/media/series/95396" });
  });

  it("goes through IGDB's Steam cross-reference for a store page", async () => {
    const matchSteamAppIds = vi
      .fn()
      .mockResolvedValue(new Map([["367520", "14593"]]));
    const resolver = makeResolver({ igdb: { matchSteamAppIds } });

    await expect(
      resolver.resolve("https://store.steampowered.com/app/367520/"),
    ).resolves.toEqual({ domain: "GAMES", href: "/app/games/14593" });
    expect(matchSteamAppIds).toHaveBeenCalledWith(["367520"]);
  });

  it("opens an Open Library edition on its work", async () => {
    const resolver = makeResolver({
      openLibrary: {
        workIdForEdition: vi.fn().mockResolvedValue("OL893414W"),
      },
    });

    await expect(
      resolver.resolve("https://openlibrary.org/books/OL62190138M"),
    ).resolves.toEqual({ domain: "BOOKS", href: "/app/books/OL893414W" });
  });

  it("reports an id the source no longer knows as not recognized", async () => {
    const resolver = makeResolver({
      musicBrainz: {
        releaseGroupIdForRelease: vi
          .fn()
          .mockRejectedValue(
            new AppException(
              HttpStatus.NOT_FOUND,
              ErrorCode.CatalogItemNotFound,
            ),
          ),
      },
    });

    await expect(
      resolver.resolve(
        "https://musicbrainz.org/release/0a0d4a6b-8f2f-4b3e-9d2a-9a1c2e7b5c11",
      ),
    ).resolves.toBeNull();
  });

  it("lets a provider outage through rather than calling the link unknown", async () => {
    const resolver = makeResolver({
      anilist: {
        getSummaryByMalId: vi
          .fn()
          .mockRejectedValue(
            new AppException(
              HttpStatus.BAD_GATEWAY,
              ErrorCode.CatalogProviderUnavailable,
            ),
          ),
      },
    });

    await expect(
      resolver.resolve("https://myanimelist.net/anime/52991"),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("recognizes nothing from a site it doesn't know", async () => {
    await expect(
      makeResolver({}).resolve("https://letterboxd.com/film/the-matrix/"),
    ).resolves.toBeNull();
  });
});
