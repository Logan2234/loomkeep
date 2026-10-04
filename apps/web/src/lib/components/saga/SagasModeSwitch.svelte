<script lang="ts" module>
  export const sagasMode = (url: URL): "works" | "sagas" =>
    url.searchParams.get("vue") === "sagas" ? "sagas" : "works";
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // A library's works or its sagas, the choice living in the URL so a link
  // or "back" lands on the same view.
  let { isNew = false }: { isNew?: boolean } = $props();

  const mode = $derived(sagasMode(page.url));

  function setMode(next: "works" | "sagas") {
    void goto(next === "sagas" ? "?vue=sagas" : page.url.pathname, {
      keepFocus: true,
      noScroll: true,
    });
  }
</script>

<div class="flex items-center gap-2">
  {#if isNew}<NewBadge />{/if}
  <SegmentedControl
    label={m.media_view_label()}
    options={[
      { value: "works", label: m.common_works(), icon: "library" },
      { value: "sagas", label: m.media_view_sagas(), icon: "list" },
    ]}
    value={mode}
    onChange={setMode} />
</div>
