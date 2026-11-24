import type { LoanFilter } from "@loomkeep/shared";

export interface LoanInput {
  ownershipStatus?: string;
  lentOut?: boolean;
  loanPerson?: string | null;
  loanSince?: string | null;
}

type LoanDirection = "BORROWED" | "LENT";

/** An entry's open loan, as ACTIVE_LOAN_INCLUDE reads it. */
interface ActiveLoan {
  direction: LoanDirection;
  person: string | null;
  since: Date | null;
}

/** An entry with its open loan (at most one, see ACTIVE_LOAN_INCLUDE). */
interface LoanState {
  ownershipStatus: string;
  loans: ActiveLoan[];
}

/**
 * Spread into an entry's include/select: its open loan, if any. A returned
 * loan keeps its row (`returnedAt` set) as history; only the open one counts.
 */
export const ACTIVE_LOAN_INCLUDE = {
  loans: {
    where: { returnedAt: null },
    select: { direction: true, person: true, since: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const;

function direction(status: string, lentOut: boolean): LoanDirection | null {
  if (status === "BORROWED") return "BORROWED";
  return status === "PHYSICAL" && lentOut ? "LENT" : null;
}

/**
 * The nested write on an entry's `loans` that an entry update makes. A loan
 * only lives on a BORROWED entry (borrowed from someone) or a PHYSICAL one
 * marked lent out. Leaving either returns the open loan; switching direction
 * returns it and opens a new one, person and date starting over unless the
 * update sets them; staying edits the open one.
 *
 * Returning only ever targets the current direction and a new loan is always
 * the other one, so the result doesn't depend on the order Prisma runs the
 * nested writes in — nor trips the one-open-loan-per-direction index.
 */
export function loanUpdate(current: LoanState, dto: LoanInput) {
  if (
    dto.ownershipStatus === undefined &&
    dto.lentOut === undefined &&
    dto.loanPerson === undefined &&
    dto.loanSince === undefined
  ) {
    return {};
  }

  const open = current.loans[0] ?? null;
  const status = dto.ownershipStatus ?? current.ownershipStatus;
  const lentOut =
    status === "PHYSICAL" && (dto.lentOut ?? open?.direction === "LENT");
  const next = direction(status, lentOut);
  const person =
    dto.loanPerson === undefined ? undefined : dto.loanPerson?.trim() || null;
  const since =
    dto.loanSince === undefined
      ? undefined
      : dto.loanSince
        ? new Date(dto.loanSince)
        : null;
  const returnOpen = open && {
    updateMany: {
      where: { returnedAt: null, direction: open.direction },
      data: { returnedAt: new Date() },
    },
  };

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

/**
 * Statuses with no ownership source: NONE (unset) and BORROWED (the loan's
 * person says where it came from). The database refuses a source on them
 * (the entry tables' ownershipSource CHECK).
 */
const SOURCELESS_OWNERSHIP = new Set(["NONE", "BORROWED"]);

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
  const open = entry.loans[0] ?? null;
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
  if (loan === "BORROWED") return { ownershipStatus: "BORROWED" as const };
  return {};
}
