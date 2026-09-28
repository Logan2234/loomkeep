import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PageNumberControl from "./PageNumberControl.svelte";

describe("PageNumberControl", () => {
  it("adjusts the page with explicit controls and respects its bounds", async () => {
    render(PageNumberControl, {
      props: {
        value: 1,
        label: m.book_session_pages(),
        min: 1,
        max: 2,
      },
    });

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: m.book_session_pages(),
    });
    const decrease = screen.getByRole<HTMLButtonElement>("button", {
      name: m.session_value_decrease({ label: m.book_session_pages() }),
    });
    const increase = screen.getByRole<HTMLButtonElement>("button", {
      name: m.session_value_increase({ label: m.book_session_pages() }),
    });

    expect(input.value).toBe("1");
    expect(decrease.disabled).toBe(true);

    await userEvent.click(increase);

    expect(input.value).toBe("2");
    expect(increase.disabled).toBe(true);
  });
});
