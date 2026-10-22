import { afterEach, describe, expect, it, vi } from "vitest";
import { shareFile, shareNatively } from "./share";

const { share, writeFile } = vi.hoisted(() => ({
  share: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("@capacitor/share", () => ({ Share: { share } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { writeFile },
}));

afterEach(() => {
  share.mockReset();
  writeFile.mockReset();
});

describe("shareNatively", () => {
  it("treats closing the sheet as done, not as an error", async () => {
    share.mockRejectedValue(new Error("Share canceled"));

    await expect(shareNatively({ url: "https://x" })).resolves.toBeUndefined();
  });

  it("still surfaces a real failure", async () => {
    share.mockRejectedValue(new Error("No activity found"));

    await expect(shareNatively({ url: "https://x" })).rejects.toThrow(
      "No activity found",
    );
  });
});

describe("shareFile", () => {
  it("writes the export to the cache and shares that file", async () => {
    writeFile.mockResolvedValue({ uri: "file:///cache/export.json" });
    share.mockResolvedValue({});

    await shareFile("{}", "export.json");

    expect(writeFile).toHaveBeenCalledWith({
      path: "export.json",
      data: "{}",
      directory: "CACHE",
      encoding: "utf8",
    });
    expect(share).toHaveBeenCalledWith({
      files: ["file:///cache/export.json"],
    });
  });

  it("opens one sheet at a time, in order, even after a failure", async () => {
    writeFile.mockImplementation(({ path }: { path: string }) =>
      Promise.resolve({ uri: `file:///cache/${path}` }),
    );
    const opened: string[] = [];
    let closeFirst!: () => void;
    share
      .mockImplementationOnce(({ files }: { files: string[] }) => {
        opened.push(files[0]);
        return new Promise<void>((resolve) => (closeFirst = resolve));
      })
      .mockImplementationOnce(() => Promise.reject(new Error("boom")))
      .mockImplementation(({ files }: { files: string[] }) => {
        opened.push(files[0]);
        return Promise.resolve();
      });

    const first = shareFile("a", "a.csv");
    const second = shareFile("b", "b.csv");
    const third = shareFile("c", "c.csv");
    await vi.waitFor(() => expect(opened).toEqual(["file:///cache/a.csv"]));

    closeFirst();
    await first;
    await expect(second).rejects.toThrow("boom");
    await third;
    expect(opened).toEqual(["file:///cache/a.csv", "file:///cache/c.csv"]);
  });
});
