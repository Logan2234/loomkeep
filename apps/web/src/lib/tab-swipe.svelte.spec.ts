import { afterEach, describe, expect, it, vi } from "vitest";
import { tabSwipe } from "./tab-swipe";

function slideLeft(node: Element) {
  const touch = (x: number) => [{ clientX: x, clientY: 100 }];
  const event = (type: string, props: object) =>
    Object.assign(new Event(type, { bubbles: true }), props);
  node.dispatchEvent(event("touchstart", { touches: touch(300) }));
  node.dispatchEvent(event("touchend", { changedTouches: touch(100) }));
}

describe("tabSwipe", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function mount(inert: boolean) {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const root = document.body.appendChild(document.createElement("div"));
    const list = root.appendChild(document.createElement("div"));
    list.toggleAttribute("inert", inert);
    const tabs = list.appendChild(document.createElement("div"));
    tabs.setAttribute("role", "tablist");
    tabs.getClientRects = () => [{}] as unknown as DOMRectList;
    const pane = root.appendChild(document.createElement("p"));
    const step = vi.fn();
    tabSwipe(root, step);
    return { pane, step };
  }

  it("changes tab while the tabs are in use", () => {
    const { pane, step } = mount(false);

    slideLeft(pane);

    expect(step).toHaveBeenCalledWith(1);
  });

  it("leaves an open conversation alone", () => {
    const { pane, step } = mount(true);

    slideLeft(pane);

    expect(step).not.toHaveBeenCalled();
  });
});
