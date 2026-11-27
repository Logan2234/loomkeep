import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import OtpInput from "./OtpInput.svelte";

const box = (position: number) =>
  screen.getByRole<HTMLInputElement>("textbox", {
    name: m.auth_mfa_code_digit({ position, total: 6 }),
  });

function setup() {
  const oninput = vi.fn();
  const oncomplete = vi.fn();
  render(OtpInput, { length: 6, label: "Code", oninput, oncomplete });
  return { user: userEvent.setup(), oninput, oncomplete };
}

describe("OtpInput", () => {
  it("moves to the next box as each digit is typed", async () => {
    const { user, oncomplete } = setup();

    await user.keyboard("123456");

    expect([1, 2, 3, 4, 5, 6].map((p) => box(p).value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(oncomplete).toHaveBeenCalledWith("123456");
  });

  it("ignores anything but digits", async () => {
    const { user, oninput } = setup();

    await user.keyboard("a");

    expect(box(1).value).toBe("");
    expect(document.activeElement).toBe(box(1));
    expect(oninput).toHaveBeenLastCalledWith("");
  });

  it("erases backwards, one box at a time", async () => {
    const { user, oninput } = setup();
    await user.keyboard("123");

    await user.keyboard("{Backspace}");
    expect(box(3).value).toBe("");
    expect(document.activeElement).toBe(box(3));

    await user.keyboard("{Backspace}");
    expect(box(2).value).toBe("");
    expect(document.activeElement).toBe(box(2));
    expect(oninput).toHaveBeenLastCalledWith("1");
  });

  it("moves between boxes with the arrow keys", async () => {
    const { user } = setup();
    await user.keyboard("12");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(box(1));

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(box(2));
  });

  it("spreads a pasted code over every box, wherever it's pasted", async () => {
    const { user, oncomplete } = setup();
    await user.click(box(4));

    await user.paste("123 456");

    expect(box(1).value).toBe("1");
    expect(box(6).value).toBe("6");
    expect(oncomplete).toHaveBeenCalledWith("123456");
  });
});
