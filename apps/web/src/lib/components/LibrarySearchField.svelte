<script lang="ts">
  // A library's filter-by-title field, the same in its works and sagas
  // views: beside the view switch on a wide screen, under the header on a
  // phone (where the "/" shortcut has no keyboard to come from).
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  let {
    value,
    oninput,
    input = $bindable(null),
  }: {
    value: string;
    oninput: (value: string) => void;
    /** The field itself, for "/" and the phone's magnifier to focus. */
    input?: HTMLInputElement | null;
  } = $props();
</script>

<div class="relative min-w-0 flex-1 md:w-72 md:flex-none">
  <span
    class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
    <Icon name="search" class="h-4.5 w-4.5" />
  </span>
  <input
    bind:this={input}
    type="search"
    name="query"
    aria-label={m.library_filter_placeholder()}
    enterkeyhint="search"
    placeholder={m.library_filter_placeholder()}
    {value}
    oninput={(e) => oninput(e.currentTarget.value)}
    class="input pl-10 {layout.compact ? '' : 'pr-9'}" />
  {#if !layout.compact && !value}
    <kbd
      class="border-border text-dim pointer-events-none absolute inset-y-0 right-3 my-auto h-fit rounded border px-1.5 font-mono text-[0.68rem]"
      aria-hidden="true">/</kbd>
  {/if}
</div>
