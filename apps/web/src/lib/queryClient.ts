import { QueryClient } from "@tanstack/svelte-query";

// App-wide TanStack Query cache. Mutations invalidate by key rather than
// hand-patching component state — see CommentThread.svelte for the pattern.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A stray network blip shouldn't need a manual refresh; 1 retry is
      // enough for a self-host instance on a possibly-flaky connection.
      retry: 1,
    },
  },
});
