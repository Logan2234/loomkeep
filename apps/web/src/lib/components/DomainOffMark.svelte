<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { domainOffReason } from "#lib/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Domain } from "@loomkeep/shared";

  // The warning shown in place of a link to a work whose domain the viewer
  // can't open (see `isDomainEnabled`): chat cards, lists, reviews.
  let { domain, class: className = "" }: { domain: Domain; class?: string } =
    $props();

  // A maintenance isn't the viewer's to undo: don't send them to Settings.
  const label = $derived(
    domainOffReason(domain) === "maintenance"
      ? m.common_work_domain_maintenance({ domain: DOMAINS[domain].label })
      : m.common_work_domain_off({ domain: DOMAINS[domain].label }),
  );
</script>

<Tooltip text={label} class={className}>
  <span
    class="text-warning grid h-7 w-7 place-items-center"
    role="img"
    aria-label={label}>
    <Icon name="warning" class="h-4 w-4" />
  </span>
</Tooltip>
