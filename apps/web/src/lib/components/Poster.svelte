<script lang="ts">
  // 2:3 poster. Falls back to a deterministic gradient (stable per title) with
  // the title set in the display face, so a missing artwork still reads well.
  let {
    src = null,
    title,
    class: cls = "",
    adult = false,
  }: {
    src?: string | null;
    title: string;
    class?: string;
    /** 18+ title — shows a small corner badge. */
    adult?: boolean;
  } = $props();

  const hue = $derived(
    [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7),
  );

  // Some sources (e.g. Cover Art Archive) build a URL without confirming the
  // image exists — a 404 falls back to the same gradient as a null src.
  let failed = $state(false);
  $effect(() => {
    void src;
    failed = false;
  });
</script>

<div class="relative">
  {#if src && !failed}
    <img
      {src}
      alt={title}
      loading="lazy"
      onerror={() => (failed = true)}
      class="bg-surface-2 aspect-2/3 w-full object-cover {cls}" />
  {:else}
    <div
      class="flex aspect-2/3 w-full items-end p-2 {cls}"
      style="background: linear-gradient(150deg, hsl({hue} 32% 24%), hsl({(hue +
        40) %
        360} 34% 13%));">
      <span
        class="font-display line-clamp-3 text-xs leading-tight font-bold wrap-anywhere text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
        {title}
      </span>
    </div>
  {/if}
  {#if adult}
    <span
      class="bg-danger absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[0.6rem] font-black text-white shadow">
      18+
    </span>
  {/if}
</div>
