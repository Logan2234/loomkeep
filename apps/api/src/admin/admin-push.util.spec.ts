import { groupByUserAgentFamily, userAgentFamily } from "./admin-push.util";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const EDGE = `${CHROME} Edg/140.0.0.0`;
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

describe("userAgentFamily", () => {
  it("recognises plain Chrome", () => {
    expect(userAgentFamily(CHROME)).toBe("Chrome");
  });

  it("prefers the Chromium derivative over Chrome itself", () => {
    expect(userAgentFamily(EDGE)).toBe("Edge");
    expect(userAgentFamily(`${CHROME} OPR/115.0.0.0`)).toBe("Opera");
    expect(userAgentFamily("Mozilla/5.0 SamsungBrowser/25.0 Chrome/121")).toBe(
      "Samsung Internet",
    );
  });

  it("only calls Safari what isn't a Chromium browser in disguise", () => {
    expect(userAgentFamily(SAFARI_IOS)).toBe("Safari");
  });

  it("recognises Firefox", () => {
    expect(userAgentFamily(FIREFOX)).toBe("Firefox");
  });

  it("falls back to Inconnu on a missing or unrecognised user-agent", () => {
    expect(userAgentFamily(null)).toBe("Inconnu");
    expect(userAgentFamily("")).toBe("Inconnu");
    expect(userAgentFamily("curl/8.7.1")).toBe("Inconnu");
  });
});

describe("groupByUserAgentFamily", () => {
  it("counts subscriptions per family, most first", () => {
    expect(
      groupByUserAgentFamily([CHROME, CHROME, SAFARI_IOS, EDGE, null]),
    ).toEqual([
      { label: "Chrome", count: 2 },
      { label: "Edge", count: 1 },
      { label: "Inconnu", count: 1 },
      { label: "Safari", count: 1 },
    ]);
  });

  it("returns nothing when no device is subscribed", () => {
    expect(groupByUserAgentFamily([])).toEqual([]);
  });
});
