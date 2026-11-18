import { IMPORT_SOURCE_NAMES, type ImportSource } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";

/**
 * Warns the operators when someone's import fails while being applied, so a
 * failure doesn't wait for the next visit to Admin › Imports. Best-effort:
 * an alert that can't go out must never affect the import's own outcome.
 */
@Injectable()
export class ImportAlertService {
  private readonly logger = new Logger(ImportAlertService.name);

  constructor(
    private readonly mail: MailService,
    private readonly adminAlerts: AdminAlertService,
  ) {}

  async importFailed(sourceId: ImportSource, error: string): Promise<void> {
    const source = IMPORT_SOURCE_NAMES[sourceId];

    try {
      await this.adminAlerts.notify("ADMIN_IMPORT_FAILED", {
        email: (admin) =>
          this.mail.sendImportAlert(admin, {
            source,
            error: error.split("\n")[0],
          }),
        push: (copy) => ({
          ...copy.adminAlerts.importFailed(source),
          url: "/app/admin/imports?status=FAILURE",
        }),
      });
    } catch (err) {
      this.logger.error(`Import alert for ${sourceId} failed`, err);
    }
  }
}
