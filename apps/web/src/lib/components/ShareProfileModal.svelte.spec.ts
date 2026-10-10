import { m } from "#lib/paraglide/messages.js";
import { toast } from "#lib/toast.svelte.js";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShareProfileModal from "./ShareProfileModal.svelte";

vi.mock("qrcode", () => ({
  default: { toString: vi.fn(async () => "<svg></svg>") },
}));
afterEach(() => vi.restoreAllMocks());

describe("profile link copying", () => {
  it("reports clipboard rejection without showing a copied success", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new DOMException("Clipboard blocked", "NotAllowedError"),
    );
    const error = vi.spyOn(toast, "error");
    render(ShareProfileModal, {
      username: "logan",
      displayName: "Logan",
      onclose: vi.fn(),
    });
    await user.click(
      screen.getByRole("button", { name: m.common_copy_link() }),
    );
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.queryByText(m.common_link_copied())).toBeNull();
  });
});
