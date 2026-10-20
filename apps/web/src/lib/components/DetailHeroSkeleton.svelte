<script lang="ts">
  let { wide = true, media = false }: { wide?: boolean; media?: boolean } =
    $props();
</script>

{#if media}
  <div class="relative h-[64vh] max-h-155 min-h-[min(26.25rem,62svh)]">
    <div class="skeleton h-full w-full"></div>
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent">
    </div>
    <div class="skeleton absolute top-4 left-4 h-8 w-24 rounded-full"></div>
    <div
      class="skeleton absolute right-4 bottom-4 z-10 aspect-2/3 w-16 rounded-lg sm:w-20 md:right-6 md:bottom-6 md:w-24">
    </div>
    <div class="absolute inset-x-0 bottom-0">
      <div
        class="mx-auto max-w-4xl px-5 pr-20 pb-6 sm:pr-24 md:px-8 md:pr-8 md:pb-8">
        <div class="flex gap-2">
          <div class="skeleton h-6 w-16 rounded-full"></div>
          <div class="skeleton h-6 w-20 rounded-full"></div>
        </div>
        <div class="skeleton mt-2 h-9 w-2/3 max-w-xl rounded md:h-10"></div>
        <div class="skeleton mt-2 h-4 w-1/2 max-w-sm rounded"></div>
      </div>
    </div>
  </div>

  <div class="border-border border-b">
    <div
      class="mx-auto flex max-w-4xl items-center justify-between px-5 py-3 md:px-8">
      <div class="skeleton h-10 w-32 rounded-full"></div>
      <div class="flex gap-2.5">
        <div class="skeleton h-9 w-9 rounded-full"></div>
        <div class="skeleton h-9 w-9 rounded"></div>
        <div class="skeleton h-9 w-9 rounded"></div>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-4xl px-5 pt-6 pb-6 md:px-8 md:pb-10">
    <div class="flex max-w-2xl flex-col gap-2">
      <div class="skeleton h-4 w-full rounded"></div>
      <div class="skeleton h-4 w-11/12 rounded"></div>
      <div class="skeleton h-4 w-2/3 rounded"></div>
    </div>
  </div>
{:else}
  <div class="relative">
    <div class="skeleton h-44 w-full md:h-60"></div>
    <div
      class="from-bg via-bg/50 absolute inset-0 bg-linear-to-t to-transparent">
    </div>
  </div>

  <div
    class="relative z-10 mx-auto pb-6 md:pb-10 {wide
      ? 'max-w-5xl'
      : 'max-w-4xl'} px-4 md:px-8">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <div
        class="skeleton aspect-2/3 w-32 shrink-0 rounded-xl shadow-lg md:w-44">
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="skeleton h-5 w-24 rounded-full"></div>
        <div class="skeleton h-8 w-3/4 rounded"></div>
        <div class="skeleton h-4 w-1/3 rounded"></div>
      </div>
    </div>
    <div class="skeleton mt-6 h-10 w-56 rounded-lg"></div>
  </div>
{/if}
