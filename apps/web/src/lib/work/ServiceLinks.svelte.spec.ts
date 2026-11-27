import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ServiceLinks from "./ServiceLinks.svelte";

describe("ServiceLinks", () => {
  it("draws a logo where there is one and a monogram otherwise", () => {
    render(ServiceLinks, {
      links: [
        { service: "STEAM", url: "https://store.steampowered.com/app/1" },
        { service: "XBOX", url: "https://www.xbox.com/games/store/x/1" },
      ],
    });

    const steam = screen.getByRole("link", { name: "Steam" });
    expect(steam.querySelector("svg path")).toBeTruthy();
    const xbox = screen.getByRole("link", { name: /Xbox/ });
    expect(xbox.querySelector("svg")).toBeNull();
    expect(xbox.textContent).toContain("X");
  });
});
