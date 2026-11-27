import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoadMoreButton from "./LoadMoreButton.svelte";
describe("LoadMoreButton", () => {
  it("loads a page using the shared label without submitting its parent form", async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    render(LoadMoreButton, {
      query: { isFetchingNextPage: false, fetchNextPage },
    });
    const button = screen.getByRole("button", { name: m.common_load_more() });
    expect(button.getAttribute("type")).toBe("button");
    await userEvent.click(button);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
  it("prevents additional clicks while the next page is loading", async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    render(LoadMoreButton, {
      query: { isFetchingNextPage: true, fetchNextPage },
    });
    const button = screen.getByRole("button", {
      name: m.common_loading(),
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
