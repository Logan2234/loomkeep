<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let { children } = $props();

  // Single guard for the whole /admin subtree: the rail hides the entry for
  // non-admins and the API 403s regardless, but a direct navigation must bounce
  // too. Wait for the profile so we don't redirect before auth is known.
  $effect(() => {
    if (auth.user && !auth.isAdmin) void goto("/");
  });
</script>

{#if auth.isAdmin}
  {@render children()}

  <a
    href="/admin"
    class="border-accent/40 bg-accent/15 text-accent fixed right-4 bottom-20 z-30 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur md:bottom-4">
    <Icon name="shield" class="h-3.5 w-3.5" />
    {m.nav_admin()}
  </a>
{/if}
