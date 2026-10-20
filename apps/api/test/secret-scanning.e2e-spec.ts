import { INestApplication } from "@nestjs/common";
import { generateKeyPairSync, sign } from "node:crypto";
import request from "supertest";
import { App } from "supertest/types";
import { vi } from "vitest";
import { generateApiKeySecret } from "./../src/api-keys/api-key-format";
import { GithubPublicKeysService } from "./../src/api-keys/secret-scanning/github-public-keys.service";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * GitHub reporting a key it found in public: a signed alert revokes the key
 * and tells its owner; anything not signed by GitHub is turned away.
 */
describe("GitHub secret scanning (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let session: string;

  // GitHub's real keys come from api.github.com; this pair stands in for them.
  const github = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const KEY_ID = "e2e-key";

  const alert = (body: string, privateKey = github.privateKey) =>
    request(http)
      .post("/api/integrations/github/secret-scanning")
      .set("Content-Type", "application/json")
      .set("Github-Public-Key-Identifier", KEY_ID)
      .set(
        "Github-Public-Key-Signature",
        sign("sha256", Buffer.from(body), privateKey).toString("base64"),
      )
      .send(body);

  async function mintKey(): Promise<string> {
    const res = await request(http)
      .post("/api/api-keys")
      .set("Cookie", session)
      .send({ name: "Dotfiles", scopes: ["library:read"], expiresAt: null })
      .expect(201);
    return res.body.secret as string;
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    vi.spyOn(app.get(GithubPublicKeysService), "fetchKeys").mockResolvedValue([
      {
        key_identifier: KEY_ID,
        key: github.publicKey.export({ type: "spki", format: "pem" }) as string,
        is_current: true,
      },
    ]);
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-secret-scanning"))
      .expect(201);
    session = authCookies(registered);
  });

  afterAll(async () => {
    await app.close();
  });

  it("revokes a leaked key and tells its owner", async () => {
    const secret = await mintKey();
    const url = "https://github.com/octocat/dotfiles/blob/main/.env";

    const res = await alert(
      JSON.stringify([
        { token: secret, type: "loomkeep_api_key", url, source: "content" },
      ]),
    ).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        token_type: "loomkeep_api_key",
        label: "true_positive",
      }),
    ]);
    await request(http)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${secret}`)
      .expect(401);

    const { id: userId } = (
      await request(http).get("/api/users/me").set("Cookie", session)
    ).body as { id: string };
    expect(
      await prisma.notification.findFirst({
        where: { userId, type: "API_KEY_LEAKED" },
      }),
    ).toMatchObject({ data: { name: "Dotfiles", foundAt: url } });
    expect(
      await prisma.securityEvent.count({
        where: { userId, type: "API_KEY_LEAKED" },
      }),
    ).toBe(1);
  });

  it("calls a lookalike a false positive and ignores a key it doesn't know", async () => {
    const res = await alert(
      JSON.stringify([
        { token: `lk_${"0".repeat(49)}`, type: "loomkeep_api_key" },
        // Well formed but not ours: another instance's, or already revoked.
        { token: generateApiKeySecret(), type: "loomkeep_api_key" },
      ]),
    ).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({ label: "false_positive" }),
    ]);
  });

  it("turns away an alert GitHub didn't sign", async () => {
    const secret = await mintKey();
    const forger = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

    const res = await alert(
      JSON.stringify([{ token: secret, type: "loomkeep_api_key" }]),
      forger.privateKey,
    ).expect(401);

    expect(res.body.code).toBe("api.secret_scanning_unauthorized");
    await request(http)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${secret}`)
      .expect(200);
  });
});
