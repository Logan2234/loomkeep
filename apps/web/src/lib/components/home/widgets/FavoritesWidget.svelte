<script lang="ts">
  import {
    listBooks,
    listGames,
    listLibrary,
    listMusic,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain, type HomeWidgetDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { widgetDomains } from "./domains";
  import { mediaHref } from "./media";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const picked = $derived(widgetDomains(widget));
  const shows = (domain: Domain) =>
    !!auth.user &&
    isDomainEnabled(domain) &&
    (!picked || picked.includes(domain));

  const def = HOME_WIDGETS.favorites;

  interface Favorite {
    id: string;
    href: string;
    title: string;
    imageUrl: string | null;
    addedAt: string;
  }

  // One query per enabled domain, each failing on its own.
  const mediaQuery = createApiQuery(() => ({
    key: keys.home.favorites(Domain.MEDIA),
    fetch: () =>
      listLibrary({ favorite: true }).then((r) =>
        r.items.map((e): Favorite => ({
          id: e.id,
          href: mediaHref(e.mediaItem),
          title: e.mediaItem.title,
          imageUrl: e.mediaItem.posterUrl,
          addedAt: e.createdAt,
        })),
      ),
    enabled: shows(Domain.MEDIA),
  }));
  const gamesQuery = createApiQuery(() => ({
    key: keys.home.favorites(Domain.GAMES),
    fetch: () =>
      listGames({ favorite: true }).then((r) =>
        r.items.map((e): Favorite => ({
          id: e.id,
          href: `/app/games/${e.game.sourceId}`,
          title: e.game.title,
          imageUrl: e.game.coverUrl,
          addedAt: e.createdAt,
        })),
      ),
    enabled: shows(Domain.GAMES),
  }));
  const booksQuery = createApiQuery(() => ({
    key: keys.home.favorites(Domain.BOOKS),
    fetch: () =>
      listBooks({ favorite: true }).then((r) =>
        r.items.map((e): Favorite => ({
          id: e.id,
          href: `/app/books/${e.book.sourceId}`,
          title: e.book.title,
          imageUrl: e.book.coverUrl,
          addedAt: e.createdAt,
        })),
      ),
    enabled: shows(Domain.BOOKS),
  }));
  const musicQuery = createApiQuery(() => ({
    key: keys.home.favorites(Domain.MUSIC),
    fetch: () =>
      listMusic({ favorite: true }).then((r) =>
        r.items.map((e): Favorite => ({
          id: e.id,
          href: `/app/music/${e.album.sourceId}`,
          title: e.album.title,
          imageUrl: e.album.coverUrl,
          addedAt: e.createdAt,
        })),
      ),
    enabled: shows(Domain.MUSIC),
  }));

  const queries = [mediaQuery, gamesQuery, booksQuery, musicQuery];
  const FAVORITE_DOMAINS = [
    Domain.MEDIA,
    Domain.GAMES,
    Domain.BOOKS,
    Domain.MUSIC,
  ];
  // Every domain mixed, the most recently added first.
  const favorites = $derived(
    queries
      .filter((_, i) => shows(FAVORITE_DOMAINS[i]))
      .flatMap((q) => q.data ?? [])
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );
  const loading = $derived(
    favorites.length === 0 &&
      queries.some((q, i) => shows(FAVORITE_DOMAINS[i]) && q.loading),
  );
</script>

<WidgetShell icon={def.icon} title={def.title()}>
  <PosterRail
    items={favorites}
    keyOf={(f) => f.id}
    label={def.title()}
    info={(f) => ({ href: f.href, title: f.title, imageUrl: f.imageUrl })}
    {size}
    {loading}
    empty={m.home_favorites_empty()} />
</WidgetShell>
