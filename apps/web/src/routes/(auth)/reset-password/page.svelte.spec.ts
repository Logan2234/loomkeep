import { m } from "$lib/paraglide/messages.js";
import { visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

beforeEach(() => visit("/reset-password?token=reset-token"));

const submit = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: m.common_reset() });
const newPassword = () =>
  screen.getByLabelText(m.common_new_password(), { selector: "input" });

describe("Reset password page", () => {
  it("keeps the button disabled until the password meets every requirement", async () => {
    const user = userEvent.setup();
    renderWithQuery(ResetPasswordPage, {});

    expect(submit().disabled).toBe(true);
    await user.type(newPassword(), "lowercase-only");
    expect(submit().disabled).toBe(true);

    await user.clear(newPassword());
    await user.type(newPassword(), "Valid-password-1");
    expect(submit().disabled).toBe(false);
  });
});
