import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * The work search reads the instance's own works in SQL — accent folding,
 * the viewer's status, how many accounts track one — before it mixes in the
 * (stubbed) catalogues: nothing a mocked Prisma could check.
 */
describe("Work search (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;

  const alice = e2eUser("e2e-search-alice");
  const bob = e2eUser("e2e-search-bob");
  const session: Record<string, string> = {};
  let aliceStatus: string;

  async function signUp(user: ReturnType<typeof e2eUser>, key: string) {
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    session[key] = authCookies(registered);
  }

  function search(key: string, q: string, scope?: "local") {
    return request(http)
      .get("/api/search/works")
      .query({ q, ...(scope && { scope }) })
      .set("Cookie", session[key])
      .expect(200)
      .then((res) => res.body);
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    await signUp(alice, "alice");
    await signUp(bob, "bob");
    // Only the media catalogues are stubbed: the others would go online.
    await prisma.user.updateMany({ data: { enabledDomains: ["MEDIA"] } });

    const entry = await request(http)
      .put("/api/library")
      .set("Cookie", session.alice)
      .send({
        source: "ANILIST",
        sourceId: "4242",
        type: "ANIME",
        status: "WATCHING",
      })
      .expect(200);
    aliceStatus = entry.body.status;
    await prisma.mediaItem.update({
      where: { id: entry.body.mediaItem.id },
      data: { title: "Évangélion Test" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("finds a work the instance knows, accents or not", async () => {
    const body = await search("bob", "evangelion", "local");

    expect(body.items).toEqual([
      expect.objectContaining({
        kind: "ANIME",
        title: "Évangélion Test",
        href: "/app/media/anime/4242",
        status: null,
      }),
    ]);
  });

  it("says when the viewer tracks it", async () => {
    const body = await search("alice", "ÉVANGÉLION", "local");

    expect(body.items).toEqual([
      expect.objectContaining({
        href: "/app/media/anime/4242",
        status: aliceStatus,
      }),
    ]);
  });

  it("shows it once when a catalogue returns it too", async () => {
    // The stubbed AniList answers any query with this same anime.
    const body = await search("alice", "evangelion");

    expect(
      body.items.filter(
        (hit: { href: string }) => hit.href === "/app/media/anime/4242",
      ),
    ).toHaveLength(1);
    expect(body.unavailable).toEqual([]);
  });
});
