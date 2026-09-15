import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeSocket, ioMock } = vi.hoisted(() => {
  const fakeSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };
  return { fakeSocket, ioMock: vi.fn(() => fakeSocket) };
});

vi.mock("socket.io-client", () => ({ io: ioMock }));

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
});
