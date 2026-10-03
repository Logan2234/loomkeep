<script lang="ts">
  import { getMediaSaga, upsertLibraryEntry } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import TrackingStatusBadge from "$lib/components/TrackingStatusBadge.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatDate, joinMeta } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { EntryStatus, MediaType, SagaMemberDto } from "@loomkeep/shared";

  let {
    type,
    sourceId,
    entryStatus,
  }: {
    type: MediaType;
    sourceId: string;
    /** The viewed work's live status, ahead of the saga's own copy. */
    entryStatus: EntryStatus | null;
  } = $props();

  const sagaKey = $derived(keys.media.saga(type, sourceId));

  const sagaQuery = createApiQuery(() => ({
    key: sagaKey,
    fetch: () => getMediaSaga(type, sourceId).then((r) => r.saga),
    enabled: type !== "SERIES",
  }));

  const members = $derived(
    (sagaQuery.data?.members ?? []).map((member) =>
      member.sourceId === sourceId
        ? { ...member, status: entryStatus }
        : member,
    ),
  );
  const current = $derived(members.findIndex((x) => x.sourceId === sourceId));

  // A work still airing that you're caught up on counts as seen, like a
  // finished one; an announcement counts for nothing yet.
  const isSeen = (x: SagaMemberDto) =>
    x.status === "COMPLETED" || x.status === "UP_TO_DATE";
  const released = $derived(members.filter((x) => !x.upcoming));
  const seenCount = $derived(released.filter(isSeen).length);

  let expanded = $state(false);
  const visible = $derived(
    expanded
      ? members
      : members.filter((_, i) => i >= current - 2 && i <= current + 2),
  );

  const segmentClass = (x: SagaMemberDto, i: number) =>
    isSeen(x)
      ? "bg-success"
      : i === current
        ? "bg-accent"
        : x.upcoming
          ? "border-border border border-dashed"
          : "bg-surface-2";

  const FORMATS: Record<string, string> = {
    MOVIE: m.media_movie(),
    SPECIAL: m.media_special(),
    TV_SHORT: m.media_short_series(),
  };

  const metaOf = (x: SagaMemberDto) =>
    x.upcoming
      ? m.media_saga_upcoming_on({
          date: x.releaseDate ? formatDate(x.releaseDate) : "—",
        })
      : joinMeta(
          x.year !== null ? String(x.year) : null,
          x.format ? (FORMATS[x.format] ?? x.format) : null,
          x.episodes ? `${x.episodes} ${m.media_episode_short()}` : null,
        );

  const hrefOf = (x: SagaMemberDto) =>
    `/app/media/${x.type.toLowerCase()}/${x.sourceId}`;

  const addMut = createApiMutation(() => ({
    mutate: (x: SagaMemberDto) =>
      upsertLibraryEntry({
        source: x.source,
        sourceId: x.sourceId,
        type: x.type,
        status: "PLANNED",
      }),
    invalidates: [sagaKey],
    errorToast: true,
  }));

  // Finishing a work is the moment its sequel is most wanted: offer it then,
  // rather than leaving it to be searched for.
  let previousStatus: EntryStatus | null | undefined;
  $effect(() => {
    const status = entryStatus;
    const before = previousStatus;
    previousStatus = status;
    if (before === undefined || before === "COMPLETED") return;
    if (status !== "COMPLETED") return;

    const next = members.find((x, i) => i > current && !isSeen(x));
    if (!next) return;
    const message = m.media_saga_next_toast({ title: next.title });
    if (next.status) {
      toast.show(message, "success");
    } else {
      toast.action(message, {
        label: m.media_saga_next_add(),
        onSelect: () => addMut.mutate(next),
      });
    }
  });
</script>

{#if members.length > 1}
  <section class="card mt-10 flex flex-col gap-4 p-4 sm:p-5">
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="timecode flex items-center gap-2 text-xs">
          {m.media_saga_title()}
          {#if isFeatureNew("sagas")}<NewBadge />{/if}
        </p>
        <h2 class="font-display text-xl font-bold text-balance">
          {sagaQuery.data?.title}
        </h2>
      </div>
      <p class="shrink-0 text-right font-mono">
        <span class="text-2xl font-bold tabular-nums"
          >{seenCount}<span class="text-dim">/{released.length}</span></span>
        <span class="timecode block text-xs">{m.media_saga_done()}</span>
      </p>
    </div>

    <div class="flex gap-0.5" aria-hidden="true">
      {#each members as member, i (member.sourceId)}
        <span
          data-saga-segment
          class="h-2 flex-1 rounded-sm {segmentClass(member, i)}"></span>
      {/each}
    </div>

    <ol class="flex flex-col">
      {#each visible as member (member.sourceId)}
        {@const index = members.indexOf(member)}
        {@const here = index === current}
        <li
          class="grid grid-cols-[1.75rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 {here
            ? 'bg-accent/10'
            : ''}">
          <span
            class="font-mono text-xs tabular-nums {here
              ? 'text-accent'
              : 'text-dim'}">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div class={member.upcoming ? "opacity-50" : ""}>
            <Poster
              src={member.posterUrl}
              title={member.title}
              alt=""
              caption={false} />
          </div>
          <div class="min-w-0">
            <p class="truncate font-semibold">
              {#if here}
                {member.title}
                <span
                  class="border-accent/45 bg-accent/10 text-accent ml-1 rounded-full border px-1.5 align-middle text-[0.6rem] font-bold tracking-wider uppercase">
                  {m.media_saga_here()}
                </span>
              {:else}
                <a href={hrefOf(member)} class="hover:text-accent">
                  {member.title}
                </a>
              {/if}
            </p>
            <p class="timecode truncate text-xs">{metaOf(member)}</p>
          </div>
          <div class="flex justify-end">
            {#if member.status}
              <TrackingStatusBadge domain="MEDIA" status={member.status} />
            {:else if !here}
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                aria-label={m.media_saga_add_label({ title: member.title })}
                disabled={addMut.loading}
                onclick={() => addMut.mutate(member)}>
                <Icon name="plus" class="h-3.5 w-3.5" />
                {m.media_status_planned()}
              </button>
            {:else if member.upcoming}
              <span
                class="border-border text-dim inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-bold">
                <Icon name="calendar" class="h-3.5 w-3.5" />
                {m.media_saga_upcoming()}
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    {#if visible.length < members.length}
      <button
        type="button"
        class="btn-text self-start text-sm"
        onclick={() => (expanded = true)}>
        {m.media_saga_show_all({ count: members.length })}
        <Icon name="chevron-down" class="h-4 w-4" />
      </button>
    {/if}
  </section>
{/if}
