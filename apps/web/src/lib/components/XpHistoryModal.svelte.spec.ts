import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { localDayKey } from "#lib/xp-history.js";
import {
  xpForLevel,
  type PagedResult,
  type XpHistoryDayDto,
  type XpHistoryItemDto,
} from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import XpHistoryModal from "./XpHistoryModal.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const episode = (n: number, amount = 10): XpHistoryItemDto => ({
  reason: "EPISODE_WATCHED",
  revoked: false,
  amount,
  at: new Date().toISOString(),
  revokedAt: null,
  earnedAt: null,
  title: "The Bear",
  href: "/app/media/series/136315",
  seasonNumber: 3,
  episodeNumber: n,
  achievementKey: null,
  domain: null,
  goalTarget: null,
  goalYear: null,
});

const today = localDayKey(new Date());
// Newest first, as the API sends them.
const HISTORY: PagedResult<XpHistoryDayDto> = {
  items: [
    {
      day: today,
      net: 20,
      items: [
        {
          ...episode(7, -10),
          revoked: true,
          earnedAt: new Date(Date.now() - 86_400_000).toISOString(),
        },
        episode(3),
        episode(2),
        episode(1),
      ],
    },
  ],
  hasMore: false,
};

describe("XpHistoryModal", () => {
  it("lists a day's gains and what was taken back, with the level reached", async () => {
    server.use(
      http.get(apiUrl("/gamification/me/history"), () =>
        HttpResponse.json(HISTORY),
      ),
    );

    // The second-to-last episode took the total across level 5.
    renderWithQuery(XpHistoryModal, {
      xp: xpForLevel(5) + 5,
      onclose: () => {},
    });

    // Cut in two by the level mark.
    expect(
      await screen.findAllByText(m.gamification_xp_reason_episode_watched()),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        m.gamification_xp_history_revoked({
          reason: m.gamification_xp_reason_episode_watched().toLowerCase(),
        }),
      ),
    ).toBeTruthy();
    expect(screen.getByText("The Bear · S03E07")).toBeTruthy();
    expect(
      screen.getByText(m.gamification_xp_history_level_up({ level: 5 })),
    ).toBeTruthy();
  });

  it("unfolds a group into its lines", async () => {
    server.use(
      http.get(apiUrl("/gamification/me/history"), () =>
        HttpResponse.json(HISTORY),
      ),
    );
    renderWithQuery(XpHistoryModal, { xp: 1000, onclose: () => {} });

    const toggle = await screen.findByRole("button", { expanded: false });
    expect(screen.queryByText("The Bear · S03E02")).toBeNull();

    await userEvent.setup().click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("The Bear · S03E02")).toBeTruthy();
  });

  it("invites to earn XP when there is none yet", async () => {
    server.use(
      http.get(apiUrl("/gamification/me/history"), () =>
        HttpResponse.json({ items: [], hasMore: false }),
      ),
    );
    renderWithQuery(XpHistoryModal, { xp: 0, onclose: () => {} });

    expect(
      await screen.findByText(m.gamification_xp_history_empty()),
    ).toBeTruthy();
  });
});
