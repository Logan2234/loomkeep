<script lang="ts">
  // The widget catalog, sorted by what each widget is for — what you're in
  // the middle of, what's coming, your collections, then what arranges the
  // page — so composing a home page reads top to bottom.
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { currentHomeGate } from "$lib/home/gate";
  import { HOME_WIDGET_GROUPS, HOME_WIDGETS } from "$lib/home/widgets";
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
  const groups = $derived(
    HOME_WIDGET_GROUPS.map((group) => ({
      ...group,
      widgets: group.types
        .map((type) => HOME_WIDGETS[type])
        .filter((def) => def.available(gate)),
    })).filter((group) => group.widgets.length > 0),
  );

  const reduced = prefersReducedMotion();
</script>

<Modal title={m.home_editor_catalog_title()} wide {onclose}>
  <p class="text-dim -mt-2 mb-5 text-sm">{m.home_catalog_intro()}</p>

  <div class="space-y-6">
    {#each groups as group, g (group.id)}
      <section
        in:fly|global={{
          y: 8,
          duration: reduced ? 0 : 220,
          delay: reduced ? 0 : g * 60,
        }}>
        <div class="border-border mb-3 border-b pb-2">
          <h4 class="font-display text-sm font-bold">{group.title()}</h4>
          <p class="text-dim text-xs">{group.description()}</p>
        </div>
        <ul class="grid gap-2 sm:grid-cols-2">
          {#each group.widgets as def (def.type)}
            {@const taken = !def.repeatable && placed.has(def.type)}
            <li>
              <button
                type="button"
                class="group hover:border-accent hover:bg-surface-2 border-border flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                disabled={taken || !!def.comingSoon}
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
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</Modal>
