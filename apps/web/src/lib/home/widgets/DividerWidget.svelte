<script lang="ts">
  // A letterbox hairline (DESIGN.md), fading out at both ends, centred in its
  // one-cell-thick slot.
  let { vertical = false }: { vertical?: boolean } = $props();
</script>

<div
  class="flex h-full w-full items-center justify-center"
  role="separator"
  aria-orientation={vertical ? "vertical" : "horizontal"}>
  <div
    class="hairline {vertical ? 'h-full w-px' : 'h-px w-full'}"
    class:vertical>
  </div>
</div>

<style>
  .hairline {
    background: linear-gradient(
      to right,
      transparent,
      var(--border) 12%,
      var(--border) 88%,
      transparent
    );
  }
  .hairline.vertical {
    background: linear-gradient(
      to bottom,
      transparent,
      var(--border) 12%,
      var(--border) 88%,
      transparent
    );
  }
</style>
