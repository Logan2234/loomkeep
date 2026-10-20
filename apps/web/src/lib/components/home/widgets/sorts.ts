import {
  type BookSortKey,
  type GameSortKey,
  type HomeWidgetSort,
  type MusicSortKey,
} from "@loomkeep/shared";

/**
 * A widget's order as the library endpoints' `sort`. "recent" is their
 * default (last added); "progress" differs per domain, so each widget maps
 * it itself.
 */
export const ENTRY_SORTS: Partial<
  Record<HomeWidgetSort, BookSortKey & GameSortKey & MusicSortKey>
> = {
  recent: "added",
  title: "title",
};
