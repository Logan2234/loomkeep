import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ExternalRatingChips from "./ExternalRatingChips.svelte";
describe("ExternalRatingChips", () => {
  it("keeps scores with external sources as safe links and other scores as plain text", () => {
    render(ExternalRatingChips, {
      ratings: [
        { source: "IMDb", score: "8.1", url: "https://imdb.com/title/tt123" },
        { source: "Unknown", score: "7" },
      ],
    });
    const link = screen.getByRole("link", { name: "IMDb 8.1" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Unknown").parentElement?.className).toContain(
      "bg-surface-2",
    );
  });
  it("preserves the contrast fallback on poster overlays", () => {
    render(ExternalRatingChips, {
      ratings: [{ source: "Unknown", score: "7" }],
      overlay: true,
    });
    expect(screen.getByText("Unknown").parentElement?.className).toContain(
      "bg-white/15",
    );
  });
});
