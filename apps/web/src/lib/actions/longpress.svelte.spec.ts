import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { longpress } from "./longpress";

function press(node: HTMLElement, pointerType = "touch") {
  node.dispatchEvent(
    new PointerEvent("pointerdown", { pointerType, clientX: 10, clientY: 10 }),
  );
}

describe("longpress", () => {
  let node: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    node = document.createElement("a");
    document.body.append(node);
  });

  afterEach(() => {
    vi.useRealTimers();
    node.remove();
  });

  it("fires after a held touch, saying so while it's held", () => {
    const onLongPress = vi.fn();
    longpress(node, { onLongPress });

    press(node);
    expect(node.dataset.pressing).toBe("");
    vi.advanceTimersByTime(450);

    expect(onLongPress).toHaveBeenCalledOnce();
    expect(node.dataset.pressing).toBeUndefined();
  });

  it("swallows the click the release makes, wherever it lands, and only that one", () => {
    longpress(node, { onLongPress: () => {} });
    const backdrop = document.createElement("button");
    document.body.append(backdrop);
    const onClick = vi.fn();
    backdrop.addEventListener("click", onClick);

    press(node);
    vi.advanceTimersByTime(450);
    backdrop.click();
    expect(onClick).not.toHaveBeenCalled();

    backdrop.click();
    expect(onClick).toHaveBeenCalledOnce();
    backdrop.remove();
  });

  it("lets the next tap through when the release made no click", () => {
    longpress(node, { onLongPress: () => {} });
    const onClick = vi.fn();
    node.addEventListener("click", onClick);

    press(node);
    vi.advanceTimersByTime(450);
    node.dispatchEvent(new PointerEvent("pointerup"));
    press(node, "mouse");
    node.click();

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("gives up when the finger moves away or lets go", () => {
    const onLongPress = vi.fn();
    longpress(node, { onLongPress });

    press(node);
    node.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 40, clientY: 10 }),
    );
    press(node);
    node.dispatchEvent(new PointerEvent("pointerup"));
    vi.advanceTimersByTime(450);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ignores a mouse, and a press while disabled", () => {
    const onLongPress = vi.fn();
    const action = longpress(node, { onLongPress });

    press(node, "mouse");
    vi.advanceTimersByTime(450);
    action.update({ onLongPress, enabled: false });
    press(node);
    vi.advanceTimersByTime(450);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(node.dataset.longpress).toBeUndefined();
  });

  it("replaces the context menu for a touch, not for a right click", () => {
    longpress(node, { onLongPress: () => {} });

    const menu = () => {
      const event = new MouseEvent("contextmenu", { cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    };

    press(node, "mouse");
    expect(menu()).toBe(false);
    press(node);
    expect(menu()).toBe(true);
  });
});
