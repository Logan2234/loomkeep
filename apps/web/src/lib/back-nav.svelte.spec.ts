import { beforeEach, expect, it, vi } from "vitest";
import { goUp, trackBackHistory } from "./back-nav.svelte";

const { navigated } = vi.hoisted(() => ({
  navigated: { run: (_: { from: unknown }) => {} },
}));
vi.mock("$app/navigation", () => ({
  afterNavigate: (callback: typeof navigated.run) => {
    navigated.run = callback;
  },
}));

const click = () => new MouseEvent("click", { cancelable: true });
const cameFrom = (pathname: string) =>
  navigated.run({ from: { url: { pathname } } });

beforeEach(() => {
  trackBackHistory();
  vi.spyOn(history, "back").mockImplementation(() => {});
});

it("steps back to the parent it came from, so the two can't bounce", () => {
  cameFrom("/app/settings");
  const event = click();

  goUp(event, "/app/settings#appearance");

  expect(event.defaultPrevented).toBe(true);
  expect(history.back).toHaveBeenCalledOnce();
});

it("follows the link when it came from elsewhere", () => {
  vi.mocked(history.back).mockClear();
  cameFrom("/app/search");
  const event = click();

  goUp(event, "/app/settings");

  expect(event.defaultPrevented).toBe(false);
  expect(history.back).not.toHaveBeenCalled();
});
