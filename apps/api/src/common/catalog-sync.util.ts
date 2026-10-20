export const CATALOG_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export function isCatalogFresh(lastSyncedAt: Date): boolean {
  return Date.now() - lastSyncedAt.getTime() < CATALOG_SYNC_TTL_MS;
}
