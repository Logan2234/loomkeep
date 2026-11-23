import { upgradeNotesBetween } from "./upgrade-notes.util";

const CHANGELOG = `# Changelog

## [Unreleased]

### Breaking changes

- Not released yet.

## 1.16.0 — Ratings

### Added

- Half points.

## 1.15.0 — Admin

### Breaking changes

- **Self-hosting: \`ADMIN_EMAIL\` waits.** When email is set up, that
  account becomes admin. Details:
  [Telemetry](https://docs.loomkeep.app/telemetry/).
- Second point.

### Added

- Not a breaking change.

## 1.14.0 — Studios

### Before upgrading a self-hosted instance

- Back up first.

## 1.12.0 — Old

### Breaking changes

- Already behind you.
`;

describe("upgradeNotesBetween", () => {
  it("keeps the action bullets of each newer version, oldest first", () => {
    expect(upgradeNotesBetween(CHANGELOG, "1.13.2", "1.16.0")).toEqual([
      { version: "1.14.0", items: ["Back up first."] },
      {
        version: "1.15.0",
        items: [
          "**Self-hosting: `ADMIN_EMAIL` waits.** When email is set up, that account becomes admin. Details: Telemetry.",
          "Second point.",
        ],
      },
    ]);
  });

  it("stops at the latest version and skips the unreleased section", () => {
    expect(upgradeNotesBetween(CHANGELOG, "1.14.0", "1.14.5")).toEqual([]);
  });
});
