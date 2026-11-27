import { describe, expect, it } from "vitest";
import { isIsbnBarcode, profileUsernameFromQr } from "./scan-codes";

describe("isIsbnBarcode", () => {
  it("takes Bookland EAN-13 codes only", () => {
    expect(isIsbnBarcode("9782070612758")).toBe(true);
    expect(isIsbnBarcode("9791032305690")).toBe(true);
    expect(isIsbnBarcode("3017620422003")).toBe(false);
    expect(isIsbnBarcode("978207061275")).toBe(false);
  });
});

describe("profileUsernameFromQr", () => {
  const origin = "https://loomkeep.app";

  it("reads the username of this instance's profile links", () => {
    expect(profileUsernameFromQr(`${origin}/app/u/logan`, origin)).toBe(
      "logan",
    );
    expect(profileUsernameFromQr(`${origin}/app/u/l%C3%A9a/`, origin)).toBe(
      "léa",
    );
  });

  it("rejects other sites, other pages and non-links", () => {
    expect(
      profileUsernameFromQr("https://elsewhere.example/app/u/logan", origin),
    ).toBeNull();
    expect(profileUsernameFromQr(`${origin}/app/search`, origin)).toBeNull();
    expect(profileUsernameFromQr("just text", origin)).toBeNull();
  });
});
