import { goBack, goUp } from "#lib/back-nav.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import PageHeader from "./PageHeader.svelte";

vi.mock("#lib/back-nav.svelte.js", () => ({ goBack: vi.fn(), goUp: vi.fn() }));

beforeEach(() => vi.mocked(goBack).mockClear());

it("names the admin chevron without adding visible header text", () => {
  render(PageHeader, { title: "Schema", back: "/app/admin" });
  const back = screen.getByRole("link", { name: "Return to administration" });
  expect(back.getAttribute("title")).toBe("Return to administration");
  expect(back.textContent?.trim()).toBe("");
});

it("returns to the previous page when asked to, not to a fixed one", async () => {
  render(PageHeader, {
    title: "Notifications",
    back: "/app",
    backInHistory: true,
  });

  const back = screen.getByRole("link", { name: m.common_back() });
  back.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(back);

  expect(goBack).toHaveBeenCalledOnce();
});

it("leads to its parent page otherwise", async () => {
  render(PageHeader, { title: "Sessions", back: "/app/settings" });

  const back = screen.getByRole("link", { name: m.common_back() });
  back.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(back);

  expect(goBack).not.toHaveBeenCalled();
  expect(back.getAttribute("href")).toBe("/app/settings");
});

it("keeps a nav destination's chevron to the phone", () => {
  const props = {
    title: "Stats",
    back: "/app",
    backInHistory: true,
    backOnPhoneOnly: true,
  };
  layout.compact = true;
  const phone = render(PageHeader, props);
  expect(screen.getByRole("link", { name: m.common_back() })).toBeTruthy();
  phone.unmount();

  layout.compact = false;
  render(PageHeader, props);
  expect(screen.queryByRole("link", { name: m.common_back() })).toBeNull();
  layout.compact = true;
});

it("lets a fixed chevron step back to its parent", async () => {
  render(PageHeader, { title: "Jobs", back: "/app/admin" });

  const back = screen.getByRole("link", {
    name: m.admin_back_to_overview(),
  });
  back.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(back);

  expect(goUp).toHaveBeenCalledWith(expect.anything(), "/app/admin");
  expect(goBack).not.toHaveBeenCalled();
});
