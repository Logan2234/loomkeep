<script lang="ts">
  let { wide = true }: { wide?: boolean } = $props();
</script>

<div class="relative">
  <div class="skeleton h-44 w-full md:h-60"></div>
  <div class="from-bg via-bg/50 absolute inset-0 bg-linear-to-t to-transparent">
  </div>
</div>

<div
  class="relative z-10 mx-auto pb-6 md:pb-10 {wide
    ? 'max-w-5xl'
    : 'max-w-4xl'} px-4 md:px-8">
  <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
    <div class="skeleton aspect-2/3 w-32 shrink-0 rounded-xl shadow-lg md:w-44">
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="skeleton h-5 w-24 rounded-full"></div>
      <div class="skeleton h-8 w-3/4 rounded"></div>
      <div class="skeleton h-4 w-1/3 rounded"></div>
    </div>
  </div>
  <div class="skeleton mt-6 h-10 w-56 rounded-lg"></div>
</div>
