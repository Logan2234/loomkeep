import { utcDateIso, wellFormedIsbn } from "./csv-field.util";

describe("CSV book fields", () => {
  it("normalizes ISBN-10 check digits and preserves ISBN-13 and leading zeros", () => {
    expect(wellFormedIsbn("080442957x")).toBe("080442957X");
    expect(wellFormedIsbn("080442957X")).toBe("080442957X");
    expect(wellFormedIsbn("9782070368228")).toBe("9782070368228");

    for (const value of ["", "123", "978207036822X", "080442957A"]) {
      expect(wellFormedIsbn(value)).toBeNull();
    }
  });

  it("keeps CSV dates at UTC midnight and preserves calendar rollover", () => {
    expect(utcDateIso("2024", "2", "29")).toBe("2024-02-29T00:00:00.000Z");
    expect(utcDateIso("2024", "2", "30")).toBe("2024-03-01T00:00:00.000Z");
    expect(utcDateIso("invalid", "2", "1")).toBeNull();
  });
});
