import { m } from "#lib/paraglide/messages.js";
import { describe, expect, it } from "vitest";
import {
  BOOK_DIRECT_STATUS_TARGETS,
  GAME_DIRECT_STATUS_TARGETS,
  getStatusCorrections,
  statusCorrectionLabel,
} from "./status-corrections";

const BOOK_STATUSES = ["TO_READ", "READING", "READ", "DROPPED"] as const;
const GAME_STATUSES = ["BACKLOG", "PLAYING", "COMPLETED", "DROPPED"] as const;

describe("getStatusCorrections", () => {
  it("keeps only the exceptional correction while reading or playing", () => {
    expect(
      getStatusCorrections(
        BOOK_STATUSES,
        "READING",
        BOOK_DIRECT_STATUS_TARGETS.READING,
      ),
    ).toEqual(["TO_READ"]);
    expect(
      getStatusCorrections(
        GAME_STATUSES,
        "PLAYING",
        GAME_DIRECT_STATUS_TARGETS.PLAYING,
      ),
    ).toEqual(["BACKLOG"]);
  });

  it("does not duplicate resume actions for dropped works", () => {
    expect(
      getStatusCorrections(
        BOOK_STATUSES,
        "DROPPED",
        BOOK_DIRECT_STATUS_TARGETS.DROPPED,
      ),
    ).toEqual(["TO_READ", "READ"]);
    expect(
      getStatusCorrections(
        GAME_STATUSES,
        "DROPPED",
        GAME_DIRECT_STATUS_TARGETS.DROPPED,
      ),
    ).toEqual(["BACKLOG", "COMPLETED"]);
  });

  it("offers every other status when no quick action exists", () => {
    expect(getStatusCorrections(BOOK_STATUSES, "TO_READ")).toEqual([
      "READING",
      "READ",
      "DROPPED",
    ]);
    expect(getStatusCorrections(GAME_STATUSES, "COMPLETED")).toEqual([
      "BACKLOG",
      "PLAYING",
      "DROPPED",
    ]);
  });
});

describe("statusCorrectionLabel", () => {
  // A game in progress with sessions can't go back to the backlog: with no
  // correction left, the menu used to offer an editor with nothing in it.
  it("offers no correction when none is left", () => {
    expect(statusCorrectionLabel([], "Remettre à jouer")).toBe(null);
  });

  it("names the only correction, or opens the editor for several", () => {
    expect(statusCorrectionLabel(["BACKLOG"], "Remettre à jouer")).toBe(
      "Remettre à jouer",
    );
    expect(statusCorrectionLabel(["BACKLOG", "COMPLETED"], "x")).toBe(
      m.tracking_correct_status(),
    );
  });
});
