import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { createE2eApp } from "./e2e-app";

/**
 * The per-IP limit ran after authentication: a request refused for having
 * no valid session was never counted, so guessing tokens or cookies went
 * unthrottled (audit 2026-11-17, SEC-23).
 */
describe("Global throttle on refused requests (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("counts requests the authentication refuses, past the limit", async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 61; i++) {
      const res = await request(http)
        .get("/api/users/me")
        .set("Cookie", "loomkeep_access=forged");
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 60).every((s) => s === 401)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
