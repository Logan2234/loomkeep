<script lang="ts">
  import { PROVIDER_BRANDS, type ProviderBrandKey } from "$lib/provider-brands";

  let {
    brand,
    decorative = false,
    class: className = "h-4 w-4",
  }: {
    brand: ProviderBrandKey;
    /** Hide the mark when adjacent text already identifies the provider. */
    decorative?: boolean;
    class?: string;
  } = $props();

  const mark = $derived(PROVIDER_BRANDS[brand]);
</script>

{#if "path" in mark}
  <svg
    viewBox="0 0 24 24"
    class={className}
    fill={mark.color}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : mark.name}
    aria-hidden={decorative ? "true" : undefined}><path d={mark.path} /></svg>
{:else}
  <span
    class="inline-grid place-items-center rounded-[0.2em] text-[0.52em] leading-none font-black tracking-[-0.08em] {className}"
    style:background-color={mark.color}
    style:color={mark.foreground}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : mark.name}
    aria-hidden={decorative ? "true" : undefined}>{mark.monogram}</span>
{/if}
