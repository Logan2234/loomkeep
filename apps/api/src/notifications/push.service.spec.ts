import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import webpush from "web-push";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";
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
