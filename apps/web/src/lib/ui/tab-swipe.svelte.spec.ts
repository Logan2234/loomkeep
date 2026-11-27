import { afterEach, describe, expect, it, vi } from "vitest";
import { listenTabSwipe, tabSwipe } from "./tab-swipe";

function slideLeft(node: Element) {
  const touch = (x: number) => [{ clientX: x, clientY: 100 }];
  const event = (type: string, props: object) =>
    Object.assign(new Event(type, { bubbles: true }), props);
  node.dispatchEvent(event("touchstart", { touches: touch(300) }));
  node.dispatchEvent(event("touchend", { changedTouches: touch(100) }));
}

describe("following the finger", () => {
  afterEach(() => {
    document.documentElement.classList.add("a11y-reduce-motion");
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function mount(canStep: boolean) {
    document.documentElement.classList.remove("a11y-reduce-motion");
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({ matches: query.includes("coarse") }) as unknown as MediaQueryList,
    );
    const root = document.body.appendChild(document.createElement("div"));
    const pane = root.appendChild(document.createElement("p"));
    const step = vi.fn();
    listenTabSwipe(root, step, {
      targets: () => [pane],
      canStep: () => canStep,
    });
    const send = (type: string, x: number, y = 100) =>
      pane.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), {
          touches: [{ clientX: x, clientY: y }],
          changedTouches: [{ clientX: x, clientY: y }],
        }),
      );
    return { pane, step, send };
  }

  it("moves the content with the finger, then hands over to the next tab", () => {
    const { pane, step, send } = mount(true);

    send("touchstart", 300);
    send("touchmove", 200);
    expect(pane.style.transform).toBe("translateX(-100px)");

    send("touchend", 150);
    expect(pane.style.transform).toBe("");
    expect(step).toHaveBeenCalledWith(1);
  });

  it("only gives a little where there's no tab left", () => {
    const { pane, send } = mount(false);

    send("touchstart", 300);
    send("touchmove", 200);

    expect(pane.style.transform).toBe("translateX(-25px)");
  });

  it("stays out of a vertical scroll", () => {
    const { pane, send } = mount(true);

    send("touchstart", 300, 100);
    send("touchmove", 295, 200);
    send("touchmove", 200, 210);

    expect(pane.style.transform).toBe("");
  });
});

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
