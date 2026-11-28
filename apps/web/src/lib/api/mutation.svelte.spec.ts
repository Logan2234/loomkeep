import MutationProbe from "#lib/test/MutationProbe.svelte";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { invalidate } from "./invalidations";
import { keys } from "./keys";

describe("createApiMutation", () => {
  it("refetches what it touched once it succeeds", async () => {
    const { client } = renderWithQuery(MutationProbe, {
      run: () => Promise.resolve(),
      invalidates: invalidate.lists(),
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: keys.lists.editable() }),
    );
  });

  // A mutation made of several calls (create a list, then add to it) used to
  // leave the screen on the old state when a later call failed, though the
  // first had gone through (audit 2026-11-17, BUG-47).
  it("refetches what it touched even when it fails", async () => {
    const { client } = renderWithQuery(MutationProbe, {
      run: () => Promise.reject(new Error("second call failed")),
      invalidates: invalidate.lists(),
    });
    const spy = vi.spyOn(client, "invalidateQueries");

    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    await screen.findByRole("alert");
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.lists.editable() });
  });
});
