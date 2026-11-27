<script lang="ts" module>
  export type EmptyArtName =
    | "projector"
    | "tv"
    | "controller"
    | "book"
    | "vinyl"
    | "search"
    | "list"
    | "star"
    | "people"
    | "bell"
    | "calendar"
    | "chart"
    | "trophy"
    | "chat"
    | "shield"
    | "key"
    | "import";
</script>

<script lang="ts">
  // The amber line drawings of empty states (SHL-08). Every stroke carries
  // pathLength="1", so one CSS dash animation traces any of them, once, with
  // nothing to measure. `.soft` strokes are the dim secondary lines.
  let { name, class: cls = "" }: { name: EmptyArtName; class?: string } =
    $props();
</script>

<svg
  class="empty-art {cls}"
  viewBox="0 0 120 90"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true">
  {#if name === "projector"}
    <circle pathLength="1" cx="36" cy="28" r="13" />
    <circle pathLength="1" cx="64" cy="24" r="10" />
    <rect pathLength="1" x="24" y="44" width="52" height="28" rx="5" />
    <path pathLength="1" d="M76 52h10v12H76" />
    <path class="soft" pathLength="1" d="M88 52 116 34M88 64l28 18" />
  {:else if name === "tv"}
    <rect pathLength="1" x="30" y="26" width="60" height="42" rx="5" />
    <path pathLength="1" d="m50 14 10 12 10-12" />
    <path class="soft" pathLength="1" d="M70 40h8l-8 10h8" />
  {:else if name === "controller"}
    <path
      pathLength="1"
      d="M34 34h52a14 14 0 0 1 0 28c-6 0-9-6-14-6H48c-5 0-8 6-14 6a14 14 0 0 1 0-28z" />
    <path pathLength="1" d="M38 44v8M34 48h8" />
    <path pathLength="1" d="M80 44.5v.5M86 50.5v.5" />
    <path class="soft" pathLength="1" d="M14 78h92" />
  {:else if name === "book"}
    <path pathLength="1" d="M60 26c-8-6-20-7-30-4v46c10-3 22-2 30 4z" />
    <path pathLength="1" d="M60 26c8-6 20-7 30-4v46c-10-3-22-2-30 4z" />
    <path class="soft" pathLength="1" d="M38 36h14M38 44h14M68 36h14" />
  {:else if name === "vinyl"}
    <circle pathLength="1" cx="60" cy="45" r="30" />
    <circle pathLength="1" cx="60" cy="45" r="8" />
    <path class="soft" pathLength="1" d="M60 23a22 22 0 0 1 22 22" />
  {:else if name === "search"}
    <circle pathLength="1" cx="54" cy="40" r="22" />
    <path pathLength="1" d="m70 56 18 18" />
    <path class="soft" pathLength="1" d="M14 80h18M40 80h10" />
  {:else if name === "list"}
    <rect pathLength="1" x="32" y="16" width="56" height="62" rx="5" />
    <path pathLength="1" d="M44 34h32M44 46h32M44 58h20" />
    <path class="soft" pathLength="1" d="M96 30v18M87 39h18" />
  {:else if name === "star"}
    <path
      pathLength="1"
      d="m60 14 9.5 19.3 21.3 3.1-15.4 15 3.6 21.2L60 62.6 41 72.6l3.6-21.2-15.4-15 21.3-3.1z" />
    <path class="soft" pathLength="1" d="M18 80h84" />
  {:else if name === "people"}
    <circle pathLength="1" cx="46" cy="32" r="10" />
    <path pathLength="1" d="M28 70a18 18 0 0 1 36 0" />
    <circle class="soft" pathLength="1" cx="76" cy="36" r="8" />
    <path class="soft" pathLength="1" d="M68 58a16 16 0 0 1 24 12" />
  {:else if name === "bell"}
    <path pathLength="1" d="M42 62V44a18 18 0 0 1 36 0v18l5 7H37zM54 76h12" />
    <path
      class="soft"
      pathLength="1"
      d="M88 30a24 24 0 0 0-8-12M32 30a24 24 0 0 1 8-12" />
  {:else if name === "calendar"}
    <rect pathLength="1" x="28" y="22" width="64" height="52" rx="5" />
    <path pathLength="1" d="M28 38h64M44 14v14M76 14v14" />
    <path class="soft" pathLength="1" d="M42 52h6M57 52h6M72 52h6M42 62h6" />
  {:else if name === "chart"}
    <path pathLength="1" d="M28 74h64" />
    <path pathLength="1" d="M38 74V52M54 74V36M70 74V58M86 74V28" />
    <path class="soft" pathLength="1" d="m38 44 16-16 16 14 16-22" />
  {:else if name === "trophy"}
    <path pathLength="1" d="M44 18h32v16a16 16 0 0 1-32 0z" />
    <path
      pathLength="1"
      d="M44 24H34a10 10 0 0 0 10 14M76 24h10a10 10 0 0 1-10 14" />
    <path pathLength="1" d="M60 50v12M48 72h24M52 62h16v10H52z" />
  {:else if name === "chat"}
    <path pathLength="1" d="M26 22h50v32H44l-12 10V54h-6z" />
    <path class="soft" pathLength="1" d="M84 36h10v28h-6v8l-10-8H58v-6" />
  {:else if name === "shield"}
    <path
      pathLength="1"
      d="M60 14 84 24v18c0 16-10 28-24 34-14-6-24-18-24-34V24z" />
    <path class="soft" pathLength="1" d="m50 46 7 7 14-14" />
  {:else if name === "key"}
    <circle pathLength="1" cx="42" cy="45" r="14" />
    <path pathLength="1" d="M56 45h36M82 45v10M72 45v7" />
    <path class="soft" pathLength="1" d="M18 80h84" />
  {:else if name === "import"}
    <path pathLength="1" d="M60 16v38M46 42l14 14 14-14" />
    <path pathLength="1" d="M30 60v12h60V60" />
    <path class="soft" pathLength="1" d="M14 80h92" />
  {/if}
</svg>

<style>
  .empty-art {
    color: var(--color-accent);
  }

  .empty-art :global(.soft) {
    stroke: var(--color-dim);
    opacity: 0.6;
  }

  .empty-art > :global(*) {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: ink 0.7s ease-out forwards;
  }

  .empty-art > :global(:nth-child(2)) {
    animation-delay: 0.08s;
  }

  .empty-art > :global(:nth-child(n + 3)) {
    animation-delay: 0.16s;
  }

  @keyframes ink {
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .empty-art > :global(*) {
      stroke-dashoffset: 0;
      animation: none;
    }
  }

  :global(.a11y-reduce-motion) .empty-art > :global(*) {
    stroke-dashoffset: 0;
    animation: none;
  }
</style>
