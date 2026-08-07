<script lang="ts">
  import { page } from "$app/state";
  import ProfileView from "$lib/components/profile/ProfileView.svelte";

  let username = $derived(page.params.username ?? "");
</script>

<ProfileView {username} publicView />
