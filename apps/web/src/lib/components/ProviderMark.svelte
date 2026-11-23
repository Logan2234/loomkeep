<script lang="ts">
  import {
    PROVIDER_BRANDS,
    type ProviderBrandKey,
  } from "#lib/provider-brands.js";

  let {
    brand,
    decorative = false,
    mono = false,
    class: className = "h-4 w-4",
  }: {
    brand: ProviderBrandKey;
    /** Hide the mark when adjacent text already identifies the provider. */
    decorative?: boolean;
    class?: string;
    /** Draw a logo in the surrounding text colour, for a chip that is already brand-coloured. */
    mono?: boolean;
  } = $props();

  const mark = $derived(PROVIDER_BRANDS[brand]);
</script>

{#if "src" in mark}
  <img
    src={mark.src}
    alt={decorative ? "" : mark.name}
    class="object-contain {mono ? 'brightness-0' : ''} {className}" />
{:else if "path" in mark}
  <svg
    viewBox="0 0 24 24"
    class={className}
    fill={mono ? "currentColor" : mark.color}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : mark.name}
    aria-hidden={decorative ? "true" : undefined}>
    <path d={mark.path} />
  </svg>
{:else}
  <span
    class="inline-grid place-items-center rounded-[0.2em] text-[0.52em] leading-none font-black tracking-[-0.08em] {className}"
    style:background-color={mark.color}
    style:color={mark.foreground}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : mark.name}
    aria-hidden={decorative ? "true" : undefined}>
    {mark.monogram}
  </span>
{/if}
