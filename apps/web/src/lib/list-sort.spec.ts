import type { MyListDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { listComparator } from "./list-sort";
const older = {
  title: "Alpha",
  createdAt: "2025-01-01",
  updatedAt: "2025-03-01",
  itemCount: 2,
} as MyListDto;
const newer = {
  title: "Zulu",
  createdAt: "2025-02-01",
  updatedAt: "2025-02-01",
  itemCount: 5,
} as MyListDto;
describe("listComparator", () => {
  it.each<[string, MyListDto]>([
    ["recent", older],
    ["updatedAt", older],
    ["unknown", older],
    ["created", newer],
    ["createdAt", newer],
    ["size", newer],
    ["itemCount", newer],
    ["title", older],
  ])("preserves %s ordering for saved widgets and list pages", (key, first) => {
    expect([older, newer].sort(listComparator(key))[0]).toBe(first);
  });
});
