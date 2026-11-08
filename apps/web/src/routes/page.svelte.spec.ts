import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { fireEvent, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

describe("landing poster wall", () => {
  // Decoration behind the title: dragging a poster out of it, or selecting
  // it, broke the illusion of a backdrop.
  it("can't be dragged out", () => {
    const { container } = renderWithQuery(LandingPage, {});

    const posters = container.querySelectorAll(
      "section [aria-hidden='true'] img",
    );
    expect(posters.length).toBeGreaterThan(0);

    for (const poster of posters) {
      expect(poster.getAttribute("draggable")).toBe("false");
    }
  });
});

describe("landing hero call to action", () => {
  // Lifting the risk right next to the button: "free" was only hinted at by
  // the kicker's "entrée libre" pun.
  it("says it's free, ad-free and fully exportable under the button", () => {
    renderWithQuery(LandingPage, {});

    const hero = screen.getByRole("heading", { level: 1 }).parentElement!;
    expect(
      within(hero).getByRole("link", { name: m.landing_comparator_cta() }),
    ).toBeTruthy();
    expect(within(hero).getByText(m.landing_hero_reassurance())).toBeTruthy();
  });

  it("drops the reassurance for a signed-in visitor, who just opens the app", () => {
    auth.user = { id: "u1" } as UserDto;

    try {
      renderWithQuery(LandingPage, {});

      const hero = screen.getByRole("heading", { level: 1 }).parentElement!;
      expect(
        within(hero).getByRole("link", { name: m.landing_open_app() }),
      ).toBeTruthy();
      expect(within(hero).queryByText(m.landing_hero_reassurance())).toBeNull();
    } finally {
      auth.user = null;
    }
  });
});

describe("landing hero title", () => {
  // The shared setup turns reduced motion on, which stops the rotation.
  beforeEach(() => {
    document.documentElement.classList.remove("a11y-reduce-motion");
    vi.useFakeTimers();
  });
  afterEach(() => {
    document.documentElement.classList.add("a11y-reduce-motion");
    vi.useRealTimers();
  });

  const heading = () => screen.getByRole("heading", { level: 1 });
  const shownVerb = () => heading().querySelector('[aria-hidden="true"]');

  it("gives screen readers every verb, not the rotating one", () => {
    renderWithQuery(LandingPage, {});

    expect(heading().textContent).toContain(m.landing_verb_all());
    expect(shownVerb()?.textContent?.trim()).toBe(m.landing_verb_watched());
  });

  // WCAG 2.2.2: text that keeps moving needs a way to stop it.
  it("holds the current verb while the title is hovered", async () => {
    renderWithQuery(LandingPage, {});

    await fireEvent.pointerEnter(heading());
    await vi.advanceTimersByTimeAsync(5000);
    expect(shownVerb()?.textContent?.trim()).toBe(m.landing_verb_watched());

    await fireEvent.pointerLeave(heading());
    await vi.advanceTimersByTimeAsync(2200);
    expect(shownVerb()?.textContent?.trim()).toBe(m.landing_verb_played());
  });
});
