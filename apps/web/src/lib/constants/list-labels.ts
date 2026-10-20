import { m } from "#lib/paraglide/messages.js";
import { ListKind, ListVisibility } from "@loomkeep/shared";

export const LIST_KIND_LABEL: Record<ListKind, string> = {
  get RANKED() {
    return m.lists_kind_ranked();
  },
  get COLLECTION() {
    return m.lists_kind_collection();
  },
};
export const LIST_VISIBILITY_LABEL: Record<ListVisibility, string> = {
  get PRIVATE() {
    return m.common_private();
  },
  get FRIENDS() {
    return m.common_friends();
  },
  get PUBLIC() {
    return m.common_public();
  },
};

/** "1 œuvre", "13 œuvres". */
export function workCountLabel(count: number): string {
  return count === 1
    ? m.lists_work_count_one({ count })
    : m.lists_work_count_many({ count });
}
