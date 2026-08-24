<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { toggleDomainSelection } from "$lib/domains";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain, PREMIUM_DOMAINS } from "@loomkeep/shared";

  let domainsError = $state("");
  const premiumLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const next = toggleDomainSelection(auth.user.enabledDomains, id);
    if (next === auth.user.enabledDomains) return; // last domain, refused
    domainsError = "";
    try {
      await updateMe({ enabledDomains: next });
    } catch (err) {
      domainsError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">Domaines</h2>
    <p class="text-dim mb-4 text-sm">
      Choisis les univers présents dans ton app. Ce que tu masques disparaît de
      la navigation.
    </p>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {#each Object.entries(DOMAINS) as [id, d] (id)}
        {@const on = auth.user.enabledDomains.includes(id as Domain)}
        {@const isLast = on && auth.user.enabledDomains.length === 1}
        {@const inMaintenance = liveFlags.isEnabled(`MAINTENANCE_${id}`)}
        {@const showLock =
          !on &&
          !inMaintenance &&
          premiumLocked &&
          PREMIUM_DOMAINS.includes(id as Domain)}
        {#snippet domainButton()}
          <button
            type="button"
            class="border-border relative flex w-full flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:pointer-events-none disabled:opacity-50 {on
              ? 'border-accent bg-accent/10 text-fg'
              : 'text-dim hover:bg-surface-2'}"
            disabled={isLast || inMaintenance || showLock}
            title={inMaintenance
              ? "Temporairement indisponible."
              : isLast
                ? "Au moins un domaine doit rester actif."
                : undefined}
            onclick={() => toggleDomain(id as Domain)}>
            {#if inMaintenance}
              <span
                class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 rounded-full p-1">
                <Icon name="lock" class="h-3 w-3" />
              </span>
            {:else if d.comingSoon && !showLock}
              <span
                class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
                {m.common_coming_soon()}
              </span>
            {/if}
            <Icon name={d.icon} class="h-5 w-5 {on ? 'text-accent' : ''}" />
            <span class="text-xs font-semibold">{d.label}</span>
          </button>
        {/snippet}
        {#if showLock}
          <Tooltip text={m.common_premium_locked()}>
            {@render domainButton()}
            <PremiumLockBadge />
          </Tooltip>
        {:else}
          {@render domainButton()}
        {/if}
      {/each}
    </div>
    {#if domainsError}
      <p class="text-danger mt-2 text-sm">{domainsError}</p>
    {/if}
  </section>
{/if}
