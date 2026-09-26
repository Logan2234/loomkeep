import { m } from "$lib/paraglide/messages.js";
import { ratingWord } from "$lib/rating-words";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RatingSlider from "./RatingSlider.svelte";

function renderSlider(value: number | null) {
  const onChange = vi.fn();
  render(RatingSlider, { props: { value, onChange } });
  const slider = screen.getByRole<HTMLInputElement>("slider", {
    name: m.reviews_rating_out_of_ten(),
  });
  return { onChange, slider, user: userEvent.setup() };
}

const spoken = (rating: number) =>
  m.reviews_rating_value_word({ rating, word: ratingWord(rating) });

describe("RatingSlider", () => {
  it("announces an unrated work and offers nothing to clear", () => {
    const { slider } = renderSlider(null);

    expect(slider.getAttribute("aria-valuetext")).toBe(
      m.reviews_rating_unrated(),
    );
    expect(
      screen.queryByRole("button", { name: m.reviews_rating_clear() }),
    ).toBeNull();
  });

  it("treats 0 as a real score, not as unrated", () => {
    const { slider } = renderSlider(0);

    expect(slider.getAttribute("aria-valuetext")).toBe(spoken(0));
    expect(
      screen.getByRole("button", { name: m.reviews_rating_clear() }),
    ).toBeTruthy();
  });

  it("clears a rating back to unrated", async () => {
    const { onChange, user } = renderSlider(7);

    await user.click(
      screen.getByRole("button", { name: m.reviews_rating_clear() }),
    );

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("reports the picked score as a number", async () => {
    const { onChange, slider } = renderSlider(3);

    slider.value = "8";
    await fireEvent.input(slider);

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it("shows a legacy half-point score rounded", () => {
    const { slider } = renderSlider(7.5);

    expect(slider.value).toBe("8");
    expect(slider.getAttribute("aria-valuetext")).toBe(spoken(8));
  });

  it.each([
    ["{ArrowRight}", 5],
    ["{ArrowLeft}", 5],
    ["{Home}", 0],
    ["{End}", 10],
  ])(
    "starts an unrated slider from the keyboard (%s → %i)",
    async (key, expected) => {
      const { onChange, slider, user } = renderSlider(null);

      slider.focus();
      await user.keyboard(key);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith(expected);
    },
  );

  it("leaves the keyboard to the native slider once rated", async () => {
    const { onChange, slider } = renderSlider(6);

    const notPrevented = await fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(notPrevented).toBe(true);
    expect(onChange).not.toHaveBeenCalledWith(5);
  });

  it("rates the parked middle position on a plain click", async () => {
    const { onChange, slider } = renderSlider(null);

    await fireEvent.pointerUp(slider);

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("ignores a click that doesn't move an existing rating", async () => {
    const { onChange, slider } = renderSlider(4);

    await fireEvent.pointerUp(slider);

    expect(onChange).not.toHaveBeenCalled();
  });
});
