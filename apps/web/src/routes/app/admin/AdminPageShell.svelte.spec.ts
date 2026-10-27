import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import AdminPageShell from "./AdminPageShell.svelte";

vi.mock("$app/navigation", () => ({ afterNavigate: () => {} }));

describe("AdminPageShell", () => {
  // The app shell (DesktopSidebar / MobileLayout) already renders the page's
  // one <main>: a second one nested inside it is invalid HTML, and screen
  // readers announce two main regions.
  it("leaves the main landmark to the app shell", () => {
    render(AdminPageShell, {
      pathname: "/app/admin/users",
      children: createRawSnippet(() => ({ render: () => "<p>Users</p>" })),
    });

    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
  });
});
