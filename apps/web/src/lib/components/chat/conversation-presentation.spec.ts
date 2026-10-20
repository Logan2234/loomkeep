import { m } from "#lib/paraglide/messages.js";
import type { ConversationDto, WorkThreadDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  neighbourConversation,
  workThreadContext,
  workThreadPreview,
} from "./conversation-presentation";

const list = ["a", "b", "c"].map((id) => ({ id }) as ConversationDto);

describe("neighbourConversation", () => {
  it("moves up and down the list, and stops at its ends", () => {
    expect(neighbourConversation(list, "b", 1)).toBe("c");
    expect(neighbourConversation(list, "b", -1)).toBe("a");
    expect(neighbourConversation(list, "c", 1)).toBe(null);
  });

  it("starts from the first when none is open", () => {
    expect(neighbourConversation(list, null, 1)).toBe("a");
    expect(neighbourConversation([], null, 1)).toBe(null);
  });
});

const thread = (over: Partial<WorkThreadDto>) =>
  ({
    seasonNumber: null,
    episodeNumber: null,
    lastComment: null,
    ...over,
  }) as WorkThreadDto;

describe("workThreadContext", () => {
  it("names a season's or an episode's discussion, not the work's own", () => {
    expect(workThreadContext(thread({ seasonNumber: 2 }))).toBe(
      `${m.common_season()} 2`,
    );
    expect(
      workThreadContext(thread({ seasonNumber: 2, episodeNumber: 5 })),
    ).toBe("S02E05");
    expect(workThreadContext(thread({}))).toBe(null);
  });
});

describe("workThreadPreview", () => {
  it("never shows a spoiler's text", () => {
    const preview = workThreadPreview(
      thread({ lastComment: { authorName: "Léa", mine: false, text: null } }),
    );
    expect(preview).toBe(
      m.chat_work_preview({ name: "Léa", text: m.chat_work_spoiler() }),
    );
  });

  it("says who wrote it", () => {
    expect(
      workThreadPreview(
        thread({ lastComment: { authorName: "Léa", mine: true, text: "Oui" } }),
      ),
    ).toBe(m.chat_preview_mine({ text: "Oui" }));
  });
});
