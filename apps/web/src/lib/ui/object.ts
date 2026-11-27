export function typedEntries<K extends string, V>(
  record: Record<K, V>,
): [K, V][] {
  return Object.entries(record) as [K, V][];
}

export function recordFrom<K extends string, V>(
  keys: readonly K[],
  value: (key: K, index: number) => V,
): Record<K, V> {
  return Object.fromEntries(
    keys.map((key, index) => [key, value(key, index)]),
  ) as Record<K, V>;
}
