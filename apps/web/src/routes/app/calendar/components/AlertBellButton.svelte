<script lang="ts">
  // Mutes a show's release alerts from any of its calendar episodes — the
  // flag lives on the library entry, so it always covers the whole show.
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let {
    title,
    muted,
    disabled = false,
    onToggle,
  }: {
    title: string;
    muted: boolean;
    disabled?: boolean;
    onToggle: () => void;
  } = $props();

  const label = $derived(
    muted
      ? m.calendar_unmute_series({ title })
      : m.calendar_mute_series({ title }),
  );
</script>

<button
  type="button"
  class="btn-icon-bordered"
  {disabled}
  title={label}
  aria-label={label}
  onclick={onToggle}>
  <Icon name={muted ? "bell-off" : "bell"} class="h-4 w-4" />
</button>
