<script lang="ts">
  import { getAdminUserLibrary } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import Banner from "#lib/components/Banner.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import {
    BOOK_STATUS_LABELS,
    GAME_STATUS_LABELS,
    MEDIA_STATUS_META,
    MUSIC_STATUS_LABELS,
  } from "#lib/constants/status-labels.js";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    AdminUserLibraryEntryDto,
    AdminUserLibraryKind,
    PagedResult,
  } from "@loomkeep/shared";

  let {
    userId,
    kind,
    title,
    onClose,
  }: {
    userId: string;
    kind: AdminUserLibraryKind;
    title: string;
    onClose: () => void;
  } = $props();

  const query = createApiInfiniteQuery(() => ({
    key: keys.admin.userLibrary(userId, kind),
    fetch: (page: number) => getAdminUserLibrary(userId, kind, page),
    getPageItems: (page: PagedResult<AdminUserLibraryEntryDto>) => page.items,
    initialPageParam: 1,
    getNextPageParam: (
      last: PagedResult<AdminUserLibraryEntryDto>,
      all: PagedResult<AdminUserLibraryEntryDto>[],
    ) => (last.hasMore ? all.length + 1 : undefined),
  }));

  function statusLabel(status: string): string {
    const labels: Record<string, string> =
      kind === "games"
        ? GAME_STATUS_LABELS
        : kind === "books"
          ? BOOK_STATUS_LABELS
          : kind === "music"
            ? MUSIC_STATUS_LABELS
            : Object.fromEntries(
                Object.entries(MEDIA_STATUS_META).map(([key, meta]) => [
                  key,
                  meta.label,
                ]),
              );
    return labels[status] ?? status;
  }
</script>

<Modal {title} onclose={onClose}>
  {#if query.loading}
    <div class="space-y-2" aria-label={m.common_loading()}>
      <div class="skeleton h-14 rounded-lg"></div>
      <div class="skeleton h-14 rounded-lg"></div>
    </div>
  {:else if query.error}
    <Banner variant="error">{query.error}</Banner>
  {:else if query.data.length === 0}
    <p class="text-dim py-4 text-center text-sm">{m.common_no_results()}.</p>
  {:else}
    <ul class="space-y-2">
      {#each query.data as entry (entry.id)}
        <li
          class="border-border flex items-center gap-3 rounded-lg border p-2 text-sm">
          {#if entry.imageUrl}
            <img
              src={entry.imageUrl}
              alt=""
              loading="lazy"
              class="bg-surface-2 h-14 w-10 shrink-0 rounded object-cover" />
          {:else}
            <div class="bg-surface-2 h-14 w-10 shrink-0 rounded"></div>
          {/if}
          <div class="min-w-0 flex-1">
            {#if entry.href}
              <a
                href={entry.href}
                class="text-fg block truncate font-semibold hover:underline"
                >{entry.title}</a>
            {:else}
              <span class="text-fg block truncate font-semibold"
                >{entry.title}</span>
            {/if}
            <p class="text-dim text-xs">
              {statusLabel(entry.status)} · {m.admin_users_library_added({
                date: formatDate(entry.addedAt),
              })}
            </p>
          </div>
          {#if entry.favorite}
            <span class="text-danger shrink-0">
              <Icon name="heart" class="h-4 w-4" />
              <span class="sr-only">{m.common_favorite()}</span>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if query.hasNextPage}
      <button
        type="button"
        class="btn btn-ghost btn-sm mt-3 w-full"
        disabled={query.isFetchingNextPage}
        onclick={() => query.fetchNextPage()}>
        {m.common_load_more()}
      </button>
    {/if}
  {/if}
</Modal>
