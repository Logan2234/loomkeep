import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CreatorNames from "./CreatorNames.svelte";

describe("CreatorNames", () => {
  it("links each person to their page, with one badge for the row", () => {
    const { container } = renderWithQuery(CreatorNames, {
      refs: [
        { source: "tmdb", id: "1219174", name: "Craig Mazin" },
        { source: "tmdb", id: "1234567", name: "Neil Druckmann" },
      ],
      newBadge: true,
    });

    expect(
      screen.getByRole("link", { name: "Craig Mazin" }).getAttribute("href"),
    ).toBe("/app/people/tmdb/1219174");
    expect(
      screen.getByRole("link", { name: "Neil Druckmann" }).getAttribute("href"),
    ).toBe("/app/people/tmdb/1234567");
    expect(screen.getAllByText(m.common_new())).toHaveLength(1);
    expect(container.textContent).toContain(
      `Craig Mazin,Neil Druckmann ${m.common_new()}`,
    );
  });

  it("leaves a name as text when its source has no page yet", () => {
    renderWithQuery(CreatorNames, {
      refs: [{ source: "anilist", id: "95185", name: "Keiichirō Saitō" }],
    });

    expect(screen.getByText("Keiichirō Saitō")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
