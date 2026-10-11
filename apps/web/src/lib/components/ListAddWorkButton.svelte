<script lang="ts">
  import Drawer from "#lib/components/Drawer.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import ListAddWork from "#lib/components/ListAddWork.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { scale } from "svelte/transition";

  // "Ajouter" on a list: the search opens under the button on a desktop, as
  // a bottom sheet on a phone. Not a Dropdown — that one sizes itself once,
  // on opening, and the results only come afterwards.
  let {
    listId,
    title,
    inList,
  }: {
    listId: string;
    title: string;
    inList: Set<string>;
  } = $props();

  const reduced = prefersReducedMotion();
  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);

  function close() {
    open = false;
    trigger?.focus();
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (open && !layout.compact && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="relative">
  <button
    bind:this={trigger}
    type="button"
    class="btn btn-primary"
    aria-expanded={open}
    aria-haspopup="dialog"
    onclick={() => (open = !open)}>
    <Icon name="plus" class="h-4 w-4" />
    {m.list_add_work()}
  </button>

  {#if open && !layout.compact}
    <button
      type="button"
      tabindex="-1"
      class="fixed inset-0 z-30 cursor-default"
      aria-label={m.common_close()}
      onclick={close}></button>
    <div
      role="dialog"
      aria-label={m.list_add_work_title({ title })}
      data-escape-consumer
      transition:scale={{ duration: reduced ? 0 : 120, start: 0.95 }}
      style="transform-origin: top right;"
      class="border-border bg-surface absolute top-full right-0 z-40 mt-2 flex max-h-[min(32rem,70vh)] w-[26rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border p-1.5 shadow-xl">
      <ListAddWork {listId} {inList} />
    </div>
  {/if}
</div>

{#if open && layout.compact}
  <Drawer onclose={() => (open = false)} labelledby="list-add-title">
    <div class="flex max-h-[80vh] min-h-0 flex-col px-3 pb-3">
      <h2 id="list-add-title" class="font-display px-1 pb-2 text-lg font-bold">
        {m.list_add_work_title({ title })}
      </h2>
      <ListAddWork {listId} {inList} />
    </div>
  </Drawer>
{/if}
