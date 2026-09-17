import type { ReviewTargetType } from "@loomkeep/shared";

// An unsaved review survives an accidental close (backdrop tap, swipe,
// Escape) on this device only. Losing it to a private window or a full
// quota just means no restore — same degradation as before drafts existed.
export interface ReviewDraft {
  rating: number | null;
  text: string;
  spoilerTag: boolean;
}

const PREFIX = "loomkeep.reviewDraft.";

const keyOf = (targetType: ReviewTargetType, targetId: string) =>
  `${PREFIX}${targetType}:${targetId}`;

function isDraft(value: unknown): value is ReviewDraft {
  const d = value as ReviewDraft | null;
  return (
    typeof d === "object" &&
    d !== null &&
    (d.rating === null || typeof d.rating === "number") &&
    typeof d.text === "string" &&
    typeof d.spoilerTag === "boolean"
  );
}

export function readReviewDraft(
  targetType: ReviewTargetType,
  targetId: string,
): ReviewDraft | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(keyOf(targetType, targetId));
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeReviewDraft(
  targetType: ReviewTargetType,
  targetId: string,
  draft: ReviewDraft,
): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(keyOf(targetType, targetId), JSON.stringify(draft));
  } catch {
    // See the module comment: a lost draft is acceptable.
  }
}

export function clearReviewDraft(
  targetType: ReviewTargetType,
  targetId: string,
): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(keyOf(targetType, targetId));
  } catch {
    // See the module comment: a lost draft is acceptable.
  }
}
