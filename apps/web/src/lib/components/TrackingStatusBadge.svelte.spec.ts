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

  it("marks a caught-up series with a calendar, waiting for the next episode", () => {
    const { container } = render(TrackingStatusBadge, {
      props: { domain: "MEDIA", status: "UP_TO_DATE" },
    });

    expect(screen.getByText(m.media_status_caught_up())).toBeTruthy();
    expect(
      container.querySelector('[data-status-icon="calendar"]'),
    ).toBeTruthy();
  });

  it("gives an album still to hear a note", () => {
    const { container } = render(TrackingStatusBadge, {
      props: { domain: "MUSIC", status: "TO_LISTEN" },
    });

    expect(screen.getByText(m.music_status_to_listen())).toBeTruthy();
    expect(container.querySelector('[data-status-icon="music"]')).toBeTruthy();
  });
});
