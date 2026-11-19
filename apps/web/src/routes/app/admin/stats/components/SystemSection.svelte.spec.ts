import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { AdminSystemSectionDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SystemSection from "./SystemSection.svelte";

function stats(
  selfHostedInstances: AdminSystemSectionDto["selfHostedInstances"],
): AdminSystemSectionDto {
  return {
    generatedAt: "2026-11-19T08:00:00.000Z",
    providerCalls: [],
    ops: {
      notificationsTotal: 0,
      pushSubscriptions: 0,
      failedLogins24h: 0,
      lastBackup: null,
    },
    selfHostedInstances,
  };
}

describe("SystemSection", () => {
  it("counts the self-hosted instances by version on the hosted instance", () => {
    renderWithQuery(SystemSection, {
      stats: stats({
        active30d: 7,
        versions: [
          { version: "1.15.0", instances: 5 },
          { version: "1.14.0", instances: 2 },
        ],
      }),
    });

    expect(
      screen.getByRole("heading", { name: m.admin_system_instances_title() }),
    ).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("1.15.0")).toBeTruthy();
    expect(screen.getByText("1.14.0")).toBeTruthy();
  });

  it("says so before any instance has checked in", () => {
    renderWithQuery(SystemSection, {
      stats: stats({ active30d: 0, versions: [] }),
    });

    expect(screen.getByText(m.admin_system_instances_empty())).toBeTruthy();
  });

  it("shows no instance card on a self-host", () => {
    renderWithQuery(SystemSection, { stats: stats(null) });

    expect(
      screen.queryByRole("heading", { name: m.admin_system_instances_title() }),
    ).toBeNull();
  });
});
