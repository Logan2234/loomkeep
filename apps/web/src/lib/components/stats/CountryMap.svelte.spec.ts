import { formatHours, formatRegion } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CountryMap from "./CountryMap.svelte";

const COUNTRIES = [
  { country: "US", titles: 12, minutes: 900 },
  { country: "KR", titles: 3, minutes: 1500 },
  // Too small to draw at this scale: it still has its line.
  { country: "SG", titles: 1, minutes: 95 },
];

describe("the map of countries of origin", () => {
  it("ranks every country by titles, those too small to draw included", async () => {
    const { container } = render(CountryMap, { countries: COUNTRIES });

    const labels = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(labels[0]).toContain(formatRegion("US"));
    expect(labels[2]).toContain(formatRegion("SG"));
    expect(
      screen.getByText(m.stats_video_country_titles_many({ count: 12 })),
    ).toBeTruthy();

    await waitFor(() =>
      expect(container.querySelector("svg path")).toBeTruthy(),
    );
  });

  it("ranks by watch time once switched to time", async () => {
    render(CountryMap, { countries: COUNTRIES });

    await fireEvent.click(
      screen.getByRole("button", { name: m.common_time() }),
    );

    const first = screen.getAllByRole("listitem")[0].textContent ?? "";
    expect(first).toContain(formatRegion("KR"));
    expect(first).toContain(formatHours(1500));
  });
});
