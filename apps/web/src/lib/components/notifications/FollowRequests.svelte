<script lang="ts">
  // Pending follow requests, answered in place: on the bell and on top of
  // the notifications page. An accepted one says so for a moment, then goes.
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { acceptFollowRequest, rejectFollowRequest } from "#lib/api/social.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { rowIn, rowOut } from "#lib/notifications/transitions.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { FollowRequestDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { fly } from "svelte/transition";
  import Avatar from "../Avatar.svelte";
  import Icon from "../Icon.svelte";

  let {
    requests,
    onopen,
  }: {
    requests: FollowRequestDto[];
    /** Following a profile link, e.g. so the bell closes behind. */
    onopen?: () => void;
  } = $props();

  const ACCEPTED_SHOWN_MS = 1300;

  const queryClient = useQueryClient();
  const mountedAt = new Date().toISOString();
  let accepted = $state<string[]>([]);

  function removeRequest(id: string) {
    queryClient.setQueryData(
      keys.social.followRequests(),
      (prev: FollowRequestDto[] | undefined) =>
        prev?.filter((r) => r.id !== id),
    );
  }

  const answer = createApiMutation(() => ({
    mutate: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? acceptFollowRequest(id) : rejectFollowRequest(id),
    onSuccess: (_: void, { id, accept }: { id: string; accept: boolean }) => {
      if (!accept) return removeRequest(id);
      accepted = [...accepted, id];
      setTimeout(() => {
        removeRequest(id);
        accepted = accepted.filter((a) => a !== id);
      }, ACCEPTED_SHOWN_MS);
    },
    errorToast: true,
  }));
</script>

<ul>
  {#each requests as req (req.id)}
    <li
      in:rowIn={{ flash: req.createdAt > mountedAt }}
      out:rowOut
      class="row-flash">
      {#if accepted.includes(req.id)}
        <p
          in:fly={{ x: 8, duration: prefersReducedMotion() ? 0 : 200 }}
          class="text-success flex items-center gap-2.5 py-3.5 pr-4 pl-6 text-sm font-semibold">
          <Icon name="check" class="h-4 w-4" />
          {m.notif_follows_you_now({ name: req.user.displayName })}
        </p>
      {:else}
        <div class="flex items-center gap-3 py-2.5 pr-4 pl-6">
          <a href="/app/u/{req.user.username}" onclick={onopen}>
            <Avatar
              seed={req.user.username}
              url={req.user.avatarUrl}
              size={36} />
          </a>
          <div class="min-w-0 flex-1">
            <a
              href="/app/u/{req.user.username}"
              onclick={onopen}
              class="block truncate text-sm font-semibold hover:underline">
              {req.user.displayName}
            </a>
            <p class="timecode truncate text-xs">@{req.user.username}</p>
          </div>
          <button
            type="button"
            aria-label={m.common_accept()}
            disabled={answer.loading}
            onclick={() => answer.mutate({ id: req.id, accept: true })}
            class="bg-accent text-accent-fg grid h-8 w-8 shrink-0 place-items-center rounded-full transition-[filter,scale] duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50 motion-reduce:transition-none">
            <Icon name="check" class="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={m.common_reject()}
            disabled={answer.loading}
            onclick={() => answer.mutate({ id: req.id, accept: false })}
            class="text-dim hover:text-fg hover:bg-surface-2 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-150 disabled:opacity-50">
            <Icon name="x" class="h-4 w-4" />
          </button>
        </div>
      {/if}
    </li>
  {/each}
</ul>
