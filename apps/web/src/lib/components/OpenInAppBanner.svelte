<script lang="ts">
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
  import { readStorage, writeStorage } from "#lib/local-storage.js";
  import { isNativeApp } from "#lib/native/app-shell.js";
  import { canOfferApp, openInAppUrl } from "#lib/native/open-in-app.js";
  import { m } from "#lib/paraglide/messages.js";
  import { slide } from "svelte/transition";
  import Icon from "./Icon.svelte";

  let dismissed = $state(
    browser ? readStorage(STORAGE_KEYS.openInAppDismissed) !== null : true,
  );

  function dismiss() {
    dismissed = true;
    writeStorage(STORAGE_KEYS.openInAppDismissed, "1");
  }

  const shown = $derived(
    browser &&
      !dismissed &&
      !isNativeApp() &&
      !matchMedia("(display-mode: standalone)").matches &&
      canOfferApp(page.url, navigator.userAgent),
  );
</script>

{#if shown}
  <div
    transition:slide={{ duration: 200 }}
    class="border-border bg-surface flex items-center gap-3 border-b px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm">
    <p class="min-w-0 flex-1">{m.open_in_app_prompt()}</p>
    <a class="btn btn-primary shrink-0" href={openInAppUrl(page.url)}>
      {m.open_in_app_action()}
    </a>
    <button
      type="button"
      class="btn btn-ghost shrink-0"
      aria-label={m.common_close()}
      onclick={dismiss}>
      <Icon name="x" class="h-4 w-4" />
    </button>
  </div>
{/if}
