/**
 * One persisted backup dump on disk, for the admin "Sauvegarde" page's
 * list/download/delete UI. Produced by the daily `backup.run` cron (also
 * triggerable on demand from /admin/jobs or the Sauvegarde page itself) —
 * pruned to the 7 most recent.
 */
export interface AdminBackupFileDto {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  status: "AVAILABLE" | "MISSING";
}

export interface AdminOrphanBackupFileDto {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AdminBackupInventoryDto {
  files: AdminBackupFileDto[];
  orphans: AdminOrphanBackupFileDto[];
}

/**
 * Age-encrypted, ASCII-armored content of one persisted backup, for
 * download — never plain SQL. Decrypt locally with
 * `age -d -o dump.sql <file>` before restoring.
 */
export interface AdminBackupFileContentDto {
  filename: string;
  content: string;
}

/** Replaces the entire instance database with a previously downloaded dump. */
export interface AdminBackupRestoreRequestDto {
  sql: string;
  currentPassword: string;
}
