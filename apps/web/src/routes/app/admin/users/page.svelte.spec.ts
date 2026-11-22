import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto, page, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { AdminUserDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const ROW: AdminUserDto = {
  id: "u1",
  email: "camille@example.com",
  username: "camille",
  displayName: "Camille",
  avatarUrl: null,
  emailVerified: true,
  role: "USER",
  plan: "FREE",
  createdAt: "2026-03-14T00:00:00.000Z",
  lastActiveAt: null,
  inactivityWarningSentAt: null,
  suspendedUntil: "2026-12-01T00:00:00.000Z",
  deletionScheduledFor: null,
  deletionReason: null,
  xp: 0,
  invitation: null,
  libraryCounts: { media: 3, games: 1, books: 0, music: 0 },
  enabledDomains: ["MEDIA"],
  secondFactors: ["WEBAUTHN"],
  onboarded: false,
  online: true,
};

let lastQuery: URLSearchParams | null;

beforeEach(() => {
  lastQuery = null;
  visit("/app/admin/users");
  auth.user = { id: "admin", role: "ADMIN" } as UserDto;
  server.use(
    http.get(apiUrl("/admin/users"), ({ request }) => {
      lastQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ items: [ROW], hasMore: false });
    }),
  );
});

describe("Admin users table", () => {
  it("links each account to its own page and shows its new facts", async () => {
    renderWithQuery(Page, {});

    const link = await screen.findByRole("link", { name: /Camille/ });
    expect(link.getAttribute("href")).toBe("/app/admin/users/u1");
    expect(screen.getAllByText(m.admin_users_online()).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(m.admin_users_onboarding_badge())).toBeTruthy();
    expect(screen.getByText(m.admin_users_factor_passkey())).toBeTruthy();
  });

  it("sorts on a header click, then flips the direction", async () => {
    const user = userEvent.setup();
    renderWithQuery(Page, {});
    await screen.findByRole("link", { name: /Camille/ });

    await user.click(screen.getByRole("button", { name: m.common_library() }));
    await waitFor(() =>
      expect(page.url.searchParams.get("sort")).toBe("library"),
    );
    await waitFor(() => expect(lastQuery?.get("sort")).toBe("library"));

    await user.click(screen.getByRole("button", { name: m.common_library() }));
    await waitFor(() => expect(page.url.searchParams.get("dir")).toBe("asc"));
    expect(goto).toHaveBeenCalled();
  });
});
