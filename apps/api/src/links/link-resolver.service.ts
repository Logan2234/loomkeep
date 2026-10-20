import {
  Domain,
  type MediaSummaryDto,
  type ResolvedLinkDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenLibraryProvider } from "../books/providers/open-library.provider";
import { AnilistProvider } from "../catalog/providers/anilist.provider";
import { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { AppException } from "../common/app.exception";
import { webOrigins } from "../common/web-origin.util";
import { IgdbProvider } from "../games/providers/igdb.provider";
import { MusicBrainzProvider } from "../music/providers/musicbrainz.provider";
import { type CatalogLink, parseCatalogLink } from "./link-parser";

// The hosted instance: its links open on a self-hosted one too.
const HOSTED_INSTANCE_HOST = "loomkeep.app";

const DOMAIN_BY_SECTION: Record<string, Domain> = {
  media: Domain.MEDIA,
  games: Domain.GAMES,
  books: Domain.BOOKS,
  music: Domain.MUSIC,
};

const mediaHref = (media: MediaSummaryDto): ResolvedLinkDto => ({
  domain: Domain.MEDIA,
  href: `/app/media/${media.type.toLowerCase()}/${media.sourceId}`,
});
const gameHref = (igdbId: string): ResolvedLinkDto => ({
  domain: Domain.GAMES,
  href: `/app/games/${igdbId}`,
});
const bookHref = (workId: string): ResolvedLinkDto => ({
  domain: Domain.BOOKS,
  href: `/app/books/${workId}`,
});
const musicHref = (releaseGroupId: string): ResolvedLinkDto => ({
  domain: Domain.MUSIC,
  href: `/app/music/${releaseGroupId}`,
});

/**
 * Turns a link shared from another app (UX-05) into the Loomkeep page for the
 * same work. Links whose id is already Loomkeep's own route id map directly;
 * the others (IMDb, MyAnimeList, Steam, IGDB slugs, Open Library editions and
 * ISBNs, MusicBrainz releases) cost one provider lookup.
 */
@Injectable()
export class LinkResolverService {
  constructor(
    private readonly config: ConfigService,
    private readonly tmdb: TmdbProvider,
    private readonly anilist: AnilistProvider,
    private readonly igdb: IgdbProvider,
    private readonly openLibrary: OpenLibraryProvider,
    private readonly musicBrainz: MusicBrainzProvider,
  ) {}

  async resolve(url: string): Promise<ResolvedLinkDto | null> {
    const link = parseCatalogLink(url, this.loomkeepHosts());
    if (!link) return null;

    try {
      return await this.pageFor(link);
    } catch (err) {
      // An id the source no longer knows is "not recognized", like an
      // unknown site; a provider outage still surfaces as one.
      if (
        err instanceof AppException &&
        err.getStatus() === HttpStatus.NOT_FOUND
      ) {
        return null;
      }

      throw err;
    }
  }

  /** This instance's own web hostnames (WEB_ORIGIN), plus the hosted one. */
  private loomkeepHosts(): string[] {
    const own = webOrigins(this.config.get<string>("WEB_ORIGIN")).flatMap(
      (origin) => {
        try {
          return [new URL(origin.trim()).hostname.replace(/^www\./, "")];
        } catch {
          return [];
        }
      },
    );
    return [...own, HOSTED_INSTANCE_HOST];
  }

  private async pageFor(link: CatalogLink): Promise<ResolvedLinkDto | null> {
    switch (link.source) {
      case "loomkeep": {
        const section = link.path.split("/")[2];
        return {
          domain: Object.hasOwn(DOMAIN_BY_SECTION, section)
            ? DOMAIN_BY_SECTION[section]
            : null,
          href: link.path,
        };
      }

      case "tmdb":
        return {
          domain: Domain.MEDIA,
          href: `/app/media/${link.type.toLowerCase()}/${link.id}`,
        };
      case "anilist":
        return { domain: Domain.MEDIA, href: `/app/media/anime/${link.id}` };

      case "imdb": {
        const media =
          (await this.tmdb.findMovieSummaryByImdbId(link.id)) ??
          (await this.tmdb.findSeriesSummaryByImdbId(link.id));
        return media ? mediaHref(media) : null;
      }

      case "myanimelist": {
        const media = await this.anilist.getSummaryByMalId(link.id);
        return media ? mediaHref(media) : null;
      }

      case "igdb": {
        const id = await this.igdb.gameIdForSlug(link.slug);
        return id ? gameHref(id) : null;
      }

      case "steam": {
        const id = (await this.igdb.matchSteamAppIds([link.appId])).get(
          link.appId,
        );
        return id ? gameHref(id) : null;
      }

      case "openlibrary-work":
        return bookHref(link.id);

      case "openlibrary-edition": {
        const workId = await this.openLibrary.workIdForEdition(link.id);
        return workId ? bookHref(workId) : null;
      }

      case "isbn": {
        const book = await this.openLibrary.searchByIsbn(link.isbn);
        return book ? bookHref(book.sourceId) : null;
      }

      case "musicbrainz-release-group":
        return musicHref(link.id);

      case "musicbrainz-release": {
        const id = await this.musicBrainz.releaseGroupIdForRelease(link.id);
        return id ? musicHref(id) : null;
      }
    }
  }
}
