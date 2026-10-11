import { compareText } from "#lib/format.js";
import type { MyListDto } from "@loomkeep/shared";
const comparators = {
  recent: (a: MyListDto, b: MyListDto) =>
    b.updatedAt.localeCompare(a.updatedAt),
  created: (a: MyListDto, b: MyListDto) =>
    b.createdAt.localeCompare(a.createdAt),
  size: (a: MyListDto, b: MyListDto) => b.itemCount - a.itemCount,
  title: (a: MyListDto, b: MyListDto) => compareText(a.title, b.title),
};

export function listComparator(sort: string) {
  switch (sort) {
    case "created":
    case "createdAt":
      return comparators.created;
    case "size":
    case "itemCount":
      return comparators.size;
    case "title":
      return comparators.title;
    default:
      return comparators.recent;
  }
}
