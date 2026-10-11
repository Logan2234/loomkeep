<script lang="ts">
  let {
    targetId,
    canParticipate,
  }: { targetId: string; canParticipate: boolean } = $props();
</script>

<div data-testid="comments" data-can-participate={canParticipate}>
  {targetId}
</div>
