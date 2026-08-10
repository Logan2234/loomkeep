<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.svelte";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import { untrack } from "svelte";

  let { children } = $props();

  // Bounce visitors who are *already* signed in when they land on an auth
  // form — the mirror of the /app guard. The post-registration "check your
  // email" screen deliberately sits outside this group (see (verification)/):
  // the user *is* logged in there.
  //
  // Read `isLoggedIn` untracked, once bootstrap resolves, rather than reacting
  // to it: signing in from one of these very forms flips it, and a reactive
  // redirect would then race the page's own post-submit navigation — register
  // goes to the email-verification screen, not to /app. `allowed` latches for
  // the same reason, so the form stays mounted until its navigation lands
  // instead of blanking out mid-flight.
  let allowed = $state(false);

  $effect(() => {
    if (!bootstrap.ready) return;
    if (untrack(() => auth.isLoggedIn)) void goto("/app");
    else allowed = true;
  });
</script>

{#if allowed}
  {@render children()}
{/if}
