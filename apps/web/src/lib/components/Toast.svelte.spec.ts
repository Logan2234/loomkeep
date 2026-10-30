import { m } from "#lib/paraglide/messages.js";
import { toast } from "#lib/toast.svelte.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import Toast from "./Toast.svelte";

afterEach(() => {
  toast.items.forEach((item) => toast.dismiss(item.id));
});

function renderToast() {
  render(Toast);
  toast.show("Saved", "success");
}

async function drag(
  pointerType: string,
  to: { clientX: number; clientY: number },
) {
  const el = await screen.findByRole("status");
  const capture = vi.fn();
  Object.defineProperty(el, "setPointerCapture", { value: capture });
  Object.defineProperty(el, "offsetWidth", { value: 300 });
  const init = { pointerId: 1, pointerType };
  await fireEvent.pointerDown(el, { ...init, clientX: 0, clientY: 0 });
  await fireEvent.pointerMove(el, { ...init, ...to });
  await fireEvent.pointerUp(el, { ...init, ...to });
  return capture;
}

it("dismisses a toast swiped sideways on a phone", async () => {
  renderToast();
  await drag("touch", { clientX: 200, clientY: 4 });
  await waitFor(() => expect(screen.queryByText("Saved")).toBeNull());
});

it("leaves a toast a vertical scroll passed over", async () => {
  renderToast();
  const capture = await drag("touch", { clientX: 6, clientY: 120 });
  expect(capture).not.toHaveBeenCalled();
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("doesn't swipe toasts with a mouse", async () => {
  renderToast();
  await drag("mouse", { clientX: 200, clientY: 0 });
  expect(screen.getByText("Saved")).toBeTruthy();
});

it("keeps a close button for screen readers on a phone", async () => {
  renderToast();
  await fireEvent.click(
    await screen.findByRole("button", { name: m.common_close() }),
  );
  expect(screen.queryByText("Saved")).toBeNull();
});
