<script lang="ts">
  import { page } from "$app/state";
  import ChatFullscreen from "#lib/components/chat/ChatFullscreen.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{`${m.chat_title()} · ${m.common_loomkeep()}`}</title>
</svelte:head>

<ChatFullscreen conversationId={page.params.id ?? null} />
