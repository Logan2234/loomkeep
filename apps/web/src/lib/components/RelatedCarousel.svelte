<script lang="ts">
  import Carousel from "./Carousel.svelte";
  import Poster from "./Poster.svelte";

  let {
    title,
    items,
  }: {
    title: string;
    items: { key: string; href: string; cover: string | null; title: string }[];
  } = $props();
</script>

{#if items.length > 0}
  <section class="mt-10">
    <h2 class="font-display mb-3 text-xl font-bold">{title}</h2>
    <Carousel {items} keyOf={(item) => item.key}>
      {#snippet card(item)}
        <a href={item.href} class="block w-28 sm:w-32">
          <div class="card hover:border-accent transition-colors">
            <Poster src={item.cover} title={item.title} />
          </div>
          <p class="mt-1.5 truncate text-xs font-semibold">{item.title}</p>
        </a>
      {/snippet}
    </Carousel>
  </section>
{/if}
