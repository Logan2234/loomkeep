import { describe, expect, it } from "vitest";
import {
  numberedSettingsSection,
  settingsShortcutIndex,
  settingsShortcutLabel,
} from "./keyboard-navigation";
import type { SettingsSectionDef } from "./nav";

const sections = Array.from({ length: 15 }, (_, index) => ({
  slug: `section-${index + 1}`,
})) as SettingsSectionDef[];

describe("settings keyboard navigation", () => {
  it("maps every visible settings shortcut to its section", () => {
    expect(numberedSettingsSection(1, sections)?.slug).toBe("section-1");
    expect(numberedSettingsSection(10, sections)?.slug).toBe("section-10");
    expect(numberedSettingsSection(15, sections)?.slug).toBe("section-15");
  });

  it("does not resolve an unsupported shortcut number", () => {
    expect(numberedSettingsSection(0, sections)).toBeNull();
    expect(numberedSettingsSection(20, sections)).toBeNull();
  });

  it("uses Alt + 0 for the tenth section and Alt + Shift + number after it", () => {
    expect(settingsShortcutIndex("Digit1", false)).toBe(1);
    expect(settingsShortcutIndex("Digit0", false)).toBe(10);
    expect(settingsShortcutIndex("Digit1", true)).toBe(11);
    expect(settingsShortcutIndex("Digit5", true)).toBe(15);
    expect(settingsShortcutIndex("Digit0", true)).toBeNull();
  });

  it("formats the shortcut shown beside each section", () => {
    expect(settingsShortcutLabel(1)).toBe("Alt 1");
    expect(settingsShortcutLabel(10)).toBe("Alt 0");
    expect(settingsShortcutLabel(15)).toBe("Alt ⇧5");
    expect(settingsShortcutLabel(20)).toBeNull();
  });
});
