import { describe, expect, it } from "vitest";
import {
  chatPreview,
  episodeSeries,
  formatShortcut,
  mentionToken,
  parseChatMarkdown,
  placeUserMentions,
  readSlashCommand,
  selectionFormats,
  toggleFormat,
  withUserTokens,
} from "./chat-markdown";

describe("parseChatMarkdown", () => {
  it("reads every format of the subset", () => {
    expect(
      parseChatMarkdown("**gras** *italique* ~~barré~~ `code` ||spoiler||"),
    ).toEqual([
      { type: "strong", children: [{ type: "text", text: "gras" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "italique" }] },
      { type: "text", text: " " },
      { type: "strike", children: [{ type: "text", text: "barré" }] },
      { type: "text", text: " " },
      { type: "code", text: "code" },
      { type: "text", text: " " },
      { type: "spoiler", children: [{ type: "text", text: "spoiler" }] },
    ]);
  });

  it("nests formats inside a spoiler", () => {
    expect(parseChatMarkdown("||Helly **reste**||")).toEqual([
      {
        type: "spoiler",
        children: [
          { type: "text", text: "Helly " },
          { type: "strong", children: [{ type: "text", text: "reste" }] },
        ],
      },
    ]);
  });

  it("reads three stars as bold and italic", () => {
    expect(parseChatMarkdown("***les deux***")).toEqual([
      {
        type: "strong",
        children: [
          { type: "em", children: [{ type: "text", text: "les deux" }] },
        ],
      },
    ]);
  });

  it("closes an italic inside a bold on three stars", () => {
    expect(parseChatMarkdown("**gras *italique***")).toEqual([
      {
        type: "strong",
        children: [
          { type: "text", text: "gras " },
          { type: "em", children: [{ type: "text", text: "italique" }] },
        ],
      },
    ]);
  });

  it("leaves markers inside code alone", () => {
    expect(parseChatMarkdown("`**pas gras**`")).toEqual([
      { type: "code", text: "**pas gras**" },
    ]);
  });

  it("keeps a lone or empty marker as text", () => {
    expect(parseChatMarkdown("5 * 3 et ****")).toEqual([
      { type: "text", text: "5 * 3 et ****" },
    ]);
  });

  it("links bare URLs without their trailing punctuation", () => {
    expect(
      parseChatMarkdown("Vu sur https://loomkeep.app/app/lists/1."),
    ).toEqual([
      { type: "text", text: "Vu sur " },
      { type: "link", href: "https://loomkeep.app/app/lists/1" },
      { type: "text", text: "." },
    ]);
  });

  // Someone else's text never turns into markup.
  it("never produces HTML from the text", () => {
    expect(parseChatMarkdown("<img src=x onerror=alert(1)>")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)>" },
    ]);
  });
});

describe("blocks", () => {
  it("reads quotes, lists and code blocks line by line", () => {
    expect(
      parseChatMarkdown(
        "Avant\n> elle a dit\n> **non**\n- un\n- deux\n```\nconst x = 1;\n```",
      ),
    ).toEqual([
      { type: "text", text: "Avant" },
      {
        type: "quote",
        children: [
          { type: "text", text: "elle a dit\n" },
          { type: "strong", children: [{ type: "text", text: "non" }] },
        ],
      },
      {
        type: "list",
        items: [
          [{ type: "text", text: "un" }],
          [{ type: "text", text: "deux" }],
        ],
      },
      { type: "codeblock", text: "const x = 1;" },
    ]);
  });

  it("leaves an unclosed code fence as text", () => {
    expect(parseChatMarkdown("```\npas fermé")).toEqual([
      { type: "text", text: "```\npas fermé" },
    ]);
  });
});

describe("work mentions and episode codes", () => {
  it("reads a work mention and a padded episode code", () => {
    expect(
      parseChatMarkdown(
        `${mentionToken("Severance", "/app/media/series/95396")} s2e5 !`,
      ),
    ).toEqual([
      {
        type: "mention",
        title: "Severance",
        href: "/app/media/series/95396",
      },
      { type: "text", text: " " },
      { type: "episode", season: 2, episode: 5, code: "S02E05" },
      { type: "text", text: " !" },
    ]);
  });

  // A mention may only point at a work page: it can't hide another link.
  it("keeps a mention of anything but a work page as text", () => {
    expect(parseChatMarkdown("#[Clique](https://example.com)")).toEqual([
      { type: "text", text: "#[Clique](" },
      { type: "link", href: "https://example.com" },
      { type: "text", text: ")" },
    ]);
  });

  it("doesn't read an episode code inside a word", () => {
    expect(parseChatMarkdown("ABS2E5")).toEqual([
      { type: "text", text: "ABS2E5" },
    ]);
  });

  it("links episode codes to the only series of the message", () => {
    const nodes = parseChatMarkdown(
      `${mentionToken("Severance", "/app/media/series/95396")} S02E05`,
    );

    expect(episodeSeries(nodes, [])).toBe("/app/media/series/95396");
    expect(episodeSeries(nodes, ["/app/media/anime/21"])).toBe(null);
    expect(episodeSeries(parseChatMarkdown("S02E05"), [])).toBe(null);
  });
});

describe("chatPreview", () => {
  it("shows mentions by their title and spaces out blocks", () => {
    expect(
      chatPreview(
        `${mentionToken("Severance", "/app/media/series/95396")} **gr**as\n- un\n- deux`,
      ),
    ).toBe("#Severance gras un · deux");
  });

  it("drops the markers and hides spoilers", () => {
    expect(chatPreview("La fin : ||Helly reste|| **fou**")).toBe(
      "La fin : ••• fou",
    );
  });
});

describe("toggleFormat", () => {
  it("wraps a plain selection and keeps it on the same words", () => {
    expect(toggleFormat("La fin est folle", 3, 6, "spoiler")).toEqual({
      value: "La ||fin|| est folle",
      start: 5,
      end: 8,
    });
  });

  it("takes the format off when its markers surround the selection", () => {
    expect(toggleFormat("un **mot**", 5, 8, "bold")).toEqual({
      value: "un mot",
      start: 3,
      end: 6,
    });
  });

  it("takes the format off when the selection holds its markers", () => {
    expect(toggleFormat("un ~~mot~~", 3, 10, "strike")).toEqual({
      value: "un mot",
      start: 3,
      end: 6,
    });
  });

  it("adds italic to a bold word, then takes each off separately", () => {
    const both = toggleFormat("**mot**", 2, 5, "italic");
    expect(both).toEqual({ value: "***mot***", start: 3, end: 6 });
    expect(toggleFormat(both.value, both.start, both.end, "bold")).toEqual({
      value: "*mot*",
      start: 1,
      end: 4,
    });
    expect(toggleFormat(both.value, both.start, both.end, "italic")).toEqual({
      value: "**mot**",
      start: 2,
      end: 5,
    });
  });
});

describe("selectionFormats", () => {
  it("tells bold from italic around the same stars", () => {
    expect(selectionFormats("**mot**", 2, 5)).toEqual(["bold"]);
    expect(selectionFormats("*mot*", 1, 4)).toEqual(["italic"]);
    expect(selectionFormats("***mot***", 3, 6)).toEqual(["bold", "italic"]);
    expect(selectionFormats("||~~mot~~||", 4, 7)).toEqual(["strike"]);
  });
});

describe("readSlashCommand", () => {
  it("sends the rest of a /spoiler message masked", () => {
    expect(readSlashCommand("/spoiler Mark reste")).toEqual({
      text: "Mark reste",
      spoiler: true,
    });
  });

  it("sends anything else as typed", () => {
    expect(readSlashCommand("  /spoilers ne compte pas ")).toEqual({
      text: "/spoilers ne compte pas",
      spoiler: false,
    });
  });
});

describe("comment mentions", () => {
  it("links a comment's mentions where they sit, and leaves stale ones plain", () => {
    const text = withUserTokens("Salut @lea et @malo", [
      { username: "lea", start: 6 },
      { username: "zoe", start: 14 },
    ]);
    expect(text).toBe("Salut @[@lea](/app/u/lea) et @malo");
    expect(parseChatMarkdown(text)).toEqual([
      { type: "text", text: "Salut " },
      { type: "user", label: "@lea", href: "/app/u/lea" },
      { type: "text", text: " et @malo" },
    ]);
  });

  it("places each pick on its own @username, skipping longer names", () => {
    expect(
      placeUserMentions("@leane puis @lea, encore @lea", [
        { id: "u1", username: "lea" },
        { id: "u1", username: "lea" },
        { id: "u2", username: "malo" },
      ]),
    ).toEqual([
      { userId: "u1", start: 12 },
      { userId: "u1", start: 25 },
    ]);
  });
});

describe("episode codes in a work's discussion", () => {
  const series = "/app/media/series/95396";

  it("point at the discussion's series when the comment names no other", () => {
    expect(episodeSeries(parseChatMarkdown("Ce S2E5 !"), [], series)).toBe(
      series,
    );
  });

  it("point at the one series the comment names instead", () => {
    const nodes = parseChatMarkdown(
      "Comme #[Dark](/app/media/series/70523) S1E3",
    );
    expect(episodeSeries(nodes, [], series)).toBe("/app/media/series/70523");
  });
});

describe("formatShortcut", () => {
  // Unit tests run in Node, without DOM events: only the read fields matter.
  const key = (init: Partial<KeyboardEvent>) =>
    ({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...init,
    }) as KeyboardEvent;

  it("reads Messages' shortcuts", () => {
    expect(formatShortcut(key({ key: "b", ctrlKey: true }))).toBe("bold");
    expect(
      formatShortcut(key({ key: "X", ctrlKey: true, shiftKey: true })),
    ).toBe("strike");
    expect(formatShortcut(key({ key: "b" }))).toBe(null);
  });
});
