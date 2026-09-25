<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { settingsSearch } from "../search-state.svelte";

  let { id }: { id: string } = $props();

  let inputEl = $state<HTMLInputElement | null>(null);

  // Named after the key it actually names on this machine, which is a
  // platform fact rather than a language one.
  const shortcutLabel = $derived(
    typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "⌘ K"
      : "Ctrl K",
  );

  // The field is rendered twice — in the rail and above the content on a
  // phone — and only one of them is ever on screen. `offsetParent` is null
  // for the hidden one, so the shortcut always reaches the visible field.
  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
    if (!inputEl?.offsetParent) return;
    event.preventDefault();
    inputEl.focus();
    inputEl.select();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && settingsSearch.active) {
      event.preventDefault();
      settingsSearch.clear();
      inputEl?.blur();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="relative">
  <label class="sr-only" for={id}>{m.settings_search_placeholder()}</label>
  <Icon
    name="search"
    class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
  <input
    bind:this={inputEl}
    bind:value={settingsSearch.query}
    {id}
    type="search"
    autocomplete="off"
    class="input py-2 pr-16 pl-9 text-sm"
    placeholder={m.settings_search_placeholder()}
    onkeydown={onKeydown} />
  <kbd
    class="border-border text-dim pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[0.65rem] whitespace-nowrap md:block">
    {shortcutLabel}
  </kbd>
</div>
