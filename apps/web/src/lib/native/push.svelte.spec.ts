import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto } from "#lib/test/navigation.svelte.js";
import { AlertGroup } from "@loomkeep/shared";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableNativePush,
  enableNativePush,
  isNativePushEnabledHere,
  notificationTarget,
  startNativePush,
} from "./push";

type Listener = (event: unknown) => unknown;

const { plugin, emit } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(event: unknown) => unknown>>();

  const emit = async (event: string, data: unknown) => {
    await Promise.all([...(listeners.get(event) ?? [])].map((l) => l(data)));
  };

  const plugin = {
    permission: "granted",
    token: "fcm-token-1",
    requestPermissions: vi.fn(() =>
      Promise.resolve({ receive: plugin.permission }),
    ),
    checkPermissions: vi.fn(() =>
      Promise.resolve({ receive: plugin.permission }),
    ),
    register: vi.fn(() => {
      void emit("registration", { value: plugin.token });
      return Promise.resolve();
    }),
    unregister: vi.fn(() => Promise.resolve()),
    createChannel: vi.fn((_channel: { id: string }) => Promise.resolve()),
    addListener: vi.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return Promise.resolve({
        remove: () => {
          listeners.get(event)!.delete(listener);
          return Promise.resolve();
        },
      });
    }),
  };
  return { plugin, emit };
});
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: plugin,
}));
const { native } = vi.hoisted(() => ({
  native: { plugins: new Set<string>() },
}));
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capacitor/core")>()),
  Capacitor: { isPluginAvailable: (name: string) => native.plugins.has(name) },
}));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

/** Records each native-push call the API receives. */
function recordApi() {
  const calls: { method: string; token: string; actions?: boolean }[] = [];

  const record = async ({ request }: { request: Request }) => {
    const { token, actions } = (await request.json()) as {
      token: string;
      actions?: boolean;
    };
    calls.push({ method: request.method, token, actions });
    return new HttpResponse(null, { status: 204 });
  };

  server.use(
    http.post(apiUrl("/notifications/push/native"), record),
    http.delete(apiUrl("/notifications/push/native"), record),
  );
  return calls;
}

afterEach(() => {
  localStorage.clear();
  native.plugins.clear();
  plugin.permission = "granted";
  plugin.token = "fcm-token-1";
  vi.clearAllMocks();
});

describe("native push", () => {
  it("registers this install's FCM token with the API once Android allows it", async () => {
    const calls = recordApi();

    await expect(enableNativePush()).resolves.toBe(true);

    expect(calls).toEqual([
      { method: "POST", token: "fcm-token-1", actions: false },
    ]);
    await expect(isNativePushEnabledHere()).resolves.toBe(true);
  });

  it("tells the API when the APK draws its notifications, with buttons", async () => {
    native.plugins.add("NotificationActions");
    const calls = recordApi();

    await enableNativePush();

    expect(calls).toEqual([
      { method: "POST", token: "fcm-token-1", actions: true },
    ]);
  });

  it("says it again at each start, once push is on here", async () => {
    const calls = recordApi();
    await enableNativePush();
    native.plugins.add("NotificationActions");

    const stop = startNativePush();

    await vi.waitFor(() =>
      expect(calls.at(-1)).toEqual({
        method: "POST",
        token: "fcm-token-1",
        actions: true,
      }),
    );
    stop();
  });

  it("stops at a refused permission, before asking FCM or the API", async () => {
    plugin.permission = "denied";

    await expect(enableNativePush()).resolves.toBe(false);

    expect(plugin.register).not.toHaveBeenCalled();
    await expect(isNativePushEnabledHere()).resolves.toBe(false);
  });

  it("forgets the token on the API and in FCM when switched off", async () => {
    const calls = recordApi();
    await enableNativePush();

    await disableNativePush();

    expect(calls.at(-1)).toEqual({ method: "DELETE", token: "fcm-token-1" });
    expect(plugin.unregister).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEYS.nativePushToken)).toBeNull();
  });

  it("swaps a token FCM rotated, while push is on here", async () => {
    const calls = recordApi();
    await enableNativePush();
    const stop = startNativePush();

    await emit("registration", { value: "fcm-token-2" });

    expect(calls.slice(2)).toEqual([
      { method: "POST", token: "fcm-token-2", actions: false },
      { method: "DELETE", token: "fcm-token-1" },
    ]);
    expect(localStorage.getItem(STORAGE_KEYS.nativePushToken)).toBe(
      "fcm-token-2",
    );
    stop();
  });

  it("opens the notification's page when it's tapped, marking its bell entry read", async () => {
    const stop = startNativePush();

    await emit("pushNotificationActionPerformed", {
      actionId: "tap",
      notification: { data: { url: "/app/media/tv/1", notificationId: "n1" } },
    });

    expect(goto).toHaveBeenCalledWith("/app/media/tv/1?notification=n1");
    stop();
  });

  it("files notifications under one Android channel per alert group", () => {
    const stop = startNativePush();

    expect(
      plugin.createChannel.mock.calls.map(([channel]) => channel.id).sort(),
    ).toEqual(Object.values(AlertGroup).sort());
    stop();
  });
});

describe("notificationTarget", () => {
  it("keeps the page's own query and hash", () => {
    expect(
      notificationTarget({
        url: "/app?messages=cv1#end",
        notificationId: "n2",
      }),
    ).toBe("/app?messages=cv1&notification=n2#end");
    expect(notificationTarget({ url: "/app/calendar" })).toBe("/app/calendar");
    expect(notificationTarget({})).toBe("/app");
  });
});
