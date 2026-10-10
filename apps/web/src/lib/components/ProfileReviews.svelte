<script lang="ts">
  import { getMyReviews } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import DomainOffMark from "#lib/components/DomainOffMark.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import ProfileSectionHeading from "#lib/components/profile/ProfileSectionHeading.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isDomainEnabled, targetDomain } from "#lib/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import { seasonEpisodeLabel } from "#lib/review-target-label.js";

  const PREVIEW_COUNT = 3;

  const TYPE_LABEL: Record<string, string> = {
    MEDIA: m.common_Media(),
    GAME: m.common_Games(),
    BOOK: m.common_Books(),
    MUSIC: m.common_Music(),
    SEASON: m.common_season(),
    EPISODE: m.common_episode(),
  };

  const TYPE_HUE: Record<string, string> = {
    MEDIA: "var(--stat-media)",
    SEASON: "var(--stat-media)",
    EPISODE: "var(--stat-media)",
    GAME: "var(--stat-games)",
    BOOK: "var(--stat-books)",
    MUSIC: "var(--stat-music)",
  };

  const reviewsQuery = createApiQuery(() => ({
    key: keys.profile.myReviews(),
    fetch: getMyReviews,
  }));

  const reviews = $derived((reviewsQuery.data ?? []).slice(0, PREVIEW_COUNT));
</script>

{#if !reviewsQuery.loading && reviews.length > 0}
  <section>
    <ProfileSectionHeading label={m.profile_reviews_title()}>
      {#snippet action()}
        <a href="/app/reviews" class="btn-text group shrink-0">
          {m.common_manage()}
          <Icon
            name="arrow-right"
            class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      {/snippet}
    </ProfileSectionHeading>
    <ul class="divide-border/70 flex flex-col divide-y">
      {#each reviews as review (review.id)}
        {@const domain = targetDomain(review.targetType)}
        {@const off = !isDomainEnabled(domain)}
        {@const href = off ? null : review.target?.href}
        <!-- A domain the viewer turned off: a warning instead of the link,
             as on /app/reviews. -->
        <li
          class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors {href
            ? 'hover:bg-surface-2'
            : ''}">
          <svelte:element
            this={href ? "a" : "div"}
            href={href ?? undefined}
            class="flex min-w-0 flex-1 items-center gap-3 {href
              ? 'group'
              : ''}">
            {#if review.target?.imageUrl}
              <img
                src={review.target.imageUrl}
                alt=""
                class="h-16 w-12 shrink-0 rounded-md object-cover {off
                  ? 'opacity-70'
                  : ''}" />
            {:else}
              {@const hue = TYPE_HUE[review.targetType] ?? "var(--dim)"}
              <div
                class="flex h-16 w-12 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold"
                style="background: linear-gradient(155deg, color-mix(in srgb, {hue} 55%, var(--surface-2)), color-mix(in srgb, {hue} 12%, var(--surface-2))); color: color-mix(in srgb, {hue} 85%, var(--fg));">
                {TYPE_LABEL[review.targetType]?.[0] ?? "?"}
              </div>
            {/if}

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1">
                <p
                  class="min-w-0 truncate font-semibold {href
                    ? 'group-hover:text-accent transition-colors'
                    : ''}">
                  {review.target?.title ?? m.common_work()}
                </p>
                {#if off}
                  <DomainOffMark {domain} class="-my-1.5 shrink-0" />
                {/if}
              </div>
              <p class="text-dim flex flex-wrap items-center gap-x-2 text-xs">
                <span class="timecode uppercase"
                  >{seasonEpisodeLabel(review) ??
                    TYPE_LABEL[review.targetType] ??
                    review.targetType}</span>
                {#if appConfig.socialEnabled}
                  <span aria-hidden="true">·</span>
                  <span
                    >{review.visibility === "PUBLIC"
                      ? m.common_public()
                      : m.common_friends()}</span>
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
