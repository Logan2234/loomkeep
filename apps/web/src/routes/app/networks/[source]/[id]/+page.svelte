<script lang="ts">
  import { page } from "$app/state";
  import StudioPage from "#lib/components/StudioPage.svelte";
  import type { CreatorSource } from "@loomkeep/shared";
</script>

<!-- From one studio to its parent: a fresh page, not the last one's tab. -->
{#key page.params.id}
  <StudioPage
    kind="NETWORK"
    source={(page.params.source ?? "") as CreatorSource}
    id={page.params.id ?? ""} />
{/key}
