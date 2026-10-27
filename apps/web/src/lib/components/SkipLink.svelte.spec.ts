import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SkipLink from "./SkipLink.svelte";

describe("SkipLink", () => {
  // Each of the four app shells renders its own <main>: the link must reach
  // whichever one is mounted, past the navigation.
  it("is the first stop for the keyboard and moves focus into the page's main", async () => {
    const main = document.createElement("main");
    main.textContent = "Library";
    document.body.append(main);
    const user = userEvent.setup();
    render(SkipLink);

    await user.tab();
    const link = screen.getByRole("link", { name: m.common_skip_to_content() });
    expect(document.activeElement).toBe(link);

    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(main);
    main.remove();
  });
});
