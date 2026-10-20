import type { ApiV1TargetDto, ApiV1WorkDto, Locale } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MediaItemService } from "../../catalog/media-item.service";
import { safeLang } from "../../common/locale.util";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Titles in the language a script asks for (`?lang=`), else the account's.
 * Only video titles have translations, and only the ones already cached —
 * the same rule as the web app's lists: a title nobody has opened in that
 * language yet stays in English, rather than costing a TMDB call per item.
 */
@Injectable()
export class WorkTitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItems: MediaItemService,
  ) {}

  async languageFor(userId: string, lang: Locale | undefined): Promise<string> {
    if (lang) return lang;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return safeLang(user?.locale) ?? "en";
  }

  /** Swaps each video work's title for its translation, in place. */
  async translateWorks(lang: string, works: ApiV1WorkDto[]): Promise<void> {
    const media = works.filter((work) => work.domain === "MEDIA");
    const titles = await this.mediaItems.translatedTitles(
      [...new Set(media.map((work) => work.id))],
      lang,
    );
    for (const work of media) work.title = titles.get(work.id) ?? work.title;
  }

  /** Same for list items and reviews: a MEDIA target's id is its work's. */
  async translateTargets(
    lang: string,
    targets: ApiV1TargetDto[],
  ): Promise<void> {
    const media = targets.filter((target) => target.type === "MEDIA");
    const titles = await this.mediaItems.translatedTitles(
      [...new Set(media.map((target) => target.id))],
      lang,
    );

    for (const target of media) {
      target.title = titles.get(target.id) ?? target.title;
    }
  }
}
