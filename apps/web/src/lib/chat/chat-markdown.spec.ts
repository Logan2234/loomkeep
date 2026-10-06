import { describe, expect, it } from "vitest";
import {
  chatPreview,
  parseChatMarkdown,
  readSlashCommand,
  wrapSelection,
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

describe("chatPreview", () => {
  it("drops the markers and hides spoilers", () => {
    expect(chatPreview("La fin : ||Helly reste|| **fou**")).toBe(
      "La fin : ••• fou",
    );
  });
});

describe("wrapSelection", () => {
  it("wraps the selection and keeps it on the same words", () => {
    expect(wrapSelection("La fin est folle", 3, 6, "spoiler")).toEqual({
      value: "La ||fin|| est folle",
      start: 5,
      end: 8,
    });
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
