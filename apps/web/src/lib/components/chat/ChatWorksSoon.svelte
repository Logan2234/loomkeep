<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<div
  class="text-dim flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
  <Icon name="tv" class="h-8 w-8" />
  <p class="font-display text-fg text-lg font-extrabold text-balance">
    {m.chat_works_title()}
  </p>
  <p class="max-w-[32ch] text-sm leading-relaxed">{m.chat_works_soon()}</p>
  <span
    class="border-accent text-accent rounded border px-1.5 font-mono text-[0.62rem] font-bold tracking-wider uppercase">
    {m.common_coming_soon()}
  </span>
</div>
