<script lang="ts">
  import Banner from "$lib/components/Banner.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let {
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  } = $props();
</script>

<Banner variant="error">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{message}</span>
    <button type="button" class="btn btn-ghost btn-sm" onclick={onRetry}>
      {m.common_retry()}
    </button>
  </div>
</Banner>
