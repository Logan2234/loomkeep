import { m } from "$lib/paraglide/messages.js";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Components from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

it("finds classes and icons, gives specimens direct links and offers generic statistics", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const { container } = render(Components, {});
  const user = userEvent.setup();
  const search = screen.getByRole("searchbox", {
    name: m.admin_components_search(),
  });
  await user.type(search, ".btn-danger");
  await waitFor(() =>
    expect(
      screen
        .getByRole("link", { name: ".btn", exact: true })
        .getAttribute("href"),
    ).toBe("#specimen-btn"),
  );
  expect(screen.queryByRole("heading", { name: "PasswordInput" })).toBeNull();
  await user.clear(search);
  await user.type(search, "moon");
  expect(screen.getByText("moon")).toBeTruthy();
  expect(screen.queryByText("home", { selector: "code" })).toBeNull();
  await user.clear(search);
  await user.type(search, "RankBars");
  expect(
    screen
      .getByRole("link", { name: "RankBars", exact: true })
      .getAttribute("href"),
  ).toBe("#specimen-rankbars");
  expect(container.querySelector("#specimen-cohorttable")).toBeNull();
  vi.unstubAllGlobals();
});
