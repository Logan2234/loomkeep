import { jsonObject, toJsonInput } from "./json.util";

describe("JSON boundaries", () => {
  it("keeps object data and defaults missing or non-object data to an empty object", () => {
    const data = { count: 2, nested: { label: "Book" } };
    expect(jsonObject(data)).toBe(data);
    for (const value of [null, undefined, [], "text", 42])
      expect(jsonObject(value)).toEqual({});
  });
  it("serializes nested DTO fields without persisting undefined fields", () => {
    expect(
      toJsonInput({
        count: 2,
        optional: undefined,
        nested: [{ enabled: true }],
      }),
    ).toEqual({ count: 2, nested: [{ enabled: true }] });
  });
});
