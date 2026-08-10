<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import ProfileView from "$lib/components/profile/ProfileView.svelte";
</script>

{#if auth.user}
  <ProfileView username={auth.user.username} />
{/if}
