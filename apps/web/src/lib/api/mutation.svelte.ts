// createApiMutation() — thin wrapper over TanStack's createMutation(), next
// to createApiQuery() (docs/plans/centralized-api-layer.md §3). Same
// { data, error, loading, fieldErrors } surface as createApiQuery, plus
// `mutate()`. `invalidates` replaces manual local patching after a mutation
// — the query keys it lists get refetched instead.
import { toast } from "$lib/toast.svelte";
import {
  createMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/svelte-query";
import { bannerMessage, fieldError } from "./validation-messages";

interface ApiMutationOptions<TArgs, TData> {
  mutate: (args: TArgs) => Promise<TData>;
  /** Local update, close a modal, navigate. */
  onSuccess?: (data: TData) => void;
  /** Factory keys to refetch after success. Default `[]`. */
  invalidates?: QueryKey[];
  /** Success message, via m() — never a hardcoded literal. */
  successToast?: string;
  /** Clear `error` when `mutate()` is called. Default `true`. */
  resetErrorOnRun?: boolean;
  // Fields already shown via fieldError() under an input — suppresses the
  // duplicate banner message and is also the source for `fieldErrors`.
  coveredFields?: string[];
  /** Extra side effect on failure; the error is resolved either way. */
  onError?: (err: unknown) => void;
  /** Surface the error as a toast in addition to `error`. Default `false`. */
  errorToast?: boolean;
}

export function createApiMutation<TArgs = void, TData = unknown>(
  optionsFn: () => ApiMutationOptions<TArgs, TData>,
) {
  const queryClient = useQueryClient();

  const mutation = createMutation<TData, Error, TArgs>(() => {
    const opts = optionsFn();
    return {
      mutationFn: opts.mutate,
      onSuccess: (data: TData) => {
        opts.onSuccess?.(data);

        for (const key of opts.invalidates ?? []) {
          void queryClient.invalidateQueries({ queryKey: key });
        }

        if (opts.successToast) toast.success(opts.successToast);
      },
      onError: (err: unknown) => {
        opts.onError?.(err);

        if (opts.errorToast) {
          const message = bannerMessage(err, opts.coveredFields ?? []);
          if (message) toast.error(message);
        }
      },
    };
  });

  return {
    // Ignores the call when one is already in flight — the double-submit
    // guard every hand-rolled `saving` boolean used to be.
    mutate(args: TArgs) {
      if (mutation.isPending) return;
      if (optionsFn().resetErrorOnRun ?? true) mutation.reset();
      mutation.mutate(args);
    },
    get data() {
      return mutation.data ?? null;
    },
    get error() {
      if (!mutation.error) return null;
      return bannerMessage(mutation.error, optionsFn().coveredFields ?? []);
    },
    get loading() {
      return mutation.isPending;
    },
    get fieldErrors() {
      const coveredFields = optionsFn().coveredFields ?? [];
      const result: Record<string, string> = {};

      for (const field of coveredFields) {
        const message = fieldError(mutation.error, field);
        if (message) result[field] = message;
      }

      return result;
    },
  };
}
