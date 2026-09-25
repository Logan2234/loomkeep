import type { SettingsSectionDef } from "./nav";

export function settingsShortcutIndex(
  code: string,
  shiftKey: boolean,
): number | null {
  const match = /^Digit([0-9])$/.exec(code);
  if (!match) return null;

  const digit = Number(match[1]);
  if (shiftKey) return digit === 0 ? null : digit + 10;

  return digit === 0 ? 10 : digit;
}

export function settingsShortcutLabel(index: number): string | null {
  if (index >= 1 && index <= 9) return `Alt ${index}`;
  if (index === 10) return "Alt 0";
  if (index >= 11 && index <= 19) return `Alt ⇧${index - 10}`;

  return null;
}

export function numberedSettingsSection(
  index: number,
  sections: readonly SettingsSectionDef[],
): SettingsSectionDef | null {
  return index < 1 || index > 19 ? null : (sections[index - 1] ?? null);
}
