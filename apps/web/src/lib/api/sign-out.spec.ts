import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAndRedirect } from "./auth";
const { typedRequest, clear, goto } = vi.hoisted(() => ({
  typedRequest: vi.fn(),
  clear: vi.fn(),
  goto: vi.fn(),
}));
vi.mock("./generated/typed-request", () => ({ typedRequest }));
vi.mock("../auth.svelte", () => ({ auth: { clear } }));
vi.mock("$app/navigation", () => ({ goto }));
beforeEach(() => {
  typedRequest.mockReset().mockResolvedValue(undefined);
  clear.mockReset();
  goto.mockReset().mockResolvedValue(undefined);
});
describe("signOutAndRedirect", () => {
  it.each([false, true])(
    "clears the local account before navigating even if logout fails (%s)",
    async (fails) => {
      const order: string[] = [];
      typedRequest.mockImplementation(async () => {
        order.push("logout");
        if (fails) throw new Error("Offline");
      });
      clear.mockImplementation(() => {
        order.push("clear");
      });
      goto.mockImplementation(async () => {
        order.push("navigate");
      });
      await signOutAndRedirect();
      expect(order).toEqual(["logout", "clear", "navigate"]);
      expect(goto).toHaveBeenCalledWith("/login");
    },
  );
});
