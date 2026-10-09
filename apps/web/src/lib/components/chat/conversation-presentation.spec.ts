import type { ConversationDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { neighbourConversation } from "./conversation-presentation";

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
