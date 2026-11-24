import {
  loanFields,
  loanUpdate,
  loanWhere,
  ownershipSourceUpdate,
} from "./entry-loan.util";

const NOW = new Date("2026-11-24T12:00:00Z");
const PHYSICAL = { ownershipStatus: "PHYSICAL", loans: [] };
const LENT = {
  ownershipStatus: "PHYSICAL",
  loans: [
    {
      direction: "LENT" as const,
      person: "Julie",
      since: new Date("2026-03-08"),
    },
  ],
};
const BORROWED = {
  ownershipStatus: "BORROWED",
  loans: [{ direction: "BORROWED" as const, person: "Max", since: null }],
};
const returnOpen = (direction: string) => ({
  updateMany: {
    where: { returnedAt: null, direction },
    data: { returnedAt: NOW },
  },
});

describe("loanUpdate", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it("writes nothing when the update touches neither ownership nor loan", () => {
    expect(loanUpdate(LENT, {})).toEqual({});
  });

  it("opens a loan when a physical copy is lent to someone since a date", () => {
    expect(
      loanUpdate(PHYSICAL, {
        lentOut: true,
        loanPerson: "  Julie ",
        loanSince: "2026-03-08",
      }),
    ).toEqual({
      loans: {
        create: {
          direction: "LENT",
          person: "Julie",
          since: new Date("2026-03-08"),
        },
      },
    });
  });

  it("opens no loan on a copy that isn't physical", () => {
    expect(
      loanUpdate(
        { ownershipStatus: "DIGITAL", loans: [] },
        { lentOut: true, loanPerson: "Julie" },
      ),
    ).toEqual({});
  });

  it("returns the loan, kept as history, when the copy comes back", () => {
    expect(loanUpdate(LENT, { lentOut: false })).toEqual({
      loans: returnOpen("LENT"),
    });
  });

  it("returns the loan when a lent copy stops being physical", () => {
    expect(loanUpdate(LENT, { ownershipStatus: "DIGITAL" })).toEqual({
      loans: returnOpen("LENT"),
    });
  });

  it("returns the lent loan and opens a borrowed one, person starting over", () => {
    expect(loanUpdate(LENT, { ownershipStatus: "BORROWED" })).toEqual({
      loans: {
        ...returnOpen("LENT"),
        create: { direction: "BORROWED", person: null, since: null },
      },
    });
  });

  it("opens a borrowed loan, without a person yet, on a newly borrowed entry", () => {
    expect(loanUpdate(PHYSICAL, { ownershipStatus: "BORROWED" })).toEqual({
      loans: {
        create: { direction: "BORROWED", person: null, since: null },
      },
    });
  });

  it("edits the open loan while only the date changes", () => {
    expect(loanUpdate(BORROWED, { loanSince: "2026-09-14" })).toEqual({
      loans: {
        updateMany: {
          where: { returnedAt: null, direction: "BORROWED" },
          data: { person: undefined, since: new Date("2026-09-14") },
        },
      },
    });
  });

  it("writes nothing when the status is restated without loan changes", () => {
    expect(loanUpdate(BORROWED, { ownershipStatus: "BORROWED" })).toEqual({});
  });
});

describe("loanFields", () => {
  it("reads the open loan, the date as a calendar day", () => {
    expect(loanFields(LENT)).toEqual({
      lentOut: true,
      loanPerson: "Julie",
      loanSince: "2026-03-08",
    });
  });

  it("reads a borrowed entry's lender without a lent flag", () => {
    expect(loanFields(BORROWED)).toEqual({
      lentOut: false,
      loanPerson: "Max",
      loanSince: null,
    });
  });

  it("reads no loan as none", () => {
    expect(loanFields(PHYSICAL)).toEqual({
      lentOut: false,
      loanPerson: null,
      loanSince: null,
    });
  });
});

describe("loanWhere", () => {
  it("filters lent copies on their open LENT loan", () => {
    expect(loanWhere("LENT")).toEqual({
      loans: { some: { returnedAt: null, direction: "LENT" } },
    });
  });

  it("filters borrowed ones on their status", () => {
    expect(loanWhere("BORROWED")).toEqual({ ownershipStatus: "BORROWED" });
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
