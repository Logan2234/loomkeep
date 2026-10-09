import { describe, expect, it } from "vitest";
import {
  chatPreview,
  parseChatMarkdown,
  readSlashCommand,
  selectionFormats,
  toggleFormat,
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

describe("chatPreview", () => {
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
