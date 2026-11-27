<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getProfileFigures } from "#lib/api/stats.js";
  import { auth } from "#lib/auth.svelte.js";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import ProfileSectionHeading from "#lib/components/profile/ProfileSectionHeading.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { formatNumber } from "#lib/format.js";
  import { figureLines } from "#lib/home/figure-lines.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fade } from "svelte/transition";

  // « En chiffres » (PRV-05): « Mon année »'s counters, or the same over the
  // whole library. The API leaves out each domain the viewer may not see,
  // as the library section below does with its counts.
  let { username }: { username: string } = $props();

  // The viewer's own calendar year, as on the home widget.
  const year = new Date().getFullYear();
  let period = $state<"year" | "all">("year");
  const periods = [
    { value: "year", label: String(year) },
    { value: "all", label: m.profile_figures_all_time() },
  ] as const;

  const figuresQuery = createApiQuery(() => ({
    key: keys.profile.figures(username, year),
    fetch: () => getProfileFigures(username, year),
  }));

  // In the viewer's own domain order, as everywhere else on the profile.
  const lines = $derived.by(() => {
    const figures = figuresQuery.data;
    if (!figures) return [];
    const order = orderedDomains(auth.user?.domainOrder).filter(
      isDomainEnabled,
    );
    return figureLines(period === "year" ? figures.thisYear : figures.allTime)
      .filter((line) => order.includes(line.domain))
      .sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain));
  });

  const reduced = prefersReducedMotion();
</script>

{#if lines.length > 0}
  <section aria-label={m.profile_figures_title()}>
    <ProfileSectionHeading label={m.profile_figures_title()}>
      {#snippet action()}
        <!-- A phone's heading has no room for both badge and switch. -->
        {#if isFeatureNew("profile-figures")}
          <span class="max-sm:hidden"><NewBadge /></span>
        {/if}
        <div
          role="group"
          aria-label={m.profile_figures_period()}
          class="flex items-center gap-1 font-mono text-[0.6875rem]">
          {#each periods as { value, label }, index (value)}
            {#if index > 0}<span class="text-border" aria-hidden="true">
                /
              </span>{/if}
            <button
              type="button"
              aria-pressed={period === value}
              class="decoration-accent rounded px-1 py-0.5 whitespace-nowrap underline-offset-[3px] transition-colors {period ===
              value
                ? 'text-fg font-bold underline'
                : 'text-dim hover:text-fg'}"
              onclick={() => (period = value)}>
              {label}
            </button>
          {/each}
        </div>
      {/snippet}
    </ProfileSectionHeading>

    {#key period}
      <ul
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
        in:fade={{ duration: reduced ? 0 : 160 }}>
        {#each lines as line (line.domain)}
          <li class="grid grid-cols-[4px_minmax(0,1fr)] gap-3">
            <span
              class="rounded-[2px]"
              style:background={DOMAINS[line.domain].accent}></span>
            <div class="min-w-0">
              <p class="text-dim text-xs font-semibold">
                {DOMAINS[line.domain].label}
              </p>
              <p class="text-sm">
                <span class="font-display text-xl font-extrabold tabular-nums">
                  {formatNumber(line.value)}
                </span>
                {line.label}
              </p>
              {#if line.detail}
                <p class="text-dim text-xs">{line.detail}</p>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/key}
  </section>
{/if}
