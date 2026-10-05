export const CANONICAL_EXTERNAL_ID_SELECT = {
  canonicalSource: true,
  externalIds: { select: { source: true, externalId: true } },
} as const;

/**
 * A catalogue item's external ID in its own canonical source (always present
 * in practice; falls back to "" if the canonical ref is somehow missing).
 *
 * Works across every domain (media/game/book) because their external-id rows
 * share the same `{ source, externalId }` shape and their items a
 * `canonicalSource` — comparison is on the source enum value, structurally.
 */
export function canonicalExternalId(
  item: { canonicalSource: string },
  externalIds: readonly { source: string; externalId: string }[],
): string {
  return (
    externalIds.find((ext) => ext.source === item.canonicalSource)
      ?.externalId ?? ""
  );
}

/**
 * Projects catalogue external-id rows (which carry extra columns) down to the
 * `{ source, externalId }` pairs the data-export DTOs expose. Domain-agnostic,
 * same as {@link canonicalExternalId}.
 */
export function toExternalIdDtos(
  externalIds: readonly { source: string; externalId: string }[],
): { source: string; externalId: string }[] {
  return externalIds.map((id) => ({
    source: id.source,
    externalId: id.externalId,
  }));
}
