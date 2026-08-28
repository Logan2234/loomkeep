// createApiQuery() — thin wrapper over TanStack's createQuery(), one of the
// helpers from the centralized API layer (docs/plans/centralized-api-layer.md
// §3). Every helper shares the same { data, error, loading, fieldErrors }
// surface, with `error` always resolved through bannerMessage() so a raw
// ApiError can never reach a template.
import { toast } from "$lib/toast.svelte";
import {
  createQuery,
  keepPreviousData,
  type QueryKey,
} from "@tanstack/svelte-query";
import { bannerMessage, fieldError } from "./validation-messages";

interface ApiQueryOptions<T> {
  key: QueryKey;
  fetch: () => Promise<T>;
  /** Don't fetch until this holds. Default `true`. */
  enabled?: boolean;
  /** Also the refetch-on-focus knob. Default: the global 30s (queryClient.ts). */
  staleTime?: number;
  /** Polling interval. Default `false`. */
  refetchInterval?: number | false;
  // Opt-in — only correct when a key change means "same subject, different
  // view" (filters/sort/page/search), never "different subject". Default `false`.
  keepPreviousData?: boolean;
  /** Default: the global retry (queryClient.ts). */
  retry?: number;
  // Fields already shown via fieldError() under an input — suppresses the
  // duplicate banner message and is also the source for `fieldErrors`.
  coveredFields?: string[];
  /** Extra side effect on failure; the error is resolved either way. */
  onError?: (err: unknown) => void;
  /** Surface the error as a toast in addition to `error`. Default `false`. */
  errorToast?: boolean;
}

export function createApiQuery<T>(optionsFn: () => ApiQueryOptions<T>) {
  const query = createQuery(() => {
    const opts = optionsFn();
    return {
      queryKey: opts.key,
      queryFn: opts.fetch,
      enabled: opts.enabled ?? true,
      refetchInterval: opts.refetchInterval ?? false,
      placeholderData: opts.keepPreviousData ? keepPreviousData : undefined,
      ...(opts.staleTime !== undefined ? { staleTime: opts.staleTime } : {}),
      ...(opts.retry !== undefined ? { retry: opts.retry } : {}),
    };
  });

  // Fires onError/errorToast once per distinct failure — request() throws a
  // fresh error instance on every failed fetch, so reference identity is
  // enough to detect a new failure without a separate "seen" flag to reset.
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
    get data() {
      return query.data ?? null;
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
  };
}
