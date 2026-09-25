import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeSocket, ioMock, tryRefreshMock, authMock } = vi.hoisted(() => {
  const fakeSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };
  return {
    fakeSocket,
    ioMock: vi.fn(() => fakeSocket),
    tryRefreshMock: vi.fn(),
    authMock: { clear: vi.fn() },
  };
});

vi.mock("socket.io-client", () => ({ io: ioMock }));
vi.mock("$lib/api/core", () => ({
  API_URL: "http://localhost:3000/api",
  tryRefresh: tryRefreshMock,
}));
vi.mock("$lib/auth.svelte", () => ({ auth: authMock }));

describe("realtime socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connectRealtimeSocket only connects an idle socket", async () => {
    const { connectRealtimeSocket } = await import("./socket");

    fakeSocket.connected = false;
    connectRealtimeSocket();
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);

    fakeSocket.connected = true;
    connectRealtimeSocket();
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
  });

  it("onRealtimeEvent subscribes and its cleanup unsubscribes the same handler", async () => {
    const { onRealtimeEvent } = await import("./socket");
    const handler = vi.fn();

    const off = onRealtimeEvent("notification", handler);
    expect(fakeSocket.on).toHaveBeenCalledWith("notification", handler);

    off();
    expect(fakeSocket.off).toHaveBeenCalledWith("notification", handler);
  });

  it("joinRealtimeRoom joins immediately and re-joins on every reconnect", async () => {
    const { joinRealtimeRoom } = await import("./socket");

    const leave = joinRealtimeRoom("join-list", "leave-list", "l1");
    expect(fakeSocket.emit).toHaveBeenCalledWith("join-list", "l1");
    expect(fakeSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));

    // Simulate the reconnect socket.io itself would fire.
    const reconnectHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === "connect",
    )?.[1] as () => void;
    reconnectHandler();
    expect(fakeSocket.emit).toHaveBeenCalledWith("join-list", "l1");
    expect(fakeSocket.emit).toHaveBeenCalledTimes(2);

    fakeSocket.connected = true;
    leave();
    expect(fakeSocket.off).toHaveBeenCalledWith("connect", reconnectHandler);
    expect(fakeSocket.emit).toHaveBeenCalledWith("leave-list", "l1");
  });

  it("joinRealtimeRoom's leave skips the leave-event emit when already disconnected", async () => {
    const { joinRealtimeRoom } = await import("./socket");

    fakeSocket.connected = false;
    const leave = joinRealtimeRoom("join-comments", "leave-comments", {
      targetType: "MEDIA",
      targetId: "m1",
    });
    leave();

    expect(fakeSocket.emit).not.toHaveBeenCalledWith(
      "leave-comments",
      expect.anything(),
    );
  });

  it("does nothing on our own disconnect (logout) — no refresh, no reconnect", async () => {
    vi.resetModules();
    await import("./socket");
    const disconnectHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1] as (reason: string) => void;

    disconnectHandler("io client disconnect");

    expect(tryRefreshMock).not.toHaveBeenCalled();
  });

  it("refreshes and reconnects on an unexpected disconnect (e.g. token expiry) once the refresh succeeds", async () => {
    // socket.io does NOT auto-reconnect after a server-initiated disconnect —
    // this reconnect() call is the only thing that brings the tab back.
    tryRefreshMock.mockResolvedValue(true);
    vi.resetModules();
    await import("./socket");
    const disconnectHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1] as (reason: string) => void;
    fakeSocket.connected = false;

    disconnectHandler("io server disconnect");
    await new Promise((r) => setTimeout(r, 0));

    expect(tryRefreshMock).toHaveBeenCalledTimes(1);
    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
    expect(authMock.clear).not.toHaveBeenCalled();
  });

  it("logs out instead of retrying forever when the refresh token is also dead", async () => {
    tryRefreshMock.mockResolvedValue(false);
    vi.resetModules();
    await import("./socket");
    const disconnectHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1] as (reason: string) => void;

    disconnectHandler("io server disconnect");
    await new Promise((r) => setTimeout(r, 0));

    expect(authMock.clear).toHaveBeenCalledTimes(1);
    expect(fakeSocket.connect).not.toHaveBeenCalled();
  });
});
