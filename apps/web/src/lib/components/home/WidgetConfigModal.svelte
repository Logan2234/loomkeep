<script lang="ts">
  // A widget's own settings, beyond its size and place. Edits a copy: the
  // layout only changes on "Appliquer", and the page itself only once the
  // editor saves.
  import Modal from "$lib/components/Modal.svelte";
  import { DEFAULT_QUICK_LINKS } from "$lib/home/quick-links";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetConfigDto, HomeWidgetDto } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import ListContentConfig from "./config/ListContentConfig.svelte";
  import QuickLinksConfig from "./config/QuickLinksConfig.svelte";

  let {
    widget,
    onapply,
    onclose,
  }: {
    widget: HomeWidgetDto;
    onapply: (config: HomeWidgetConfigDto) => void;
    onclose: () => void;
  } = $props();

  const def = $derived(HOME_WIDGETS[widget.type]);
  let links = $state(
    untrack(() => widget.config?.links ?? DEFAULT_QUICK_LINKS),
  );
  let listId = $state(untrack(() => widget.config?.listId));

  function apply() {
    onapply(widget.type === "quickLinks" ? { links } : { listId });
    onclose();
  }
</script>

<Modal
  title={m.home_editor_configure_title({ name: def.title() })}
  wide
  {onclose}>
  {#if widget.type === "quickLinks"}
    <QuickLinksConfig bind:links />
  {:else if widget.type === "listContent"}
    <ListContentConfig bind:listId />
  {/if}
  {#snippet actions()}
    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" onclick={onclose}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={widget.type === "listContent" && !listId}
        onclick={apply}>
        {m.common_apply()}
      </button>
    </div>
  {/snippet}
</Modal>
