<script lang="ts">
  // The friend search of Messages. The input itself carries the field's
  // frame, as SettingsSearchField does, so keyboard focus rings the field.
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let {
    value = $bindable(""),
    height = "h-9",
    oninput,
  }: {
    value?: string;
    /** The field's height class: the sheet's is taller, for touch. */
    height?: string;
    oninput?: () => void;
  } = $props();
</script>

<div class="relative">
  <Icon
    name="search"
    class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
  <input
    bind:value
    {oninput}
    aria-label={m.chat_search_friends()}
    placeholder={m.chat_search_friends()}
    class="input focus:border-accent py-0 pl-9 text-sm transition-colors duration-150 {height}" />
</div>
