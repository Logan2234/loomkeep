import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import type { ListService } from "../lists/list.service";
import { AppException } from "./app.exception";
import {
  addToList,
  applyBulkUpdate,
  assertBulkUpdate,
  type BulkEntryRow,
} from "./bulk-entries.util";

const row = (overrides: Partial<BulkEntryRow> = {}): BulkEntryRow => ({
  id: "entry-1",
  itemId: "item-1",
  status: "PLAYING",
  favorite: false,
  ownershipStatus: "NONE",
  ownershipSource: null,
  ...overrides,
});

function ops() {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    addToList: vi.fn().mockResolvedValue(true),
  };
}

describe("assertBulkUpdate", () => {
  it.each([
    ["no target", { status: "PLAYING" }],
    ["two targets", { ids: ["a"], filters: {}, status: "PLAYING" }],
    ["no action", { ids: ["a"] }],
    ["two actions", { ids: ["a"], status: "PLAYING", favorite: true }],
    ["a source with no ownership", { ids: ["a"], ownershipSource: "Steam" }],
  ])("rejects a request with %s", (_label, dto) => {
    expect(() => assertBulkUpdate(dto)).toThrow(
      expect.objectContaining({ code: ErrorCode.LibraryBulkInvalid }),
    );
  });

  it("accepts one target and one action", () => {
    expect(() =>
      assertBulkUpdate({ filters: {}, favorite: false }),
    ).not.toThrow();
  });
});

describe("applyBulkUpdate", () => {
  it("writes the status through the domain's update and skips entries already there", async () => {
    const o = ops();

    const result = await applyBulkUpdate(
      [row({ id: "a" }), row({ id: "b", status: "COMPLETED" })],
      { ids: ["a", "b"], status: "COMPLETED" },
      o,
    );

    expect(o.update).toHaveBeenCalledTimes(1);
    expect(o.update).toHaveBeenCalledWith("a", { status: "COMPLETED" });
    expect(result).toEqual({ updated: 1, skipped: 1 });
  });

  it("sets the ownership source picked with it, and skips an entry already owned that way", async () => {
    const o = ops();

    const result = await applyBulkUpdate(
      [
        row({ id: "a", ownershipStatus: "DIGITAL" }),
        row({
          id: "b",
          ownershipStatus: "STREAMING",
          ownershipSource: "Netflix",
        }),
      ],
      {
        ids: ["a", "b"],
        ownershipStatus: "STREAMING",
        ownershipSource: "Netflix",
      },
      o,
    );

    expect(o.update).toHaveBeenCalledTimes(1);
    expect(o.update).toHaveBeenCalledWith("a", {
      ownershipStatus: "STREAMING",
      ownershipSource: "Netflix",
    });
    expect(result).toEqual({ updated: 1, skipped: 1 });
  });

  it("clears the ownership source along with a new ownership status", async () => {
    const o = ops();

    await applyBulkUpdate(
      [row({ ownershipStatus: "DIGITAL" })],
      { ids: ["entry-1"], ownershipStatus: "PHYSICAL" },
      o,
    );

    expect(o.update).toHaveBeenCalledWith("entry-1", {
      ownershipStatus: "PHYSICAL",
      ownershipSource: null,
    });
  });

  it("adds each work to the list and counts the ones already in it as skipped", async () => {
    const o = ops();
    o.addToList.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await applyBulkUpdate(
      [row({ itemId: "x" }), row({ id: "entry-2", itemId: "y" })],
      { ids: ["entry-1", "entry-2"], listId: "list-1" },
      o,
    );

    expect(o.addToList).toHaveBeenNthCalledWith(1, "x", "list-1");
    expect(o.addToList).toHaveBeenNthCalledWith(2, "y", "list-1");
    expect(result).toEqual({ updated: 1, skipped: 1 });
  });

  it("hands the status to the domain's own rule when it has one", async () => {
    const setStatus = vi.fn().mockResolvedValue(true);
    const o = { ...ops(), setStatus };

    await applyBulkUpdate(
      [row()],
      { ids: ["entry-1"], status: "COMPLETED" },
      o,
    );

    expect(setStatus).toHaveBeenCalledWith(row(), "COMPLETED");
    expect(o.update).not.toHaveBeenCalled();
  });
});

describe("addToList", () => {
  it("treats a work already in the list as skipped, not as a failure", async () => {
    const lists = {
      addItem: vi
        .fn()
        .mockRejectedValue(
          new AppException(409, ErrorCode.ListItemAlreadyExists),
        ),
    } as unknown as ListService;

    await expect(
      addToList(lists, "user-1", "list-1", "GAME", "item-1"),
    ).resolves.toBe(false);
  });
});
