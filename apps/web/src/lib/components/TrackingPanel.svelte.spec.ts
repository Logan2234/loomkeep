import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import TrackingPanel from "./TrackingPanel.svelte";

const body = createRawSnippet(() => ({ render: () => "<p>Domain body</p>" }));

function renderPanel(
  props: {
    favorite?: boolean;
    saving?: boolean;
    actions?: {
      label: string;
      icon: "check";
      onSelect: () => void;
    }[];
  } = {},
) {
  const onToggleFavorite = vi.fn();
  const onRemove = vi.fn();
  render(TrackingPanel, {
    props: {
      favorite: props.favorite ?? false,
      saving: props.saving ?? false,
      targetType: "GAME",
      targetId: "game-1",
      onToggleFavorite,
      onRemove,
      actions: props.actions ?? [],
      children: body,
    },
  });
  return { onToggleFavorite, onRemove };
}

describe("TrackingPanel", () => {
  it("renders the domain-specific body between header and footer", () => {
    renderPanel();

    expect(screen.getByText("Domain body")).toBeTruthy();
  });

  it("offers to add a work that isn't a favourite yet", async () => {
    const { onToggleFavorite } = renderPanel({ favorite: false });

    const toggle = screen.getByRole("button", {
      name: m.common_favorite_add(),
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(toggle);
    expect(onToggleFavorite).toHaveBeenCalledOnce();
  });

  it("offers to remove a work that already is a favourite", () => {
    renderPanel({ favorite: true });

    const toggle = screen.getByRole("button", {
      name: m.common_favorite_remove(),
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("removes the work from the library", async () => {
    const { onRemove } = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: m.tracking_remove() }),
    );

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("runs contextual lifecycle actions from the more-actions menu", async () => {
    const onSelect = vi.fn();
    renderPanel({
      actions: [{ label: "Mark as finished", icon: "check", onSelect }],
    });

    await userEvent.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Mark as finished" }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("locks both actions while a save is in flight", async () => {
    const { onToggleFavorite, onRemove } = renderPanel({ saving: true });

    const toggle = screen.getByRole<HTMLButtonElement>("button", {
      name: m.common_favorite_add(),
    });
    await userEvent.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    const remove = screen.getByRole<HTMLButtonElement>("menuitem", {
      name: m.tracking_remove(),
    });
    expect(toggle.disabled).toBe(true);
    expect(remove.disabled).toBe(true);

    await userEvent.click(toggle);
    await userEvent.click(remove);
    expect(onToggleFavorite).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
