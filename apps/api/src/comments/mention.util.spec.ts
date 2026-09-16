import { extractMentions } from "./mention.util";

describe("extractMentions", () => {
  it("extracts distinct usernames", () => {
    expect(extractMentions("hey @alice and @bob, also @alice again")).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("returns nothing when there is no mention", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });

  it("ignores an email-like string", () => {
    expect(extractMentions("contact me at me@example.com")).toEqual([]);
  });
});
