import { m } from "#lib/paraglide/messages.js";
import { formatSessionMinutes } from "#lib/sessions/session-presentation.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SessionDurationPicker from "./SessionDurationPicker.svelte";

describe("SessionDurationPicker", () => {
  it("supports quick values and fine adjustments", async () => {
    render(SessionDurationPicker, {
      props: { value: 60, quickDurations: [30, 60, 90, 120] },
    });

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: m.session_duration(),
    });
    expect(input.value).toBe("60");

    await userEvent.click(
      screen.getByRole("button", { name: formatSessionMinutes(90) }),
    );
    expect(input.value).toBe("90");

    await userEvent.click(
      screen.getByRole("button", { name: m.session_duration_decrease() }),
    );
    expect(input.value).toBe("75");
    expect(
      screen
        .getByRole("button", { name: m.session_duration_decrease() })
        .querySelector("path"),
    ).toBeTruthy();
  });

  it("only explains the converted duration from one hour onward", async () => {
    render(SessionDurationPicker, {
      props: { value: 30, quickDurations: [15, 30, 45, 60] },
    });

    expect(screen.queryByRole("status")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: formatSessionMinutes(60) }),
    );

    expect(screen.getByRole("status").textContent?.trim()).toBe(
      formatSessionMinutes(60),
    );
  });

  it("recovers from an empty draft when using the step controls", async () => {
    const user = userEvent.setup();
    render(SessionDurationPicker, {
      props: { value: 30, quickDurations: [15, 30, 45, 60] },
    });

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: m.session_duration(),
    });
    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: m.session_duration_increase() }),
    );

    expect(input.value).toBe("16");
    expect(input.value).not.toBe("NaN");
  });

  describe("when optional", () => {
    const dash = "–";

    it("shows a dash while idle and no value is set", () => {
      render(SessionDurationPicker, {
        props: { value: 0, quickDurations: [15, 30], optional: true },
      });

      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: m.session_duration(),
      });
      expect(input.value).toBe("");
      expect(screen.getByText(dash)).toBeTruthy();
    });

    it("swaps the dash for the caret on focus and brings it back on blur", async () => {
      const user = userEvent.setup();
      render(SessionDurationPicker, {
        props: { value: 0, quickDurations: [15, 30], optional: true },
      });

      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: m.session_duration(),
      });
      await user.click(input);
      expect(screen.queryByText(dash)).toBeNull();
      expect(input.value).toBe("");

      await user.tab();
      expect(screen.getByText(dash)).toBeTruthy();
    });

    it("never shows the dash once a duration is typed", async () => {
      const user = userEvent.setup();
      render(SessionDurationPicker, {
        props: { value: 0, quickDurations: [15, 30], optional: true },
      });

      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: m.session_duration(),
      });
      await user.type(input, "20");
      expect(screen.queryByText(dash)).toBeNull();

      await user.tab();
      expect(input.value).toBe("20");
      expect(screen.queryByText(dash)).toBeNull();
    });

    it("goes back to the dash when the duration is cleared or typed as 0", async () => {
      const user = userEvent.setup();
      render(SessionDurationPicker, {
        props: { value: 20, quickDurations: [15, 30], optional: true },
      });

      const input = screen.getByRole<HTMLInputElement>("textbox", {
        name: m.session_duration(),
      });
      await user.clear(input);
      await user.tab();
      expect(input.value).toBe("");
      expect(screen.getByText(dash)).toBeTruthy();

      await user.type(input, "0");
      await user.tab();
      expect(input.value).toBe("");
      expect(screen.getByText(dash)).toBeTruthy();
    });

    it("lets the minus control reach zero but not go below", async () => {
      const user = userEvent.setup();
      render(SessionDurationPicker, {
        props: { value: 15, quickDurations: [15, 30], optional: true },
      });

      const decrease = screen.getByRole("button", {
        name: m.session_duration_decrease(),
      });
      await user.click(decrease);
      expect(screen.getByText(dash)).toBeTruthy();

      await user.click(decrease);
      expect(screen.getByText(dash)).toBeTruthy();
    });
  });

  it("normalizes a non-finite bound value before using the step controls", async () => {
    render(SessionDurationPicker, {
      props: { value: Number.NaN, quickDurations: [15, 30, 45, 60] },
    });

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: m.session_duration(),
    });
    expect(input.value).toBe("1");

    await userEvent.click(
      screen.getByRole("button", { name: m.session_duration_increase() }),
    );

    expect(input.value).toBe("16");
    expect(input.value).not.toBe("NaN");
  });
});
