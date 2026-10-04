import { render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";
import PageHeader from "./PageHeader.svelte";

it("names the admin chevron without adding visible header text", () => {
  render(PageHeader, { title: "Schema", back: "/app/admin" });
  const back = screen.getByRole("link", { name: "Return to administration" });
  expect(back.getAttribute("title")).toBe("Return to administration");
  expect(back.textContent?.trim()).toBe("");
});
