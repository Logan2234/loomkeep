import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { InstanceSettingsService } from "./../src/instance-settings/instance-settings.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * An API key's whole life: minted from a browser session, used on the
 * public API, refused everywhere else, then revoked.
 */
describe("API keys (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let session: string;
  let keyId: string;
  let secret: string;

  const withKey = (url: string, key = secret) =>
    request(http).get(url).set("Authorization", `Bearer ${key}`);

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-api-key"))
      .expect(201);
    session = authCookies(registered);
  });

  afterAll(async () => {
    await app.close();
  });

  it("mints a key from a browser session and shows its secret once", async () => {
    const created = await request(http)
      .post("/api/api-keys")
      .set("Cookie", session)
      .send({ name: "Script perso", scopes: ["library:read"], expiresAt: null })
      .expect(201);
    ({ secret } = created.body);
    keyId = created.body.apiKey.id;
    expect(secret).toMatch(/^lk_/);

    const listed = await request(http)
      .get("/api/api-keys")
      .set("Cookie", session)
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ id: keyId, suffix: secret.slice(-4) }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain(secret);
  });

  it("authenticates the key on the public API", async () => {
    const res = await withKey("/api/v1/me").expect(200);

    expect(res.body.apiKey).toEqual({
      name: "Script perso",
      scopes: ["library:read"],
      expiresAt: null,
    });
  });

  it("refuses the key on internal routes, key management included", async () => {
    await withKey("/api/users/me").expect(403);
    await withKey("/api/api-keys").expect(403);
  });

  it("answers api.disabled while the instance has the API turned off", async () => {
    const settings = app.get(InstanceSettingsService);
    await settings.update({ publicApiEnabled: false });

    try {
      const res = await withKey("/api/v1/me").expect(403);
      expect(res.body.code).toBe("api.disabled");
      await request(http)
        .post("/api/api-keys")
        .set("Cookie", session)
        .send({ name: "Off", scopes: ["library:read"], expiresAt: null })
        .expect(403);
    } finally {
      await settings.update({ publicApiEnabled: true });
    }

    await withKey("/api/v1/me").expect(200);
  });

  it("rejects an unknown key", async () => {
    await withKey("/api/v1/me", "lk_not-a-real-key").expect(401);
  });

  it("stops working as soon as it is revoked", async () => {
    await request(http)
      .delete(`/api/api-keys/${keyId}`)
      .set("Cookie", session)
      .expect(204);

    await withKey("/api/v1/me").expect(401);
  });
});
