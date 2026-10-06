<script lang="ts">
  // "Recommander", on every work page: the work goes to the friends picked,
  // each in their own conversation. Only while Messages is on.
  import { getChatFriends, recommendWork } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    MESSAGE_TEXT_MAX_LENGTH,
    RECOMMEND_MAX_FRIENDS,
    type MessageWorkDto,
  } from "@loomkeep/shared";
  import { scale } from "svelte/transition";
  import { workKindLabel } from "./conversation-presentation";

  let { work }: { work: MessageWorkDto } = $props();

  const reduced = prefersReducedMotion();
  let open = $state(false);
  let search = $state("");
  let query = $state("");
  let picked = $state<string[]>([]);
  let note = $state("");

  $effect(() => {
    const next = search.trim();
    const timer = setTimeout(() => (query = next), 250);
    return () => clearTimeout(timer);
  });

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(query),
    fetch: () => getChatFriends(query),
    enabled: open,
    keepPreviousData: true,
  }));

  const sendMut = createApiMutation(() => ({
    mutate: () =>
      recommendWork({
        work: work.href,
        usernames: picked,
        text: note.trim() || undefined,
      }),
    onSuccess: ({ sent }) => {
      toast.success(
        sent > 1
          ? m.chat_recommend_sent_many({ count: sent })
          : m.chat_recommend_sent_one(),
      );
      close();
    },
    invalidates: [keys.chat.conversations()],
    errorToast: true,
  }));

  function toggle(username: string) {
    picked = picked.includes(username)
      ? picked.filter((u) => u !== username)
      : picked.length < RECOMMEND_MAX_FRIENDS
        ? [...picked, username]
        : picked;
  }

  function close() {
    open = false;
    picked = [];
    note = "";
    search = "";
  }
</script>

{#if appConfig.chatEnabled}
  <button
    type="button"
    class="btn-icon border-border text-dim hover:bg-surface-2 hover:text-fg relative h-9 w-9 border transition-colors duration-150"
    aria-label={m.chat_recommend()}
    title={m.chat_recommend()}
    aria-haspopup="dialog"
    onclick={() => (open = true)}>
    <Icon name="send" class="h-4 w-4" />
    {#if isFeatureNew("recommend")}
      <span
        class="bg-accent ring-surface absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2"
        aria-hidden="true"></span>
    {/if}
  </button>
{/if}

{#if open}
  <Modal title={m.chat_recommend()} onclose={close}>
    <div class="flex flex-col gap-4">
      <div class="bg-surface-2 flex items-center gap-3 rounded-xl p-2">
        <span class="w-[34px] shrink-0 overflow-hidden rounded">
          <Poster
            src={work.imageUrl}
            title={work.title}
            alt=""
            caption={false} />
        </span>
        <span class="min-w-0">
          <span
            class="text-accent block font-mono text-[0.62rem] font-bold tracking-wider uppercase">
            {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
          </span>
          <span class="font-display block truncate font-extrabold"
            >{work.title}</span>
        </span>
      </div>

      <label class="input flex items-center gap-2">
        <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
        <span class="sr-only">{m.chat_search_friends()}</span>
        <input
          bind:value={search}
          class="min-w-0 flex-1 bg-transparent outline-none"
          placeholder={m.chat_search_friends()} />
      </label>

      <div
        role="group"
        aria-label={m.chat_recommend_to()}
        class="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto">
        {#each friendsQuery.data ?? [] as friend (friend.id)}
          {@const selected = picked.includes(friend.username)}
          <button
            type="button"
            aria-pressed={selected}
            class="hover:bg-surface-2 flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition-colors duration-150"
            onclick={() => toggle(friend.username)}>
            <span
              class="relative rounded-full transition-shadow duration-150
                {selected
                ? 'ring-accent ring-offset-surface ring-2 ring-offset-2'
                : ''}">
              <Avatar seed={friend.username} url={friend.avatarUrl} size={44} />
              {#if selected}
                <span
                  transition:scale={{ duration: reduced ? 0 : 150, start: 0.6 }}
                  class="bg-accent text-accent-fg ring-surface absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full ring-2">
                  <Icon name="check" class="h-3 w-3" />
                </span>
              {/if}
            </span>
            <span class="w-full truncate text-center"
              >{friend.displayName}</span>
          </button>
        {:else}
          {#if !friendsQuery.loading}
            <p class="text-dim col-span-4 px-2 py-4 text-center text-sm">
              {query ? m.common_no_results() : m.chat_no_friends()}
            </p>
          {/if}
        {/each}
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="sr-only">{m.chat_recommend_note()}</span>
        <textarea
          bind:value={note}
          rows="2"
          maxlength={MESSAGE_TEXT_MAX_LENGTH}
          class="input resize-none"
          placeholder={m.chat_recommend_note()}></textarea>
      </label>
    </div>

    {#snippet actions()}
      <button type="button" class="btn btn-ghost" onclick={close}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={picked.length === 0 || sendMut.loading}
        onclick={() => sendMut.mutate()}>
        <Icon name="send" class="h-4 w-4" />
        {picked.length > 1
          ? m.chat_recommend_send_many({ count: picked.length })
          : picked.length === 1
            ? m.chat_recommend_send_one()
            : m.common_send()}
      </button>
    {/snippet}
  </Modal>
{/if}
