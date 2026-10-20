import { corsOptionsFor } from "./cors";

const WEB = ["https://loomkeep.app"];

describe("corsOptionsFor", () => {
  it("opens the public API to any origin, with a key but never a session", () => {
    for (const url of ["/api/v1/me", "/api/v1/library?phase=DONE", "/api/v1"]) {
      expect(corsOptionsFor(url, WEB)).toMatchObject({
        origin: "*",
        credentials: false,
        allowedHeaders: ["Authorization", "Content-Type"],
      });
    }
  });

  it("keeps everything else to the web app's own origins, with its cookies", () => {
    for (const url of ["/api/users/me", "/api/v10/x", "/api/api-keys"]) {
      expect(corsOptionsFor(url, WEB)).toMatchObject({
        origin: WEB,
        credentials: true,
        allowedHeaders: ["Content-Type"],
      });
    }
  });
});
