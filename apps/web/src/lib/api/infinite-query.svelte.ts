// createApiInfiniteQuery() — thin wrapper over TanStack's
// createInfiniteQuery(), the third helper from the centralized API layer
// (docs/plans/centralized-api-layer.md §3). "Infinite" means accumulating
// pages, not a scroll mechanism — the trigger (IntersectionObserver
// sentinel, "load more" button) stays the component's business. Supports
// both server paging styles (cursor or page number) through
// `getNextPageParam`, not a mode flag — and there is deliberately no
// accumulate-vs-replace flag either, since every paginated list in this app
// accumulates.
import { toast } from "$lib/toast.svelte";
import {
  createInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/svelte-query";
import { bannerMessage, fieldError } from "./validation-messages";

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
   * De-dupes the flattened list by this key, keeping the first occurrence —
   * for sources (an external catalog search) whose pages can overlap.
   */
  dedupeKey?: (item: TItem) => string;
  /** Don't fetch until this holds. Default `true`. */
  enabled?: boolean;
  /** Default: the global 30s (queryClient.ts). */
  staleTime?: number;
  /** Default: the global retry (queryClient.ts). */
  retry?: number;
  coveredFields?: string[];
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
      queryFn: ({ pageParam }) => opts.fetch(pageParam),
      initialPageParam: opts.initialPageParam,
      getNextPageParam: opts.getNextPageParam,
      enabled: opts.enabled ?? true,
      ...(opts.staleTime !== undefined ? { staleTime: opts.staleTime } : {}),
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

      if (opts.errorToast) {
        const message = bannerMessage(query.error, opts.coveredFields ?? []);
        if (message) toast.error(message);
      }
    }
  });

  return {
    get data(): TItem[] {
      const opts = optionsFn();
      const items = (query.data?.pages ?? []).flatMap((page) =>
        opts.getPageItems(page),
      );
      if (!opts.dedupeKey) return items;
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = opts.dedupeKey!(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    // Raw pages, for call sites that also need per-page metadata (a total
    // count) alongside the flattened `data`.
    get pages(): TPage[] {
      return query.data?.pages ?? [];
    },
    get error() {
      if (!query.error) return null;
      return bannerMessage(query.error, optionsFn().coveredFields ?? []);
    },
    get loading() {
      return query.isPending;
    },
    get fieldErrors() {
      const coveredFields = optionsFn().coveredFields ?? [];
      const result: Record<string, string> = {};

      for (const field of coveredFields) {
        const message = fieldError(query.error, field);
        if (message) result[field] = message;
      }

      return result;
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
