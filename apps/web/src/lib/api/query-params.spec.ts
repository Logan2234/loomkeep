import { describe, expect, it } from "vitest";
import { limitParam, pageParam } from "./query-params";

describe("pagination query parameters", () => {
  it("omits the default page and absent values", () => {
    expect(pageParam(undefined)).toBeUndefined();
    expect(pageParam(0)).toBeUndefined();
    expect(pageParam(1)).toBeUndefined();
    expect(pageParam(2)).toBe("2");
  });

  it("keeps the existing truthy-limit serialization", () => {
    expect(limitParam(undefined)).toBeUndefined();
    expect(limitParam(0)).toBeUndefined();
    expect(limitParam(20)).toBe("20");
  });
});
