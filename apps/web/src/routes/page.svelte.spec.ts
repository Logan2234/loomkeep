import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import { fireEvent, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

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
