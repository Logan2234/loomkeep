import { readFileSync } from "node:fs";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";
import { bannerRole } from "./banner-semantics";

const componentSource = (name: string) =>
  readFileSync(new URL(`./${name}.svelte`, import.meta.url), "utf8");

function buttonTypes(source: string): Array<string | undefined> {
  const types: Array<string | undefined> = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);

    const node = value as Record<string, unknown>;

    if (node.type === "RegularElement" && node.name === "button") {
      const attributes = node.attributes as Array<Record<string, unknown>>;
      const type = attributes.find(
        (attribute) =>
          attribute.type === "Attribute" && attribute.name === "type",
      );
      const value = type?.value as Array<Record<string, unknown>> | undefined;
      types.push(value?.[0]?.data as string | undefined);
    }

    for (const [key, child] of Object.entries(node)) {
      if (!["metadata", "loc", "css"].includes(key)) visit(child);
    }
  }

  visit(parse(source, { modern: true }));
  return types;
}

describe("shared component contracts", () => {
  it.each(["Dropdown", "Modal", "FocusOverlay", "Drawer"])(
    "%s internal buttons never submit an enclosing form",
    (component) => {
      expect(buttonTypes(componentSource(component))).not.toContain(undefined);
      expect(buttonTypes(componentSource(component))).not.toContain("submit");
    },
  );

  it.each(["Modal", "Drawer", "FocusOverlay", "Lightbox"])(
    "%s uses the shared focus contract exactly once",
    (component) => {
      expect(componentSource(component).match(/use:dialogFocus/g)).toHaveLength(
        1,
      );
    },
  );

  it("does not render a close button for a non-dismissible modal backdrop", () => {
    const source = componentSource("Modal");

    expect(source).not.toContain("dismissable && onclose()");
    expect(source).toContain("{#if dismissable}");
  });

  it("exposes determinate and indeterminate progress semantics", () => {
    const source = componentSource("ProgressBar");

    expect(source).toContain('role="progressbar"');
    expect(source).toContain("aria-valuemin");
    expect(source).toContain("aria-valuemax");
    expect(source).toContain("aria-valuenow");
    expect(source).toContain("aria-label");
    expect(source).toContain("aria-labelledby");
  });

  it("keeps carousel navigation visible and usable from the keyboard", () => {
    const source = componentSource("Carousel");

    expect(source).toContain('role="region"');
    expect(source).toContain("tabindex={hasFocusableChildren ? undefined : 0}");
    expect(source).toContain("aria-label={label}");
    expect(source).toContain("onkeydown={onKeydown}");
    expect(source).toContain("focus-visible:opacity-100");
  });

  it("exposes combobox selection through one composite tab stop", () => {
    const source = componentSource("Combobox");

    expect(source).toContain('role="combobox"');
    expect(source).toContain("aria-activedescendant");
    expect(source).toContain("aria-multiselectable");
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain("aria-disabled");
  });

  it("supports arrow navigation and restores focus in dropdown menus", () => {
    const source = componentSource("Dropdown");
    const reviewCard = componentSource("ReviewCard");

    expect(source).toContain("onTriggerKeydown");
    expect(source).toContain("onPanelKeydown");
    expect(source).toContain("triggerElement?.focus()");
    expect(reviewCard).toContain("{ open, toggle, onkeydown }");
    expect(reviewCard).toContain("{onkeydown}");
  });

  it("opens tooltips for keyboard focus and dismisses them with Escape", () => {
    const source = componentSource("Tooltip");

    expect(source).toContain("onfocusin={onFocusIn}");
    expect(source).toContain("onfocusout={onFocusOut}");
    expect(source).toContain('e.key === "Escape"');
    expect(source).toContain('setAttribute("aria-describedby"');
  });

  it("announces dynamic banner content without making informational copy noisy", () => {
    expect(bannerRole("error", "auto")).toBe("alert");
    expect(bannerRole("warning", "auto")).toBeUndefined();
    expect(bannerRole("info", "polite")).toBe("status");
    expect(bannerRole("neutral", "assertive")).toBe("alert");
    expect(bannerRole("error", "off")).toBeUndefined();

    const source = componentSource("Banner");
    expect(source).toContain("role={bannerRole(variant, live)}");
    expect(source).toContain(
      '{#if variant === "error" || variant === "warning"}',
    );
  });

  it("keeps page heading semantics limited to the title", () => {
    const heading =
      componentSource("PageHeader").match(/<h1[\s\S]*?<\/h1>/)?.[0];

    expect(heading).toContain("{title}");
    expect(heading).not.toContain("<a");
    expect(heading).not.toContain("<Icon");
    expect(heading).not.toContain("<NewBadge");
  });

  it("portals the lightbox while preserving focus and scroll contracts", () => {
    const source = componentSource("Lightbox");

    expect(source).toContain("use:portal");
    expect(source).toContain("use:scrollLock");
    expect(source).toContain("use:dialogFocus");
  });

  it.each(["CardRowSkeleton", "PosterGridSkeleton"])(
    "%s exposes one named busy region and hides its placeholder artwork",
    (component) => {
      const source = componentSource(component);

      expect(source).toContain('role="status"');
      expect(source).toContain('aria-busy="true"');
      expect(source).toContain('aria-hidden="true"');
      expect(source).toContain("m.common_loading()");
    },
  );

  it("uses readable foregrounds for confirmed contrast failures", () => {
    expect(componentSource("BetaBadge")).not.toContain("opacity-60");
    expect(componentSource("Poster")).toContain("text-btn-fg");
    expect(componentSource("Banner")).toContain(
      'error: "border-danger/40 bg-danger/10 text-fg"',
    );
    expect(componentSource("ProviderMark")).toContain(
      "style:color={mark.foreground}",
    );
  });
});
