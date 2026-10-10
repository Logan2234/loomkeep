import { stripTags } from "./text.util";

describe("stripTags", () => {
  it("preserves the providers' cleanup of malformed tags", () => {
    expect(stripTags("  <<b>script>value</script>  ")).toBe("script>value");
  });

  it("preserves the Open Library treatment of breaks and empty tags", () => {
    expect(stripTags("first<br />second<>")).toBe("firstsecond");
  });

  it("preserves AniList line breaks without stripping empty tags", () => {
    expect(
      stripTags("first<BR/>second<>", {
        brToNewline: true,
        stripEmptyTags: false,
      }),
    ).toBe("first\nsecond<>");
  });
});
