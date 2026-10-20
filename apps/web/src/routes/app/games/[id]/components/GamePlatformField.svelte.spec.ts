import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GamePlatformField from "./GamePlatformField.svelte";

const PLATFORMS = ["Nintendo Switch", "PC (Microsoft Windows)"];

describe("GamePlatformField", () => {
  it("offers only the game's own platforms, and saves the one picked", async () => {
    const onChange = vi.fn();
    render(GamePlatformField, {
      platform: null,
      platforms: PLATFORMS,
      onChange,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: `${m.game_platform_title()} : ${m.game_platform_unset()}`,
      }),
    );
    expect(
      screen
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent?.trim()),
    ).toEqual([m.game_platform_unset(), ...PLATFORMS]);
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Nintendo Switch" }),
    );

    expect(onChange).toHaveBeenCalledWith("Nintendo Switch");
  });

  it("clears the platform set", async () => {
    const onChange = vi.fn();
    render(GamePlatformField, {
      platform: "Nintendo Switch",
      platforms: PLATFORMS,
      onChange,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: `${m.game_platform_title()} : Nintendo Switch`,
      }),
    );
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: m.game_platform_unset() }),
    );

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
