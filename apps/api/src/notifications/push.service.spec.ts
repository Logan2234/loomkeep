import { AlertGroup, ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import webpush from "web-push";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";
import { FcmClient } from "./fcm.client";
import { NotificationAction, verifyAction } from "./notification-action";
import { PushService } from "./push.service";

// web-push validates the VAPID key's byte length at setVapidDetails() time —
// a throwaway keypair is needed to exercise the `enabled` branch at all.
const VAPID_KEYS = webpush.generateVAPIDKeys();

const ALLOWED_ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const SSRF_ENDPOINT = "http://db:5432/";

function makeService(
  overrides: {
    existingSubscription?: { userId: string } | null;
  } = {},
) {
  const prisma = {
    pushSubscription: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides.existingSubscription ?? null),
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    },
  } as unknown as PrismaService;

  const service = new PushService(prisma);
  return { service, prisma };
}

describe("PushService.subscribe", () => {
  it("accepts a fresh endpoint for the requesting user", async () => {
    const { service, prisma } = makeService({ existingSubscription: null });

    await service.subscribe("u1", ALLOWED_ENDPOINT, "p256dh", "auth");

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: ALLOWED_ENDPOINT },
      update: {
        userId: "u1",
        p256dh: "p256dh",
        auth: "auth",
        userAgent: undefined,
      },
      create: {
        userId: "u1",
        endpoint: ALLOWED_ENDPOINT,
        p256dh: "p256dh",
        auth: "auth",
        userAgent: undefined,
      },
    });
  });

  it("re-subscribing the same user to their own endpoint is a no-op update", async () => {
    const { service, prisma } = makeService({
      existingSubscription: { userId: "u1" },
    });

    await service.subscribe("u1", ALLOWED_ENDPOINT, "p256dh", "auth");

    expect(prisma.pushSubscription.upsert).toHaveBeenCalled();
  });

  // The endpoint is the unique key, so without this check whoever
  // learns another user's endpoint could silently reassign it to their own
  // account, cutting off the original owner's notifications.
  it("rejects reassigning an endpoint already owned by another user", async () => {
    const { service, prisma } = makeService({
      existingSubscription: { userId: "someone-else" },
    });

    await expect(
      service.subscribe("u1", ALLOWED_ENDPOINT, "p256dh", "auth"),
    ).rejects.toMatchObject({
      code: ErrorCode.NotificationPushEndpointTaken,
    } satisfies Partial<AppException>);

    expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });
});

describe("PushService.sendToUserDetailed", () => {
  it("drops a pre-existing subscription whose endpoint isn't an allowed push host", async () => {
    process.env.VAPID_PUBLIC_KEY = VAPID_KEYS.publicKey;
    process.env.VAPID_PRIVATE_KEY = VAPID_KEYS.privateKey;
    process.env.VAPID_SUBJECT = "mailto:admin@example.com";

    const prisma = {
      pushSubscription: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sub1",
            endpoint: SSRF_ENDPOINT,
            p256dh: "p",
            auth: "a",
            userAgent: "Chrome",
          },
        ]),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new PushService(prisma);
    const outcomes = await service.sendToUserDetailed("u1", {
      title: "t",
      body: "b",
      url: "/",
      group: AlertGroup.ACTIVITY,
    });

    expect(outcomes).toEqual([
      expect.objectContaining({ ok: false, userAgent: "Chrome" }),
    ]);
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: "sub1" },
    });

    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });
});

describe("PushService app badge", () => {
  it("sends the app icon's badge count along with the push", async () => {
    process.env.VAPID_PUBLIC_KEY = VAPID_KEYS.publicKey;
    process.env.VAPID_PRIVATE_KEY = VAPID_KEYS.privateKey;
    process.env.VAPID_SUBJECT = "mailto:admin@example.com";
    const send = vi
      .spyOn(webpush, "sendNotification")
      .mockResolvedValue({} as never);
    const prisma = {
      pushSubscription: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sub1",
            endpoint: ALLOWED_ENDPOINT,
            p256dh: "p",
            auth: "a",
            userAgent: "Chrome",
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new PushService(prisma);
    service.setBadgeSource((userId) =>
      Promise.resolve(userId === "u1" ? 4 : 0),
    );

    await service.sendToUser("u1", {
      title: "t",
      body: "b",
      url: "/app",
      group: AlertGroup.ACTIVITY,
    });

    expect(JSON.parse(send.mock.calls[0][1] as string)).toEqual({
      title: "t",
      body: "b",
      url: "/app",
      group: AlertGroup.ACTIVITY,
      badge: 4,
    });

    send.mockRestore();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });
});

describe("PushService VAPID subject", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = VAPID_KEYS.publicKey;
    process.env.VAPID_PRIVATE_KEY = VAPID_KEYS.privateKey;
    delete process.env.VAPID_SUBJECT;
  });

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("falls back to the instance's own address, never a hardcoded one", () => {
    process.env.WEB_ORIGIN =
      "https://tracker.example.org,https://other.example.org";
    const setVapidDetails = vi.spyOn(webpush, "setVapidDetails");

    const { service } = makeService();

    expect(setVapidDetails).toHaveBeenCalledWith(
      "https://tracker.example.org",
      VAPID_KEYS.publicKey,
      VAPID_KEYS.privateKey,
    );
    expect(service.publicKey()).toBe(VAPID_KEYS.publicKey);
  });

  it("returns the public key validated at startup even if the environment changes", () => {
    process.env.WEB_ORIGIN = "https://tracker.example.org";
    const { service } = makeService();
    delete process.env.VAPID_PUBLIC_KEY;
    expect(service.publicKey()).toBe(VAPID_KEYS.publicKey);
  });

  it("stays off without a subject when the instance isn't on HTTPS", () => {
    process.env.WEB_ORIGIN = "http://localhost:8080";
    const setVapidDetails = vi.spyOn(webpush, "setVapidDetails");

    const { service } = makeService();

    expect(setVapidDetails).not.toHaveBeenCalled();
    expect(service.publicKey()).toBe("");
  });
});

describe("PushService on the Android app", () => {
  const TOKEN = "fcm-token-of-the-android-app";
  const SERVICE_ACCOUNT = Buffer.from(
    JSON.stringify({
      project_id: "loomkeep-test",
      client_email: "push@loomkeep-test.iam.gserviceaccount.com",
      private_key: "unused: FcmClient.send is stubbed",
    }),
  ).toString("base64");

  function makeAndroidService(fcmConfigured = true, actions = false) {
    if (fcmConfigured) process.env.FCM_SERVICE_ACCOUNT_BASE64 = SERVICE_ACCOUNT;
    else delete process.env.FCM_SERVICE_ACCOUNT_BASE64;
    const prisma = {
      pushSubscription: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "app1",
            platform: "ANDROID",
            endpoint: TOKEN,
            p256dh: null,
            auth: null,
            userAgent: "LoomkeepApp/1.11.0",
            actions,
          },
        ]),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    return { service: new PushService(prisma), prisma };
  }

  const payload = {
    title: "Severance",
    body: "S02E03 is out",
    url: "/app/media/tv/95396",
    notificationId: "n1",
    tag: "release:95396",
    group: AlertGroup.RELEASES,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FCM_SERVICE_ACCOUNT_BASE64;
  });

  it("stores the app's FCM token as an Android subscription", async () => {
    const { service, prisma } = makeAndroidService();

    await service.subscribeNative("u1", TOKEN, "LoomkeepApp/1.11.0");

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: TOKEN },
      update: { userId: "u1", userAgent: "LoomkeepApp/1.11.0", actions: false },
      create: {
        userId: "u1",
        platform: "ANDROID",
        endpoint: TOKEN,
        userAgent: "LoomkeepApp/1.11.0",
        actions: false,
      },
    });
    expect(service.nativeEnabled()).toBe(true);
  });

  it("delivers through FCM on the alert group's channel, with the page to open", async () => {
    const send = vi
      .spyOn(FcmClient.prototype, "send")
      .mockResolvedValue({ ok: true });
    const { service, prisma } = makeAndroidService();

    const outcomes = await service.sendToUserDetailed("u1", payload);

    expect(send).toHaveBeenCalledWith(TOKEN, {
      notification: { title: "Severance", body: "S02E03 is out" },
      data: { url: "/app/media/tv/95396", notificationId: "n1" },
      android: {
        priority: "HIGH",
        notification: { channel_id: "releases", tag: "release:95396" },
      },
    });
    expect(outcomes).toEqual([{ userAgent: "LoomkeepApp/1.11.0", ok: true }]);
    // A token isn't a URL: the Web Push host filter must leave it alone.
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it("sends an app that builds its own notifications the content and signed buttons as data", async () => {
    process.env.JWT_ACCESS_SECRET = "access-secret";
    const send = vi
      .spyOn(FcmClient.prototype, "send")
      .mockResolvedValue({ ok: true });
    const { service } = makeAndroidService(true, true);

    await service.sendToUserDetailed("u1", {
      ...payload,
      actions: [
        {
          action: NotificationAction.CHAT_REPLY,
          label: "Reply",
          replyHint: "Your reply",
          target: { conversationId: "c1" },
        },
      ],
    });

    const [, message] = send.mock.calls[0]!;
    expect(message.notification).toBeUndefined();
    expect(message.android).toEqual({ priority: "HIGH" });
    const { actions, ...data } = message.data;
    expect(data).toEqual({
      title: "Severance",
      body: "S02E03 is out",
      url: "/app/media/tv/95396",
      notificationId: "n1",
      channel: "releases",
      tag: "release:95396",
    });
    const [button] = JSON.parse(actions!) as {
      label: string;
      replyHint?: string;
      token: string;
    }[];
    expect(button).toMatchObject({ label: "Reply", replyHint: "Your reply" });
    expect(verifyAction(button!.token)).toMatchObject({
      action: NotificationAction.CHAT_REPLY,
      target: { conversationId: "c1" },
      subscriptionId: "app1",
      notificationId: "n1",
    });
  });

  it("forgets a token FCM says is dead", async () => {
    vi.spyOn(FcmClient.prototype, "send").mockResolvedValue({
      ok: false,
      unregistered: true,
      error: "HTTP 404 UNREGISTERED",
    });
    const { service, prisma } = makeAndroidService();

    await service.sendToUserDetailed("u1", payload);

    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: "app1" },
    });
  });

  it("keeps a token through a passing FCM failure", async () => {
    vi.spyOn(FcmClient.prototype, "send").mockRejectedValue(
      new Error("socket hang up"),
    );
    const { service, prisma } = makeAndroidService();

    const outcomes = await service.sendToUserDetailed("u1", payload);

    expect(outcomes).toEqual([
      expect.objectContaining({ ok: false, error: "Error: socket hang up" }),
    ]);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it("skips the app while FCM isn't configured", async () => {
    const send = vi.spyOn(FcmClient.prototype, "send");
    const { service } = makeAndroidService(false);

    await expect(service.sendToUserDetailed("u1", payload)).resolves.toEqual(
      [],
    );
    expect(send).not.toHaveBeenCalled();
    expect(service.nativeEnabled()).toBe(false);
  });
});
