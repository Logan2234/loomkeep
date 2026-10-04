import { m } from "$lib/paraglide/messages.js";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MermaidDiagram from "./MermaidDiagram.svelte";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({
      svg: '<svg viewBox="0 0 800 600"><g id="mermaid-render-entity-User-0"><text>User</text></g></svg>',
    })),
  },
}));

it("does not increase the zoom when zooming out after reset", async () => {
  render(MermaidDiagram, { code: "erDiagram\nUser {}" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: m.common_reset() }));
  expect(screen.getByText("100%")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: m.common_zoom_out() }));
  expect(screen.queryByText("200%")).toBeNull();
});

it("finds table names and supports keyboard exploration", async () => {
  const { container } = render(MermaidDiagram, { code: "erDiagram\nUser {}" });
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("searchbox", { name: m.admin_diagram_search() }),
    "user",
  );
  expect(screen.getByRole("option", { name: "User" })).toBeTruthy();
  const viewport = screen.getByRole("application");
  viewport.focus();
  await user.keyboard("{ArrowRight}");
  expect(
    container
      .querySelector('[style*="transform-origin"]')
      ?.getAttribute("style"),
  ).toContain("translate(-60px, 0px)");
  await user.keyboard("+");
  expect(screen.getByText("120%")).toBeTruthy();
});
