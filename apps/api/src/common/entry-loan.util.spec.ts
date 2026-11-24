import {
  loanFields,
  loanUpdate,
  ownershipSourceUpdate,
} from "./entry-loan.util";

const PHYSICAL = { ownershipStatus: "PHYSICAL", lentOut: false };

describe("loanUpdate", () => {
  it("writes nothing when the update touches neither ownership nor loan", () => {
    expect(loanUpdate(PHYSICAL, {})).toEqual({});
  });

  it("lends a physical copy to someone since a date", () => {
    expect(
      loanUpdate(PHYSICAL, {
        lentOut: true,
        loanPerson: "  Julie ",
        loanSince: "2026-03-08",
      }),
    ).toEqual({
      lentOut: true,
      loanPerson: "Julie",
      loanSince: new Date("2026-03-08"),
    });
  });

  it("refuses a lent flag on a copy that isn't physical", () => {
    expect(
      loanUpdate(
        { ownershipStatus: "DIGITAL", lentOut: false },
        {
          lentOut: true,
          loanPerson: "Julie",
        },
      ),
    ).toEqual({ lentOut: false, loanPerson: null, loanSince: null });
  });

  it("clears the loan when a lent copy stops being physical", () => {
    expect(
      loanUpdate(
        { ownershipStatus: "PHYSICAL", lentOut: true },
        {
          ownershipStatus: "DIGITAL",
        },
      ),
    ).toEqual({ lentOut: false, loanPerson: null, loanSince: null });
  });

  it("starts the person over when a lent copy becomes a borrowed one", () => {
    expect(
      loanUpdate(
        { ownershipStatus: "PHYSICAL", lentOut: true },
        {
          ownershipStatus: "BORROWED",
        },
      ),
    ).toEqual({ lentOut: false, loanPerson: null, loanSince: null });
  });

  it("keeps the borrowed person while only the date changes", () => {
    expect(
      loanUpdate(
        { ownershipStatus: "BORROWED", lentOut: false },
        {
          loanSince: "2026-09-14",
        },
      ),
    ).toEqual({
      lentOut: false,
      loanPerson: undefined,
      loanSince: new Date("2026-09-14"),
    });
  });
});

describe("loanFields", () => {
  it("serializes the date as a calendar day", () => {
    expect(
      loanFields({
        lentOut: true,
        loanPerson: "Julie",
        loanSince: new Date("2026-03-08"),
      }),
    ).toEqual({ lentOut: true, loanPerson: "Julie", loanSince: "2026-03-08" });
  });
});

describe("ownershipSourceUpdate", () => {
  it("writes the requested source on a status that carries one", () => {
    expect(
      ownershipSourceUpdate("NONE", {
        ownershipStatus: "STREAMING",
        ownershipSource: "Netflix",
      }),
    ).toBe("Netflix");
    expect(ownershipSourceUpdate("DIGITAL", { ownershipSource: "Steam" })).toBe(
      "Steam",
    );
  });

  it("leaves the source alone when the update touches neither", () => {
    expect(ownershipSourceUpdate("DIGITAL", {})).toBeUndefined();
  });

  it("clears the source once the status no longer carries one", () => {
    expect(
      ownershipSourceUpdate("STREAMING", { ownershipStatus: "NONE" }),
    ).toBeNull();
    expect(
      ownershipSourceUpdate("DIGITAL", {
        ownershipStatus: "BORROWED",
        ownershipSource: "Kindle",
      }),
    ).toBeNull();
  });
});
