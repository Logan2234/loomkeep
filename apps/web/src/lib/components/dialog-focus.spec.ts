import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("dialog focus contract", () => {
  it("shares focus management across every dialog primitive", () => {
    const action = readFileSync(
      new URL("../actions/dialogFocus.ts", import.meta.url),
      "utf8",
    );

    expect(action).toContain("previouslyFocused");
    expect(action).toContain('event.key !== "Tab"');
    expect(action).toContain("dialogStack");

    for (const name of ["Modal.svelte", "SidePanel.svelte", "Drawer.svelte"]) {
      expect(componentSource(name)).toContain("use:dialogFocus");
    }
  });

  it("locks page scrolling for desktop dialogs and side panels", () => {
    expect(componentSource("Modal.svelte")).toContain("use:scrollLock");
    expect(componentSource("SidePanel.svelte")).toContain("use:scrollLock");
  });
});
