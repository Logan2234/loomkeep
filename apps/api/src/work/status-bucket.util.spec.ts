import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
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
