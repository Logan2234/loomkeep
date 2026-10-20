import type {
  AdminBackupInventoryDto,
  JobDto,
  ServiceStatusDto,
} from "@loomkeep/shared";
import { expect, it } from "vitest";
import { adminAttentionData } from "./admin-attention";

it("counts only latest job failures and picks a physically available backup", () => {
  const jobs = [
    { key: "recovered", runs: [{ status: "SUCCESS" }, { status: "FAILURE" }] },
    { key: "failed", runs: [{ status: "FAILURE" }] },
  ] as JobDto[];
  const backups = {
    files: [
      { id: "missing", status: "MISSING", createdAt: "2026-10-04" },
      { id: "valid", status: "AVAILABLE", createdAt: "2026-10-03" },
    ],
    orphans: [{}],
  } as AdminBackupInventoryDto;
  const services = [
    { key: "optional", configured: false, required: false },
    { key: "required", configured: false, required: true },
    { key: "future", comingSoon: true, configured: false, required: true },
  ] as ServiceStatusDto[];
  const result = adminAttentionData(services, jobs, backups);
  expect(result.failed.map((job) => job.key)).toEqual(["failed"]);
  expect(result.degraded.map((service) => service.key)).toEqual(["required"]);
  expect(result.latest?.id).toBe("valid");
  expect(result.anomalies).toBe(2);
});
it("keeps unavailable inventory distinct from an empty successful inventory", () => {
  expect(adminAttentionData(null, null, null).latest).toBeNull();
  expect(
    adminAttentionData([], [], { files: [], orphans: [] }).available,
  ).toEqual([]);
});
