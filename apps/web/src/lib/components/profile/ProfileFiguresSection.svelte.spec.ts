import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { ProfileFiguresDto, UserDto } from "@loomkeep/shared/contracts";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import ProfileFiguresSection from "./ProfileFiguresSection.svelte";

const FIGURES: ProfileFiguresDto = {
  thisYear: {
    year: new Date().getFullYear(),
    video: { movies: 38, episodes: 412, minutes: 21_360 },
    books: { read: 17, pages: 5840 },
  },
  allTime: {
    video: { movies: 611, episodes: 8204, minutes: 415_800 },
    books: { read: 214, pages: 71_300 },
  },
};

afterEach(() => {
  auth.user = null;
});

describe("ProfileFiguresSection", () => {
  it("switches from this year to the whole library", async () => {
    auth.user = {
      enabledDomains: ["MEDIA", "BOOKS"],
      domainOrder: ["BOOKS", "MEDIA"],
    } as unknown as UserDto;
    server.use(
      http.get(apiUrl("/stats/profiles/:username/figures"), () =>
        HttpResponse.json(FIGURES),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(ProfileFiguresSection, { username: "camille" });

    const section = await screen.findByRole("region", {
      name: m.profile_figures_title(),
    });
    expect(section.textContent).toContain("38");
    // The viewer's own domain order: books before films.
    expect(section.textContent!.indexOf(m.common_Books())).toBeLessThan(
      section.textContent!.indexOf("38"),
    );

    await user.click(
      screen.getByRole("button", { name: m.profile_figures_all_time() }),
    );

    expect(section.textContent).toContain("611");
    expect(section.textContent).not.toContain("38 ");
  });

  it("stays out of the way when no domain can be shown", async () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    server.use(
      http.get(apiUrl("/stats/profiles/:username/figures"), () =>
        HttpResponse.json({ thisYear: { year: 2026 }, allTime: {} }),
      ),
    );
    renderWithQuery(ProfileFiguresSection, { username: "camille" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("region")).toBeNull();
  });
});
