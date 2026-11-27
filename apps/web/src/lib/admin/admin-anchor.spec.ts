import { afterEach, expect, it, vi } from "vitest";
import { scrollToAdminAnchor } from "./admin-anchor";

afterEach(() => vi.unstubAllGlobals());

it("scrolls to an anchored row when asynchronous data mounts it", () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("window", { location: { hash: "#job-catalogSync" } });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const row = { id: "job-catalogSync", scrollIntoView: vi.fn() };
  scrollToAdminAnchor(row as unknown as HTMLElement);
  expect(row.scrollIntoView).not.toHaveBeenCalled();
  frame!(0);
  expect(row.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
});

it("does not scroll after the navigation target changes", () => {
  let frame: FrameRequestCallback | undefined;
  const location = { hash: "#service-smtp" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const row = { id: "service-smtp", scrollIntoView: vi.fn() };
  scrollToAdminAnchor(row as unknown as HTMLElement);
  location.hash = "";
  frame!(0);
  expect(row.scrollIntoView).not.toHaveBeenCalled();
});
