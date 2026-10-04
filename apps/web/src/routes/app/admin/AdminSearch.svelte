<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import Icon from "$lib/components/Icon.svelte";
  import { searchAdminSections } from "$lib/admin-search";
  import { m } from "$lib/paraglide/messages";
  import type { Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
  let query = $state("");
  afterNavigate(() => (query = ""));
  let input = $state<HTMLInputElement>();
  const groups = $derived(searchAdminSections(query));
  const shortcut =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘ K"
      : "Ctrl K";
  function shortcutKey(event: KeyboardEvent) {
    if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      input?.focus();
      input?.select();
    }
  }
</script>

<svelte:window onkeydown={shortcutKey} />
<div class="relative mb-6 max-w-xl">
  <label for="admin-search" class="sr-only"
    >{m.admin_search_placeholder()}</label>
  <Icon
    name="search"
    class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
  <input
    id="admin-search"
    type="search"
    autocomplete="off"
    bind:this={input}
    bind:value={query}
    class="input py-2 pr-20 pl-9 text-sm"
    placeholder={m.admin_search_placeholder()}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        query = "";
        input?.blur();
      }
    }} />
  <kbd
    class="text-dim absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 text-xs md:block"
    >{shortcut}</kbd>
</div>
{#if query.trim()}
  <section aria-label={m.common_results()} aria-live="polite" class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="font-display text-xl font-bold">{m.common_results()}</h1>
      <button
        class="btn btn-ghost btn-sm"
        onclick={() => {
          query = "";
          input?.focus();
        }}>{m.common_clear()}</button>
    </div>
    {#each groups as group (group.label)}
      <section>
        <h2 class="text-dim mb-2 text-sm font-semibold">{group.label}</h2>
        <div class="card divide-border divide-y">
          {#each group.items as item (item.href)}
            <a
              href={item.href}
              onclick={() => (query = "")}
              class="hover:bg-surface-2 flex items-center gap-3 p-4"
              ><Icon
                name={item.icon}
                class="text-accent h-5 w-5 shrink-0" /><span
                ><span class="block font-semibold">{item.label}</span><span
                  class="text-dim text-sm">{item.description}</span
                ></span
              ></a>
          {/each}
        </div>
      </section>
    {:else}<p class="text-dim py-8">{m.admin_search_empty({ query })}</p>{/each}
  </section>
{/if}
<div hidden={!!query.trim()}>{@render children()}</div>
