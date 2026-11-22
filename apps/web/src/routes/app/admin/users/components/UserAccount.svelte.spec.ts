import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { AdminUserDetailDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserAccount from "./UserAccount.svelte";

vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const DETAIL: AdminUserDetailDto = {
  user: {
    id: "u1",
    email: "camille@example.com",
    username: "camille",
    displayName: "Camille",
    avatarUrl: null,
    emailVerified: true,
    role: "USER",
    plan: "FREE",
    createdAt: "2026-03-14T00:00:00.000Z",
    lastActiveAt: "2026-11-20T00:00:00.000Z",
    inactivityWarningSentAt: null,
    suspendedUntil: null,
    deletionScheduledFor: null,
    deletionReason: null,
    xp: 0,
    invitation: { label: "Famille", createdByName: "Logan" },
    libraryCounts: { media: 3, games: 0, books: 2, music: 0 },
    enabledDomains: ["MEDIA", "BOOKS"],
    secondFactors: ["TOTP"],
    onboarded: false,
    online: false,
  },
  journey: {
    onboardedAt: null,
    acquisitionSource: null,
    acquisitionSourceOther: null,
    acceptedTermsVersion: "2026-09",
    acceptedTermsAt: "2026-03-14T00:00:00.000Z",
    ageBracket: "25-34",
  },
  security: {
    passkeys: 0,
    passwordless: false,
    recoveryCodesLeft: 8,
    apiKeys: [
      {
        id: "k1",
        name: "Home Assistant",
        suffix: "9f2a",
        lastUsedAt: null,
        expiresAt: null,
      },
    ],
    devices: [],
    pushSubscriptions: [],
    events: [
      {
        id: "e1",
        type: "PASSWORD_CHANGED",
        createdAt: "2026-10-02T09:12:00.000Z",
      },
    ],
  },
  preferences: {
    locale: "fr",
    timezone: "Europe/Paris",
    watchRegion: null,
    watchProviderCount: 0,
    notifyEmail: "WEEKLY",
    notifyPush: "DAILY",
    newsletter: false,
    newsletterOptInAt: null,
    profileAccess: "PRIVATE",
    defaultReviewVisibility: "FRIENDS",
    allowAdultContent: false,
  },
  imports: [
    {
      id: "i1",
      sourceId: "goodreads",
      status: "FAILURE",
      itemCount: 0,
      finishedAt: "2026-11-01T00:00:00.000Z",
    },
  ],
  recentAdditions: [],
  engagement: { achievements: 0, sharedListMemberships: 2, savedViews: 4 },
  moderation: {
    decisions: [
      {
        id: "d1",
        measure: "REVIEW_REMOVED",
        tosClause: "§6.2",
        decidedAt: "2026-09-03T10:00:00.000Z",
        decidedByName: "Logan",
      },
    ],
    reportsFiled: 0,
    blocking: 1,
    blockedBy: 0,
  },
};

let planPatched = false;

beforeEach(() => {
  planPatched = false;
  auth.user = { id: "admin", role: "ADMIN" } as UserDto;
  server.use(
    http.get(apiUrl("/admin/users/u1/sessions"), () => HttpResponse.json([])),
    http.get(apiUrl("/admin/users/u1/library-stats"), () =>
      HttpResponse.json({
        movies: 2,
        series: 1,
        anime: 0,
        games: 0,
        books: 2,
        music: 0,
        total: 5,
      }),
    ),
    http.patch(apiUrl("/admin/users/u1/plan"), () => {
      planPatched = true;
      return HttpResponse.json({ plan: "PREMIUM" });
    }),
  );
});

describe("Admin account page", () => {
  it("lays the account out in sections reachable from its menu", async () => {
    renderWithQuery(UserAccount, { detail: DETAIL });

    const nav = screen.getByRole("navigation", {
      name: m.admin_user_sections(),
    });

    for (const label of [
      m.admin_user_section_account(),
      m.admin_users_security(),
      m.admin_user_section_preferences(),
      m.admin_user_section_moderation(),
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeTruthy();
    }

    expect(
      screen.getByRole("heading", { level: 1, name: "Camille" }),
    ).toBeTruthy();
    await screen.findByText(m.media_movies());
  });

  it("shows the journey, security and moderation facts", async () => {
    renderWithQuery(UserAccount, { detail: DETAIL });

    expect(
      screen.getByText(m.admin_user_age_value({ bracket: "25-34" })),
    ).toBeTruthy();
    expect(screen.getByText(m.admin_user_onboarding_pending())).toBeTruthy();
    expect(screen.getByText("Home Assistant")).toBeTruthy();
    expect(screen.getByText(m.admin_user_api_key_never())).toBeTruthy();
    expect(screen.getByText(m.admin_user_measure_review())).toBeTruthy();
    expect(
      screen.getByText(m.admin_user_imports_failed({ count: 1 })),
    ).toBeTruthy();
    await screen.findByText(m.media_movies());
  });

  it("changes the plan from the page", async () => {
    const user = userEvent.setup();
    renderWithQuery(UserAccount, { detail: DETAIL });

    await user.click(
      screen.getByRole("combobox", {
        name: new RegExp(m.admin_users_plan()),
      }),
    );
    await user.click(
      await screen.findByRole("option", { name: m.common_premium() }),
    );

    await waitFor(() => expect(planPatched).toBe(true));
  });
});
