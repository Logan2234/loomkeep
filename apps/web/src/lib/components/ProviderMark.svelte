<script lang="ts">
  import { PROVIDER_BRANDS, type ProviderBrandKey } from "$lib/provider-brands";

  let {
    brand,
    class: className = "h-4 w-4",
  }: { brand: ProviderBrandKey; class?: string } = $props();

  const mark = $derived(PROVIDER_BRANDS[brand]);
</script>

{#if "path" in mark}
  <svg
    viewBox="0 0 24 24"
    class={className}
    fill={mark.color}
    role="img"
    aria-label={mark.name}><path d={mark.path} /></svg>
{:else}
  <span
    class="inline-grid place-items-center rounded-[0.2em] text-[0.52em] leading-none font-black tracking-[-0.08em] text-white {className}"
    style:background-color={mark.color}
    role="img"
    aria-label={mark.name}>{mark.monogram}</span>
{/if}
