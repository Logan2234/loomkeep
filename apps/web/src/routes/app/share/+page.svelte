<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { keys } from "$lib/api/keys";
  import { resolveLink } from "$lib/api/links";
  import { createApiQuery } from "$lib/api/query.svelte";
  import BootSplash from "$lib/components/BootSplash.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import QuickAddPanel from "$lib/components/QuickAddPanel.svelte";
  import { m } from "$lib/paraglide/messages";
  import { quickAddTarget } from "$lib/quick-add";
  import { readSharedLink } from "$lib/share-link";

  const { link, searchTerm } = readSharedLink(page.url.searchParams);
  const searchHref = `/app/search?query=${encodeURIComponent(searchTerm)}`;

  const resolved = createApiQuery(() => ({
    key: keys.links.resolve(link ?? ""),
    fetch: () => resolveLink(link!),
    enabled: link !== null,
  }));

  const target = $derived(resolved.data?.match?.href ?? null);
  // A work gets the quick-add panel (UX-09); any other page opens as is.
  const quickAdd = $derived(target !== null && quickAddTarget(target) !== null);
  const settled = $derived(
    link === null || resolved.error !== null || resolved.data !== null,
  );
  const unrecognized = $derived(settled && !target && !searchTerm);

  $effect(() => {
    if (quickAdd) return;
    if (target) void goto(target, { replaceState: true });
    else if (settled && searchTerm)
      void goto(searchHref, { replaceState: true });
  });
</script>

{#if quickAdd}
  <div class="mx-auto w-full max-w-md px-4 py-6 md:py-10">
    <QuickAddPanel href={target!} link={link!} shared />
  </div>
{:else if unrecognized}
  <div class="mx-auto flex h-full max-w-2xl items-center px-5 py-10 md:px-8">
    <EmptyState>
      <p class="font-display text-fg text-lg font-bold">
        {m.share_unrecognized_title()}
      </p>
      <p class="mt-2">{m.share_unrecognized_body()}</p>
      <a class="btn btn-primary mt-5" href="/app/search">
        {m.search_title_cta()}
      </a>
    </EmptyState>
  </div>
{:else}
  <BootSplash message={m.share_resolving()} class="min-h-[70svh]" />
{/if}
