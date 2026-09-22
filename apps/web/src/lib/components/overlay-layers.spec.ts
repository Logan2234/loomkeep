import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ELEVATED_SIDE_PANEL_BACKDROP_Z_INDEX,
  MODAL_Z_INDEX,
} from "./overlay-layers";

const componentSource = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("overlay layers", () => {
  it("reserves a layer above an elevated side panel for nested modals", () => {
    expect(MODAL_Z_INDEX).toBeGreaterThan(
      ELEVATED_SIDE_PANEL_BACKDROP_Z_INDEX + 1,
    );
  });

  it("portals the desktop modal and uses the top layer on both layouts", () => {
    const modal = componentSource("Modal.svelte");

    expect(modal).toContain("use:portal");
    expect(modal).toContain('style="z-index: {MODAL_Z_INDEX}"');
    expect(modal).toContain("zIndex={MODAL_Z_INDEX}");
  });

  it("keeps elevated side panels on the reserved layer below modals", () => {
    const commentsPanel = componentSource("CommentsPanel.svelte");
    const userDrawer = readFileSync(
      new URL(
        "../../routes/app/admin/users/components/UserDrawer.svelte",
        import.meta.url,
      ),
      "utf8",
    );

    for (const source of [commentsPanel, userDrawer]) {
      expect(source).toContain("zIndex={ELEVATED_SIDE_PANEL_BACKDROP_Z_INDEX}");
    }
  });
});
