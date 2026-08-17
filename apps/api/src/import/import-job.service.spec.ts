import type { ConfigService } from "@nestjs/config";
import { Domain, type ImportSource } from "@loomkeep/shared";
import type { PrismaService } from "../prisma/prisma.service";
import { ImportJobService } from "./import-job.service";
import type { ImportReq } from "./import-source";

function fakeSource(id: ImportSource, requiredEnvKeys?: string[]): ImportReq {
  return {
    id,
    searchDomain: Domain.MEDIA,
    supportsOverwrite: false,
    requiredEnvKeys,
    parseInput: () => ({}),
    buildPlan: async () => ({
      groups: [],
      counts: { total: 0, matched: 0, unresolved: 0, apiErrors: 0 },
      searchDomain: Domain.MEDIA,
    }),
    commit: async () => ({ overwrite: false, tiles: [] }),
  };
}

describe("ImportJobService.getAvailability", () => {
  it("omits sources with no required env keys, and reports configured/unconfigured ones", () => {
    const config = {
      get: jest.fn((key: string) => (key === "SET_KEY" ? "value" : undefined)),
    };
    const service = new ImportJobService(
      [
        fakeSource("tvtime"), // no config of its own
        fakeSource("trakt", ["SET_KEY"]),
        fakeSource("simkl", ["SET_KEY", "MISSING_KEY"]),
      ],
      {} as PrismaService,
      config as unknown as ConfigService,
    );

    const availability = service.getAvailability();

    expect(availability).toEqual({
      trakt: true,
      simkl: false,
    });
    expect(availability.tvtime).toBeUndefined();
  });
});
