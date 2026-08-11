<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain } from "@loomkeep/shared";

  let domainsError = $state("");

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const current = auth.user.enabledDomains;
    const has = current.includes(id);
    if (has && current.length === 1) return; // keep at least one domain visible
    // Rebuild in canonical order so the stored list stays tidy.
    const next = Object.keys(DOMAINS).filter((d) =>
      d === id ? !has : current.includes(d as Domain),
    ) as Domain[];
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
        <button
          type="button"
          class="border-border relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:pointer-events-none disabled:opacity-50 {on
            ? 'border-accent bg-accent/10 text-fg'
            : 'text-dim hover:bg-surface-2'}"
          disabled={isLast}
          title={isLast ? "Au moins un domaine doit rester actif." : undefined}
          onclick={() => toggleDomain(id as Domain)}>
          {#if d.comingSoon}
            <span
              class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
              {m.common_coming_soon()}
            </span>
          {/if}
          <Icon name={d.icon} class="h-5 w-5 {on ? 'text-accent' : ''}" />
          <span class="text-xs font-semibold">{d.label}</span>
        </button>
      {/each}
    </div>
    {#if domainsError}
      <p class="text-danger mt-2 text-sm">{domainsError}</p>
    {/if}
  </section>
{/if}
