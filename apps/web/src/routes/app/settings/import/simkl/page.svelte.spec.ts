import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SimklPage from "./+page.svelte";

const { browser } = vi.hoisted(() => ({
  browser: { available: false, open: vi.fn(() => Promise.resolve()) },
}));
vi.mock("$app/env/public", () => ({ PUBLIC_SIMKL_CLIENT_ID: "simkl-client" }));
vi.mock("#lib/native/browser.js", () => ({
  isNativeBrowserAvailable: () => browser.available,
  openInAppBrowser: browser.open,
}));

afterEach(() => {
  browser.available = false;
  browser.open.mockClear();
});

const connectLink = () =>
  screen.getByRole("link", { name: m.settings_import_simkl_button() });

/** Whether the click would still follow the link, once every handler ran. */
function watchNavigation(): () => boolean {
  let navigated = false;

  const listener = (event: MouseEvent) => {
    navigated = !event.defaultPrevented;
    event.preventDefault();
  };

  window.addEventListener("click", listener);

  return () => {
    window.removeEventListener("click", listener);
    return navigated;
  };
}

describe("Simkl connection", () => {
  it("opens Simkl's consent over the Android app, coming back through the app", async () => {
    browser.available = true;
    render(SimklPage);
    const link = connectLink();
    const navigated = watchNavigation();

    await userEvent.click(link);

    expect(navigated()).toBe(false);
    expect(browser.open).toHaveBeenCalledWith(link.getAttribute("href"));
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("/app/settings/import/simkl/callback"),
    );
  });

  it("stays a plain link in a browser", async () => {
    render(SimklPage);
    const navigated = watchNavigation();

    await userEvent.click(connectLink());

    expect(navigated()).toBe(true);
    expect(browser.open).not.toHaveBeenCalled();
  });
});
