<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { currentHomeGate } from "$lib/home/gate";
  import { HOME_WIDGET_ORDER, HOME_WIDGETS } from "$lib/home/widgets";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetType } from "@loomkeep/shared";
  import { fly } from "svelte/transition";

  let {
    placed,
    onpick,
    onclose,
  }: {
    /** Kinds already on the page — a kind that isn't repeatable is greyed out. */
    placed: ReadonlySet<HomeWidgetType>;
    onpick: (type: HomeWidgetType) => void;
    onclose: () => void;
  } = $props();

  const gate = $derived(currentHomeGate());
  const entries = $derived(
    HOME_WIDGET_ORDER.map((type) => HOME_WIDGETS[type]).filter((def) =>
      def.available(gate),
    ),
  );
  const reduced = prefersReducedMotion();
</script>

<Modal title={m.home_editor_catalog_title()} wide {onclose}>
  <ul class="grid gap-3 sm:grid-cols-2">
    {#each entries as def, i (def.type)}
      {@const taken = !def.repeatable && placed.has(def.type)}
      {@const disabled = taken || !!def.comingSoon}
      <li
        in:fly|global={{
          y: 8,
          duration: reduced ? 0 : 220,
          delay: reduced ? 0 : i * 25,
        }}>
        <button
          type="button"
          class="group border-border hover:border-accent hover:bg-surface-2 flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          {disabled}
          onclick={() => onpick(def.type)}>
          <span
            class="bg-accent/10 text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-110">
            <Icon name={def.icon} class="h-5 w-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="text-sm font-semibold">{def.title()}</span>
              {#if def.comingSoon}
                <span
                  class="bg-surface-2 text-dim rounded-full px-2 py-0.5 text-[0.6rem] font-bold">
                  {m.common_coming_soon()}
                </span>
              {:else if taken}
                <span class="text-dim text-[0.7rem]">
                  {m.home_editor_already_added()}
                </span>
              {/if}
            </span>
            <span class="text-dim mt-0.5 block text-xs">
              {def.description()}
            </span>
            <span class="timecode mt-1.5 block text-[0.65rem]">
              {def.min.w}×{def.min.h} – {def.max.w}×{def.max.h}
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
</Modal>
