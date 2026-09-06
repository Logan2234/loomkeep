<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "$lib/paraglide/messages.js";
  import LegalLinks from "./LegalLinks.svelte";

  let { tagline, children }: { tagline?: Snippet; children: Snippet } =
    $props();
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
        </p>
        {#if tagline}
          <p class="text-dim mt-2 text-sm">{@render tagline()}</p>
        {/if}
      </div>

      {@render children()}
    </div>
  </div>
  <LegalLinks />
</div>
