import { auth } from "#lib/auth/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { formatDate, formatRegion } from "#lib/ui/format.js";
import type { PremiereDto, UserDto } from "@loomkeep/shared/contracts";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PremieresView from "./PremieresView.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const premiere = (
  sourceId: string,
  title: string,
  firstAirDate: string,
  extra: Partial<PremiereDto> = {},
): PremiereDto => ({
  sourceId,
  title,
  originalTitle: null,
  firstAirDate,
  networkId: 213,
  networkName: "Netflix",
  originCountries: ["US"],
  overview: null,
  posterUrl: `https://image.tmdb.org/t/p/w500/${sourceId}.jpg`,
  backdropUrl: null,
  popularity: 1,
  ...extra,
});

const PREMIERES = [
  premiere("1", "La Comtesse de Monte-Cristo", "2026-11-16", {
    networkId: 290,
    networkName: "TF1",
    originCountries: ["FR"],
  }),
  premiere("2", "The Altruists", "2026-11-19", {
    overview: "Deux fondateurs de la crypto.",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/b2.jpg",
    popularity: 9,
  }),
  premiere("3", "Harry Potter", "2026-12-25", {
    networkId: 49,
    networkName: "HBO",
    originCountries: ["GB", "US"],
  }),
];

let upserts: unknown[];

beforeEach(() => {
  // Sunday 15 November 2026, mid-afternoon.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 15, 15, 0));
  upserts = [];
  server.use(
    http.get(apiUrl("/catalog/premieres"), () => HttpResponse.json(PREMIERES)),
    http.get(apiUrl("/library/tracked"), () => HttpResponse.json([])),
    http.put(apiUrl("/library"), async ({ request }) => {
      upserts.push(await request.json());
      return HttpResponse.json({});
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  auth.user = null;
});

describe("premieres page", () => {
  it("puts the week's headliner first, then today and a rail per week or month", async () => {
    renderWithQuery(PremieresView, {});

    await screen.findByRole("heading", { name: "The Altruists", level: 2 });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "The Altruists",
      m.common_today(),
      m.common_this_week(),
      m.calendar_premieres_in_month({
        month: formatDate(new Date(2026, 11, 1), { month: "long" }),
      }),
    ]);
    expect(
      screen.getByText(
        `${m.calendar_premieres_today_none()} ${m.calendar_premieres_next({
          title: "La Comtesse de Monte-Cristo",
          day: m.common_tomorrow(),
          network: "TF1",
        })}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Monte-Cristo/ }).getAttribute("href"),
    ).toBe("/app/media/series/1");
    // A worldwide streamer's date needs no country; HBO's is Britain's.
    expect(
      screen.getByText(
        m.calendar_premieres_origin({ country: formatRegion("GB") }),
      ),
    ).toBeTruthy();
  });

  it("narrows the list to the networks of the user's services", async () => {
    auth.user = { watchProviderIds: [8] } as UserDto;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(PremieresView, {});

    const mine = await screen.findByRole("button", {
      name: `${m.calendar_premieres_filter_mine()} (1)`,
    });
    await user.click(mine);

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Monte-Cristo/ })).toBeNull(),
    );
    expect(screen.getAllByRole("link", { name: /The Altruists/ })).toHaveLength(
      2,
    );

    await user.click(mine);
    await screen.findByRole("link", { name: /Monte-Cristo/ });
  });

  it("hides the services filter from a user without services", async () => {
    renderWithQuery(PremieresView, {});

    await screen.findByRole("heading", { name: "The Altruists", level: 2 });
    expect(
      screen.queryByRole("button", {
        name: new RegExp(m.calendar_premieres_filter_mine()),
      }),
    ).toBeNull();
  });

  it("adds the headliner to the watchlist", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithQuery(PremieresView, {});

    await user.click(
      await screen.findByRole("button", { name: m.media_status_planned() }),
    );

    await waitFor(() =>
      expect(upserts).toEqual([
        { source: "TMDB", sourceId: "2", type: "SERIES", status: "PLANNED" },
      ]),
    );
  });
});
