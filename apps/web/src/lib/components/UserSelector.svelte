<script lang="ts">
  import {
    getAdminUserOptions,
    normalizeAdminUserOptionsPage,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Combobox from "./Combobox.svelte";

  let {
    value = null,
    label = m.user_selector_all_accounts(),
    searchPlaceholder = m.user_selector_search_placeholder(),
    valueMode = "id",
    onChange,
  }: {
    /** Selected user id, or null for "no account filter". */
    value?: string | null;
    label?: string;
    searchPlaceholder?: string;
    valueMode?: "id" | "email";
    onChange: (value: string | null) => void;
  } = $props();

  const PAGE_SIZE = 20;
  let pendingSearch = $state("");
  let search = $state("");
  let selectedLabel = $state<string | undefined>();
  let syncedValue = $state<string | null>(null);

  $effect(() => {
    const candidate = pendingSearch.trim();
    const next = candidate.length >= 2 ? candidate : "";
    const timeout = window.setTimeout(() => (search = next), 250);
    return () => window.clearTimeout(timeout);
  });

  const usersQuery = createApiInfiniteQuery(() => ({
    key: keys.admin.userOptions(search),
    fetch: async (page: number) =>
      normalizeAdminUserOptionsPage(
        await getAdminUserOptions({
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        }),
        search,
      ),
    getPageItems: (result) => result.items,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    keepPreviousData: true,
  }));

  const options = $derived([
    { label, value: "" },
    ...usersQuery.data.map((u) => ({
      label: `${u.displayName} <${u.email}>`,
      value: valueMode === "email" ? u.email : u.id,
    })),
  ]);

  $effect(() => {
    if (value !== syncedValue) {
      syncedValue = value;
      pendingSearch = value ?? "";
      selectedLabel = valueMode === "email" && value ? value : undefined;
    }

    if (!value) {
      selectedLabel = undefined;
      return;
    }
    const selected = options.find((option) => option.value === value);
    if (selected) selectedLabel = selected.label;
    else if (valueMode === "email") selectedLabel = value;
  });

  function select(values: string[]) {
    const next = values[0] || null;
    const selected = options.find((option) => option.value === next);
    selectedLabel = selected?.label;
    onChange(next);
  }
</script>

<Combobox
  {label}
  {options}
  values={value ? [value] : []}
  searchable
  {searchPlaceholder}
  {selectedLabel}
  loading={usersQuery.loading || usersQuery.isFetchingNextPage}
  hasMore={usersQuery.hasNextPage}
  onSearch={(query) => (pendingSearch = query)}
  onLoadMore={usersQuery.fetchNextPage}
  onChange={select} />
