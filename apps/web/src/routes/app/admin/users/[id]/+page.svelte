<script lang="ts">
  import { page } from "$app/state";
  import { getAdminUser } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { fade } from "svelte/transition";
  import AdminQueryError from "../../AdminQueryError.svelte";
  import UserAccount from "../components/UserAccount.svelte";

  const reduced = prefersReducedMotion();
  const userId = $derived(page.params.id ?? "");

  const userQuery = createApiQuery(() => ({
    key: keys.admin.user(userId),
    fetch: () => getAdminUser(userId),
    enabled: auth.isAdmin && !!userId,
  }));
</script>

{#if userQuery.error}
  <AdminQueryError
    message={userQuery.error}
    queryKey={keys.admin.user(userId)} />
{:else if userQuery.data}
  <div in:fade={{ duration: reduced ? 0 : 180 }}>
    <UserAccount detail={userQuery.data} />
  </div>
{:else}
  <div class="space-y-4" aria-busy="true">
    <div class="skeleton h-20 rounded-xl"></div>
    <div class="skeleton h-16 rounded-xl"></div>
    <div class="skeleton h-64 rounded-xl"></div>
  </div>
{/if}
