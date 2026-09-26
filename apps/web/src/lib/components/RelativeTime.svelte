<script lang="ts">
  // A timestamp shown relative ("il y a 2 h") with the absolute date/time as
  // a hover title on desktop. On mobile there's no hover, so a tap toggles
  // this instance between relative and absolute display instead.
  import {
    DATETIME_LONG_OPTIONS,
    formatDateTime,
    formatRelative,
  } from "$lib/format";

  let { iso, class: className = "" }: { iso: string; class?: string } =
    $props();

  let showAbsolute = $state(false);

  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  function toggle() {
    showAbsolute = !showAbsolute;
  }

  const absolute = $derived(formatDateTime(iso, DATETIME_LONG_OPTIONS));
  const text = $derived(showAbsolute ? absolute : formatRelative(iso));
</script>

{#if coarse}
  <button
    type="button"
    class={className}
    title={absolute}
    aria-pressed={showAbsolute}
    onclick={toggle}>
    <time datetime={iso} aria-label={absolute}>{text}</time>
  </button>
{:else}
  <time datetime={iso} class={className} title={absolute} aria-label={absolute}
    >{text}</time>
{/if}
