<script lang="ts">
  import { listLibrary } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { dailyPick, localDayNumber } from "$lib/home/daily-pick";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto, MediaType } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";
  import { mediaHref } from "./media";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.tonightPick;

  const plannedQuery = createApiQuery(() => ({
    key: keys.home.tonightPick(),
    fetch: () => listLibrary({ statuses: ["PLANNED"] }).then((r) => r.items),
    enabled: !!auth.user,
  }));

  // Sorted by id so the pick doesn't depend on the order the API sends.
  // Nothing picked means every type.
  const types = $derived(widget.config?.mediaTypes ?? []);
  const candidates = $derived(
    (plannedQuery.data ?? [])
      .filter((e) => types.length === 0 || types.includes(e.mediaItem.type))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  const pick = $derived.by(() => {
    const index = dailyPick(
      candidates.length,
      auth.user?.id ?? "",
      localDayNumber(new Date()),
    );
    return index < 0 ? null : candidates[index];
  });

  const TYPE_LABELS: Record<MediaType, () => string> = {
    MOVIE: () => m.media_movie(),
    SERIES: () => m.media_series(),
    ANIME: () => m.media_anime_label(),
  };

  // Poster beside the text when there's room, above it otherwise; either
  // way as tall as the widget allows.
  const body = $derived(bodyOf(size));
  const side = $derived(body.width >= 300);
  const posterHeight = $derived(
    side ? body.height : Math.max(80, body.height - 64),
  );
</script>

<WidgetShell icon={def.icon} title={def.title()}>
  {#if plannedQuery.loading}
    <div class="flex h-full gap-3">
      <div
        class="skeleton shrink-0 rounded-lg"
        style:height={`${posterHeight}px`}
        style:width={`${(posterHeight * 2) / 3}px`}>
      </div>
    </div>
  {:else if pick}
    <a
      href={mediaHref(pick.mediaItem)}
      class="group flex h-full gap-3 {side
        ? 'items-stretch'
        : 'flex-col items-center text-center'}">
      <div
        class="card group-hover:border-accent shrink-0 overflow-hidden transition-[border-color]"
        style:height={`${posterHeight}px`}
        style:width={`${(posterHeight * 2) / 3}px`}>
        <Poster
          src={pick.mediaItem.posterUrl}
          title={pick.mediaItem.title}
          alt="" />
      </div>
      <div class="flex min-w-0 flex-col {side ? 'justify-center' : ''}">
        <p class="timecode text-[0.65rem] uppercase">
          {TYPE_LABELS[pick.mediaItem.type]()}
        </p>
        <p
          class="font-display group-hover:text-accent line-clamp-2 font-bold transition-colors">
          {pick.mediaItem.title}
        </p>
        {#if side}
          <p class="text-dim mt-2 text-xs">{m.home_tonight_pick_tomorrow()}</p>
        {/if}
      </div>
    </a>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_tonight_pick_empty()}
    </p>
  {/if}
</WidgetShell>
