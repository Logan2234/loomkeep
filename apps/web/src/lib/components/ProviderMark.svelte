<script lang="ts">
  import { PROVIDER_BRANDS, type ProviderBrandKey } from "$lib/provider-brands";

  let {
    brand,
    class: className = "h-4 w-4",
  }: { brand: ProviderBrandKey; class?: string } = $props();

  const mark = $derived(PROVIDER_BRANDS[brand]);
</script>

<svg
  viewBox="0 0 24 24"
  class={className}
  fill={mark.color}
  role="img"
  aria-label={mark.name}><path d={mark.path} /></svg>
