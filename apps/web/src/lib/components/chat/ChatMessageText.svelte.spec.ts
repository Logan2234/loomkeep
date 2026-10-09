import { auth } from "#lib/auth.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ChatMessageText from "./ChatMessageText.svelte";

beforeEach(() => {
  auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
});

afterEach(() => {
  auth.user = null;
});

describe("ChatMessageText", () => {
  it("links a mention to its work and an episode code to that series", () => {
    renderWithQuery(ChatMessageText, {
      text: "#[Severance](/app/media/series/95396) S02E05",
    });

    expect(
      screen.getByRole("link", { name: "#Severance" }).getAttribute("href"),
    ).toBe("/app/media/series/95396");
    expect(
      screen.getByRole("link", { name: "S02E05" }).getAttribute("href"),
    ).toBe("/app/media/series/95396#s2e5");
  });

  it("renders quotes, lists and code blocks", () => {
    const { container } = renderWithQuery(ChatMessageText, {
      text: "> cité\n- un\n```\nbloc\n```",
    });

    expect(container.querySelector("blockquote")?.textContent).toBe("cité");
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(container.querySelector("pre")?.textContent).toBe("bloc");
  });
});
