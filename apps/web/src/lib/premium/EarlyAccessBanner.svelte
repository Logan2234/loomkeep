<script lang="ts">
  import { browser } from "$app/env";
  import { readStorage, writeStorage } from "#lib/ui/local-storage.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import Banner from "../ui/Banner.svelte";
  import EarlyAccessBadge from "./EarlyAccessBadge.svelte";
  import Icon from "../ui/Icon.svelte";

  // A domain's "early access" notice: says once that it can be slow and
  // incomplete, then stays out of the way once closed (per device).
  let {
    storageKey,
    class: cls = "",
    children,
  }: { storageKey: string; class?: string; children: Snippet } = $props();

  // Hidden until the browser has been asked, so a closed banner never
  // flashes back in on load. The key is fixed for a banner's lifetime.
  // svelte-ignore state_referenced_locally
  let dismissed = $state(browser ? readStorage(storageKey) !== null : true);

  function dismiss() {
    dismissed = true;
    writeStorage(storageKey, "1");
  }
</script>

{#if !dismissed}
  <Banner variant="neutral" class={cls}>
    <div class="flex items-start gap-3">
      <EarlyAccessBadge class="mt-0.5 shrink-0" />
      <p class="min-w-0 flex-1">{@render children()}</p>
      <button
        type="button"
        class="btn btn-ghost -my-1.5 -mr-2 shrink-0"
        aria-label={m.common_close()}
        onclick={dismiss}>
        <Icon name="x" class="h-4 w-4" />
      </button>
    </div>
  </Banner>
{/if}
