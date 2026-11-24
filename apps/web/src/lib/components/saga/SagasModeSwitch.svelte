<script lang="ts" module>
  import type { ReadonlyURL } from "$app/state";

  export const sagasMode = (url: ReadonlyURL): "works" | "sagas" =>
    url.searchParams.get("vue") === "sagas" ? "sagas" : "works";
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SegmentedControl from "#lib/components/SegmentedControl.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";

  const mode = $derived(sagasMode(page.url));

  function setMode(next: "works" | "sagas") {
    void goto(next === "sagas" ? "?vue=sagas" : page.url.pathname, {
      reset: false,
    });
  }
</script>

<SegmentedControl
  label={m.media_view_label()}
  options={[
    // Without icons on a phone, to fit beside the page's title.
    {
      value: "works",
      label: m.common_works(),
      icon: layout.compact ? undefined : "library",
    },
    {
      value: "sagas",
      label: m.media_view_sagas(),
      icon: layout.compact ? undefined : "list",
    },
  ]}
  value={mode}
  onChange={setMode} />
