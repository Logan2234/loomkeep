<script lang="ts">
  // Invisible, mounted once in the app layout while messages are on: keeps
  // the conversation caches in step with the socket, whichever surface
  // (panel, sheet, full-screen page) is showing them, and opens Messages
  // on a `?messages=<conversation>` link — the one a push leads to.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { keys } from "#lib/api/keys.js";
  import {
    applyToConversations,
    upsertMessage,
    type MessagePages,
  } from "#lib/chat/chat-cache.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import { onRealtimeEvent, socket } from "#lib/realtime/socket.js";
  import {
    RealtimeEvent,
    type ChatMessageEvent,
    type ChatPresenceEvent,
    type ChatReadEvent,
    type ChatTypingEvent,
    type ConversationDto,
    type MessageDto,
    type PagedResult,
  } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { auth } from "#lib/auth.svelte.js";

  const queryClient = useQueryClient();

  function onMessage({ conversationId, message }: ChatMessageEvent) {
    if (!message.mine) chat.stopTyping(conversationId);

    queryClient.setQueryData<MessagePages>(
      keys.chat.messages(conversationId),
      (data) => upsertMessage(data, message),
    );

    const list = queryClient.getQueryData<PagedResult<ConversationDto>>(
      keys.chat.conversations(),
    );
    const next = applyToConversations(
      list,
      message,
      chat.onScreen(conversationId),
    );

    if (next === null) {
      void queryClient.invalidateQueries({
        queryKey: keys.chat.conversations(),
      });
    } else {
      queryClient.setQueryData(keys.chat.conversations(), next);
    }

    if (!message.mine) {
      void queryClient.invalidateQueries({ queryKey: keys.chat.unread() });
    }

    // Pinned or unpinned by either member, or deleted while pinned.
    if (
      message.pinned ||
      message.deleted ||
      queryClient
        .getQueryData<MessageDto[]>(keys.chat.pins(conversationId))
        ?.some((pin) => pin.id === message.id)
    ) {
      void queryClient.invalidateQueries({
        queryKey: keys.chat.pins(conversationId),
      });
    }
  }

  function onRead({ conversationId, userId, lastReadAt }: ChatReadEvent) {
    const patch = (c: ConversationDto): ConversationDto =>
      userId === auth.user?.id
        ? { ...c, unread: 0 }
        : { ...c, peerLastReadAt: lastReadAt };

    queryClient.setQueryData<PagedResult<ConversationDto>>(
      keys.chat.conversations(),
      (list) =>
        list && {
          ...list,
          items: list.items.map((c) =>
            c.id === conversationId ? patch(c) : c,
          ),
        },
    );
    queryClient.setQueryData<ConversationDto>(
      keys.chat.conversation(conversationId),
      (c) => c && patch(c),
    );

    if (userId === auth.user?.id) {
      void queryClient.invalidateQueries({ queryKey: keys.chat.unread() });
    }
  }

  function onTyping({ conversationId }: ChatTypingEvent) {
    chat.markTyping(conversationId);
  }

  function onPresence({ userId, online }: ChatPresenceEvent) {
    chat.presence = { ...chat.presence, [userId]: online };
  }

  $effect(() => {
    const offs = [
      onRealtimeEvent<ChatMessageEvent>(RealtimeEvent.CHAT_MESSAGE, onMessage),
      onRealtimeEvent<ChatReadEvent>(RealtimeEvent.CHAT_READ, onRead),
      onRealtimeEvent<ChatTypingEvent>(RealtimeEvent.CHAT_TYPING, onTyping),
      onRealtimeEvent<ChatPresenceEvent>(
        RealtimeEvent.CHAT_PRESENCE,
        onPresence,
      ),
    ];
    // Whatever was said while the connection was down.
    const catchUp = () => {
      chat.presence = {};
      void queryClient.invalidateQueries({ queryKey: keys.chat.all() });
    };
    socket.on("connect", catchUp);

    return () => {
      for (const off of offs) off();
      socket.off("connect", catchUp);
    };
  });

  $effect(() => {
    const conversationId = page.url.searchParams.get("messages");
    if (!conversationId) return;

    chat.show(conversationId);
    const url = new URL(page.url.href);
    url.searchParams.delete("messages");
    void goto(url, { replace: true, shallow: true });
  });
</script>
