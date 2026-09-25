<script lang="ts">
  import { getMyReviews } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, rowsLayout, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.latestReviews;

  // Same cache entry as "Mes critiques".
  const reviewsQuery = createApiQuery(() => ({
    key: keys.profile.myReviews(),
    fetch: getMyReviews,
  }));
  const rows = $derived(rowsLayout(bodyOf(size), { rowHeight: 76 }));
  const shown = $derived(
    [...(reviewsQuery.data ?? [])]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, rows.count),
  );
  const filled = $derived(shown.length === rows.count);
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  href="/app/reviews"
  linkLabel={m.common_see_more()}>
  {#if reviewsQuery.loading}
    <div class="space-y-3">
      {#each { length: 2 } as _, i (i)}
        <div class="flex gap-3">
          <div class="skeleton h-15 w-10 shrink-0 rounded-md"></div>
          <div class="min-w-0 flex-1 space-y-2">
            <div class="skeleton h-3 w-3/5 rounded"></div>
            <div class="skeleton h-2 w-full rounded"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if shown.length > 0}
    <!-- Like PosterRail's rows: filled, they share the leftover height. -->
    <ul
      class="grid gap-x-4 {filled ? 'h-full' : ''}"
      style:grid-template-columns={`repeat(${rows.columns}, minmax(0, 1fr))`}
      style:grid-template-rows={filled
        ? `repeat(${rows.count / rows.columns}, minmax(4.75rem, 1fr))`
        : undefined}>
      {#each shown as review (review.id)}
        <li class="border-border border-b last:border-b-0">
          <svelte:element
            this={review.target?.href ? "a" : "div"}
            href={review.target?.href ?? undefined}
            class="flex h-full min-h-19 items-center gap-3 py-2">
            <div class="w-10 shrink-0 overflow-hidden rounded-md">
              <Poster
                src={review.target?.imageUrl ?? null}
                title={review.target?.title ?? ""} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2">
                <span class="font-display truncate text-sm font-semibold">
                  {review.target?.title ?? m.home_review_untitled()}
                </span>
                <span
                  class="border-accent/40 text-accent timecode shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem]">
                  {m.home_review_rating({ rating: review.rating })}
                </span>
              </p>
              {#if review.spoilerTag}
                <p class="text-dim mt-0.5 text-xs italic">
                  {m.home_review_spoiler()}
                </p>
              {:else if review.text}
                <p class="text-dim mt-0.5 line-clamp-2 text-xs">
                  {review.text}
                </p>
              {/if}
            </div>
          </svelte:element>
        </li>
      {/each}
    </ul>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_latest_reviews_empty()}
    </p>
  {/if}
</WidgetShell>
