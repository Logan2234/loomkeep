import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Tabs from "./Tabs.svelte";

it("keeps unavailable tabs visible without allowing selection", async () => {
  const onSelect = vi.fn();
  render(Tabs, {
    props: {
      label: "Domains",
      tabs: [
        { value: "media", label: "Media" },
        { value: "podcasts", label: "Podcasts · Coming soon", disabled: true },
      ],
      current: "media",
      onSelect,
    },
  });

  const unavailable = screen.getByRole<HTMLButtonElement>("tab", {
    name: "Podcasts · Coming soon",
  });
  expect(unavailable.disabled).toBe(true);

  await userEvent.setup().click(unavailable);
  expect(onSelect).not.toHaveBeenCalled();
});
