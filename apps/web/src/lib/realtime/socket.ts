import { API_URL, tryRefresh } from "$lib/api/core";
import type { RealtimeEvent } from "@loomkeep/shared";
import { io } from "socket.io-client";

// The gateway rides socket.io's own default path (/socket.io), a sibling of
// the `api` HTTP prefix rather than under it — see EventsGateway's class
// comment and the Caddyfile's dedicated `handle /socket.io/*` block.
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

/**
 * One socket for the whole app, created once at module load but not
 * connected until connectRealtimeSocket() is called (root layout, once the
 * user is authenticated) — so any component can register a listener via
 * `socket.on(...)` at any time without caring whether the connection exists
 * yet, the same way an unopened EventSource would just queue nothing.
 */
export const socket = io(API_ORIGIN, {
  withCredentials: true,
  autoConnect: false,
  // @nestjs/platform-fastify's raw http.Server doesn't complete engine.io's
  // polling→websocket upgrade handshake (the browser reports "WebSocket is
  // closed before the connection is established", confirmed independently
  // with curl: upgrading an existing polling session hangs after the 101,
  // while a fresh websocket-only connection works immediately) — so this
  // connects as websocket from the very first request instead of probing
  // through polling first.
  transports: ["websocket"],
});

export function connectRealtimeSocket(): void {
  if (!socket.connected) socket.connect();
}

export function disconnectRealtimeSocket(): void {
  socket.disconnect();
}

// EventsGateway force-disconnects a socket once its connecting access token's
// own expiry is reached (~15 min) — unlike a REST call, there's no 401 to
// react to, so nothing would otherwise refresh the cookie before socket.io's
// own auto-reconnect retries with the same, now-expired one. "io client
// disconnect" is skipped: that's disconnectRealtimeSocket() itself (logout),
// where refreshing the very session being torn down would be wrong.
socket.on("disconnect", (reason) => {
  if (reason !== "io client disconnect") void tryRefresh();
});

export function onRealtimeEvent<T = void>(
  event: RealtimeEvent,
  handler: (payload: T) => void,
): () => void {
  socket.on(event, handler);

  return () => {
    socket.off(event, handler);
  };
}

/**
 * Joins a shared-resource room (a list, a comment thread) and keeps it joined
 * across reconnects — socket.io drops room membership on every disconnect,
 * so a component that only joined once at mount would go silent after a
 * dropped connection without this. Returns the cleanup: leaves the room and
 * stops re-joining, for the component's own effect teardown.
 */
export function joinRealtimeRoom(
  joinEvent: "join-list" | "join-comments",
  leaveEvent: "leave-list" | "leave-comments",
  payload: unknown,
): () => void {
  const join = () => socket.emit(joinEvent, payload);
  join();
  socket.on("connect", join);

  return () => {
    socket.off("connect", join);
    if (socket.connected) socket.emit(leaveEvent, payload);
  };
}
