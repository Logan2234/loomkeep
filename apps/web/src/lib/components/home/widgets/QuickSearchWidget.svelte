<script lang="ts">
  // The search page's bar in one row: "Tout" or a domain picked first, as
  // there, then Entrée opens the search on it with the words typed.
  import { goto } from "$app/navigation";
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domains.js";
  import type { BoxSize } from "#lib/home/sizing.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Domain } from "@loomkeep/shared";

  let { size }: { size: BoxSize } = $props();

  const choices = $derived(
    orderedDomains(auth.user?.domainOrder).filter(
      (d) => !DOMAINS[d].comingSoon && isDomainEnabled(d),
    ),
  );
  // Every domain at once, as the search page's first tab — only worth
  // offering with more than one.
  const ALL = "ALL";
  const hasAll = $derived(choices.length > 1);

  let picked = $state<Domain | typeof ALL | null>(null);
  // "Tout" (or the only domain) until they pick one — and again if the picked
  // one gets turned off.
  const domain = $derived(
    picked === ALL || (picked && choices.includes(picked))
      ? picked
      : hasAll
        ? ALL
        : choices[0],
  );
  let query = $state("");

  // Names beside the icons once there's room for them all; below that, the
  // magnifier gives its room to the words typed.
  const labelled = $derived(
    size.width >= 200 + (choices.length + Number(hasAll)) * 96,
  );
  const narrow = $derived(size.width < 320);
  const placeholder = $derived(
    domain === ALL
      ? m.search_placeholder_all()
      : domain
        ? m.search_placeholder({ domain: DOMAINS[domain].searchHint })
        : "",
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!domain) return;
    const params = new URLSearchParams(domain === ALL ? {} : { type: domain });
    if (query.trim()) params.set("query", query.trim());
    void goto(`/app/search?${params}`);
  }
</script>

{#if domain}
  <form
    role="search"
    class="bar card"
    style={`--domain-accent: ${domain === ALL ? "var(--accent)" : DOMAINS[domain].accent}`}
    onsubmit={submit}>
    {#if hasAll}
      <div
        class="domains"
        role="group"
        aria-label={m.home_quick_search_domains()}>
        <button
          type="button"
          class="domain"
          class:active={domain === ALL}
          aria-pressed={domain === ALL}
          aria-label={labelled ? undefined : m.search_tab_all()}
          title={m.search_tab_all()}
          onclick={() => (picked = ALL)}>
          <Icon name="search" class="h-3.5 w-3.5 shrink-0" />
          {#if labelled}
            <span>{m.search_tab_all()}</span>
          {/if}
        </button>
        {#each choices as choice (choice)}
          <button
            type="button"
            class="domain"
            class:active={choice === domain}
            aria-pressed={choice === domain}
            aria-label={labelled ? undefined : DOMAINS[choice].label}
            title={DOMAINS[choice].label}
            onclick={() => (picked = choice)}>
            <Icon name={DOMAINS[choice].icon} class="h-3.5 w-3.5 shrink-0" />
            {#if labelled}
              <span>{DOMAINS[choice].label}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
    {#if !narrow}
      <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
    {/if}
    <input
      type="search"
      name="query"
      enterkeyhint="search"
      aria-label={placeholder}
      {placeholder}
      bind:value={query}
      class="input-bare" />
  </form>
{/if}

<style>
  /* Le Guichet (the search page's bar), folded into one row: the domain's
     hue runs along the top edge and follows the pick. */
  .bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 100%;
    padding: 0 0.75rem 0 0.25rem;
    border-top: 2px solid var(--domain-accent);
    transition:
      border-color 0.2s ease,
      border-top-color 0.25s ease,
      box-shadow 0.2s ease;
  }

  .bar:has(.input-bare:focus) {
    border-color: var(--domain-accent);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--domain-accent) 16%, transparent);
  }

  .domains {
    display: flex;
    flex: none;
    gap: 0.125rem;
    border-radius: 999px;
    background: var(--surface-2);
    padding: 0.125rem;
  }

  .domain {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border-radius: 999px;
    padding: 0.25rem 0.5rem;
    color: var(--dim);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    transition:
      color 0.15s ease,
      background-color 0.2s ease;
  }

  .domain:hover {
    color: var(--fg);
  }

  .domain.active {
    background: color-mix(in srgb, var(--domain-accent) 18%, var(--surface));
    color: var(--domain-accent);
  }

  .input-bare {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.9rem;
    color: var(--fg);
  }

  .input-bare::placeholder {
    color: var(--dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .bar,
    .domain {
      transition: none;
    }
  }
</style>
