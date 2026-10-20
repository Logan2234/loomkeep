<script lang="ts">
  // "Partager à un ami": a work's comment, quoted in a private message to
  // each friend picked, with the work's card and a link back to the comment
  // in its discussion — a comment's "Transférer".
  import { recommendWork } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chatPreview, mentionToken } from "#lib/chat/chat-markdown.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import type { CommentDto, CommentTargetType } from "@loomkeep/shared";
  import ChatFriendPicker from "./ChatFriendPicker.svelte";

  let {
    comment,
    targetType,
    targetId,
    title,
    href,
    onclose,
  }: {
    comment: CommentDto;
    targetType: CommentTargetType;
    targetId: string;
    /** The work's title and page: the card the message carries. */
    title: string;
    href: string;
    onclose: () => void;
  } = $props();

  let picked = $state<string[]>([]);

  const QUOTE_MAX = 280;

  // The comment quoted line by line — still behind a spoiler if it was one —
  // then who wrote it, and where, linked back to it.
  function messageText(): string {
    const text = (comment.text ?? "").slice(0, QUOTE_MAX);
    const body = comment.spoilerTag ? `||${text}||` : text;
    const quote = body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const author = comment.author?.displayName ?? m.common_deleted_user();
    const link = `${href}?work=${targetType}:${targetId}&comment=${comment.id}`;
    return `${quote}\n— ${author} · ${mentionToken(title, link)}`;
  }

  const shareMut = createApiMutation(() => ({
    mutate: () =>
      recommendWork({ usernames: picked, text: messageText(), work: href }),
    onSuccess: ({ sent }) => {
      toast.success(
        sent > 1
          ? m.chat_forward_sent_many({ count: sent })
          : m.chat_forward_sent_one(),
      );
      onclose();
    },
    invalidates: [keys.chat.conversations()],
    errorToast: true,
  }));
</script>

<Modal title={m.chat_share_comment()} {onclose}>
  <div class="flex flex-col gap-4">
    <p class="bg-surface-2 text-dim line-clamp-3 rounded-xl px-3 py-2 text-sm">
      {comment.spoilerTag
        ? m.chat_spoiler_reveal()
        : chatPreview(comment.text ?? "")}
    </p>
    <ChatFriendPicker bind:picked label={m.chat_forward_to()} />
  </div>

  {#snippet actions()}
    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" onclick={onclose}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={picked.length === 0 || shareMut.loading}
        onclick={() => shareMut.mutate()}>
        <Icon name="send" class="h-4 w-4" />
        {picked.length > 1
          ? m.chat_recommend_send_many({ count: picked.length })
          : m.chat_recommend_send_one()}
      </button>
    </div>
  {/snippet}
</Modal>
