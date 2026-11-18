import { AcquisitionSource } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { acquisitionSourceOrder } from "./acquisition-sources";

const ALL = Object.values(AcquisitionSource);

describe("acquisitionSourceOrder", () => {
  it("offers every source once, Other last", () => {
    const order = acquisitionSourceOrder(null);

    expect([...order].sort()).toEqual([...ALL].sort());
    expect(order.at(-1)).toBe(AcquisitionSource.OTHER);
  });

  it("shuffles the rest", () => {
    const first = acquisitionSourceOrder(null, () => 0);
    const last = acquisitionSourceOrder(null, () => 0.999);

    expect(first.slice(0, -1)).not.toEqual(last.slice(0, -1));
  });

  it("keeps the order stored for the session", () => {
    const stored = acquisitionSourceOrder(null).slice(0, -1).join(",");

    expect(acquisitionSourceOrder(stored, () => 0).join(",")).toBe(
      `${stored},${AcquisitionSource.OTHER}`,
    );
  });

  it("draws a new order when the stored one no longer matches the sources", () => {
    const order = acquisitionSourceOrder("REDDIT,GONE", () => 0);

    expect([...order].sort()).toEqual([...ALL].sort());
  });
});
