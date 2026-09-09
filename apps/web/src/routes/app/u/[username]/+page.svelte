<script lang="ts">
  import { page } from "$app/state";
  import ProfileView from "$lib/components/profile/ProfileView.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let username = $derived(page.params.username ?? "");
</script>

<svelte:head>
  <title>@{username} · {m.common_loomkeep()}</title>
</svelte:head>

<ProfileView {username} publicView />
