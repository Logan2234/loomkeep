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
    main.id = "main";
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

  // The fullscreen chat renders a <main> of its own next to the shell's.
  it("reaches the shell's main even when another <main> comes first", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<main id="chat">Chat</main><main id="main">Library</main>`,
    );
    const user = userEvent.setup();
    render(SkipLink);

    await user.click(
      screen.getByRole("link", { name: m.common_skip_to_content() }),
    );
    expect(document.activeElement?.id).toBe("main");
    document.querySelectorAll("main").forEach((element) => element.remove());
  });
});
