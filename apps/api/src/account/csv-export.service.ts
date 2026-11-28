import { ErrorCode } from "@loomkeep/shared/catalog";
import type { Domain } from "@loomkeep/shared/enums";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { DomainRegistry } from "../library/domain-registry";

/**
 * Flat, per-domain CSV export for migrating to another tool (Storygraph,
 * a spreadsheet…) — unlike `DataExportService`'s nested GDPR dump, this is one
 * row per library entry and deliberately ignores `User.enabledDomains`: a
 * domain the user hid from their own nav is still theirs to export.
 */
@Injectable()
export class CsvExportService {
  constructor(private readonly registry: DomainRegistry) {}

  async buildCsv(userId: string, domain: Domain): Promise<string> {
    if (this.registry.has(domain)) {
      return this.registry.get(domain).exportCsv(userId);
    }

    // Planned domains with no backing tables yet — the UI keeps their CSV
    // buttons disabled, so this only guards a hand-crafted request.
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.UserCsvExportUnavailable,
      { domain },
      `CSV export is not available for the '${domain}' domain yet`,
    );
  }
}
