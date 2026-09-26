<script lang="ts">
  import {
    getSavedViews,
    listBooks,
    listGames,
    listLibrary,
    listMusic,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import { savedViewHref } from "$lib/saved-views";
  import type { HomeWidgetDto, SavedViewDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.savedView;
  const viewId = $derived(widget.config?.viewId);

  // Same cache entry as the library's chips, so a view renamed or updated
  // there shows here.
  const viewsQuery = createApiQuery(() => ({
    key: keys.savedViews.all(),
    fetch: getSavedViews,
    enabled: !!viewId,
  }));
  const view = $derived(viewsQuery.data?.find((v) => v.id === viewId));

  interface Card {
    id: string;
    href: string;
    title: string;
    imageUrl: string | null;
  }

  /** The first page of the view's library, through that library's own list. */
  function loadCards(v: SavedViewDto): Promise<Card[]> {
    const filters = {
      query: v.filters.q,
      favorite: v.filters.favorite,
      statuses: v.filters.statuses,
      sort: v.filters.sort,
      order: v.filters.order,
    };
    switch (v.domain) {
      case "MEDIA":
        return listLibrary({ ...filters, types: v.filters.types }).then((r) =>
          r.items.map((e) => ({
            id: e.id,
            href: `/app/media/${e.mediaItem.type.toLowerCase()}/${e.mediaItem.sourceId}`,
            title: e.mediaItem.title,
            imageUrl: e.mediaItem.posterUrl,
          })),
        );
      case "GAMES":
        return listGames(filters).then((r) =>
          r.items.map((e) => ({
            id: e.id,
            href: `/app/games/${e.game.sourceId}`,
            title: e.game.title,
            imageUrl: e.game.coverUrl,
          })),
        );
      case "BOOKS":
        return listBooks(filters).then((r) =>
          r.items.map((e) => ({
            id: e.id,
            href: `/app/books/${e.book.sourceId}`,
            title: e.book.title,
            imageUrl: e.book.coverUrl,
          })),
        );
      case "MUSIC":
        return listMusic(filters).then((r) =>
          r.items.map((e) => ({
            id: e.id,
            href: `/app/music/${e.album.sourceId}`,
            title: e.album.title,
            imageUrl: e.album.coverUrl,
          })),
        );
    }
  }

  const cardsQuery = createApiQuery(() => ({
    key: keys.savedViews.content(view?.id ?? "", view?.filters),
    fetch: () => loadCards(view!),
    enabled: !!view,
  }));
  const title = $derived(view?.name ?? def.title());
</script>

<WidgetShell
  icon={def.icon}
  {title}
  href={view ? savedViewHref(view) : undefined}
  linkLabel={m.home_saved_view_see_all()}>
  {#if !viewId}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_saved_view_unset()}
    </p>
  {:else if viewsQuery.data && !view}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_saved_view_missing()}
    </p>
  {:else if viewsQuery.error ?? cardsQuery.error}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {viewsQuery.error ?? cardsQuery.error}
    </p>
  {:else}
    <PosterRail
      label={title}
      items={cardsQuery.data ?? []}
      keyOf={(card) => card.id}
      info={(card) => card}
      {size}
      loading={viewsQuery.loading || cardsQuery.loading}
      empty={m.home_saved_view_empty()} />
  {/if}
</WidgetShell>
