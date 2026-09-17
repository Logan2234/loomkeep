import type { ReviewTargetType } from "@loomkeep/shared";
import { readStorage, removeStorage, writeStorage } from "./local-storage";

// An unsaved review survives an accidental close (backdrop tap, swipe,
// Escape) on this device only. Losing it to a private window or a full
// quota just means no restore — same degradation as before drafts existed.
export interface ReviewDraft {
  rating: number | null;
  text: string;
  spoilerTag: boolean;
}

// Scoped per account: a shared browser must never restore someone else's
// unsent text into the next person's form.
const keyOf = (
  userId: string,
  targetType: ReviewTargetType,
  targetId: string,
) => `loomkeep.reviewDraft.${userId}.${targetType}:${targetId}`;

function isDraft(value: unknown): value is ReviewDraft {
  const d = value as ReviewDraft | null;
  return (
    typeof d === "object" &&
    d !== null &&
    (d.rating === null ||
      (typeof d.rating === "number" && d.rating >= 0 && d.rating <= 10)) &&
    typeof d.text === "string" &&
    typeof d.spoilerTag === "boolean"
  );
}

export function readReviewDraft(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string,
): ReviewDraft | null {
  const raw = readStorage(keyOf(userId, targetType, targetId));
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeReviewDraft(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string,
  draft: ReviewDraft,
): void {
  writeStorage(keyOf(userId, targetType, targetId), JSON.stringify(draft));
}

export function clearReviewDraft(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string,
): void {
  removeStorage(keyOf(userId, targetType, targetId));
}
