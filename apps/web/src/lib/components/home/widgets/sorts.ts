import type { HomeWidgetSort } from "@loomkeep/shared";

/**
 * A widget's order as the library endpoints' `sort`. "recent" is their
 * default (last added); "progress" differs per domain, so each widget maps
 * it itself.
 */
export const ENTRY_SORTS: Partial<Record<HomeWidgetSort, string>> = {
  recent: "added",
  title: "title",
};
