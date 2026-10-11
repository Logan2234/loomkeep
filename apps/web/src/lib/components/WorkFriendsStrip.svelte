<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getWorkFriends } from "#lib/api/social.js";
  import { auth } from "#lib/auth.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { formatHours, formatNumber, formatRelative } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    didLabel,
    isAhead,
    lanes,
    namesLabel,
    positionOf,
    progressLabel,
    reelMode,
    toneCounts,
    type WorkDomain,
  } from "#lib/social/work-friends.js";
  import type {
    ListItemTargetType,
    WorkFriendDto,
    WorkProgressDto,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { fade, slide } from "svelte/transition";

  // Where the viewer's friends stand with this work, folded into one line
  // under the page's actions: their faces along the progression and how many
  // are ahead — then, unfolded, the full reel.
  let {
    domain,
    targetType,
    targetId,
    revision = "",
  }: {
    domain: WorkDomain;
    targetType: ListItemTargetType;
    targetId: string;
    /** Changes with the viewer's own entry: their place on the reel follows. */
    revision?: string;
  } = $props();

  const reduced = prefersReducedMotion();
  let open = $state(false);
  let picked = $state<number | null>(null);

  const query = createApiQuery(() => ({
    key: keys.social.workFriends(targetType, targetId),
    fetch: () => getWorkFriends(targetType, targetId),
  }));
  const data = $derived(query.data);

  // Watching an episode or changing a status happens elsewhere on the page:
  // the reel refetches once the page's own entry moved.
  const queryClient = useQueryClient();
  let seenRevision: string | null = null;
  $effect(() => {
    const current = revision;
    if (seenRevision !== null && current !== seenRevision) {
      void queryClient.invalidateQueries({
        queryKey: keys.social.workFriends(targetType, targetId),
      });
    }
    seenRevision = current;
  });

  /** Everyone on the reel: the viewer first, then their friends. */
  type Person = WorkProgressDto & {
    key: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    href: string | null;
    rating: number | null;
    me: boolean;
  };
  const friendOf = (f: WorkFriendDto): Person => ({
    ...f,
    key: f.user.id,
    name: f.user.displayName,
    username: f.user.username,
    avatarUrl: f.user.avatarUrl,
    href: `/app/u/${f.user.username}`,
    me: false,
  });
  const people = $derived.by((): Person[] => {
    if (!data) return [];
    const me: Person[] = data.me
      ? [
          {
            ...data.me,
            key: "me",
            name: m.common_you(),
            username: auth.user?.username ?? "",
            avatarUrl: auth.user?.avatarUrl ?? null,
            href: null,
            rating: null,
            me: true,
          },
        ]
      : [];
    return [...me, ...data.friends.map(friendOf)];
  });

  const mode = $derived(data ? reelMode(data) : "lanes");
  const ahead = $derived(
    data ? data.friends.filter((f) => isAhead(domain, data, f)).length : 0,
  );
  const position = (p: Person) => (data ? positionOf(domain, data, p) : null);
  const placed = $derived(people.filter((p) => position(p) !== null));
  const label = (p: Person) =>
    [
      p.name,
      progressLabel(domain, p),
      p.rating === null
        ? null
        : `${formatNumber(p.rating, { maximumFractionDigits: 1 })}/10`,
    ]
      .filter(Boolean)
      .join(" · ");

  // The season the reel opens on: the viewer's, else the first.
  const season = $derived(picked ?? data?.me?.season ?? 1);
  const episodes = $derived(data?.seasons[season - 1] ?? 0);
  const seenUpTo = (s: number, e: number) => {
    const me = data?.me;
    if (!me?.season || !me.episode) return false;
    return s < me.season || (s === me.season && e <= me.episode);
  };
  const inSeason = $derived(people.filter((p) => p.season === season));
  const elsewhere = $derived(
    people.filter((p) => !p.me && p.season !== season),
  );
  const pageCount = $derived(
    people.find((p) => p.pageCount)?.pageCount ?? null,
  );
  const unplaced = $derived(
    people.filter((p) => !p.me && position(p) === null),
  );

  // Marking episodes fills the cells one after the other, from where the
  // viewer was: each cell waits its turn after that one.
  const myCell = $derived(
    data?.me?.season === season ? (data.me.episode ?? 0) : 0,
  );
  let fillFrom = $state(0);
  let lastCell: number | null = null;
  $effect.pre(() => {
    const current = myCell;
    if (lastCell !== null && current !== lastCell) fillFrom = lastCell;
    lastCell = current;
  });
  const STEP_MS = 90;

  const TONE_CLASS = {
    idle: "bg-surface-2 text-dim",
    active: "bg-accent/12 text-accent",
    done: "bg-success/12 text-success",
    dropped: "bg-danger/10 text-danger",
  } as const;
  const rating = (r: number) =>
    `${formatNumber(r, { maximumFractionDigits: 1 })}/10`;
</script>

{#snippet face(p: Person, size: number)}
  <Avatar seed={p.username || p.name} url={p.avatarUrl} {size} />
{/snippet}

{#snippet pin(p: Person, left: number, nudge = 0)}
  <svelte:element
    this={p.href ? "a" : "span"}
    href={p.href}
    class="pin absolute top-0 -translate-x-1/2 hover:-translate-y-0.5"
    style:left={`calc(${left * 100}% + ${nudge * 14}px)`}
    aria-label={label(p)}
    data-tip={label(p)}
    data-edge={left < 0.2 ? "start" : left > 0.8 ? "end" : null}>
    {@render face(p, 26)}
  </svelte:element>
{/snippet}

{#snippet others(list: Person[])}
  {#if list.length > 0}
    <ul class="text-dim flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {#each list as p (p.key)}
        <li class="flex items-center gap-1.5">
          {@render face(p, 20)}
          <a href={p.href} class="hover:text-fg transition-colors"
            >{label(p)}</a>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#if data && data.friends.length > 0}
  <section
    class="border-border bg-surface mt-4 rounded-xl border"
    aria-label={m.work_friends_toggle()}
    in:fade={{ duration: reduced ? 0 : 180 }}>
    <button
      type="button"
      class="hover:bg-surface-2/60 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-left transition-colors duration-150 sm:grid-cols-[minmax(0,1fr)_auto_auto] {open
        ? 'rounded-t-xl'
        : 'rounded-xl'}"
      aria-expanded={open}
      onclick={() => (open = !open)}>
      {#if placed.length > 0}
        <!-- A phone gives the line its own row: squeezed, the faces pile up. -->
        <span class="relative col-span-2 h-7 sm:col-span-1" aria-hidden="true">
          <span class="bg-surface-2 absolute inset-x-0 top-3 h-1 rounded-full">
            <span
              class="bg-accent absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style:width="{(data.me ? (position(people[0]) ?? 0) : 0) * 100}%"
            ></span>
          </span>
          {#each placed as p (p.key)}
            <span
              class="absolute top-0.5 -translate-x-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none"
              style:left="{Math.min(
                98,
                Math.max(2, (position(p) ?? 0) * 100),
              )}%">
              {@render face(p, 22)}
            </span>
          {/each}
        </span>
      {:else if data.friends.length === 1}
        <!-- One friend, said in words: who did what, and when. -->
        {@const f = friendOf(data.friends[0])}
        <span
          class="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
          {@render face(f, 26)}
          <span class="min-w-0 text-sm">
            <b class="font-semibold">{f.name}</b>
            {didLabel(domain, f)}
            {#if f.playtimeMinutes}
              <span class="text-dim">· {formatHours(f.playtimeMinutes)}</span>
            {/if}
            {#if f.rating !== null}
              · <span class="text-accent font-mono font-bold"
                >{rating(f.rating)}</span>
            {/if}
            <span class="text-dim">· {formatRelative(f.updatedAt)}</span>
          </span>
        </span>
      {:else}
        <!-- Many friends: the first faces and names, then a count per status. -->
        <span
          class="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:col-span-1">
          <span class="flex shrink-0 items-center" aria-hidden="true">
            {#each data.friends.slice(0, 5) as f (f.user.id)}
              <span class="-mr-1.5">
                <Avatar
                  seed={f.user.username}
                  url={f.user.avatarUrl}
                  size={24} />
              </span>
            {/each}
            {#if data.friends.length > 5}
              <span class="text-dim ml-3 font-mono text-xs"
                >+{data.friends.length - 5}</span>
            {/if}
          </span>
          <span class="min-w-0 truncate text-sm font-semibold">
            {namesLabel(data.friends.map((f) => f.user.displayName))}
          </span>
          <span class="flex gap-1.5">
            {#each toneCounts(domain, data.friends) as c (c.tone)}
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-bold {TONE_CLASS[
                  c.tone
                ]}"
                title={c.label}
                aria-label="{c.label} : {c.count}">
                <Icon name={c.icon} class="h-3 w-3" />{c.count}
              </span>
            {/each}
          </span>
        </span>
      {/if}
      <span
        class="text-dim flex items-center gap-1.5 text-sm whitespace-nowrap">
        {#if mode !== "lanes"}
          {data.friends.length > 1
            ? m.work_friends_count_many({ count: data.friends.length })
            : m.work_friends_count_one()}
          {#if ahead > 0}
            ·
            <b class="text-accent font-semibold">
              {ahead > 1
                ? m.work_friends_ahead_many({ count: ahead })
                : m.work_friends_ahead_one()}
            </b>
          {/if}
        {/if}
        {#if isFeatureNew("work-friends")}<NewBadge />{/if}
      </span>
      <Icon
        name="chevron-down"
        class="text-dim h-4 w-4 transition-transform duration-200 motion-reduce:transition-none {open
          ? 'rotate-180'
          : ''}" />
    </button>

    {#if open}
      <div
        transition:slide={{ duration: reduced ? 0 : 220 }}
        class="bg-surface-2/50 border-border flex flex-col gap-3 rounded-b-xl border-t px-4 py-3.5">
        {#if mode !== "lanes"}
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <h3 class="font-display font-bold">
              {mode === "episodes"
                ? m.work_friends_season({ season, count: episodes })
                : m.work_friends_pages({ count: pageCount ?? 0 })}
            </h3>
            {#if mode === "episodes" && data.seasons.length > 1}
              <span class="ml-auto flex gap-1" role="group">
                {#each data.seasons as _, i (i)}
                  <button
                    type="button"
                    aria-pressed={season === i + 1}
                    class="rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold transition-colors duration-150
                      {season === i + 1
                      ? 'bg-fg text-bg border-fg'
                      : 'border-border text-dim hover:text-fg bg-surface'}"
                    onclick={() => (picked = i + 1)}
                    >{m.work_friends_season_tab({ season: i + 1 })}</button>
                {/each}
              </span>
            {/if}
          </div>
        {/if}

        {#if mode === "episodes"}
          <div class="relative pt-9 pb-1">
            {#each inSeason as p, i (p.key)}
              <!-- Two friends on one episode sit side by side. -->
              {@render pin(
                p,
                ((p.episode ?? 1) - 0.5) / episodes,
                inSeason.slice(0, i).filter((o) => o.episode === p.episode)
                  .length,
              )}
            {/each}
            <div
              class="grid gap-1"
              style:grid-template-columns={`repeat(${episodes}, minmax(0, 1fr))`}>
              {#each { length: episodes } as _, i (i)}
                <span
                  class="h-4 rounded-sm border transition-colors duration-300 motion-reduce:transition-none {data
                    .me?.season === season && data.me.episode === i + 1
                    ? 'bg-accent border-accent'
                    : seenUpTo(season, i + 1)
                      ? 'bg-accent/40 border-transparent'
                      : 'bg-surface border-border'}"
                  style:transition-delay={`${Math.max(0, i + 1 - fillFrom) * STEP_MS}ms`}
                ></span>
              {/each}
            </div>
          </div>
          <div class="text-dim flex justify-between font-mono text-xs">
            <span>{m.work_friends_episode_tick({ episode: 1 })}</span>
            <span
              >{m.work_friends_episode_tick({
                episode: Math.ceil(episodes / 2),
              })}</span>
            <span>{m.work_friends_episode_tick({ episode: episodes })}</span>
          </div>
          {@render others(elsewhere)}
        {:else if mode === "pages"}
          <div class="relative pt-9 pb-1">
            {#each placed as p (p.key)}
              {@render pin(p, Math.min(0.97, Math.max(0.03, position(p) ?? 0)))}
            {/each}
            <div
              class="bg-surface border-border relative h-4 overflow-hidden rounded-full border">
              <span
                class="bg-accent absolute inset-y-0 left-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style:width="{(data.me ? (position(people[0]) ?? 0) : 0) *
                  100}%"></span>
            </div>
          </div>
          <div class="text-dim flex justify-between font-mono text-xs">
            <span>{m.work_friends_page({ page: 1 })}</span>
            <span>{m.work_friends_page({ page: pageCount ?? 0 })}</span>
          </div>
          {@render others(unplaced)}
        {:else}
          <div class="grid gap-2 sm:grid-cols-3">
            {#each lanes(domain, people) as lane (lane.tone)}
              <div
                class="bg-surface flex min-w-0 flex-col gap-2 rounded-xl p-3">
                <h3
                  class="text-dim font-mono text-xs tracking-widest uppercase">
                  {lane.title}
                </h3>
                <ul class="flex flex-col gap-1.5">
                  {#each lane.people as p (p.key)}
                    <li class="flex min-w-0 items-center gap-2 text-sm">
                      <span class="shrink-0">
                        {@render face(p, 24)}
                      </span>
                      <svelte:element
                        this={p.href ? "a" : "span"}
                        href={p.href}
                        class="truncate {p.href
                          ? 'hover:text-accent transition-colors'
                          : 'font-semibold'}">
                        {label(p)}
                      </svelte:element>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  /* The pin's name, shown on hover and keyboard focus above the face. */
  .pin::after {
    content: attr(data-tip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translate(-50%, 3px);
    white-space: nowrap;
    background: var(--fg);
    color: var(--bg);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 8px;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s,
      transform 0.15s;
    z-index: 5;
  }

  .pin:hover::after,
  .pin:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  /* Near an edge, the name hangs inward rather than past the block. */
  .pin[data-edge="start"]::after {
    left: 0;
    transform: translate(0, 3px);
  }

  .pin[data-edge="end"]::after {
    left: auto;
    right: 0;
    transform: translate(0, 3px);
  }

  .pin[data-edge]:hover::after,
  .pin[data-edge]:focus-visible::after {
    transform: translate(0, 0);
  }

  /* The viewer's face slides to their new episode or page. */
  .pin {
    transition:
      left 0.7s cubic-bezier(0.2, 0.8, 0.2, 1),
      transform 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .pin {
      transition: none;
    }
  }
</style>
