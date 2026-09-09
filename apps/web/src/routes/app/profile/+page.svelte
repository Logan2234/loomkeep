<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import ProfileView from "$lib/components/profile/ProfileView.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.nav_profile()} · {m.common_loomkeep()}</title>
</svelte:head>

{#if auth.user}
  <ProfileView username={auth.user.username} />
{/if}
