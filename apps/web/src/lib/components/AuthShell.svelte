<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  import LegalLinks from "./LegalLinks.svelte";

  let { tagline, children }: { tagline?: Snippet; children: Snippet } =
    $props();

  // Decorative: the outline of a shelf of posters, in warm projector hues.
  // Each row holds its tiles twice, so sliding it by half loops seamlessly.
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
  const ROWS = [0, 1, 2].map((row) => {
    const own = Array.from(
      { length: 8 },
      (_, i) => HUES[(row * 5 + i * 2) % HUES.length],
    );
    return [...own, ...own];
  });
  const tile = (hue: string) =>
    `linear-gradient(150deg, ${hue}, var(--surface))`;
</script>

{#snippet wordmark(cls: string)}
  <p class="font-display font-extrabold tracking-tight {cls}">
    {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
  </p>
{/snippet}

<div class="flex min-h-svh">
  <!-- A wide screen gives the brand its own half; a phone goes straight to
       the form. -->
  <aside
    class="bg-surface border-border relative hidden min-w-0 flex-1 flex-col justify-between overflow-hidden border-r p-14 lg:flex">
    {@render wordmark("relative z-10 text-2xl")}
    <div class="auth-wall" aria-hidden="true">
      {#each ROWS as row, i (i)}
        <div class="auth-row {i % 2 ? 'auth-row-back' : ''}">
          {#each row as hue, j (j)}
            <span
              class="h-42 w-28 shrink-0 rounded-xl"
              style:background={tile(hue)}></span>
          {/each}
        </div>
      {/each}
    </div>
    <div class="auth-scrim" aria-hidden="true"></div>
    {#if tagline}
      <p
        class="font-display relative z-10 max-w-xl text-5xl leading-[1.05] font-extrabold tracking-tight text-balance">
        {@render tagline()}
      </p>
    {/if}
  </aside>

  <div
    class="flex min-h-svh w-full flex-col px-5 pt-12 pb-2 lg:w-[32.5rem] lg:shrink-0 lg:justify-center lg:px-16 lg:py-14">
    <div class="mb-7 lg:hidden">
      {@render wordmark("text-accent text-lg")}
      {#if tagline}
        <p
          class="font-display mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance">
          {@render tagline()}
        </p>
      {/if}
    </div>
    <!-- Thumb-sized fields on a phone, as the rest of the app's forms. -->
    <div
      class="flex flex-1 flex-col lg:flex-none [&_.input]:h-13 [&_.input]:text-base lg:[&_.input]:h-12 lg:[&_.input]:text-sm">
      {@render children()}
    </div>
    <LegalLinks version={false} class="items-center pt-6 text-center" />
  </div>
</div>

<style>
  .auth-wall {
    position: absolute;
    inset: 7.5rem -5rem 9rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    transform: rotate(-4deg);
    opacity: 0.85;
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
    inset: auto 0 0;
    height: 18rem;
    background: linear-gradient(transparent, var(--surface) 70%);
  }
</style>
