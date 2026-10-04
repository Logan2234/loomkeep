import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, expect, it, vi } from "vitest";
import Drawer from "./Drawer.svelte";

afterEach(() => vi.restoreAllMocks());

it("lets controls receive pointer clicks instead of capturing them as a drawer drag", async () => {
  render(Drawer, {
    onclose: vi.fn(),
    children: createRawSnippet(() => ({
      render: () =>
        '<div><button>Close preview</button><a href="#example">Link</a><input aria-label="Name" /></div>',
    })),
  });
  const dialog = screen.getByRole("dialog");
  const capture = vi.fn();
  Object.defineProperty(dialog, "setPointerCapture", { value: capture });

  for (const control of [
    screen.getByRole("button", { name: "Close preview" }),
    screen.getByRole("link"),
    screen.getByRole("textbox"),
  ]) {
    await fireEvent.pointerDown(control, {
      pointerType: "mouse",
      button: 0,
      pointerId: 1,
    });
    await fireEvent.pointerUp(control);
  }

  expect(capture).not.toHaveBeenCalled();
});

it("keeps dragging available on the drawer surface", async () => {
  render(Drawer, {
    onclose: vi.fn(),
    children: createRawSnippet(() => ({ render: () => "<p>Details</p>" })),
  });
  const capture = vi.fn();
  Object.defineProperty(screen.getByRole("dialog"), "setPointerCapture", {
    value: capture,
  });
  await fireEvent.pointerDown(screen.getByText("Details"), {
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
  });
  await fireEvent.pointerMove(screen.getByText("Details"), {
    pointerType: "mouse",
    pointerId: 1,
    clientY: 30,
  });
  expect(capture).toHaveBeenCalledOnce();
});

function renderScrollableDrawer(scrollTop = 0) {
  const onclose = vi.fn();
  render(Drawer, {
    onclose,
    children: createRawSnippet(() => ({
      render: () =>
        "<div><div><p>Header</p></div><div data-drawer-scroll><p>Scrollable content</p><button>Action</button></div></div>",
    })),
  });
  const panel = screen.getByRole("dialog");
  const scroller = panel.querySelector<HTMLElement>("[data-drawer-scroll]")!;
  scroller.scrollTop = scrollTop;
  Object.defineProperty(panel, "getBoundingClientRect", {
    value: () => ({ height: 400 }),
  });
  Object.defineProperty(panel, "setPointerCapture", { value: vi.fn() });
  return { panel, scroller, onclose };
}

it("scrolls content upward from the top instead of swallowing the touch gesture", async () => {
  const { scroller, onclose } = renderScrollableDrawer();
  const text = screen.getByText("Scrollable content");
  await fireEvent.pointerDown(text, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 180,
  });
  await fireEvent.pointerMove(text, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 80,
  });
  await fireEvent.pointerUp(text, { pointerType: "touch", pointerId: 1 });
  expect(scroller.scrollTop).toBe(100);
  expect(onclose).not.toHaveBeenCalled();
});

it("allows scrolling when the touch starts on a link or button without activating it", async () => {
  const { scroller, onclose } = renderScrollableDrawer();
  const button = screen.getByRole("button", { name: "Action" });
  const clicked = vi.fn();
  button.addEventListener("click", clicked);
  await fireEvent.pointerDown(button, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 180,
  });
  await fireEvent.pointerMove(button, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 80,
  });
  await fireEvent.pointerUp(button, { pointerType: "touch", pointerId: 1 });
  await fireEvent.click(button, { detail: 1 });
  expect(scroller.scrollTop).toBe(100);
  expect(clicked).not.toHaveBeenCalled();
  expect(onclose).not.toHaveBeenCalled();
});

it("allows a normal tap on a drawer control", async () => {
  renderScrollableDrawer();
  const button = screen.getByRole("button", { name: "Action" });
  const clicked = vi.fn();
  button.addEventListener("click", clicked);
  await fireEvent.pointerDown(button, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 100,
  });
  await fireEvent.pointerUp(button, { pointerType: "touch", pointerId: 1 });
  await fireEvent.click(button, { detail: 1 });
  expect(clicked).toHaveBeenCalledOnce();
});

it.each(["Header", "Scrollable content"])(
  "closes on a downward pull from %s while the content is at the top",
  async (text) => {
    const { onclose } = renderScrollableDrawer();
    const target = screen.getByText(text);
    await fireEvent.pointerDown(target, {
      pointerType: "touch",
      pointerId: 1,
      clientY: 80,
    });
    await fireEvent.pointerMove(target, {
      pointerType: "touch",
      pointerId: 1,
      clientY: 240,
    });
    await fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 1 });
    await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
  },
);

it("leaves scrolling away from the top to the browser without dismissing the drawer", async () => {
  const { panel, scroller, onclose } = renderScrollableDrawer(100);
  await fireEvent.scroll(scroller);
  const target = screen.getByText("Scrollable content");
  await fireEvent.pointerDown(target, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 80,
  });
  await fireEvent.pointerMove(target, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 240,
  });
  await fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 1 });
  expect(scroller.style.touchAction).toBe("pan-y");
  expect(panel.setPointerCapture).not.toHaveBeenCalled();
  expect(onclose).not.toHaveBeenCalled();
});

it("cancels an interrupted pull without closing the drawer", async () => {
  const { onclose } = renderScrollableDrawer();
  const target = screen.getByText("Header");
  await fireEvent.pointerDown(target, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 80,
  });
  await fireEvent.pointerMove(target, {
    pointerType: "touch",
    pointerId: 1,
    clientY: 240,
  });
  await fireEvent.pointerCancel(target, { pointerType: "touch", pointerId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onclose).not.toHaveBeenCalled();
});
