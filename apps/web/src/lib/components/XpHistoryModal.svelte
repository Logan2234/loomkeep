<script lang="ts">
  import { getXpHistory } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { formatDate, formatNumber, formatTime } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    buildTimeline,
    chartBars,
    itemLabel,
    localDayKey,
    reasonIcon,
    runDescription,
    runLabel,
    type XpRun,
  } from "#lib/xp-history.js";
  import {
    levelProgress,
    type PagedResult,
    type XpHistoryDayDto,
    type XpHistoryItemDto,
  } from "@loomkeep/shared";
  import { SvelteSet } from "svelte/reactivity";
  import { slide } from "svelte/transition";

  let { xp, onclose }: { xp: number; onclose: () => void } = $props();

  const reduced = prefersReducedMotion();

  const history = createApiInfiniteQuery<
    PagedResult<XpHistoryDayDto>,
    number,
    XpHistoryDayDto
  >(() => ({
    key: keys.gamification.xpHistory(),
    fetch: (page) => getXpHistory(page),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));

  const now = new Date();
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getTime() - 86_400_000));

  const days = $derived(buildTimeline(history.data, xp));
  const bars = $derived(chartBars(days, today));
  const barScale = $derived(Math.max(1, ...bars.map((b) => Math.abs(b.net))));
  const chartNet = $derived(bars.reduce((sum, b) => sum + b.net, 0));
  const progress = $derived(levelProgress(xp));

  const expanded = new SvelteSet<string>();

  let sentinel = $state<HTMLElement | null>(null);
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) history.fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  // The day a bar was clicked for, briefly highlighted once scrolled to.
  let focusedDay = $state<string | null>(null);
  let focusTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(focusTimer));

  function goToDay(day: string) {
    document.getElementById(dayAnchor(day))?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    focusedDay = day;
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => (focusedDay = null), 1200);
  }

  const dayAnchor = (day: string) => `xp-history-${day}`;

  // Noon, so no timezone shift can move a "YYYY-MM-DD" onto its neighbour.
  const dayDate = (day: string, options: Intl.DateTimeFormatOptions) =>
    formatDate(`${day}T12:00:00`, options);

  function dayLabel(day: string): string {
    const date = dayDate(day, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (day === today) return `${m.common_today()} · ${date}`;
    if (day === yesterday) return `${m.common_yesterday()} · ${date}`;
    return date;
  }

  const signed = (n: number) =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n))}`;

  const amountClass = (n: number) => (n < 0 ? "text-danger" : "text-accent");

  const barTooltip = (day: string, net: number) =>
    `${dayLabel(day)}\n${signed(net)} XP`;

  // A taken-back line says when it had been earned; any other, its time.
  const itemWhen = (item: XpHistoryItemDto) =>
    item.earnedAt
      ? m.gamification_xp_history_earned_on({
          date: dayDate(localDayKey(new Date(item.earnedAt)), {
            day: "numeric",
            month: "short",
          }),
        })
      : formatTime(item.at);

  const iconClass = (run: XpRun) =>
    run.revoked
      ? "border-danger text-danger border border-dashed"
      : run.reason === "ACHIEVEMENT_UNLOCKED"
        ? "bg-accent/15 text-accent"
        : "bg-surface-2";

  const toggle = (key: string) =>
    expanded.has(key) ? expanded.delete(key) : expanded.add(key);
</script>

<Modal
  title={m.gamification_xp_history_title()}
  description={m.gamification_xp_history_summary({
    xp: formatNumber(xp),
    level: progress.level,
    toNext: formatNumber(progress.xpToNext),
    next: progress.level + 1,
  })}
  {onclose}>
  {#snippet badge()}
    {#if isFeatureNew("xp-history")}<NewBadge />{/if}
  {/snippet}

  <figure class="mb-2" aria-label={m.gamification_xp_history_chart_label()}>
    <div class="grid h-24 grid-cols-14 gap-1">
      {#each bars as bar (bar.day)}
        <Tooltip text={barTooltip(bar.day, bar.net)} class="flex h-full">
          <button
            type="button"
            class="group enabled:hover:bg-surface-2/60 flex w-full flex-col rounded-sm transition-colors duration-150 disabled:cursor-default"
            aria-label={barTooltip(bar.day, bar.net)}
            disabled={bar.net === 0 && !bar.levelUp}
            onclick={() => goToDay(bar.day)}>
            <span class="flex flex-3 flex-col items-center justify-end gap-0.5">
              {#if bar.levelUp}
                <Icon name="chevron-up" class="text-accent h-3 w-3 shrink-0" />
              {/if}
              {#if bar.net > 0}
                <span
                  class="w-full rounded-t-sm transition-[filter] duration-150 group-hover:brightness-125 {bar.day ===
                  today
                    ? 'bg-accent'
                    : bar.levelUp
                      ? 'bg-accent/60'
                      : 'bg-dim/40'}"
                  style:height={`${(bar.net / barScale) * 100}%`}></span>
              {/if}
            </span>
            <span class="border-border flex w-full flex-1 items-start border-t">
              {#if bar.net < 0}
                <span
                  class="bg-danger w-full rounded-b-sm transition-[filter] duration-150 group-hover:brightness-125"
                  style:height={`${(-bar.net / barScale) * 100}%`}></span>
              {/if}
            </span>
          </button>
        </Tooltip>
      {/each}
    </div>
    <figcaption class="timecode mt-1 text-right text-[0.65rem]">
      {m.gamification_xp_history_chart_caption({ net: signed(chartNet) })}
    </figcaption>
  </figure>

  {#if history.loading}
    <p class="text-dim py-6 text-center text-sm">{m.common_loading()}</p>
  {:else if history.error}
    <p class="text-danger py-6 text-center text-sm">{history.error}</p>
  {:else if days.length === 0}
    <p class="text-dim py-6 text-center text-sm">
      {m.gamification_xp_history_empty()}
    </p>
  {:else}
    {#each days as day (day.day)}
      <!-- Each day's band sticks while its own lines scroll by, so the day is
           never ambiguous — and reads apart from the thin level marks. -->
      <section
        id={dayAnchor(day.day)}
        class="pt-5 first:pt-1"
        aria-label={dayLabel(day.day)}>
        <div
          class="bg-surface-2 sticky top-0 z-10 flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 transition-shadow duration-500 ring-inset {focusedDay ===
          day.day
            ? 'ring-accent ring-1'
            : 'ring-0 ring-transparent'}">
          <h4 class="timecode text-[0.7rem] tracking-widest uppercase">
            {dayLabel(day.day)}
          </h4>
          <span class="timecode text-sm font-bold {amountClass(day.net)}">
            {signed(day.net)}
          </span>
        </div>

        <ul>
          {#each day.segments as segment (segment.key)}
            {#if segment.kind === "level"}
              <li
                class="timecode flex items-center gap-2 py-2 text-xs uppercase {segment.up
                  ? 'text-accent'
                  : 'text-danger'}">
                <Icon
                  name={segment.up ? "chevron-up" : "chevron-down"}
                  class="h-3.5 w-3.5" />
                {segment.up
                  ? m.gamification_xp_history_level_up({ level: segment.level })
                  : m.gamification_xp_history_level_down({
                      level: segment.level,
                    })}
                <span
                  class="h-px flex-1 {segment.up
                    ? 'bg-accent/40'
                    : 'bg-danger/40'}"></span>
              </li>
            {:else}
              {@const run = segment}
              {@const single = run.items.length === 1 ? run.items[0] : null}
              {@const isOpen = expanded.has(run.key)}
              <li>
                {#snippet row()}
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {iconClass(
                      run,
                    )}">
                    <Icon name={reasonIcon(run.reason)} class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold">{runLabel(run)}</span>
                    <span class="text-dim block truncate text-xs">
                      {runDescription(run)}
                    </span>
                  </span>
                  <span class="timecode text-sm {amountClass(run.total)}">
                    {signed(run.total)}
                  </span>
                {/snippet}

                {#if single?.href}
                  <a
                    href={single.href}
                    class="hover:bg-surface-2/60 -mx-2 flex min-h-13 items-center gap-3 rounded-lg px-2 py-2 pr-9 transition-colors duration-150"
                    onclick={onclose}>
                    {@render row()}
                  </a>
                {:else if single}
                  <div class="flex min-h-13 items-center gap-3 py-2 pr-7">
                    {@render row()}
                  </div>
                {:else}
                  <button
                    type="button"
                    class="hover:bg-surface-2/60 -mx-2 flex min-h-13 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150"
                    aria-expanded={isOpen}
                    onclick={() => toggle(run.key)}>
                    {@render row()}
                    <Icon
                      name="chevron-down"
                      class="text-dim h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none {isOpen
                        ? 'rotate-180'
                        : ''}" />
                  </button>
                  {#if isOpen}
                    <ul
                      transition:slide={{ duration: reduced ? 0 : 200 }}
                      class="border-border timecode mb-2 ml-11 flex flex-col gap-1 border-l pl-3 text-xs">
                      {#each run.items as item, index (index)}
                        <li class="flex items-baseline justify-between gap-3">
                          {#if item.href}
                            <a
                              href={item.href}
                              class="text-fg hover:text-accent min-w-0 truncate transition-colors duration-150"
                              onclick={onclose}>
                              {itemLabel(item)}
                            </a>
                          {:else}
                            <span class="min-w-0 truncate">
                              {itemLabel(item)}
                            </span>
                          {/if}
                          <span class="flex shrink-0 gap-2">
                            <span class="text-dim">{itemWhen(item)}</span>
                            <span class={amountClass(item.amount)}>
                              {signed(item.amount)}
                            </span>
                          </span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                {/if}
              </li>
            {/if}
          {/each}
        </ul>
      </section>
    {/each}

    {#if history.hasNextPage}
      <div bind:this={sentinel} class="text-dim py-4 text-center text-xs">
        {#if history.isFetchingNextPage}{m.common_loading()}{/if}
      </div>
    {/if}
  {/if}
</Modal>
