import {
  isLoanActive,
  loanFields,
  loanUpdate,
  loanWhere,
  ownershipSourceUpdate,
} from "./entry-loan.util";

const NOW = new Date("2026-11-24T12:00:00Z");
const PHYSICAL = { ownershipStatus: "PHYSICAL", loans: [] };
const BORROWED_ALONE = { ownershipStatus: "BORROWED", loans: [] };
const lentLoan = {
  id: "loan-lent",
  direction: "LENT" as const,
  person: "Julie",
  since: new Date("2026-03-08"),
  returnedAt: null,
};
const borrowedLoan = {
  id: "loan-borrowed",
  direction: "BORROWED" as const,
  person: "Max",
  since: null,
  returnedAt: null,
};
const LENT = { ownershipStatus: "PHYSICAL", loans: [lentLoan] };
const BORROWED = { ownershipStatus: "BORROWED", loans: [borrowedLoan] };
const RETURNED_BORROWING = {
  ownershipStatus: "BORROWED",
  loans: [{ ...borrowedLoan, returnedAt: new Date("2026-11-20") }],
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

  it("opens a loan when a physical copy is lent, person and date optional", () => {
    expect(loanUpdate(PHYSICAL, { lentOut: true })).toEqual({
      loans: { create: { direction: "LENT", person: null, since: null } },
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

  it("opens no loan when an entry only becomes borrowed", () => {
    expect(loanUpdate(PHYSICAL, { ownershipStatus: "BORROWED" })).toEqual({});
  });

  it("opens a borrowing once a borrowed entry gets a person", () => {
    expect(loanUpdate(BORROWED_ALONE, { loanPerson: "  Max " })).toEqual({
      loans: { create: { direction: "BORROWED", person: "Max", since: null } },
    });
  });

  it("opens no borrowing for details left empty", () => {
    expect(
      loanUpdate(BORROWED_ALONE, { loanPerson: "  ", loanSince: null }),
    ).toEqual({});
  });

  it("edits the running loan while only the date changes", () => {
    expect(loanUpdate(BORROWED, { loanSince: "2026-09-14" })).toEqual({
      loans: {
        updateMany: {
          where: { returnedAt: null, direction: "BORROWED" },
          data: { person: undefined, since: new Date("2026-09-14") },
        },
      },
    });
  });

  it("returns the running loan, the status untouched", () => {
    expect(loanUpdate(LENT, { loanReturned: true })).toEqual({
      loans: returnOpen("LENT"),
    });
    expect(loanUpdate(BORROWED, { loanReturned: true })).toEqual({
      loans: returnOpen("BORROWED"),
    });
  });

  it("has nothing to return when no loan runs", () => {
    expect(loanUpdate(BORROWED_ALONE, { loanReturned: true })).toEqual({});
  });

  it("undoes a return by reopening the latest loan", () => {
    expect(loanUpdate(RETURNED_BORROWING, { loanReturned: false })).toEqual({
      loans: {
        update: { where: { id: "loan-borrowed" }, data: { returnedAt: null } },
      },
    });
  });

  it("reopens nothing once the status no longer fits that loan", () => {
    expect(
      loanUpdate(
        { ...RETURNED_BORROWING, ownershipStatus: "PHYSICAL" },
        { loanReturned: false },
      ),
    ).toEqual({});
    expect(loanUpdate(BORROWED, { loanReturned: false })).toEqual({});
  });

  it("returns the loan when a lent copy stops being physical", () => {
    expect(loanUpdate(LENT, { ownershipStatus: "DIGITAL" })).toEqual({
      loans: returnOpen("LENT"),
    });
  });

  it("returns the lent loan when the copy becomes borrowed without details", () => {
    expect(loanUpdate(LENT, { ownershipStatus: "BORROWED" })).toEqual({
      loans: returnOpen("LENT"),
    });
  });

  it("returns the lent loan and opens a borrowing given a person", () => {
    expect(
      loanUpdate(LENT, { ownershipStatus: "BORROWED", loanPerson: "Max" }),
    ).toEqual({
      loans: {
        ...returnOpen("LENT"),
        create: { direction: "BORROWED", person: "Max", since: null },
      },
    });
  });

  it("writes nothing when the status is restated without loan changes", () => {
    expect(loanUpdate(BORROWED, { ownershipStatus: "BORROWED" })).toEqual({});
  });
});

describe("loanFields and isLoanActive", () => {
  it("read the running loan, the date as a calendar day", () => {
    expect(loanFields(LENT)).toEqual({
      lentOut: true,
      loanPerson: "Julie",
      loanSince: "2026-03-08",
    });
    expect(isLoanActive(LENT)).toBe(true);
  });

  it("read a borrowing's lender without a lent flag", () => {
    expect(loanFields(BORROWED)).toEqual({
      lentOut: false,
      loanPerson: "Max",
      loanSince: null,
    });
    expect(isLoanActive(BORROWED)).toBe(true);
  });

  it("read a returned loan, or none, as no loan", () => {
    for (const entry of [RETURNED_BORROWING, PHYSICAL]) {
      expect(loanFields(entry)).toEqual({
        lentOut: false,
        loanPerson: null,
        loanSince: null,
      });
      expect(isLoanActive(entry)).toBe(false);
    }
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
