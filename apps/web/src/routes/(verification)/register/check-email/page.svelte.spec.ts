import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { RealtimeEvent, type UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import CheckEmailPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const { listeners } = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
}));
vi.mock("#lib/realtime/socket.js", () => ({
  connectRealtimeSocket: vi.fn(),
  onRealtimeEvent: (event: string, handler: () => void) => {
    listeners.set(event, handler);
    return () => listeners.delete(event);
  },
}));

function signIn(email: string) {
  auth.user = {
    id: "u1",
    displayName: "Alice",
    email,
    emailVerified: false,
  } as UserDto;
}

beforeEach(() => {
  listeners.clear();
  server.use(
    http.get(apiUrl("/showcase"), () => HttpResponse.json({ posters: [] })),
  );
});

it("offers to open the webmail of a known address", async () => {
  signIn("alice.martin@gmail.com");
  renderWithQuery(CheckEmailPage, {});

  const open = screen.getByRole("link", {
    name: m.auth_register_check_email_open_inbox({ inbox: "Gmail" }),
  });
  expect(open.getAttribute("href")).toBe("https://mail.google.com/");
  expect(screen.getByText("alice.martin@gmail.com")).toBeTruthy();
});

it("shows no webmail button for an address it can't place", () => {
  signIn("alice@loomkeep.app");
  renderWithQuery(CheckEmailPage, {});

  const openLabel = m
    .auth_register_check_email_open_inbox({ inbox: "" })
    .trim();
  const openLinks = screen
    .queryAllByRole("link")
    .filter((link) => link.textContent?.trim().startsWith(openLabel));
  expect(openLinks).toEqual([]);
});

it("turns to confirmed when the link is opened elsewhere", async () => {
  signIn("alice.martin@gmail.com");
  renderWithQuery(CheckEmailPage, {});

  listeners.get(RealtimeEvent.EMAIL_VERIFIED)?.();

  expect(
    await screen.findByText(m.auth_register_check_email_confirmed()),
  ).toBeTruthy();
  expect(auth.user?.emailVerified).toBe(true);
  expect(
    screen.queryByRole("button", {
      name: m.auth_register_check_email_resend(),
    }),
  ).toBeNull();
});
