<script lang="ts">
  import { appConfig } from "#lib/config.svelte.js";
  import ReviewsSection from "./ReviewsSection.svelte";
  import CommentsPanel from "./CommentsPanel.svelte";
  let {
    targetType,
    reviewTargetId,
    commentTargetId,
    title,
    meta,
    imageUrl,
    canParticipate,
  }: {
    targetType: "GAME" | "BOOK" | "MUSIC";
    reviewTargetId: string | null;
    commentTargetId: string | null;
    title: string;
    meta: string;
    imageUrl: string | null;
    canParticipate: boolean;
  } = $props();
</script>

{#snippet comments()}
  {#if appConfig.socialEnabled && commentTargetId}
    <CommentsPanel
      {targetType}
      targetId={commentTargetId}
      {title}
      {canParticipate} />
  {/if}
{/snippet}

{#if reviewTargetId}
  <ReviewsSection
    {targetType}
    targetId={reviewTargetId}
    workTitle={title}
    workMeta={meta}
    workImageUrl={imageUrl}>
    {#snippet actions()}
      {@render comments()}
    {/snippet}
  </ReviewsSection>
{:else}
  {@render comments()}
{/if}
