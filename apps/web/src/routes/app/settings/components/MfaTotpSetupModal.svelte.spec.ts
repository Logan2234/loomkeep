import { m } from "#lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MfaTotpSetupModal from "./MfaTotpSetupModal.svelte";
describe("TOTP setup modal", () => {
  it("removes spaces and limits the code before enabling confirmation", async () => {
    const onconfirm = vi.fn();
    render(MfaTotpSetupModal, {
      step: "confirm",
      qrSvg: "",
      secret: "",
      busy: false,
      invalid: false,
      onconfirm,
      onclose: vi.fn(),
    });
    const dialog = screen.getByRole("dialog"),
      input = within(dialog).getByLabelText(
        m.common_code(),
      ) as HTMLInputElement;
    const button = within(dialog).getByRole("button", {
      name: m.common_enable(),
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.type(input, "123 4567");
    expect(input.value).toBe("123456");
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    expect(onconfirm).toHaveBeenCalledOnce();
  });
});
