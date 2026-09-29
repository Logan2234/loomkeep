import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SessionWeekChart from "./SessionWeekChart.svelte";

describe("SessionWeekChart", () => {
  it("renders an accessible seven-day summary and scales the bars", () => {
    const days = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-09-${String(14 + index).padStart(2, "0")}`,
      durationMinutes: index === 0 ? 75 : 0,
      sessionCount: index === 0 ? 2 : 0,
    }));

    const { container } = render(SessionWeekChart, { props: { days } });

    const accessibleDays = screen.getAllByRole("listitem");
    expect(accessibleDays).toHaveLength(7);
    expect(accessibleDays[0]?.textContent).toContain("1 h 15 min");
    expect(accessibleDays[1]?.textContent).toContain("0 min");

    const bars = container.querySelectorAll<HTMLElement>("span[style]");
    expect(bars).toHaveLength(7);
    expect(bars[0]?.style.height).toBe("100%");
    expect(bars[1]?.style.height).toBe("4%");
  });
});
