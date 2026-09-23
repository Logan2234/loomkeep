import { INestApplication } from "@nestjs/common";
import { Secret, TOTP } from "otpauth";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * TOTP enrolment and the MFA-gated login, end to end.
 *
 * Exactly the kind of flow unit tests cover badly: the secret is written
 * encrypted by one request, read back by another, and the login that follows
 * hands out a challenge instead of a session. Codes are computed here with the
 * same library the service uses, so the test proves the stored secret really is
 * the one the authenticator app was shown.
 *
 * WebAuthn is deliberately absent: faking an authenticator means producing a
 * valid attestation, which is a project of its own.
 */
describe("MFA (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  const user = e2eUser("e2e-mfa");
  let sessionCookies: string;
  let totpSecret: string;
  let recoveryCodes: string[];

  /** A code valid right now for the secret the API just issued. */
  function currentCode(secret = totpSecret): string {
    return new TOTP({
      issuer: "Loomkeep",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).generate();
  }

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());

    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    sessionCookies = authCookies(registered);
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports MFA as off on a fresh account", async () => {
    const res = await request(http)
      .get("/api/users/me/mfa")
      .set("Cookie", sessionCookies)
      .expect(200);

    expect(res.body.totpEnabled).toBe(false);
  });

  it("issues a secret and an otpauth URI the authenticator can read", async () => {
    const res = await request(http)
      .post("/api/users/me/mfa/totp/setup")
      .set("Cookie", sessionCookies)
      .expect(201);

    expect(res.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(res.body.otpauthUri).toContain("otpauth://totp/");
    expect(res.body.otpauthUri).toContain(encodeURIComponent(user.email));
    totpSecret = res.body.secret;
  });

  it("refuses a wrong code and leaves MFA off", async () => {
    await request(http)
      .post("/api/users/me/mfa/totp/confirm")
      .set("Cookie", sessionCookies)
      .send({ code: "000000" })
      .expect(400);

    const status = await request(http)
      .get("/api/users/me/mfa")
      .set("Cookie", sessionCookies)
      .expect(200);
    expect(status.body.totpEnabled).toBe(false);
  });

  it("enables TOTP on a valid code and hands out recovery codes", async () => {
    const res = await request(http)
      .post("/api/users/me/mfa/totp/confirm")
      .set("Cookie", sessionCookies)
      .send({ code: currentCode() })
      .expect(201);

    expect(res.body.recoveryCodes).toBeInstanceOf(Array);
    expect(res.body.recoveryCodes.length).toBeGreaterThan(0);
    recoveryCodes = res.body.recoveryCodes;

    const status = await request(http)
      .get("/api/users/me/mfa")
      .set("Cookie", sessionCookies)
      .expect(200);
    expect(status.body.totpEnabled).toBe(true);
  });

  it("answers a login with a challenge, and no session cookie", async () => {
    // The point of the gate: the password alone must not authenticate anyone
    // once a second factor exists.
    const res = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.challengeId).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("refuses to complete a challenge with a wrong code", async () => {
    const login = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    await request(http)
      .post("/api/auth/mfa/verify")
      .send({ challengeId: login.body.challengeId, code: "000000" })
      .expect(401);
  });

  it("completes the login with a valid code and opens the session", async () => {
    const login = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    const verified = await request(http)
      .post("/api/auth/mfa/verify")
      .send({ challengeId: login.body.challengeId, code: currentCode() })
      .expect(200);

    expect(verified.body.user.email).toBe(user.email);

    // The cookies it just set have to be usable on a guarded route.
    await request(http)
      .get("/api/users/me")
      .set("Cookie", authCookies(verified))
      .expect(200);
  });

  it("accepts a recovery code in place of the authenticator", async () => {
    // What a user falls back on with a lost phone — and the reason the codes
    // are handed out at enrolment.
    const login = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    const verified = await request(http)
      .post("/api/auth/mfa/verify")
      .send({ challengeId: login.body.challengeId, code: recoveryCodes[0] })
      .expect(200);

    expect(verified.body.user.email).toBe(user.email);
  });

  it("burns a recovery code once it has been used", async () => {
    const login = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    await request(http)
      .post("/api/auth/mfa/verify")
      .send({ challengeId: login.body.challengeId, code: recoveryCodes[0] })
      .expect(401);
  });

  it("turns MFA back off with the account password", async () => {
    const login = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);
    const verified = await request(http)
      .post("/api/auth/mfa/verify")
      .send({ challengeId: login.body.challengeId, code: currentCode() })
      .expect(200);
    const cookies = authCookies(verified);

    await request(http)
      .post("/api/users/me/mfa/totp/disable")
      .set("Cookie", cookies)
      .send({ currentPassword: user.password })
      .expect(201);

    const status = await request(http)
      .get("/api/users/me/mfa")
      .set("Cookie", cookies)
      .expect(200);
    expect(status.body.totpEnabled).toBe(false);
  });
});
