<script lang="ts">
  import { theme } from "$lib/theme.svelte";

  const { theme: t } = $props();

  const active = $derived(theme.mode === t.mode);
</script>

<button
  type="button"
  class="w-28 rounded-lg border p-2 text-center transition-colors {active
    ? 'border-accent'
    : 'border-border'}"
  onclick={() => theme.mode !== t.mode && theme.toggle()}>
  <div class="mb-2 overflow-hidden rounded" style="background:{t.bg}">
    <div
      class="flex h-3 items-center gap-1 px-1.5"
      style="background:{t.surface}">
      <span class="h-1 w-1 rounded-full" style="background:{t.accent}"></span>
      <span class="h-0.5 w-3 rounded-full" style="background:{t.line}"></span>
    </div>
    <div class="flex flex-col gap-1 p-1.5">
      <span class="h-0.5 rounded-full" style="width:55%;background:{t.line}"
      ></span>
      <span class="h-0.5 rounded-full" style="width:35%;background:{t.accent}"
      ></span>
    </div>
  </div>
  <span class="text-xs font-semibold {active ? 'text-accent' : 'text-dim'}">
    {t.label}
  </span>
</button>
