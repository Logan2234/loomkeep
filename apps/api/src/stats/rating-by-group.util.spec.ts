import { computeAverageRatingByGroup } from "./rating-by-group.util";

describe("computeAverageRatingByGroup", () => {
  it("returns nothing for no rows", () => {
    expect(computeAverageRatingByGroup([])).toEqual([]);
  });

  it("skips unrated rows", () => {
    expect(
      computeAverageRatingByGroup([{ groups: ["PC"], rating: null }]),
    ).toEqual([]);
  });

  it("averages per group and sorts descending", () => {
    const result = computeAverageRatingByGroup([
      { groups: ["PC"], rating: 8 },
      { groups: ["PC"], rating: 6 },
      { groups: ["Switch"], rating: 9 },
    ]);

    expect(result).toEqual([
      { label: "Switch", averageRating: 9, count: 1 },
      { label: "PC", averageRating: 7, count: 2 },
    ]);
  });

  it("attributes one row to every group it belongs to", () => {
    const result = computeAverageRatingByGroup([
      { groups: ["RPG", "Action"], rating: 10 },
      { groups: ["RPG"], rating: 6 },
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { label: "RPG", averageRating: 8, count: 2 },
        { label: "Action", averageRating: 10, count: 1 },
      ]),
    );
  });
});
