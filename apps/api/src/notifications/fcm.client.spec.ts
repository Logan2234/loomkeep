import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { FcmClient, type FcmMessage } from "./fcm.client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const ACCOUNT = {
  project_id: "loomkeep-test",
  client_email: "push@loomkeep-test.iam.gserviceaccount.com",
  private_key: privateKey,
};

const MESSAGE: FcmMessage = {
  notification: { title: "Loomkeep", body: "New episode" },
  data: { url: "/app/media/tv/1" },
  android: { priority: "HIGH", notification: { channel_id: "releases" } },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

let fetchMock: Mock<(url: string, init: RequestInit) => Promise<Response>>;

beforeEach(() => {
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.startsWith("https://oauth2")
        ? json(200, { access_token: "oauth-1", expires_in: 3600 })
        : json(200, { name: "projects/loomkeep-test/messages/1" }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("FcmClient", () => {
  it("sends to the token with an OAuth token from a signed service account JWT", async () => {
    const client = new FcmClient(ACCOUNT, () => 1_800_000_000_000);

    await expect(client.send("device-token", MESSAGE)).resolves.toEqual({
      ok: true,
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    const assertion = (tokenInit.body as URLSearchParams).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    expect(
      createVerify("RSA-SHA256")
        .update(`${header}.${claims}`)
        .verify(publicKey, signature, "base64url"),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: ACCOUNT.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe(
      "https://fcm.googleapis.com/v1/projects/loomkeep-test/messages:send",
    );
    expect(new Headers(sendInit.headers).get("Authorization")).toBe(
      "Bearer oauth-1",
    );
    expect(JSON.parse(sendInit.body as string)).toEqual({
      message: { token: "device-token", ...MESSAGE },
    });
  });

  it("reuses the OAuth token until shortly before it expires", async () => {
    let now = 0;
    const client = new FcmClient(ACCOUNT, () => now);

    await client.send("a", MESSAGE);
    now = 50 * 60 * 1000;
    await client.send("b", MESSAGE);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.includes("oauth2")),
    ).toHaveLength(1);

    now = 56 * 60 * 1000;
    await client.send("c", MESSAGE);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.includes("oauth2")),
    ).toHaveLength(2);
  });

  it("flags a dead token apart from other failures", async () => {
    const client = new FcmClient(ACCOUNT);
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith("https://oauth2")
          ? json(200, { access_token: "t", expires_in: 3600 })
          : url.endsWith("send") && fetchMock.mock.calls.length < 3
            ? json(404, {
                error: {
                  status: "NOT_FOUND",
                  details: [{ errorCode: "UNREGISTERED" }],
                },
              })
            : json(503, { error: { status: "UNAVAILABLE" } }),
      ),
    );

    await expect(client.send("gone", MESSAGE)).resolves.toEqual({
      ok: false,
      unregistered: true,
      error: "HTTP 404 UNREGISTERED",
    });
    await expect(client.send("later", MESSAGE)).resolves.toEqual({
      ok: false,
      unregistered: false,
      error: "HTTP 503 UNAVAILABLE",
    });
  });

  it("is off without FCM_SERVICE_ACCOUNT_BASE64, and refuses a partial account", () => {
    expect(FcmClient.fromEnv("")).toBeNull();
    expect(
      FcmClient.fromEnv(
        Buffer.from(JSON.stringify(ACCOUNT)).toString("base64"),
      ),
    ).toBeInstanceOf(FcmClient);
    expect(() =>
      FcmClient.fromEnv(
        Buffer.from(JSON.stringify({ project_id: "x" })).toString("base64"),
      ),
    ).toThrow("lacks project_id, client_email or private_key");
  });
});
