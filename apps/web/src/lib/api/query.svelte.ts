// createApiQuery() — thin wrapper over TanStack's createQuery(), one of the
// helpers from the centralized API layer (docs/plans/centralized-api-layer.md
// §3). `error` is always resolved through resolveApiError() so a raw
// ApiError can never reach a template. No fieldErrors/coveredFields here —
// unlike createApiMutation, a GET doesn't submit a body a server can return
// per-field validation.failed details against.
import { toast } from "$lib/toast.svelte";
import {
  createQuery,
  keepPreviousData,
  type QueryKey,
} from "@tanstack/svelte-query";
import { resolveApiError } from "./errors";

interface ApiQueryOptions<T> {
  key: QueryKey;
  fetch: () => Promise<T>;
  /** Don't fetch until this holds. Default `true`. */
  enabled?: boolean;
  /**
   * Polling interval, or a function of the latest data deciding it per
   * fetch — e.g. stop once a polled job's status leaves "running". Default
   * `false`.
   */
  refetchInterval?: number | false | ((data: T | undefined) => number | false);
  /**
   *  Opt-in — only correct when a key change means "same subject, different
   * view" (filters/sort/page/search), never "different subject". Default `false`.
   */
  keepPreviousData?: boolean;
  /** Default: the global retry (queryClient.ts). */
  retry?: number;
  /** Extra side effect on failure; the error is resolved either way. */
  onError?: (err: unknown) => void;
  /** Surface the error as a toast in addition to `error`. Default `false`. */
  errorToast?: boolean;
  /** Extra side effect on every new successful fetch — mostly for polling. */
  onSuccess?: (data: T) => void;
}

export function createApiQuery<T>(optionsFn: () => ApiQueryOptions<T>) {
  const query = createQuery(() => {
    const opts = optionsFn();
    return {
      queryKey: opts.key,
      queryFn: opts.fetch,
      enabled: opts.enabled ?? true,
      refetchInterval:
        typeof opts.refetchInterval === "function"
          ? (q) =>
              (opts.refetchInterval as (data: T | undefined) => number | false)(
                q.state.data,
              )
          : (opts.refetchInterval ?? false),
      placeholderData: opts.keepPreviousData ? keepPreviousData : undefined,
      ...(opts.retry !== undefined ? { retry: opts.retry } : {}),
    };
  });

  // Fires onError/errorToast once per distinct failure — request() throws a
  // fresh error instance on every failed fetch, so reference identity is
  // enough to detect a new failure without a separate "seen" flag to reset.
  let reportedError: unknown = undefined;
  // Same identity-based dedup for onSuccess — a fresh fetch always produces
  // a new response object, so this fires once per completed fetch, including
  // every tick of a poll.
  let reportedData: T | undefined = undefined;

  $effect(() => {
    if (query.error && query.error !== reportedError) {
      reportedError = query.error;
      const opts = optionsFn();
      opts.onError?.(query.error);

      if (opts.errorToast) toast.error(resolveApiError(query.error));
    }
  });

  $effect(() => {
    if (query.data !== undefined && query.data !== reportedData) {
      reportedData = query.data;
      optionsFn().onSuccess?.(query.data);
    }
  });

  return {
    get data() {
      return query.data ?? null;
    },
    get error() {
      return query.error ? resolveApiError(query.error) : null;
    },
    get loading() {
      return query.isPending;
    },
  };
}
