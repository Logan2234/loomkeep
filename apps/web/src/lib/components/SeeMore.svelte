<script lang="ts">
  // The app's "see more": a small pill whose chevron turns over once unfolded.
  // `ruled` draws a hairline on each side, for one closing a block of its own.
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let {
    expanded,
    onclick,
    more = m.common_see_more(),
    less = m.common_see_less(),
    ruled = false,
    class: cls = "",
  }: {
    expanded: boolean;
    onclick: () => void;
    more?: string;
    less?: string;
    ruled?: boolean;
    class?: string;
  } = $props();
</script>

<button
  type="button"
  class="see-more {ruled ? 'see-more-ruled' : ''} {cls}"
  aria-expanded={expanded}
  {onclick}>
  <span class="see-more-pill">
    {expanded ? less : more}
    <Icon
      name="chevron-down"
      class="h-3.5 w-3.5 transition-transform duration-200 {expanded
        ? 'rotate-180'
        : ''}" />
  </span>
</button>

<style>
  .see-more {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }

  .see-more-ruled {
    display: flex;
    width: 100%;
  }

  .see-more-ruled::before,
  .see-more-ruled::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .see-more-pill {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    padding: 0.2rem 0.5rem 0.2rem 0.7rem;
    color: var(--text-dim);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      transform 0.15s ease;
  }

  /* Thumb-sized, without looking it. */
  .see-more-pill::after {
    content: "";
    position: absolute;
    inset: -0.55rem -0.25rem;
  }

  /* A finger leaves :hover behind after a tap. */
  @media (hover: hover) {
    .see-more:hover .see-more-pill {
      border-color: var(--accent);
      color: var(--accent);
    }
  }

  .see-more:focus-visible .see-more-pill {
    border-color: var(--accent);
    color: var(--accent);
  }

  .see-more:active .see-more-pill {
    transform: scale(0.96);
  }
</style>
