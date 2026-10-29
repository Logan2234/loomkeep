import { DATETIME_LONG_OPTIONS, formatDateTime } from "#lib/format.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import RelativeTime from "./RelativeTime.svelte";

describe("RelativeTime", () => {
  // aria-label is ignored on a <time> (it has no role that takes a name), so
  // the absolute date has to be text for a screen reader to get it.
  it("gives screen readers the absolute date", () => {
    const iso = "2026-02-05T10:01:30.000Z";
    render(RelativeTime, { iso });

    expect(
      screen.getByText(formatDateTime(iso, DATETIME_LONG_OPTIONS)),
    ).toBeTruthy();
  });
});
