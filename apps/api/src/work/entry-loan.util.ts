import { type LoanFilter, OwnershipStatus } from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";

export interface LoanInput {
  ownershipStatus?: string;
  lentOut?: boolean;
  loanPerson?: string | null;
  loanSince?: string | null;
  /** true: the running loan comes back; false: undoes that. */
  loanReturned?: boolean;
}

type LoanDirection = "BORROWED" | "LENT";

/** An entry's latest loan, open or returned, as LOAN_INCLUDE reads it. */
interface LatestLoan {
  id: string;
  direction: LoanDirection;
  person: string | null;
  since: Date | null;
  returnedAt: Date | null;
}

/** An entry with its latest loan (see LOAN_INCLUDE). */
interface LoanState {
  ownershipStatus: string;
  loans: LatestLoan[];
}

/**
 * Spread into an entry's include/select: its latest loan. At most one loan
 * is open, and it is always the latest (a new loan returns the open one
 * first; undoing a return only reopens the latest), so the latest says both
 * whether a loan runs and which returned loan an undo brings back. Returned
 * loans keep their row (`returnedAt` set) as history.
 */
export const LOAN_INCLUDE = {
  loans: {
    select: {
      id: true,
      direction: true,
      person: true,
      since: true,
      returnedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  } satisfies Prisma.LoanFindManyArgs,
};

function openLoan(entry: Pick<LoanState, "loans">): LatestLoan | null {
  const latest = entry.loans[0];
  return latest && latest.returnedAt === null ? latest : null;
}

/** A loan's direction fits the status: LENT on PHYSICAL, BORROWED on BORROWED. */
function fits(direction: LoanDirection, status: string): boolean {
  return direction === "LENT"
    ? status === OwnershipStatus.PHYSICAL
    : status === OwnershipStatus.BORROWED;
}

/**
 * The nested write on an entry's `loans` that an entry update makes.
 *
 * - A PHYSICAL copy is lent out by `lentOut: true`, which opens a LENT loan,
 *   person and date optional.
 * - A BORROWED entry alone only says the work was borrowed: no loan. Giving a
 *   person or a date opens a BORROWED loan — a borrowing still running.
 * - `loanReturned: true` returns the open loan (the status stays);
 *   `loanReturned: false` undoes that, reopening the latest returned loan
 *   if nothing runs and it still fits the status.
 * - Leaving the status a loan needs returns it; switching direction returns
 *   it and opens the other, person and date starting over unless set; an
 *   open loan of the same direction is edited in place.
 *
 * Returning only ever targets the open loan's direction and a new loan is
 * always the other one, so the result doesn't depend on the order Prisma
 * runs the nested writes in — nor trips the one-open-loan-per-direction index.
 */
export function loanUpdate(current: LoanState, dto: LoanInput) {
  if (
    dto.loanReturned === undefined &&
    dto.ownershipStatus === undefined &&
    dto.lentOut === undefined &&
    dto.loanPerson === undefined &&
    dto.loanSince === undefined
  ) {
    return {};
  }

  const open = openLoan(current);
  const returnOpen = open && {
    updateMany: {
      where: { returnedAt: null, direction: open.direction },
      data: { returnedAt: new Date() },
    },
  };

  if (dto.loanReturned === true) return returnOpen ? { loans: returnOpen } : {};

  if (dto.loanReturned === false) {
    const latest = current.loans[0];
    const status = dto.ownershipStatus ?? current.ownershipStatus;
    if (open || !latest || !fits(latest.direction, status)) return {};
    return {
      loans: {
        update: { where: { id: latest.id }, data: { returnedAt: null } },
      },
    };
  }

  const status = dto.ownershipStatus ?? current.ownershipStatus;
  const person =
    dto.loanPerson === undefined ? undefined : dto.loanPerson?.trim() || null;
  const since =
    dto.loanSince === undefined
      ? undefined
      : dto.loanSince
        ? new Date(dto.loanSince)
        : null;
  const details = Boolean(person) || Boolean(since);
  let next: LoanDirection | null = null;
  if (status === OwnershipStatus.BORROWED)
    next = open?.direction === "BORROWED" || details ? "BORROWED" : null;
  else if (status === OwnershipStatus.PHYSICAL)
    next = (dto.lentOut ?? open?.direction === "LENT") ? "LENT" : null;

  if (next === null) return returnOpen ? { loans: returnOpen } : {};

  if (open?.direction === next) {
    if (person === undefined && since === undefined) return {};
    return {
      loans: {
        updateMany: {
          where: { returnedAt: null, direction: next },
          data: { person, since },
        },
      },
    };
  }

  return {
    loans: {
      ...returnOpen,
      create: { direction: next, person: person ?? null, since: since ?? null },
    },
  };
}

/** Whether a loan runs: a PHYSICAL copy lent out, a borrowing with details. */
export function isLoanActive(entry: Pick<LoanState, "loans">): boolean {
  return openLoan(entry) !== null;
}

/**
 * Statuses with no ownership source: NONE (unset) and BORROWED (the loan's
 * person says where it came from). The database refuses a source on them
 * (the entry tables' ownershipSource CHECK).
 */
const SOURCELESS_OWNERSHIP = new Set<string>([
  OwnershipStatus.NONE,
  OwnershipStatus.BORROWED,
]);

/**
 * The ownershipSource an entry update writes: the requested one, cleared when
 * the resulting status carries none — including a status change that doesn't
 * mention the source, so a former "Netflix" never outlives its status.
 */
export function ownershipSourceUpdate(
  currentStatus: string,
  dto: { ownershipStatus?: string; ownershipSource?: string | null },
): string | null | undefined {
  const status = dto.ownershipStatus ?? currentStatus;
  return SOURCELESS_OWNERSHIP.has(status) ? null : dto.ownershipSource;
}

/** The loan as an entry DTO carries it, from the entry's open loan. */
export function loanFields(entry: Pick<LoanState, "loans">) {
  const open = openLoan(entry);
  return {
    lentOut: open?.direction === "LENT",
    loanPerson: open?.person ?? null,
    loanSince: open?.since?.toISOString().slice(0, 10) ?? null,
  };
}

/** The library list's « Lent » / « To give back » filters. */
export function loanWhere(loan: LoanFilter | undefined) {
  if (loan === "LENT")
    return {
      loans: { some: { returnedAt: null, direction: "LENT" as const } },
    };
  if (loan === "BORROWED") return { ownershipStatus: OwnershipStatus.BORROWED };
  return {};
}
