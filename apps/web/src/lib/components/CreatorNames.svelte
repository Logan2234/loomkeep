<script lang="ts">
  // Credited people as a comma list, each linked to their page when their
  // source has one, with a peek on hover.
  import { creatorPeek } from "#lib/creator-peek/peek.svelte.js";
  import { creatorHref } from "#lib/creator-href.js";
  import type { CreatorRefDto } from "@loomkeep/shared";
  import NewBadge from "./NewBadge.svelte";

  let {
    refs,
    newBadge = false,
  }: {
    refs: CreatorRefDto[];
    /** A "New" badge after the last name. */
    newBadge?: boolean;
  } = $props();
</script>

{#each refs as ref, i (`${ref.source}:${ref.id}`)}
  {@const href = creatorHref(ref)}
  {@const comma = i < refs.length - 1 ? "," : ""}
  {#if href}
    <span>
      <a
        {href}
        use:creatorPeek={{ ref }}
        class="decoration-dim/50 hover:text-accent underline underline-offset-4 transition-colors hover:decoration-current"
        >{ref.name}</a
      >{comma}
    </span>
  {:else}
    <span>{ref.name}{comma}</span>
  {/if}
{/each}
{#if newBadge && refs.some((ref) => creatorHref(ref))}
  <NewBadge />
{/if}
