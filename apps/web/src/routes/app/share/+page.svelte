<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { keys } from "$lib/api/keys";
  import { resolveLink } from "$lib/api/links";
  import { createApiQuery } from "$lib/api/query.svelte";
  import BootSplash from "$lib/components/BootSplash.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import { m } from "$lib/paraglide/messages";
  import { readSharedLink } from "$lib/share-link";

  // The PWA's share target (UX-05): another app's share sheet lands here
  // with ?url/?text/?title, and this page hands over to the matching work's
  // page — or to the search, when the link isn't one Loomkeep can read.
  const { link, searchTerm } = readSharedLink(page.url.searchParams);
  const searchHref = `/app/search?query=${encodeURIComponent(searchTerm)}`;

  const resolved = createApiQuery(() => ({
    key: keys.links.resolve(link ?? ""),
    fetch: () => resolveLink(link!),
    enabled: link !== null,
  }));

  const target = $derived(resolved.data?.match?.href ?? null);
  // Done asking: no link to look up, or the lookup came back either way.
  const settled = $derived(
    link === null || resolved.error !== null || resolved.data !== null,
  );
  // Nothing to open or search for: said on the page instead of landing on
  // an empty search that looks like the share did nothing.
  const unrecognized = $derived(settled && !target && !searchTerm);

  $effect(() => {
    // replaceState: back from the work's page returns to the sharing app,
    // not to this hand-off screen.
    if (target) void goto(target, { replaceState: true });
    else if (settled && searchTerm)
      void goto(searchHref, { replaceState: true });
  });
</script>

{#if unrecognized}
  <div class="mx-auto flex h-full max-w-2xl items-center px-5 py-10 md:px-8">
    <EmptyState>
      <p class="font-display text-fg text-lg font-bold">
        {m.share_unrecognized_title()}
      </p>
      <p class="mt-2">{m.share_unrecognized_body()}</p>
      <a class="btn btn-primary mt-5" href="/app/search">
        {m.share_search_cta()}
      </a>
    </EmptyState>
  </div>
{:else}
  <!-- The boot screen's reel and wordmark: this is a hand-off, not a page. -->
  <BootSplash message={m.share_resolving()} class="min-h-[70svh]" />
{/if}
