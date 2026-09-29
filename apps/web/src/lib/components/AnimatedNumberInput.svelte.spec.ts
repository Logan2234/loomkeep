import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AnimatedNumberInput from "./AnimatedNumberInput.svelte";

describe("AnimatedNumberInput", () => {
  it("keeps digits only and clamps the value on blur", async () => {
    const user = userEvent.setup();
    render(AnimatedNumberInput, {
      props: { value: 30, label: "Minutes", min: 1, max: 9999 },
    });

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Minutes",
    });

    await fireEvent.input(input, { target: { value: "12e3 min" } });
    expect(input.value).toBe("123");

    await user.clear(input);
    await user.type(input, "10000");
    expect(input.value).toBe("9999");
    await user.tab();
    expect(input.value).toBe("9999");
  });
});
