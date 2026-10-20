import {
  ErrorCode,
  type BulkEntriesResultDto,
  type BulkEntriesTargetDto,
  type BulkUpdateEntriesDto,
  type ListItemTargetType,
} from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { ListService } from "../lists/list.service";
import { AppException } from "./app.exception";

/** An entry as a bulk update needs it, whatever its domain. */
export interface BulkEntryRow {
  id: string;
  /** The tracked work's id, what a list item points to. */
  itemId: string;
  status: string;
  favorite: boolean;
  ownershipStatus: string;
  ownershipSource: string | null;
}

/** The entry fields a bulk update writes through the domain's own updateEntry. */
export interface BulkEntryPatch {
  status?: string;
  favorite?: boolean;
  ownershipStatus?: string;
  ownershipSource?: string | null;
}

/** Rejects a bulk request that doesn't name exactly one target. */
export function assertBulkTarget(dto: BulkEntriesTargetDto): void {
  if ((dto.ids === undefined) === (dto.filters === undefined)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryBulkInvalid,
    );
  }
}

/** Rejects a bulk update that doesn't name exactly one target and one action. */
export function assertBulkUpdate(dto: BulkUpdateEntriesDto): void {
  assertBulkTarget(dto);
  const actions = [dto.status, dto.ownershipStatus, dto.favorite, dto.listId];
  const strayOwnershipSource =
    dto.ownershipSource !== undefined && dto.ownershipStatus === undefined;

  if (
    strayOwnershipSource ||
    actions.filter((action) => action !== undefined).length !== 1
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryBulkInvalid,
    );
  }
}

/**
 * Applies `apply` to each entry in turn — one after the other, so each one's
 * side effects (XP, achievements, activity) land exactly as a single update's
 * would. `apply` resolves false when the entry needed no change.
 */
export async function applyToEntries<T>(
  entries: T[],
  apply: (entry: T) => Promise<boolean>,
): Promise<BulkEntriesResultDto> {
  let updated = 0;

  for (const entry of entries) {
    if (await apply(entry)) updated++;
  }

  return { updated, skipped: entries.length - updated };
}

/**
 * Runs the one action `dto` carries on every entry, through the domain's own
 * single-entry operations. An entry already in the requested state is
 * skipped rather than written again, so it emits no duplicate activity.
 */
export function applyBulkUpdate(
  entries: BulkEntryRow[],
  dto: BulkUpdateEntriesDto,
  ops: {
    update: (id: string, patch: BulkEntryPatch) => Promise<unknown>;
    addToList: (itemId: string, listId: string) => Promise<boolean>;
    /** Replaces the plain status write (media derives its status from viewings). */
    setStatus?: (entry: BulkEntryRow, status: string) => Promise<boolean>;
  },
): Promise<BulkEntriesResultDto> {
  return applyToEntries(entries, async (entry) => {
    if (dto.listId !== undefined)
      return ops.addToList(entry.itemId, dto.listId);

    if (dto.status !== undefined) {
      if (entry.status === dto.status) return false;
      if (ops.setStatus) return ops.setStatus(entry, dto.status);
      await ops.update(entry.id, { status: dto.status });
      return true;
    }

    if (dto.favorite !== undefined) {
      if (entry.favorite === dto.favorite) return false;
      await ops.update(entry.id, { favorite: dto.favorite });
      return true;
    }

    if (dto.ownershipStatus !== undefined) {
      // Without a source, any previous one ("Netflix") goes: it described
      // the former way of owning the work.
      const source = dto.ownershipSource ?? null;
      if (
        entry.ownershipStatus === dto.ownershipStatus &&
        entry.ownershipSource === source
      )
        return false;
      await ops.update(entry.id, {
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: source,
      });
      return true;
    }

    return false;
  });
}

/** Adds a work to a list like the unit action does; false when it's already there. */
export async function addToList(
  lists: ListService,
  userId: string,
  listId: string,
  targetType: ListItemTargetType,
  targetId: string,
): Promise<boolean> {
  try {
    await lists.addItem(userId, listId, { targetType, targetId });
    return true;
  } catch (err) {
    if (
      err instanceof AppException &&
      err.code === ErrorCode.ListItemAlreadyExists
    ) {
      return false;
    }

    throw err;
  }
}
