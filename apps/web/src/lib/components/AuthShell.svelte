<script lang="ts">
  import type { Snippet } from "svelte";
  import { getShowcase } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { dealCovers } from "#lib/auth-wall.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fade, fly } from "svelte/transition";
  import BrandMark from "./BrandMark.svelte";
  import LegalLinks from "./LegalLinks.svelte";

  // Mounted once by the (auth) layout: moving between sign-in, sign-up and
  // password pages keeps the wall drifting where it was, only the tagline and
  // the form change.
  let {
    tagline,
    page,
    children,
  }: {
    tagline: string;
    /** What changes from one auth page to the next. */
    page: string;
    children: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();

  // Real covers when the instance can name some (trending films, series and
  // games, its most followed books and albums), shuffled on every visit; warm
  // projector hues until then, or when it can't.
  const showcase = createApiQuery(() => ({
    key: keys.showcase(),
    fetch: getShowcase,
    retry: 0,
  }));

  function shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const MIN_COVERS = 8;
  // Enough to outrun the widest screens before the loop shows.
  const PER_ROW = 16;
  const ROWS = 4;
  const HUES = [
    "#7a3b2e",
    "#3d4a35",
    "#2f4c6b",
    "#5c4a2a",
    "#8a6a2f",
    "#3b6b6b",
    "#6b3b6b",
    "#4a3d6b",
    "#6b5a3e",
    "#2c5a6a",
    "#7a5a2e",
    "#35504a",
  ];
  const tile = (hue: string) =>
    `linear-gradient(150deg, ${hue}, var(--surface))`;

  // Each row holds its tiles twice, so sliding it by half loops seamlessly.
  const rows = $derived.by(() => {
    const covers = shuffled(showcase.data?.posters ?? []);
    const dealt =
      covers.length >= MIN_COVERS ? dealCovers(covers, ROWS, PER_ROW) : null;
    return Array.from({ length: ROWS }, (_, row) => {
      const own = dealt
        ? dealt[row].map((src) => ({ src, bg: null }))
        : Array.from({ length: PER_ROW }, (_, i) => ({
            src: null,
            bg: tile(HUES[(row * 5 + i * 2) % HUES.length]),
          }));
      return [...own, ...own];
    });
  });
</script>

{#snippet wordmark(cls: string)}
  <p
    class="font-display flex items-center gap-2.5 font-extrabold tracking-tight {cls}">
    <BrandMark class="h-[1.3em] w-[1.3em] shrink-0" />
    <span
      >{m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span
      ></span>
  </p>
{/snippet}

{#snippet headline(cls: string)}
  <div class="grid {cls}">
    {#key tagline}
      <p
        class="font-display col-start-1 row-start-1 leading-[1.05] font-extrabold tracking-tight text-balance"
        in:fade={{ duration: reduced ? 0 : 220, delay: reduced ? 0 : 80 }}
        out:fade={{ duration: reduced ? 0 : 120 }}>
        {tagline}
      </p>
    {/key}
  </div>
{/snippet}

<div class="flex min-h-svh">
  <!-- A wide screen gives the brand its own half; a phone goes straight to
       the form. -->
  <aside
    class="bg-surface border-border relative hidden min-w-0 flex-1 flex-col justify-between overflow-hidden border-r p-14 lg:flex">
    {@render wordmark("relative z-10 text-2xl")}
    <div class="auth-wall select-none" aria-hidden="true">
      {#each rows as row, i (i)}
        <div class="auth-row {i % 2 ? 'auth-row-back' : ''}">
          {#each row as cover, j (j)}
            {#if cover.src}
              <img
                src={cover.src}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                class="bg-surface-2 h-42 w-28 shrink-0 rounded-xl object-cover" />
            {:else}
              <span
                class="h-42 w-28 shrink-0 rounded-xl"
                style:background={cover.bg}></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="auth-scrim" aria-hidden="true"></div>
    {@render headline("relative z-10 max-w-xl text-5xl")}
  </aside>

  <div
    class="flex min-h-svh w-full flex-col px-5 pt-12 pb-2 lg:relative lg:w-[32.5rem] lg:shrink-0 lg:justify-center lg:px-16 lg:py-20">
    <!-- No tagline on a phone: it would push the form down for nothing. -->
    <div class="mb-8 lg:hidden">
      {@render wordmark("text-xl")}
    </div>
    <!-- Thumb-sized fields on a phone, as the rest of the app's forms. -->
    <div
      class="grid flex-1 lg:flex-none [&_.input]:h-13 [&_.input]:text-base lg:[&_.input]:h-12 lg:[&_.input]:text-sm">
      <!-- No exit: the page leaving would hold its height for a moment and
           shift everything around the one arriving. -->
      {#key page}
        <div
          class="col-start-1 row-start-1 flex min-w-0 flex-col"
          in:fly={{ y: reduced ? 0 : 10, duration: reduced ? 0 : 220 }}>
          {@render children()}
        </div>
      {/key}
    </div>
    <!-- Pinned to the bottom on a wide screen, wherever the form ends. -->
    <LegalLinks
      version={false}
      class="items-center pt-6 text-center lg:absolute lg:inset-x-16 lg:bottom-4" />
  </div>
</div>

<style>
  /* Over the whole half, dimmed: the tagline reads on the posters rather than
     on an edge where they stop. */
  .auth-wall {
    position: absolute;
    inset: -4rem -6rem;
    justify-content: center;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    transform: rotate(-4deg);
    opacity: 0.55;
  }

  .auth-row {
    display: flex;
    gap: 0.875rem;
    width: max-content;
    animation: auth-drift 120s linear infinite;
  }

  .auth-row-back {
    animation-direction: reverse;
    animation-duration: 150s;
  }

  @keyframes auth-drift {
    to {
      transform: translateX(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .auth-row {
      animation: none;
    }
  }

  :global(.a11y-reduce-motion) .auth-row {
    animation: none;
  }

  .auth-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, var(--surface) 12%, transparent 55%),
      linear-gradient(to bottom, var(--surface), transparent 22%);
  }
</style>
