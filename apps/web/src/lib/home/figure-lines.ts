import { formatHours, formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import type { FiguresDto } from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";

export interface FigureLine {
  domain: Domain;
  value: number;
  label: string;
  detail: string | null;
}

const counted = (value: number, one: () => string, many: () => string) =>
  value === 1 ? one() : many();

/**
 * One line per domain the figures carry, its main counter first: « Mon
 * année » on the home page and a profile's « En chiffres ».
 */
export function figureLines({
  video,
  games,
  books,
  music,
}: FiguresDto): FigureLine[] {
  const lines: FigureLine[] = [];
  if (video)
    lines.push({
      domain: Domain.MEDIA,
      value: video.movies,
      label: counted(
        video.movies,
        m.home_my_year_movies_one,
        m.home_my_year_movies_many,
      ),
      detail: m.home_my_year_video_detail({
        episodes: formatNumber(video.episodes),
        time: formatHours(video.minutes),
      }),
    });
  if (games)
    lines.push({
      domain: Domain.GAMES,
      value: games.finished,
      label: counted(
        games.finished,
        m.home_my_year_games_one,
        m.home_my_year_games_many,
      ),
      detail:
        games.minutes > 0
          ? m.home_my_year_games_detail({ time: formatHours(games.minutes) })
          : null,
    });
  if (books)
    lines.push({
      domain: Domain.BOOKS,
      value: books.read,
      label: counted(
        books.read,
        m.home_my_year_books_one,
        m.home_my_year_books_many,
      ),
      detail:
        books.pages > 0
          ? m.home_my_year_books_detail({ pages: formatNumber(books.pages) })
          : null,
    });
  if (music)
    lines.push({
      domain: Domain.MUSIC,
      value: music.listened,
      label: counted(
        music.listened,
        m.home_my_year_music_one,
        m.home_my_year_music_many,
      ),
      detail: null,
    });
  return lines;
}
