<script lang="ts">
  import { getMyReviews } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MyReviewDto } from "@loomkeep/shared";

  // Preview of the current user's own reviews, shown on their profile (own
  // view only — "Mes reviews" isn't a public surface). Mirrors the "Listes"
  // section above it: a few recent items plus a "Gérer" link to the full
  // management page, which stays out of the nav.
  const PREVIEW_COUNT = 3;

  const TYPE_LABEL: Record<string, string> = {
    MEDIA: m.nav_media(),
    GAME: m.nav_games(),
    BOOK: m.nav_books(),
    MUSIC: m.nav_music(),
    SEASON: m.profile_reviews_season(),
    EPISODE: m.profile_reviews_episode(),
  };

  let reviews = $state<MyReviewDto[]>([]);
  let loaded = $state(false);

  $effect(() => {
    getMyReviews()
      .then((r) => (reviews = r.slice(0, PREVIEW_COUNT)))
      .catch(() => (reviews = []))
      .finally(() => (loaded = true));
  });
</script>

{#if loaded && reviews.length > 0}
  <section class="mt-10">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-display text-xl font-bold">
        {m.profile_reviews_title()}
      </h2>
      <a
        href="/reviews"
        class="text-dim hover:text-accent flex items-center gap-1 text-sm font-semibold">
        {m.profile_reviews_manage()}
        <Icon name="chevron-right" class="h-4 w-4" />
      </a>
    </div>
    <ul class="space-y-2">
      {#each reviews as review (review.id)}
        <li class="card flex items-center gap-3 p-3">
          <svelte:element
            this={review.target?.href ? "a" : "div"}
            href={review.target?.href ?? undefined}
            class="flex min-w-0 flex-1 items-center gap-3 {review.target?.href
              ? 'group'
              : ''}">
            {#if review.target?.imageUrl}
              <img
                src={review.target.imageUrl}
                alt=""
                class="h-16 w-12 shrink-0 rounded object-cover" />
            {:else}
              <div
                class="bg-surface-2 text-dim flex h-16 w-12 shrink-0 items-center justify-center rounded font-mono text-xs">
                {TYPE_LABEL[review.targetType]?.[0] ?? "?"}
              </div>
            {/if}

            <div class="min-w-0 flex-1">
              <p
                class="truncate font-semibold {review.target?.href
                  ? 'group-hover:text-accent transition-colors'
                  : ''}">
                {review.target?.title ?? m.profile_reviews_untitled_work()}
              </p>
              <p class="text-dim flex flex-wrap items-center gap-x-2 text-xs">
                <span class="timecode uppercase"
                  >{TYPE_LABEL[review.targetType] ?? review.targetType}</span>
                {#if appConfig.socialEnabled}
                  <span aria-hidden="true">·</span>
                  <span
                    >{review.visibility === "PUBLIC"
                      ? m.profile_reviews_public()
                      : m.profile_reviews_friends()}</span>
                {/if}
              </p>
              {#if review.text}
                <p class="text-dim mt-1 line-clamp-1 text-sm italic">
                  « {review.text} »
                </p>
              {/if}
            </div>
          </svelte:element>

          <span
            class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
            {review.rating}<span class="text-accent/60 text-xs">/10</span>
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
