import type {
  AdminUpdateStatusDto,
  AdminUpgradeNotesDto,
  InstancePingDto,
  InstancePingResultDto,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HTTP_TIMEOUT_MS } from "../common/http.util";
import { isHostedOrigin } from "../common/instance-defaults";
import { primaryWebOrigin } from "../common/web-origin.util";
import { instanceSetting } from "../instance-settings/instance-settings.store";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";
import { PrismaService } from "../prisma/prisma.service";
import { upgradeNotesBetween } from "./upgrade-notes.util";

// The six package.json versions move in lockstep, and the images published
// on GHCR are built from `main`: its root package.json is the version a
// `docker compose pull` would bring.
export const LATEST_PACKAGE_URL =
  "https://raw.githubusercontent.com/Logan2234/loomkeep/main/package.json";

// Read for its "Breaking changes" sections, from the same branch as above.
const LATEST_CHANGELOG_URL =
  "https://raw.githubusercontent.com/Logan2234/loomkeep/main/CHANGELOG.md";

// Received by InstancePingController on the hosted instance, which answers
// the latest version: LATEST_PACKAGE_URL is only the fallback when it can't.
export const INSTANCE_PING_URL = "https://loomkeep.app/api/instances/ping";

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
 * Tells self-hosters a newer Loomkeep exists, once a day. With
 * `telemetryEnabled` the question goes to the hosted instance along with a
 * random instance id and the running version, nothing else, which is how
 * self-hosted instances are counted; without it, it's one GET of a public
 * file. Admins are emailed once per new version (`ADMIN_UPDATE_AVAILABLE`,
 * off by default).
 */
@Injectable()
export class UpdateCheckService {
  private readonly logger = new Logger(UpdateCheckService.name);
  private currentVersion: string | null = null;
  // Keyed by "current→latest": the CHANGELOG is fetched once per pair.
  private notesCache: { key: string; notes: AdminUpgradeNotesDto } | null =
    null;

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
            ? "Could not fetch the latest version"
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
    if (this.sendsTelemetry()) {
      const answered = await this.ping();
      if (answered !== null) return answered;
    }

    return this.readPublishedVersion();
  }

  /**
   * Never from the hosted instance (it receives the pings) nor from a dev or
   * test run, which would otherwise be counted as self-hosted instances.
   */
  private sendsTelemetry(): boolean {
    const nodeEnv = this.config.get<string>("NODE_ENV");
    return (
      instanceSetting(this.config, "telemetryEnabled") &&
      nodeEnv !== "development" &&
      nodeEnv !== "test" &&
      !isHostedOrigin(primaryWebOrigin(this.config.get<string>("WEB_ORIGIN")))
    );
  }

  /**
   * What to do before upgrading to the latest known version. Empty when up
   * to date, when checks are off (no outbound call then), or when the
   * CHANGELOG can't be fetched (the card keeps its link to the full notes).
   */
  async upgradeNotes(): Promise<AdminUpgradeNotesDto> {
    const { enabled, currentVersion, latestVersion, updateAvailable } =
      await this.status();
    if (!enabled || !updateAvailable || latestVersion === null)
      return { versions: [] };

    const key = `${currentVersion}→${latestVersion}`;
    if (this.notesCache?.key === key) return this.notesCache.notes;

    try {
      const response = await fetch(LATEST_CHANGELOG_URL, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const notes = {
        versions: upgradeNotesBetween(
          await response.text(),
          currentVersion,
          latestVersion,
        ),
      };
      this.notesCache = { key, notes };
      return notes;
    } catch (err) {
      this.logger.warn(
        `Upgrade notes unavailable: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      return { versions: [] };
    }
  }

  private async ping(): Promise<string | null> {
    try {
      const response = await fetch(INSTANCE_PING_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId: await this.instanceId(),
          version: await this.readCurrentVersion(),
        } satisfies InstancePingDto),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { latestVersion } = (await response.json()) as Partial<
        Record<keyof InstancePingResultDto, unknown>
      >;

      if (typeof latestVersion !== "string" || !VERSION.test(latestVersion)) {
        throw new Error("no x.y.z version in the answer");
      }

      return latestVersion;
    } catch (err) {
      this.logger.warn(
        `Instance ping failed, falling back to GitHub: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      return null;
    }
  }

  private async instanceId(): Promise<string> {
    const row = await this.prisma.updateCheck.findUnique({ where: { id: 1 } });
    if (row?.instanceId) return row.instanceId;

    const instanceId = randomUUID();
    await this.prisma.updateCheck.upsert({
      where: { id: 1 },
      create: { id: 1, instanceId },
      update: { instanceId },
    });
    return instanceId;
  }

  private async readPublishedVersion(): Promise<string | null> {
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
