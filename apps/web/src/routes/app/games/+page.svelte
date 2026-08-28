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
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
  import { Domain, type GameEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = GAME_STATUS_ORDER.map((value) => ({
    label: GAME_STATUS_LABELS[value],
    value,
  }));

  const SORTS = [
    { label: "Ajout récent", value: "added" },
    { label: m.common_title(), value: "title" },
    { label: "Note", value: "rating" },
    { label: "Temps de jeu", value: "playtime" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  async function toggleFavorite(entry: GameEntryDto, next: boolean) {
    entry.favorite = next; // optimistic
    try {
      await updateGameEntry(entry.id, { favorite: next });
    } catch {
      entry.favorite = !next;
      toast.error("Mise à jour impossible");
    }
  }

  function load(params: LibraryLoadParams) {
    return listGames({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });
  }
</script>

<LibraryBrowser
  icon="gamepad"
  title={m.common_Games()}
  subtitle={(n) => `${n} jeu${n > 1 ? "x" : ""}`}
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
      onToggleFavorite={(next) => toggleFavorite(entry, next)}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {GAME_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
