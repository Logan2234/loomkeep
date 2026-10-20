import type {
  AdminBackupInventoryDto,
  JobDto,
  ServiceStatusDto,
} from "@loomkeep/shared";

export function adminAttentionData(
  services: ServiceStatusDto[] | null,
  jobs: JobDto[] | null,
  backups: AdminBackupInventoryDto | null,
) {
  const degraded =
    services?.filter(
      (service) =>
        !service.comingSoon &&
        (service.configured ? service.reachable === false : service.required),
    ) ?? [];
  const failed = jobs?.filter((job) => job.runs[0]?.status === "FAILURE") ?? [];
  const available =
    backups?.files.filter((file) => file.status === "AVAILABLE") ?? [];
  const latest = available.reduce<(typeof available)[number] | null>(
    (latest, file) =>
      !latest || file.createdAt > latest.createdAt ? file : latest,
    null,
  );
  const anomalies =
    (backups?.files.filter((file) => file.status === "MISSING").length ?? 0) +
    (backups?.orphans.length ?? 0);
  return { degraded, failed, available, latest, anomalies };
}
