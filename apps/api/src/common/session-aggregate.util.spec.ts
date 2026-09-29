import { describe, expect, it } from "vitest";
import {
  bookSessionAggregate,
  gameSessionAggregate,
} from "./session-aggregate.util";

describe("gameSessionAggregate", () => {
  it("sums dated sessions without merging the Steam counter", () => {
    expect(
      gameSessionAggregate([{ durationMinutes: 30 }, { durationMinutes: 90 }]),
    ).toEqual({ trackedMinutes: 120 });
  });
});

describe("bookSessionAggregate", () => {
  it("advances quantity sessions from the persisted baseline", () => {
    expect(
      bookSessionAggregate(120, 544, [
        { pagesRead: 20, startPage: null, endPage: null, durationMinutes: 25 },
        { pagesRead: 15, startPage: null, endPage: null, durationMinutes: 20 },
      ]),
    ).toEqual({
      currentPage: 155,
      pagesRead: 35,
      trackedMinutes: 45,
      completionSuggested: false,
    });
  });

  it("counts reread ranges but never moves progress backwards", () => {
    expect(
      bookSessionAggregate(300, 544, [
        { pagesRead: 40, startPage: 80, endPage: 120, durationMinutes: 35 },
      ]),
    ).toEqual({
      currentPage: 300,
      pagesRead: 40,
      trackedMinutes: 35,
      completionSuggested: false,
    });
  });

  it("continues from an attained range when quantity mode is used next", () => {
    expect(
      bookSessionAggregate(0, 544, [
        { pagesRead: 100, startPage: 0, endPage: 100, durationMinutes: 80 },
        { pagesRead: 20, startPage: null, endPage: null, durationMinutes: 15 },
      ]),
    ).toEqual({
      currentPage: 120,
      pagesRead: 120,
      trackedMinutes: 95,
      completionSuggested: false,
    });
  });

  it("caps progress at the persisted edition page count and suggests completion", () => {
    expect(
      bookSessionAggregate(520, 544, [
        { pagesRead: 30, startPage: null, endPage: null, durationMinutes: 40 },
      ]),
    ).toEqual({
      currentPage: 544,
      pagesRead: 30,
      trackedMinutes: 40,
      completionSuggested: true,
    });
  });
});
