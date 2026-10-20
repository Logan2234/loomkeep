import { primaryWebOrigin, webOrigins } from "./web-origin.util";

describe("web origins", () => {
  it("keeps all configured origins for authentication and CORS", () => {
    expect(
      webOrigins(" https://one.example, , http://localhost:5173 "),
    ).toEqual(["https://one.example", "http://localhost:5173"]);
  });
  it("does not invent an allowed origin when configuration is absent", () => {
    expect(webOrigins(undefined)).toEqual([]);
    expect(webOrigins(" , ")).toEqual([]);
  });
  it("uses only the first configured origin for outgoing links", () => {
    expect(primaryWebOrigin(" https://one.example/,https://two.example ")).toBe(
      "https://one.example",
    );
  });
  it("retains the development link fallback", () => {
    expect(primaryWebOrigin(undefined)).toBe("http://localhost:5173");
    expect(primaryWebOrigin(" , https://two.example")).toBe(
      "http://localhost:5173",
    );
  });
});
