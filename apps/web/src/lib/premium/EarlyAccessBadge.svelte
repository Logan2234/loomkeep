<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  // Not `BetaBadge`: that one marks the whole instance, this one a single
  // domain that is usable but not finished.
  let { class: cls = "" }: { class?: string } = $props();
</script>

<span
  class="border-accent/50 text-accent rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold whitespace-nowrap uppercase {cls}">
  {m.common_early_access()}
</span>
