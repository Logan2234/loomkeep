import { auth } from "#lib/auth.svelte.js";
import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { onboardingReplay } from "#lib/onboarding-replay.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { DigestCadence, Domain, type UserDto } from "@loomkeep/shared";
import { fireEvent, screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import OnboardingWizard from "./OnboardingWizard.svelte";

vi.mock("$app/env", () => ({ browser: true, dev: false }));

const USER = {
  id: "u1",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  enabledDomains: [Domain.MEDIA],
  watchProviderIds: [],
  watchRegion: null,
  notifyEmail: DigestCadence.WEEKLY,
  notifyPush: DigestCadence.DISABLED,
  notifyNewsletter: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  profileAccess: "PRIVATE",
} as unknown as UserDto;

// What the steps load around them: none of it matters to these tests.
function stubSideRequests() {
  server.use(
    http.get(apiUrl("/showcase"), () => HttpResponse.json({ posters: [] })),
    http.get(apiUrl("/gamification/onboarding"), () =>
      HttpResponse.json({ steps: [] }),
    ),
    http.get(apiUrl("/catalog/watch-providers"), () =>
      HttpResponse.json({ region: "FR", regions: [], providers: [] }),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  auth.user = null;
  onboardingReplay.active = false;
});

describe("onboarding storage", () => {
  it("can open when the browser refuses access to stored progress", () => {
    const blocked = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });
    stubSideRequests();
    expect(() => renderWithQuery(OnboardingWizard, {})).not.toThrow();
    blocked.mockRestore();
  });
});

describe("replaying the welcome tour", () => {
  it("closes without marking the account onboarded again", async () => {
    const complete = vi.fn();
    stubSideRequests();
    server.use(
      http.post(apiUrl("/users/me/complete-onboarding"), () => {
        complete();
        return HttpResponse.json(USER);
      }),
    );
    auth.user = { ...USER };
    onboardingReplay.active = true;
    sessionStorage.setItem(STORAGE_KEYS.onboardingStep, "4");

    renderWithQuery(OnboardingWizard, {});
    const [open] = screen.getAllByRole("button", {
      name: m.onboarding_done_open(),
    });
    await fireEvent.click(open);

    await vi.waitFor(() => expect(onboardingReplay.active).toBe(false));
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("domains step", () => {
  it("lets the last domain be unticked, then holds the tour there", async () => {
    const saved = vi.fn();
    stubSideRequests();
    server.use(
      http.patch(apiUrl("/users/me"), () => {
        saved();
        return HttpResponse.json(USER);
      }),
    );
    auth.user = { ...USER };
    sessionStorage.setItem(STORAGE_KEYS.onboardingStep, "1");

    renderWithQuery(OnboardingWizard, {});
    const [video] = screen
      .getAllByRole("button", { name: new RegExp(m.common_Media()) })
      .filter((tile) => tile.hasAttribute("aria-pressed"));
    await fireEvent.click(video);

    expect(video.getAttribute("aria-pressed")).toBe("false");
    for (const next of screen.getAllByRole("button", { name: m.common_next() }))
      expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });
});

describe("profile step", () => {
  it("saves a new username before moving on", async () => {
    const renamed = vi.fn();
    stubSideRequests();
    server.use(
      http.get(apiUrl("/users/me/username-availability"), () =>
        HttpResponse.json({ available: true }),
      ),
      http.patch(apiUrl("/users/me/username"), async ({ request }) => {
        const body = (await request.json()) as { username: string };
        renamed(body.username);
        return HttpResponse.json({ ...USER, username: body.username });
      }),
    );
    auth.user = { ...USER };
    sessionStorage.setItem(STORAGE_KEYS.onboardingStep, "2");

    renderWithQuery(OnboardingWizard, {});
    const field = screen.getByRole("textbox");
    await fireEvent.input(field, { target: { value: "alice_reads" } });
    await screen.findByText(m.settings_username_available());
    const [next] = screen.getAllByRole("button", { name: m.common_next() });
    await fireEvent.click(next);

    await vi.waitFor(() => expect(renamed).toHaveBeenCalledWith("alice_reads"));
    await vi.waitFor(() =>
      expect(
        screen.getByRole("progressbar").getAttribute("aria-valuenow"),
      ).toBe("4"),
    );
  });
});
