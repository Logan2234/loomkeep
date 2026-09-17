export type ListNavigationCommand = "next" | "previous" | "first" | "last";

export function getEnabledOptionIndex(
  options: ReadonlyArray<object & { disabled?: boolean }>,
  currentIndex: number,
  command: ListNavigationCommand,
): number {
  const enabled = options.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );
  if (enabled.length === 0) return -1;
  if (command === "first") return enabled[0];
  if (command === "last") return enabled.at(-1) ?? -1;

  const current = enabled.indexOf(currentIndex);

  if (current === -1) {
    return command === "next" ? enabled[0] : (enabled.at(-1) ?? -1);
  }

  const delta = command === "next" ? 1 : -1;
  return enabled[(current + delta + enabled.length) % enabled.length];
}
