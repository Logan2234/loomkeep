<script lang="ts">
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  let { widget }: { widget: HomeWidgetDto } = $props();

  const def = HOME_WIDGETS.note;
  const text = $derived(widget.config?.text?.trim() ?? "");
</script>

<WidgetShell icon={def.icon} title={def.title()}>
  {#if text}
    <p
      class="no-scrollbar h-full overflow-y-auto text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
      {text}
    </p>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_note_empty()}
    </p>
  {/if}
</WidgetShell>
