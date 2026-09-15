<script lang="ts">
  // Invisible, mounted once in the root layout alongside NotificationBell/
  // WidgetIdentify — owns the WebSocket connection's lifecycle so no single
  // feature component has to. On every `connect` (the initial one, and every
  // reconnect after a dropped connection or a server redeploy) the
  // per-user/global feeds are invalidated to catch up on whatever was missed
  // while offline; NotificationBell, reports-pending etc. only need to listen
  // for their own live event from then on.
  import { keys } from "$lib/api/keys";
  import { auth } from "$lib/auth.svelte";
  import {
    connectRealtimeSocket,
    disconnectRealtimeSocket,
    socket,
  } from "$lib/realtime/socket";
  import { useQueryClient } from "@tanstack/svelte-query";

  const queryClient = useQueryClient();

  $effect(() => {
    if (!auth.isLoggedIn) return;

    connectRealtimeSocket();

    const catchUp = () => {
      void queryClient.invalidateQueries({
        queryKey: keys.notifications.feed(),
      });
      void queryClient.invalidateQueries({
        queryKey: keys.gamification.pending(),
      });
      if (auth.isAdmin) {
        void queryClient.invalidateQueries({
          queryKey: keys.admin.reportsPendingCount(),
        });
      }
    };
    socket.on("connect", catchUp);

    return () => {
      socket.off("connect", catchUp);
      disconnectRealtimeSocket();
    };
  });
</script>
