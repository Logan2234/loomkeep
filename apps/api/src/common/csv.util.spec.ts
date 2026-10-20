import { parseCsv } from "./csv.util";

describe("parseCsv", () => {
  it("parses a simple table into header-keyed records", () => {
    const records = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
    expect(records).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("handles quoted fields with commas and doubled quotes", () => {
    const records = parseCsv('name,note\n"Doe, John","say ""hi"""\n');
    expect(records).toEqual([{ name: "Doe, John", note: 'say "hi"' }]);
  });

  it("handles embedded newlines inside quoted fields", () => {
    const records = parseCsv('title,body\n"Line 1\nLine 2",ok\n');
    expect(records).toEqual([{ title: "Line 1\nLine 2", body: "ok" }]);
  });

  it("accepts CRLF line endings and a missing final newline", () => {
    const records = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(records).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("fills missing trailing cells with empty strings", () => {
    const records = parseCsv("a,b,c\n1,2\n");
    expect(records).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("returns no records for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
