<script lang="ts">
  import { listGames } from "$lib/api/client";
  import { updateGameEntry } from "$lib/api/games";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import {
    GAME_STATUS_LABELS,
    GAME_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { toggleFavorite } from "$lib/favorite-toggle";
  import { m } from "$lib/paraglide/messages";
  import { Domain, type GameEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = GAME_STATUS_ORDER.map((value) => ({
    label: GAME_STATUS_LABELS[value],
    value,
  }));

  const SORTS = [
    { label: m.library_sort_added(), value: "added" },
    { label: m.common_title(), value: "title" },
    { label: m.library_rating(), value: "rating" },
    { label: m.game_playtime(), value: "playtime" },
    { label: m.library_sort_finished(), value: "finished" },
    { label: m.library_sort_started(), value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  const load = (params: LibraryLoadParams) =>
    listGames({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });
</script>

<LibraryBrowser
  icon="gamepad"
  title={m.common_Games()}
  subtitle={(n) =>
    n === 1
      ? m.game_library_count_one({ count: n })
      : m.game_library_count_many({ count: n })}
  noun="jeu"
  domain={Domain.GAMES}
  {load}
  keyOf={(e) => e.id}
  statusOptions={STATUS_OPTIONS}
  sorts={SORTS}
  defaultSort="added">
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <GameSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: GameEntryDto)}
    <PosterCard
      href={`/app/games/${entry.game.sourceId}`}
      src={entry.game.coverUrl}
      title={entry.game.title}
      favorite={entry.favorite}
      onToggleFavorite={(next) =>
        toggleFavorite(entry, next, (n) =>
          updateGameEntry(entry.id, { favorite: n }),
        )}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {GAME_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
