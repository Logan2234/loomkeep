<script lang="ts">
  // Which domains a widget shows, among those the user has turned on.
  // Nothing picked means all of them, so a domain turned on later shows up
  // without editing the widget.
  import Combobox from "$lib/components/Combobox.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { auth } from "$lib/auth.svelte";
  import { isDomainEnabled, orderedDomains } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import type { Domain } from "@loomkeep/shared";

  let { domains = $bindable() }: { domains: Domain[] } = $props();

  const choices = $derived(
    orderedDomains(auth.user?.domainOrder)
      .filter((d) => !DOMAINS[d].comingSoon && isDomainEnabled(d))
      .map((d) => ({ value: d, label: DOMAINS[d].label })),
  );
</script>

<Combobox
  label={m.home_domains_config_legend()}
  multiselect
  options={choices}
  values={domains}
  onChange={(values) => (domains = values as Domain[])} />
