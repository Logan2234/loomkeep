import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import TrackingStatusBadge from "./TrackingStatusBadge.svelte";

describe("TrackingStatusBadge", () => {
  it("uses an open book for a reading in progress", () => {
    const { container } = render(TrackingStatusBadge, {
      props: { domain: "BOOKS", status: "READING" },
    });

    expect(screen.getByText(m.book_status_reading())).toBeTruthy();
    expect(
      container.querySelector('[data-status-icon="book-open"]'),
    ).toBeTruthy();
  });

  it("uses the same completed treatment for game tracking", () => {
    const { container } = render(TrackingStatusBadge, {
      props: { domain: "GAMES", status: "COMPLETED" },
    });

    expect(screen.getByText(m.library_status_completed())).toBeTruthy();
    expect(container.querySelector('[data-status-icon="check"]')).toBeTruthy();
  });
});
