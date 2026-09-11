import { readFileSync } from "node:fs";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";

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
    "%s uses the shared focus contract",
    (component) => {
      expect(componentSource(component)).toContain("use:dialogFocus");
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
});
