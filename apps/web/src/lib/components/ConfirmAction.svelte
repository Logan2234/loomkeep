<script lang="ts">
  // Wraps a button's label so a completed action *says so* for a moment,
  // instead of the button simply becoming enabled again. Between the click
  // and the refreshed data there is otherwise nothing to look at, which is
  // what makes an action feel like it might not have registered.
  //
  // Takes the label as a snippet rather than a string: callers already build
  // theirs from several message calls and a count.
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";
  import Icon from "./Icon.svelte";

  let {
    done,
    children,
  }: {
    /** Flips to true the moment the action succeeds. */
    done: boolean;
    children: Snippet;
  } = $props();

  const CONFIRM_MS = 1100;
  const reduced = prefersReducedMotion();

  let confirming = $state(false);
  let previous = false;
  $effect(() => {
    const current = done;
    const justFinished = !previous && current;
    previous = current;
    if (!justFinished) return;

    confirming = true;
    const timer = setTimeout(() => (confirming = false), CONFIRM_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if confirming}
  <span
    class="inline-flex items-center gap-1.5"
    in:scale={{ duration: reduced ? 0 : 180, start: 0.7 }}>
    <Icon name="check" class="h-4 w-4" />
    {@render children()}
  </span>
{:else}
  {@render children()}
{/if}
