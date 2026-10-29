// SOCIAL_ENABLED is read at module init: follows 404 without it.
process.env.SOCIAL_ENABLED = "true";

import { ProfileAccess } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import {
  NotificationAction,
  signAction,
} from "../src/notifications/notification-action";
import { authCookies, createE2eApp, type E2eApp, e2eUser } from "./e2e-app";

/**
 * A button on an Android notification (MOB-17): no session, only the token
 * the push carried, valid while the device's subscription exists.
 */
describe("Notification actions (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: E2eApp["prisma"];

  const fan = e2eUser("e2e-action-fan");
  const star = e2eUser("e2e-action-star");
  const session: Record<string, string> = {};
  const username: Record<string, string> = {};
  const FCM_TOKEN = "e2e-fcm-token:APA91bNotificationActionsDevice";

  async function signUp(user: ReturnType<typeof e2eUser>, key: string) {
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    session[key] = authCookies(registered);
    const me = await request(http)
      .get("/api/users/me")
      .set("Cookie", session[key])
      .expect(200);
    username[key] = me.body.username;
  }

  const act = (token: string) =>
    request(http).post("/api/notifications/actions").send({ token });

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    await signUp(fan, "fan");
    await signUp(star, "star");
    // The star stays private (the default): following her is a request.
    await request(http)
      .patch("/api/social/me/privacy")
      .set("Cookie", session.fan)
      .send({ profileAccess: ProfileAccess.PUBLIC })
      .expect(200);
    await request(http)
      .post("/api/notifications/push/native")
      .set("Cookie", session.star)
      .send({ token: FCM_TOKEN, actions: true })
      .expect(204);
  });

  afterAll(async () => {
    await app.close();
  });

  async function starDevice(): Promise<string> {
    const device = await prisma.pushSubscription.findUniqueOrThrow({
      where: { endpoint: FCM_TOKEN },
    });
    expect(device.actions).toBe(true);
    return device.id;
  }

  it("accepts a follow request from the notification's button", async () => {
    await request(http)
      .post(`/api/social/users/${username.star}/follow`)
      .set("Cookie", session.fan)
      .expect(201);
    const requests = await request(http)
      .get("/api/social/requests")
      .set("Cookie", session.star)
      .expect(200);
    const followId: string = requests.body.find(
      (r: { user: { username: string } }) => r.user.username === username.fan,
    ).id;

    const token = signAction({
      action: NotificationAction.FOLLOW_ACCEPT,
      target: { followId },
      subscriptionId: await starDevice(),
    });
    await act(token).expect(204);

    const profile = await request(http)
      .get(`/api/social/users/${username.star}`)
      .set("Cookie", session.fan)
      .expect(200);
    expect(profile.body.relationship).toMatchObject({ following: true });
  });

  it("lets an admin sample's button through without doing anything", async () => {
    const token = signAction({
      action: NotificationAction.TEST,
      target: {},
      subscriptionId: await starDevice(),
    });

    await act(token).expect(204);
  });

  it("refuses a token whose claims were changed", async () => {
    const token = signAction({
      action: NotificationAction.FOLLOW_BACK,
      target: { username: username.fan },
      subscriptionId: await starDevice(),
    });
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(
      Buffer.from(payload!, "base64url")
        .toString()
        .replace(username.fan!, username.star!),
    ).toString("base64url");

    await act(`${forged}.${sig}`).expect(404);
  });

  it("stops honoring a device's tokens once it unsubscribes", async () => {
    const token = signAction({
      action: NotificationAction.FOLLOW_BACK,
      target: { username: username.fan },
      subscriptionId: await starDevice(),
    });
    await request(http)
      .delete("/api/notifications/push/native")
      .set("Cookie", session.star)
      .send({ token: FCM_TOKEN })
      .expect(204);

    await act(token).expect(404);
  });
});
