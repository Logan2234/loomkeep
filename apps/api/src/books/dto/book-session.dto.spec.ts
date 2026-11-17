import { validate } from "class-validator";
import "reflect-metadata";
import { CreateBookSessionDto } from "./create-book-session.dto";
import { UpdateBookSessionDto } from "./update-book-session.dto";

describe("book session duration", () => {
  it("accepts a session logged without any reading time", async () => {
    const dto = Object.assign(new CreateBookSessionDto(), {
      durationMinutes: 0,
      occurredAt: "2026-11-17T12:00:00.000Z",
      pagesRead: 20,
    });

    expect(await validate(dto)).toEqual([]);
  });

  it("accepts removing the reading time of an existing session", async () => {
    const dto = Object.assign(new UpdateBookSessionDto(), {
      durationMinutes: 0,
    });

    expect(await validate(dto)).toEqual([]);
  });

  it("still rejects a negative duration", async () => {
    const dto = Object.assign(new CreateBookSessionDto(), {
      durationMinutes: -1,
      occurredAt: "2026-11-17T12:00:00.000Z",
      pagesRead: 20,
    });

    expect((await validate(dto)).map((e) => e.property)).toEqual([
      "durationMinutes",
    ]);
  });
});
