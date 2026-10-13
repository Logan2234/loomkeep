<script lang="ts">
  import { getReauthStatus } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { reauth } from "#lib/reauth.svelte.js";
  import { fade } from "svelte/transition";

  const reduced = prefersReducedMotion();

  const statusQuery = createApiQuery(() => ({
    key: keys.mfa.reauth(),
    fetch: getReauthStatus,
  }));

  // Signing in counts as a confirmation too, which only the server knows of.
  const until = $derived(
    Math.max(
      reauth.confirmedUntil,
      statusQuery.data?.confirmedUntil
        ? Date.parse(statusQuery.data.confirmedUntil)
        : 0,
    ),
  );

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const left = $derived(Math.max(0, Math.ceil((until - now) / 1000)));
  const timecode = $derived(
    `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`,
  );
</script>

{#if left > 0}
  <p
    class="border-success text-success inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-bold"
    title={m.settings_reauth_confirmed_hint()}
    transition:fade={{ duration: reduced ? 0 : 200 }}>
    <Icon name="shield" class="h-3.5 w-3.5" />
    {m.settings_reauth_confirmed()}
    <span class="font-mono font-normal tabular-nums">{timecode}</span>
  </p>
{/if}
