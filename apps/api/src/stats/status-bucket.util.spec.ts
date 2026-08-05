import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
  countByBucket,
} from "./status-bucket.util";

describe("bucketizeEntryStatus", () => {
  it("maps every EntryStatus to the shared vocabulary", () => {
    expect(bucketizeEntryStatus("WATCHING")).toBe("IN_PROGRESS");
    expect(bucketizeEntryStatus("COMPLETED")).toBe("DONE");
    expect(bucketizeEntryStatus("UP_TO_DATE")).toBe("DONE");
    expect(bucketizeEntryStatus("PLANNED")).toBe("PLANNED");
    expect(bucketizeEntryStatus("DROPPED")).toBe("DROPPED");
  });
});

describe("bucketizeGameStatus", () => {
  it("maps every GameStatus to the shared vocabulary", () => {
    expect(bucketizeGameStatus("BACKLOG")).toBe("PLANNED");
    expect(bucketizeGameStatus("PLAYING")).toBe("IN_PROGRESS");
    expect(bucketizeGameStatus("COMPLETED")).toBe("DONE");
    expect(bucketizeGameStatus("DROPPED")).toBe("DROPPED");
  });
});

describe("bucketizeBookStatus", () => {
  it("maps every BookStatus to the shared vocabulary", () => {
    expect(bucketizeBookStatus("TO_READ")).toBe("PLANNED");
    expect(bucketizeBookStatus("READING")).toBe("IN_PROGRESS");
    expect(bucketizeBookStatus("READ")).toBe("DONE");
    expect(bucketizeBookStatus("DROPPED")).toBe("DROPPED");
  });
});

describe("bucketizeMusicStatus", () => {
  it("maps the binary MusicStatus to the shared vocabulary", () => {
    expect(bucketizeMusicStatus("TO_LISTEN")).toBe("PLANNED");
    expect(bucketizeMusicStatus("LISTENED")).toBe("DONE");
  });
});

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
