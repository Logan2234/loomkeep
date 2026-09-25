<script lang="ts">
  // Which domains a widget shows, among those the user has turned on.
  // Nothing picked means all of them, so a domain turned on later shows up
  // without editing the widget.
  import Icon from "$lib/components/Icon.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { auth } from "$lib/auth.svelte";
  import { isDomainEnabled, orderedDomains } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain } from "@loomkeep/shared";

  let { domains = $bindable() }: { domains: Domain[] } = $props();

  const choices = $derived(
    orderedDomains(auth.user?.domainOrder).filter(
      (d) => !DOMAINS[d].comingSoon && isDomainEnabled(d),
    ),
  );
  const all = $derived(domains.length === 0);

  function toggle(domain: Domain) {
    domains = domains.includes(domain)
      ? domains.filter((d) => d !== domain)
      : [...domains, domain];
  }
</script>

<fieldset>
  <legend class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
    {m.home_domains_config_legend()}
  </legend>
  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class="chip inline-flex items-center gap-1.5 {all
        ? 'border-accent text-accent'
        : ''}"
      aria-pressed={all}
      onclick={() => (domains = [])}>
      {m.common_all()}
    </button>
    {#each choices as domain (domain)}
      {@const on = domains.includes(domain)}
      <button
        type="button"
        class="chip inline-flex items-center gap-1.5 {on
          ? 'border-accent text-accent'
          : ''}"
        aria-pressed={on}
        onclick={() => toggle(domain)}>
        <Icon name={DOMAINS[domain].icon} class="h-3.5 w-3.5" />
        {DOMAINS[domain].label}
      </button>
    {/each}
  </div>
</fieldset>
