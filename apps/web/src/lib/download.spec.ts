import { describe, expect, it, vi } from "vitest";
import { datedFilename, downloadBlob } from "./download";

const { shareFile } = vi.hoisted(() => ({
  shareFile: vi.fn(() => Promise.resolve()),
}));
vi.mock("./native/app-shell", () => ({ isNativeApp: () => true }));
vi.mock("./native/share", () => ({ shareFile }));

describe("export filenames", () => {
  it("preserves UTC dates, prefixes and extensions", () => {
    const date = new Date("2026-10-11T00:30:00+02:00");
    expect(datedFilename("loomkeep-export-logan", "json", date)).toBe(
      "loomkeep-export-logan-2026-10-10.json",
    );
    expect(datedFilename("loomkeep-books", "csv", date)).toBe(
      "loomkeep-books-2026-10-10.csv",
    );
  });
});

describe("downloads in the Android app", () => {
  it("go through the share sheet, the WebView having no downloads", () => {
    downloadBlob("{}", "application/json", "loomkeep-export.json");

    expect(shareFile).toHaveBeenCalledWith("{}", "loomkeep-export.json");
  });
});
