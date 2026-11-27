<script lang="ts">
  // Credited people or studios as a comma list, each linked to their page
  // when their source has one, with a peek on hover.
  import { creatorPeek } from "#lib/creator-peek/peek.svelte.js";
  import { creatorHref, studioHref } from "#lib/creator-href.js";
  import type { CreatorRefDto, StudioKind } from "@loomkeep/shared/contracts";
  import NewBadge from "./NewBadge.svelte";

  let {
    refs,
    studio,
    newBadge = false,
  }: {
    refs: CreatorRefDto[];
    /** Production companies or networks rather than people. */
    studio?: StudioKind;
    /** A "New" badge after the last name. */
    newBadge?: boolean;
  } = $props();

  const hrefOf = (ref: CreatorRefDto) =>
    studio ? studioHref(studio, ref) : creatorHref(ref);
</script>

{#each refs as ref, i (`${ref.source}:${ref.id}`)}
  {@const href = hrefOf(ref)}
  {@const comma = i < refs.length - 1 ? "," : ""}
  {#if href}
    <span>
      <a
        {href}
        use:creatorPeek={{ ref, studio }}
        class="decoration-dim/50 hover:text-accent underline underline-offset-4 transition-colors hover:decoration-current">
        {ref.name}
      </a>{comma}
    </span>
  {:else}
    <span>{ref.name}{comma}</span>
  {/if}
{/each}
{#if newBadge && refs.some((ref) => hrefOf(ref))}
  <NewBadge />
{/if}
