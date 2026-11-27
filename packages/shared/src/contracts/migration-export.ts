/** One CSV of a migration export, importable on its own. */
export interface MigrationExportFileDto {
  /** Base name, without date nor extension: "letterboxd-diary-2". */
  name: string;
  csv: string;
}

/**
 * A library in another service's import format (Letterboxd, Goodreads). Several
 * files when the service imports them separately, or caps their size.
 */
export interface MigrationExportDto {
  files: MigrationExportFileDto[];
}
