import type { LoanFilter } from "@loomkeep/shared";

export interface LoanInput {
  ownershipStatus?: string;
  lentOut?: boolean;
  loanPerson?: string | null;
  loanSince?: string | null;
}

interface LoanState {
  ownershipStatus: string;
  lentOut: boolean;
  loanPerson: string | null;
  loanSince: Date | null;
}

type LoanDirection = "BORROWED" | "LENT" | null;

function direction(status: string, lentOut: boolean): LoanDirection {
  if (status === "BORROWED") return "BORROWED";
  return status === "PHYSICAL" && lentOut ? "LENT" : null;
}

/**
 * The loan columns an entry update writes. A loan only lives on a BORROWED
 * entry (borrowed from someone) or a PHYSICAL one marked lent out; leaving
 * either clears the person and the date, and switching direction starts
 * them over unless the update sets them.
 */
export function loanUpdate(
  current: Pick<LoanState, "ownershipStatus" | "lentOut">,
  dto: LoanInput,
): Partial<Omit<LoanState, "ownershipStatus">> {
  if (
    dto.ownershipStatus === undefined &&
    dto.lentOut === undefined &&
    dto.loanPerson === undefined &&
    dto.loanSince === undefined
  ) {
    return {};
  }

  const status = dto.ownershipStatus ?? current.ownershipStatus;
  const lentOut = status === "PHYSICAL" && (dto.lentOut ?? current.lentOut);
  const next = direction(status, lentOut);
  if (next === null)
    return { lentOut: false, loanPerson: null, loanSince: null };

  const restart = next !== direction(current.ownershipStatus, current.lentOut);
  return {
    lentOut,
    loanPerson:
      dto.loanPerson !== undefined
        ? dto.loanPerson?.trim() || null
        : restart
          ? null
          : undefined,
    loanSince:
      dto.loanSince !== undefined
        ? dto.loanSince
          ? new Date(dto.loanSince)
          : null
        : restart
          ? null
          : undefined,
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

/** The loan as an entry DTO carries it. */
export function loanFields(entry: Omit<LoanState, "ownershipStatus">) {
  return {
    lentOut: entry.lentOut,
    loanPerson: entry.loanPerson,
    loanSince: entry.loanSince?.toISOString().slice(0, 10) ?? null,
  };
}

/** The library list's « Lent » / « To give back » filters. */
export function loanWhere(loan: LoanFilter | undefined) {
  if (loan === "LENT") return { lentOut: true };
  if (loan === "BORROWED") return { ownershipStatus: "BORROWED" as const };
  return {};
}
