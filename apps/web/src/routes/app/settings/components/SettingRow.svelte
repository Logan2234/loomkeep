<script lang="ts">
  // The recurring shape of a setting: label, one line of explanation, a
  // control on the right, and — right here rather than at the foot of the
  // card — whatever went wrong. Nine sections used to hand-roll this with
  // their own `flex items-start justify-between gap-4`, which is how the
  // description sizes and the error placement drifted apart.
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import type { IconName } from "$lib/types/icon-name";
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { flashAnchor } from "../flash-anchor";
  import SavedIndicator from "./SavedIndicator.svelte";

  /** Just enough of createApiMutation()'s surface to drive a row. */
  interface RowMutation {
    loading: boolean;
    data: unknown;
    error: string | null;
  }

  let {
    label,
    description,
    icon,
    mutation,
    error,
    saving = false,
    anchor,
    controlId,
    control,
    children,
  }: {
    label: string;
    description?: string;
    icon?: IconName;
    /**
     * The mutation this row's control drives. Wiring it is what makes the
     * saving/saved pill and the error line appear — pass it and the row needs
     * nothing else.
     */
    mutation?: RowMutation;
    /** A local validation message, shown the same way as a server one. */
    error?: string | null;
    /** For rows whose save doesn't go through a single mutation. */
    saving?: boolean;
    /**
     * The row's id in the settings search index (see nav.ts). A result that
     * matched this control links straight to it, and the row flashes once on
     * arrival so it is obvious which one was meant.
     */
    anchor?: string;
    /**
     * The id of the control this row labels. Set it for a row built around an
     * input: the label then really labels it, and the description is wired up
     * as `{controlId}-description` for the control's `aria-describedby`.
     */
    controlId?: string;
    control?: Snippet;
    /** Extra content under the label, full width (a list, a preview). */
    children?: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();

  const rowError = $derived(error ?? mutation?.error ?? null);

  // `mutation.data` stays set after a success, so the pill is driven by the
  // transition to a new value rather than by its presence.
  const SAVED_FLASH_MS = 2500;
  let saved = $state(false);
  let lastData: unknown = undefined;
  let primed = false;

  $effect(() => {
    const data = mutation?.data ?? null;
    if (!primed) {
      primed = true;
      lastData = data;
      return;
    }
    if (data === lastData) return;
    lastData = data;
    if (data === null) return; // a reset(), not a success

    saved = true;
    const timer = setTimeout(() => (saved = false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  });

  const saveState = $derived<"idle" | "saving" | "saved">(
    saving || mutation?.loading
      ? "saving"
      : saved && !rowError
        ? "saved"
        : "idle",
  );
</script>

<div
  id={anchor}
  use:flashAnchor={{ anchor: anchor ?? "", hash: page.url.hash }}
  class="py-4 first:pt-0 last:pb-0">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      {#if icon}
        <Icon name={icon} class="text-dim mt-0.5 h-5 w-5 shrink-0" />
      {/if}
      <div class="min-w-0">
        {#if controlId}
          <label class="block font-semibold" for={controlId}>{label}</label>
        {:else}
          <p class="font-semibold">{label}</p>
        {/if}
        {#if description}
          <p
            class="text-dim text-sm"
            id={controlId ? `${controlId}-description` : undefined}>
            {description}
          </p>
        {/if}
      </div>
    </div>
    {#if control}
      <div class="flex shrink-0 flex-col items-end gap-2.5">
        {@render control()}
        <SavedIndicator state={saveState} />
      </div>
    {/if}
  </div>

  {#if children}
    <div class="mt-3">{@render children()}</div>
  {/if}

  {#if rowError}
    <p
      class="text-danger mt-2 text-sm"
      transition:fly={{ y: reduced ? 0 : -4, duration: reduced ? 0 : 160 }}>
      {rowError}
    </p>
  {/if}
</div>
