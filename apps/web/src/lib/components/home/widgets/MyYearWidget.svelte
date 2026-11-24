<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getMyYear } from "#lib/api/stats.js";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { formatHours, formatNumber } from "#lib/format.js";
  import { HOME_WIDGETS } from "#lib/home/widgets.js";
  import { m } from "#lib/paraglide/messages.js";
  import { Domain, type MyYearDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  const def = HOME_WIDGETS.myYear;
  // The viewer's own calendar year, not the server's.
  const year = new Date().getFullYear();

  const yearQuery = createApiQuery(() => ({
    key: keys.home.myYear(year),
    fetch: () => getMyYear(year),
    enabled: !!auth.user,
  }));

  interface Line {
    domain: Domain;
    value: number;
    label: string;
    detail: string | null;
  }

  const counted = (value: number, one: () => string, many: () => string) =>
    value === 1 ? one() : many();

  // One line per enabled domain, its main counter first.
  function linesOf({ video, games, books, music }: MyYearDto): Line[] {
    const lines: Line[] = [];
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

  const lines = $derived(yearQuery.data ? linesOf(yearQuery.data) : []);
</script>

<WidgetShell icon={def.icon} title={def.title()} tag={String(year)}>
  {#if yearQuery.loading}
    <p class="text-dim text-sm">{m.common_loading()}</p>
  {:else if lines.length === 0}
    <p class="text-dim text-sm">{m.home_my_year_empty()}</p>
  {:else}
    <ul class="no-scrollbar flex h-full flex-col overflow-y-auto">
      {#each lines as line (line.domain)}
        <li
          class="border-surface-2 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 border-t py-2 first:border-t-0 first:pt-0">
          <Icon
            name={DOMAINS[line.domain].icon}
            class="text-dim h-4 w-4 self-center" />
          <div class="min-w-0">
            <p class="truncate text-sm">
              <span class="font-display text-xl font-extrabold tabular-nums">
                {formatNumber(line.value)}
              </span>
              {line.label}
            </p>
            {#if line.detail}
              <p class="text-dim truncate text-xs">{line.detail}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</WidgetShell>
