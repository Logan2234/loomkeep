// createApiInfiniteQuery() — thin wrapper over TanStack's
// createInfiniteQuery(), the third helper from the centralized API layer
// (docs/plans/centralized-api-layer.md §3). "Infinite" means accumulating
// pages, not a scroll mechanism — the trigger (IntersectionObserver
// sentinel, "load more" button) stays the component's business. Supports
// both server paging styles (cursor or page number) through
// `getNextPageParam`, not a mode flag — and there is deliberately no
// accumulate-vs-replace flag either, since every paginated list in this app
// accumulates. `data` is the flattened, accumulated list as-is — a call
// site whose source can repeat an item across pages (MediaSearchPanel's
// external catalog search) de-dupes it locally, since that's specific to
// one source, not something every call site needs.
import { toast } from "$lib/toast.svelte";
import {
  createInfiniteQuery,
  keepPreviousData,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/svelte-query";
import { resolveApiError } from "./errors";

interface ApiInfiniteQueryOptions<TPage, TPageParam, TItem> {
  key: QueryKey;
  fetch: (pageParam: TPageParam) => Promise<TPage>;
  /** Extracts one page's items — `data` is the flattened, accumulated list. */
  getPageItems: (page: TPage) => TItem[];
  initialPageParam: TPageParam;
  getNextPageParam: (
    lastPage: TPage,
    allPages: TPage[],
  ) => TPageParam | undefined;
  /**
   * Opt-in — keeps the previous pages on screen while a key change (a
   * filter, sort, or search query) refetches, instead of flashing empty.
   * Only correct for "same subject, different view" key changes. Default
   * `false`.
   */
  keepPreviousData?: boolean;
  /** Don't fetch until this holds. Default `true`. */
  enabled?: boolean;
  /** Default: the global retry (queryClient.ts). */
  retry?: number;
  onError?: (err: unknown) => void;
  errorToast?: boolean;
}

export function createApiInfiniteQuery<TPage, TPageParam, TItem>(
  optionsFn: () => ApiInfiniteQueryOptions<TPage, TPageParam, TItem>,
) {
  const query = createInfiniteQuery<
    TPage,
    Error,
    InfiniteData<TPage, TPageParam>,
    QueryKey,
    TPageParam
  >(() => {
    const opts = optionsFn();
    return {
      queryKey: opts.key,
      queryFn: ({ pageParam }) => opts.fetch(pageParam as TPageParam),
      initialPageParam: opts.initialPageParam,
      getNextPageParam: opts.getNextPageParam,
      enabled: opts.enabled ?? true,
      placeholderData: opts.keepPreviousData ? keepPreviousData : undefined,
      ...(opts.retry !== undefined ? { retry: opts.retry } : {}),
    };
  });

  // Fires onError/errorToast once per distinct failure — same identity
  // check as createApiQuery, see its comment for why that's enough.
  let reportedError: unknown = undefined;

  $effect(() => {
    if (query.error && query.error !== reportedError) {
      reportedError = query.error;
      const opts = optionsFn();
      opts.onError?.(query.error);

      if (opts.errorToast) toast.error(resolveApiError(query.error));
    }
  });

  return {
    get data(): TItem[] {
      const opts = optionsFn();
      return (query.data?.pages ?? []).flatMap((page) =>
        opts.getPageItems(page),
      );
    },
    // Raw pages, for call sites that also need per-page metadata (a total
    // count) alongside the flattened `data`.
    get pages(): TPage[] {
      return query.data?.pages ?? [];
    },
    get error() {
      return query.error ? resolveApiError(query.error) : null;
    },
    get loading() {
      return query.isPending;
    },
    get hasNextPage() {
      return query.hasNextPage;
    },
    get isFetchingNextPage() {
      return query.isFetchingNextPage;
    },
    fetchNextPage() {
      void query.fetchNextPage();
    },
  };
}
