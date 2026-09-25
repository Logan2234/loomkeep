// SOCIAL_ENABLED is read through ConfigService at module init, so it has to be
// set before the app is built. The whole surface 404s without it (never 403 —
// a self-host install must not advertise that the feature exists).
process.env.SOCIAL_ENABLED = "true";

import { ProfileAccess } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * Follows, requests and blocks between three accounts.
 *
 * `Follow` is the single relationship primitive — a friend is a reciprocal
 * accepted follow — and every cross-user read resolves through
 * VisibilityService. Both are logic no single-user test can reach, which is
 * why this needs three sessions in one run.
 */
describe("Social (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  const alice = e2eUser("e2e-alice");
  const bob = e2eUser("e2e-bob");
  const carol = e2eUser("e2e-carol");

  const session: Record<string, string> = {};
  const username: Record<string, string> = {};

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

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());
    await signUp(alice, "alice");
    await signUp(bob, "bob");
    await signUp(carol, "carol");

    // PRIVATE is the schema default, so the public cases are the ones that
    // need saying out loud. Carol stays private: her followers need approving.
    for (const key of ["alice", "bob"]) {
      await request(http)
        .patch("/api/social/me/privacy")
        .set("Cookie", session[key])
        .send({ profileAccess: ProfileAccess.PUBLIC })
        .expect(200);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a follow of a public profile immediately", async () => {
    const res = await request(http)
      .post(`/api/social/users/${username.bob}/follow`)
      .set("Cookie", session.alice)
      .expect(201);

    expect(res.body).toMatchObject({ following: true, requested: false });
  });

  it("shows up on both sides of the relationship", async () => {
    const followers = await request(http)
      .get(`/api/social/users/${username.bob}/followers`)
      .set("Cookie", session.bob)
      .expect(200);
    expect(
      followers.body.map((u: { username: string }) => u.username),
    ).toContain(username.alice);

    const following = await request(http)
      .get(`/api/social/users/${username.alice}/following`)
      .set("Cookie", session.alice)
      .expect(200);
    expect(
      following.body.map((u: { username: string }) => u.username),
    ).toContain(username.bob);
  });

  it("does not make a one-way follow a friendship on a public profile", async () => {
    // Following a public profile is frictionless, so mere followers are not
    // friends — only a mutual accepted follow is.
    const res = await request(http)
      .get(`/api/social/users/${username.bob}`)
      .set("Cookie", session.alice)
      .expect(200);

    expect(res.body.relationship).toMatchObject({
      following: true,
      followsYou: false,
      isFriend: false,
    });
  });

  it("becomes a friendship once the follow is reciprocated", async () => {
    await request(http)
      .post(`/api/social/users/${username.alice}/follow`)
      .set("Cookie", session.bob)
      .expect(201);

    const res = await request(http)
      .get(`/api/social/users/${username.bob}`)
      .set("Cookie", session.alice)
      .expect(200);
    expect(res.body.relationship).toMatchObject({
      following: true,
      followsYou: true,
      isFriend: true,
    });
  });

  it("only requests a follow on a private profile", async () => {
    const res = await request(http)
      .post(`/api/social/users/${username.carol}/follow`)
      .set("Cookie", session.alice)
      .expect(201);

    expect(res.body).toMatchObject({ following: false, requested: true });
  });

  it("lets the private account approve the request", async () => {
    const pending = await request(http)
      .get("/api/social/requests")
      .set("Cookie", session.carol)
      .expect(200);
    const req = pending.body.find(
      (r: { user: { username: string } }) => r.user.username === username.alice,
    );
    expect(req).toBeTruthy();

    await request(http)
      .post(`/api/social/requests/${req.id}/accept`)
      .set("Cookie", session.carol)
      .expect(201);

    const res = await request(http)
      .get(`/api/social/users/${username.carol}`)
      .set("Cookie", session.alice)
      .expect(200);
    // On a private profile an accepted follow is friend-level on its own: the
    // owner approved it.
    expect(res.body.relationship).toMatchObject({
      following: true,
      isFriend: true,
    });
  });

  it("collapses the relationship when one side blocks the other", async () => {
    await request(http)
      .post(`/api/social/users/${username.alice}/block`)
      .set("Cookie", session.bob)
      .expect(201);

    const res = await request(http)
      .get(`/api/social/users/${username.bob}`)
      .set("Cookie", session.alice);

    // Either the profile is hidden outright, or it is returned with the
    // relationship wiped — what must never happen is Alice still counting as
    // Bob's friend.
    if (res.status === 200) {
      expect(res.body.relationship).toMatchObject({
        following: false,
        followsYou: false,
        isFriend: false,
      });
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("lets a follow be undone", async () => {
    await request(http)
      .delete(`/api/social/users/${username.carol}/follow`)
      .set("Cookie", session.alice)
      .expect(200);

    const res = await request(http)
      .get(`/api/social/users/${username.carol}`)
      .set("Cookie", session.alice)
      .expect(200);
    expect(res.body.relationship).toMatchObject({
      following: false,
      isFriend: false,
    });
  });
});
