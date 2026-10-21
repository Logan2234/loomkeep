import type { AdminUpdateStatusDto } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HTTP_TIMEOUT_MS } from "../common/http.util";
import { instanceSetting } from "../instance-settings/instance-settings.store";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";
import { PrismaService } from "../prisma/prisma.service";

// The five package.json versions move in lockstep, and the images published
// on GHCR are built from `main`: its root package.json is the version a
// `docker compose pull` would bring.
export const LATEST_PACKAGE_URL =
  "https://raw.githubusercontent.com/Logan2234/loomkeep/main/package.json";

const VERSION = /^\d+\.\d+\.\d+$/;

/** Whether `candidate` is a strictly later x.y.z than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  if (!VERSION.test(candidate) || !VERSION.test(current)) return false;
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }

  return false;
}

/**
 * Tells self-hosters a newer Loomkeep exists: one GET of a public file a day,
 * nothing about the instance sent along. Admins are emailed once per new
 * version (`ADMIN_UPDATE_AVAILABLE`, off by default).
 */
@Injectable()
export class UpdateCheckService {
  private readonly logger = new Logger(UpdateCheckService.name);
  private currentVersion: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly adminAlerts: AdminAlertService,
    private readonly jobRuns: JobRunService,
  ) {}

  @Cron("30 5 * * *", { name: JOB_KEYS.UPDATE_CHECK })
  async runScheduled(): Promise<AdminUpdateStatusDto> {
    return this.jobRuns.record(
      JOB_KEYS.UPDATE_CHECK,
      () => this.check(),
      (status) =>
        !status.enabled
          ? "Update check turned off"
          : status.lastCheckFailed
            ? "Could not reach GitHub"
            : status.updateAvailable
              ? `${status.latestVersion} available (running ${status.currentVersion})`
              : `Up to date (${status.currentVersion})`,
    );
  }

  async status(): Promise<AdminUpdateStatusDto> {
    const [currentVersion, row] = await Promise.all([
      this.readCurrentVersion(),
      this.prisma.updateCheck.findUnique({ where: { id: 1 } }),
    ]);
    const latestVersion = row?.latestVersion ?? null;
    return {
      enabled: instanceSetting(this.config, "updateCheckEnabled"),
      currentVersion,
      latestVersion,
      updateAvailable:
        latestVersion !== null && isNewerVersion(latestVersion, currentVersion),
      checkedAt: row?.checkedAt?.toISOString() ?? null,
      lastCheckFailed: row?.lastCheckFailed ?? false,
    };
  }

  async check(): Promise<AdminUpdateStatusDto> {
    if (!instanceSetting(this.config, "updateCheckEnabled")) {
      return this.status();
    }

    const latest = await this.fetchLatestVersion();

    if (latest === null) {
      await this.prisma.updateCheck.upsert({
        where: { id: 1 },
        create: { id: 1, lastCheckFailed: true },
        update: { lastCheckFailed: true },
      });
      return this.status();
    }

    const row = await this.prisma.updateCheck.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        latestVersion: latest,
        checkedAt: new Date(),
        lastCheckFailed: false,
      },
      update: {
        latestVersion: latest,
        checkedAt: new Date(),
        lastCheckFailed: false,
      },
    });

    const current = await this.readCurrentVersion();

    if (isNewerVersion(latest, current) && row.notifiedVersion !== latest) {
      await this.notifyAdmins(current, latest);
    }

    return this.status();
  }

  private async notifyAdmins(current: string, latest: string): Promise<void> {
    await this.adminAlerts.notify("ADMIN_UPDATE_AVAILABLE", {
      email: (admin) => this.mail.sendUpdateAvailable(admin, current, latest),
      push: (copy) => ({
        ...copy.adminAlerts.updateAvailable(latest),
        url: "/app/admin/services",
      }),
    });
    await this.prisma.updateCheck.update({
      where: { id: 1 },
      data: { notifiedVersion: latest },
    });
  }

  private async fetchLatestVersion(): Promise<string | null> {
    try {
      const response = await fetch(LATEST_PACKAGE_URL, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { version } = (await response.json()) as { version?: unknown };

      if (typeof version !== "string" || !VERSION.test(version)) {
        throw new Error("no x.y.z version in the published package.json");
      }

      return version;
    } catch (err) {
      this.logger.warn(
        `Update check failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      return null;
    }
  }

  private async readCurrentVersion(): Promise<string> {
    if (this.currentVersion === null) {
      const raw = await readFile(
        join(__dirname, "../../package.json"),
        "utf-8",
      );
      this.currentVersion = (JSON.parse(raw) as { version: string }).version;
    }

    return this.currentVersion;
  }
}
