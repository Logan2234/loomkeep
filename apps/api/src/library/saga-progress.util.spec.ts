import type { EntryStatus, SagaMemberDto } from "@loomkeep/shared";
import {
  completedSagaWorks,
  MEDIA_SAGA_STATUS,
  sagaProgress,
} from "./saga-progress.util";

const work = (
  sourceId: string,
  status: EntryStatus | null,
  upcoming = false,
): SagaMemberDto => ({
  source: "TMDB",
  sourceId,
  type: "MOVIE",
  title: `Film ${sourceId}`,
  year: 2020,
  posterUrl: null,
  isAdult: false,
  releaseDate: upcoming ? null : "2020-01-01",
  format: null,
  episodes: null,
  upcoming,
  status,
});

const progress = (members: SagaMemberDto[]) =>
  sagaProgress(members, MEDIA_SAGA_STATUS);

describe("sagaProgress", () => {
  it("is in progress with a work seen and a released one left, the next being the first left", () => {
    const result = progress([
      work("1", "COMPLETED"),
      work("2", null),
      work("3", "PLANNED"),
      work("4", null, true),
    ]);

    expect(result).toMatchObject({ state: "inProgress", seen: 1, released: 3 });
    expect(result.state !== "none" && result.next?.sourceId).toBe("2");
  });

  it("waits on the announced sequel once everything released is seen or dropped", () => {
    const result = progress([
      work("1", "COMPLETED"),
      work("2", "DROPPED"),
      work("3", null, true),
    ]);

    expect(result).toMatchObject({ state: "waiting", seen: 1, released: 2 });
    expect(result.state !== "none" && result.next?.sourceId).toBe("3");
  });

  it("finishes a saga once everything is seen or dropped and nothing is announced", () => {
    expect(progress([work("1", "COMPLETED"), work("2", "DROPPED")])).toEqual({
      state: "finished",
      next: null,
      seen: 1,
      released: 2,
    });
  });

  it("leaves out a saga never started, and one only ever dropped", () => {
    expect(progress([work("1", "PLANNED"), work("2", null)]).state).toBe(
      "none",
    );
    expect(progress([work("1", "DROPPED"), work("2", "DROPPED")]).state).toBe(
      "none",
    );
  });
});

describe("completedSagaWorks", () => {
  it("counts the works of a saga seen through, nothing announced", () => {
    expect(
      completedSagaWorks(
        [
          work("1", "COMPLETED"),
          work("2", "COMPLETED"),
          work("3", "COMPLETED"),
        ],
        MEDIA_SAGA_STATUS,
      ),
    ).toBe(3);
  });

  it.each([
    ["a work dropped", [work("1", "COMPLETED"), work("2", "DROPPED")]],
    ["a sequel announced", [work("1", "COMPLETED"), work("2", null, true)]],
    ["a work left", [work("1", "COMPLETED"), work("2", null)]],
  ])("isn't completed with %s", (_case, members) => {
    expect(completedSagaWorks(members, MEDIA_SAGA_STATUS)).toBeNull();
  });
});
