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

  const text = $derived(
    showAbsolute
      ? formatDateTime(iso, DATETIME_LONG_OPTIONS)
      : formatRelative(iso),
  );
</script>

{#if coarse}
  <button
    type="button"
    class={className}
    title={formatDateTime(iso, DATETIME_LONG_OPTIONS)}
    onclick={toggle}>
    {text}
  </button>
{:else}
  <span class={className} title={formatDateTime(iso, DATETIME_LONG_OPTIONS)}
    >{text}</span>
{/if}
