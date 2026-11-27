import type { SelectOption } from "#lib/types/select-option.js";

export function labeledOptions<T extends string>(
  labels: Record<T, string | { label: string }>,
  values: readonly T[],
): SelectOption<T>[] {
  return values.map((value) => {
    const label = labels[value];
    return { value, label: typeof label === "string" ? label : label.label };
  });
}
