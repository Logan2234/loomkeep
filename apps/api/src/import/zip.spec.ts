import { makeZip } from "./make-zip";
import { readZipEntries, readZipEntriesMatching } from "./zip";

describe("readZipEntries", () => {
  it("extracts wanted entries, decoding both STORED and DEFLATE", () => {
    const zip = makeZip([
      { name: "a.csv", content: "hello,world", method: 0 }, // stored
      { name: "b.csv", content: "x".repeat(500), method: 8 }, // deflated
    ]);

    const out = readZipEntries(zip, new Set(["a.csv", "b.csv"]));
    expect(out.get("a.csv")).toBe("hello,world");
    expect(out.get("b.csv")).toBe("x".repeat(500));
  });

  it("matches by base name, case-insensitively, ignoring folders", () => {
    const zip = makeZip([
      { name: "gdpr-data/User_TV_Show_Data.csv", content: "col\nval" },
    ]);

    const out = readZipEntries(zip, new Set(["user_tv_show_data.csv"]));
    expect(out.get("user_tv_show_data.csv")).toBe("col\nval");
  });

  it("skips entries that are not wanted", () => {
    const zip = makeZip([
      { name: "keep.csv", content: "yes" },
      { name: "drop.csv", content: "no" },
    ]);

    const out = readZipEntries(zip, new Set(["keep.csv"]));
    expect(out.has("keep.csv")).toBe(true);
    expect(out.has("drop.csv")).toBe(false);
    expect(out.size).toBe(1);
  });

  it("throws on a buffer that is not a ZIP archive", () => {
    expect(() => readZipEntries(Buffer.from("not a zip"), new Set())).toThrow(
      /not a zip/i,
    );
  });

  it("rejects an entry whose declared uncompressed size exceeds the limit", () => {
    const zip = makeZip([{ name: "large.csv", content: "small" }]);
    const centralHeader = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(32 * 1024 * 1024 + 1, centralHeader + 24);

    expect(() => readZipEntries(zip, new Set(["large.csv"]))).toThrow(
      /uncompressed/i,
    );
  });

  it("bounds inflation even when the declared size is dishonest", () => {
    const zip = makeZip([
      {
        name: "dishonest.csv",
        content: "x".repeat(32 * 1024 * 1024 + 1),
        method: 8,
      },
    ]);
    const centralHeader = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(1, centralHeader + 24);

    expect(() => readZipEntries(zip, new Set(["dishonest.csv"]))).toThrow(
      /uncompressed/i,
    );
  }, 15_000);
});

describe("readZipEntriesMatching", () => {
  it("extracts every entry whose lowercased base name satisfies the predicate", () => {
    const zip = makeZip([
      { name: "watched-history-1.json", content: "[1]" },
      { name: "watched-history-2.json", content: "[2]" },
      { name: "Watched-History-10.json", content: "[10]" },
      { name: "watched-movies.json", content: "[]" },
    ]);

    const out = readZipEntriesMatching(zip, (name) =>
      name.startsWith("watched-history-"),
    );

    expect(out.size).toBe(3);
    expect(out.get("watched-history-1.json")).toBe("[1]");
    expect(out.get("watched-history-2.json")).toBe("[2]");
    expect(out.get("watched-history-10.json")).toBe("[10]");
    expect(out.has("watched-movies.json")).toBe(false);
  });
});
