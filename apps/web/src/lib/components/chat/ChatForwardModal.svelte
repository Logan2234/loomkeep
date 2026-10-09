<script lang="ts">
  // "Transférer": a copy of the message to each friend picked, in their own
  // conversation, marked forwarded.
  import { forwardMessage } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chatPreview } from "#lib/chat/chat-markdown.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import type { ConversationDto, MessageDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import ChatFriendPicker from "./ChatFriendPicker.svelte";

  let {
    message,
    onclose,
  }: {
    message: MessageDto;
    onclose: () => void;
  } = $props();

  let picked = $state<string[]>([]);

  // The conversation it comes from: it isn't forwarded back there.
  const origin = useQueryClient().getQueryData<ConversationDto>(
    keys.chat.conversation(message.conversationId),
  )?.peer?.username;

  const preview = $derived(
    message.spoiler
      ? m.chat_spoiler_reveal()
      : message.text
        ? chatPreview(message.text)
        : message.works.map((work) => work.title).join(", "),
  );

  const forwardMut = createApiMutation(() => ({
    mutate: () => forwardMessage(message.id, { usernames: picked }),
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

<Modal title={m.chat_forward()} {onclose}>
  <div class="flex flex-col gap-4">
    <p class="bg-surface-2 text-dim line-clamp-3 rounded-xl px-3 py-2 text-sm">
      {preview}
    </p>
    <ChatFriendPicker
      bind:picked
      label={m.chat_forward_to()}
      exclude={origin ? [origin] : []} />
  </div>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onclose}>
      {m.common_cancel()}
    </button>
    <button
      type="button"
      class="btn btn-primary"
      disabled={picked.length === 0 || forwardMut.loading}
      onclick={() => forwardMut.mutate()}>
      <Icon name="forward" class="h-4 w-4" />
      {picked.length > 1
        ? m.chat_forward_to_many({ count: picked.length })
        : m.chat_forward()}
    </button>
  {/snippet}
</Modal>
