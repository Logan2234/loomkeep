<script lang="ts">
  import { listMusic } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { ENTRY_SORTS } from "./sorts";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.musicToListen;

  const sort = $derived(widget.config?.sort ?? "recent");
  const musicQuery = createApiQuery(() => ({
    key: keys.music.toListen(sort),
    fetch: () =>
      listMusic({ statuses: ["TO_LISTEN"], sort: ENTRY_SORTS[sort] }).then(
        (r) => r.items,
      ),
    enabled: !!auth.user,
  }));
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/music">
  <PosterRail
    items={musicQuery.data ?? []}
    keyOf={(e) => e.id}
    label={def.title()}
    info={(e) => ({
      href: `/app/music/${e.album.sourceId}`,
      title: e.album.title,
      imageUrl: e.album.coverUrl,
    })}
    {size}
    loading={musicQuery.loading}
    empty={m.home_nothing_listening()} />
</WidgetShell>
