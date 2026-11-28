import { countByBucket } from "./status-bucket.util";

describe("countByBucket", () => {
  it("returns an empty array for no entries", () => {
    expect(countByBucket([])).toEqual([]);
  });

  it("counts occurrences per bucket, omitting absent buckets", () => {
    const result = countByBucket([
      "DONE",
      "DONE",
      "IN_PROGRESS",
      "DONE",
      "DROPPED",
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { bucket: "DONE", count: 3 },
        { bucket: "IN_PROGRESS", count: 1 },
        { bucket: "DROPPED", count: 1 },
      ]),
    );
    expect(result).toHaveLength(3);
  });
});
