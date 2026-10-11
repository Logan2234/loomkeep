import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RecoveryCodesModal from "./RecoveryCodesModal.svelte";
const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock("#lib/download.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#lib/download.js")>()),
  downloadBlob,
}));
describe("recovery code export", () => {
  it("downloads grouped codes as a text file for the current account", async () => {
    render(RecoveryCodesModal, {
      codes: ["abcdefghij"],
      accountEmail: "alice@example.test",
      onclose: vi.fn(),
    });
    await userEvent.click(
      screen.getByRole("button", { name: m.settings_mfa_recovery_download() }),
    );
    expect(downloadBlob).toHaveBeenCalledOnce();
    const [body, mime, filename] = downloadBlob.mock.calls[0];
    expect(body).toContain("alice@example.test");
    expect(body).toContain("abcde-fghij");
    expect(mime).toBe("text/plain;charset=utf-8");
    expect(filename).toMatch(/^loomkeep-recovery-codes.*\.txt$/);
  });
});
