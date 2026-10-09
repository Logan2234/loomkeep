import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ChatFriendPicker from "./ChatFriendPicker.svelte";

vi.mock("svelte/transition", () => ({ scale: () => ({ duration: 0 }) }));

describe("ChatFriendPicker", () => {
  // Forwarding: the friend of the conversation it comes from isn't offered.
  it("leaves out the friends excluded", async () => {
    server.use(
      http.get(apiUrl("/chat/friends"), () =>
        HttpResponse.json([
          { id: "u1", username: "lea", displayName: "Léa", avatarUrl: null },
          { id: "u2", username: "malo", displayName: "Malo", avatarUrl: null },
        ]),
      ),
      http.get(apiUrl("/chat/conversations"), () =>
        HttpResponse.json({ items: [], hasMore: false }),
      ),
    );
    renderWithQuery(ChatFriendPicker, {
      label: m.chat_forward_to(),
      exclude: ["lea"],
    });

    expect(await screen.findByRole("button", { name: /Malo/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Léa/ })).toBe(null);
  });
});
