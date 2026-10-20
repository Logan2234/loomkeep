// Both read through ConfigService at module init, so set before the app is
// built: Messages' "Œuvres" tab only exists with social and chat on.
process.env.SOCIAL_ENABLED = "true";
process.env.CHAT_ENABLED = "true";

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { REPORT_THROTTLE } from "../src/common/throttle.constants";
import { PrismaService } from "../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * A work's discussion as Messages' "Œuvres" tab counts it: what someone else
 * wrote after the member's last word is unread until they open it. The
 * counting is one SQL query over comments, mentions and read positions —
 * nothing a mocked Prisma could check.
 */
const COMMENT_COOLDOWN_MS = REPORT_THROTTLE.default.ttl + 100;

describe("Work threads (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;

  const alice = e2eUser("e2e-threads-alice");
  const bob = e2eUser("e2e-threads-bob");
  const session: Record<string, string> = {};
  let mediaItemId: string;

  async function signUpAndTrack(user: ReturnType<typeof e2eUser>, key: string) {
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    session[key] = authCookies(registered);

    const entry = await request(http)
      .put("/api/library")
      .set("Cookie", session[key])
      .send({
        source: "ANILIST",
        sourceId: "4242",
        type: "ANIME",
        status: "WATCHING",
      })
      .expect(200);
    mediaItemId = entry.body.mediaItem.id;
  }

  function comment(key: string, text: string) {
    return request(http)
      .post("/api/comments")
      .set("Cookie", session[key])
      .send({ targetType: "MEDIA", targetId: mediaItemId, text })
      .expect(201);
  }

  function unread(key: string) {
    return request(http)
      .get("/api/chat/unread")
      .set("Cookie", session[key])
      .expect(200)
      .then((res) => res.body.works as number);
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    await signUpAndTrack(alice, "alice");
    await signUpAndTrack(bob, "bob");
    // A new account turns its domains on in onboarding; the list only keeps
    // the discussions of a domain that's on.
    await prisma.user.updateMany({ data: { enabledDomains: ["MEDIA"] } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists a discussion its member wrote in, with nothing unread yet", async () => {
    await comment("alice", "Le premier épisode est superbe.");

    const res = await request(http)
      .get("/api/chat/works")
      .set("Cookie", session.alice)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      targetType: "MEDIA",
      targetId: mediaItemId,
      title: "Test Anime",
      unread: 0,
      canParticipate: true,
      lastComment: { mine: true, text: "Le premier épisode est superbe." },
    });
    expect(await unread("alice")).toBe(0);
  });

  it("does not list it for someone who never took part", async () => {
    const res = await request(http)
      .get("/api/chat/works")
      .set("Cookie", session.bob)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("counts what someone else wrote after the member's last word", async () => {
    // Posting is throttled to one comment per 5 s, tracked by IP — and every
    // account here shares the test runner's.
    await new Promise((resolve) => setTimeout(resolve, COMMENT_COOLDOWN_MS));
    await comment("bob", "D'accord, la fin est folle.");

    expect(await unread("alice")).toBe(1);
    // Writing reads the discussion for its author.
    expect(await unread("bob")).toBe(0);
  });

  it("clears the count once the member opens the discussion", async () => {
    await request(http)
      .post(`/api/chat/works/MEDIA/${mediaItemId}/read`)
      .set("Cookie", session.alice)
      .expect(201);

    expect(await unread("alice")).toBe(0);
  });

  it("keeps a muted discussion's unread on it, but out of the total", async () => {
    await request(http)
      .put(`/api/chat/works/MEDIA/${mediaItemId}/mute`)
      .set("Cookie", session.alice)
      .send({ muted: true })
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, COMMENT_COOLDOWN_MS));
    await comment("bob", "Vivement la suite.");

    const res = await request(http)
      .get("/api/chat/works")
      .set("Cookie", session.alice)
      .expect(200);
    expect(res.body[0]).toMatchObject({ unread: 1, muted: true });
    expect(await unread("alice")).toBe(0);
  });

  it("reads a discussion again from a comment marked unread", async () => {
    const list = await request(http)
      .get(`/api/comments/MEDIA/${mediaItemId}`)
      .set("Cookie", session.alice)
      .expect(200);
    const latest = list.body.items[0];

    await request(http)
      .post(`/api/chat/works/MEDIA/${mediaItemId}/unread`)
      .set("Cookie", session.alice)
      .send({ commentId: latest.id })
      .expect(201);

    const res = await request(http)
      .get(`/api/chat/works/MEDIA/${mediaItemId}`)
      .set("Cookie", session.alice)
      .expect(200);
    expect(Date.parse(res.body.lastReadAt)).toBe(
      Date.parse(latest.createdAt) - 1,
    );
  });

  it("leaves out the discussions of a domain turned off", async () => {
    await prisma.user.updateMany({
      where: { email: alice.email },
      data: { enabledDomains: ["BOOKS"] },
    });

    const res = await request(http)
      .get("/api/chat/works")
      .set("Cookie", session.alice)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("opens a discussion its member never took part in, from the work's page", async () => {
    const res = await request(http)
      .get(`/api/chat/works/MEDIA/${mediaItemId}`)
      .set("Cookie", session.bob)
      .expect(200);
    expect(res.body).toMatchObject({ title: "Test Anime", unread: 0 });
  });

  it("refuses an unknown kind of target", () => {
    return request(http)
      .get(`/api/chat/works/PLANET/${mediaItemId}`)
      .set("Cookie", session.alice)
      .expect(400);
  });
});
