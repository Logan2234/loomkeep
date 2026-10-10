import { layout } from "#lib/layout.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommentComposer, { type CommentDraft } from "./CommentComposer.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

beforeEach(() => {
  layout.compact = false;
});

function setup() {
  const sent: CommentDraft[] = [];
  renderWithQuery(CommentComposer, {
    id: "composer",
    targetType: "MEDIA",
    targetId: "m1",
    label: "Comment",
    submitLabel: "Publish",
    onsubmit: (draft) => {
      sent.push(draft);
      return Promise.resolve(true);
    },
  });
  return { sent, field: screen.getByRole("textbox", { name: "Comment" }) };
}

describe("CommentComposer", () => {
  it("sends on Enter, as Messages does, and empties", async () => {
    const user = userEvent.setup();
    const { sent, field } = setup();

    await user.type(field, "Quelle **fin**{Shift>}{Enter}{/Shift}vraiment");
    await user.keyboard("{Enter}");

    expect(sent).toEqual([
      { text: "Quelle **fin**\nvraiment", spoilerTag: false, mentions: [] },
    ]);
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
  });

  it("masks the whole comment with /spoiler", async () => {
    const user = userEvent.setup();
    const { sent, field } = setup();

    await user.type(field, "/spoiler Il meurt à la fin");
    await user.keyboard("{Enter}");

    expect(sent[0]).toMatchObject({
      text: "Il meurt à la fin",
      spoilerTag: true,
    });
  });

  it("sends a person picked with @ where their name ends up", async () => {
    server.use(
      http.get(apiUrl("/comments/MEDIA/m1/participants"), () =>
        HttpResponse.json([
          {
            id: "u1",
            username: "lea",
            displayName: "Léa",
            avatarUrl: null,
            profileAccess: "PUBLIC",
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    const { sent, field } = setup();

    await user.type(field, "Merci @le");
    await user.click(await screen.findByRole("option", { name: /Léa/ }));
    await user.type(field, "!");
    await user.keyboard("{Enter}");

    expect(sent[0]).toMatchObject({
      text: "Merci @lea !",
      mentions: [{ userId: "u1", start: 6 }],
    });
  });
});
