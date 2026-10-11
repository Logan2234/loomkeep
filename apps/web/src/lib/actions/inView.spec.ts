import { afterEach, describe, expect, it, vi } from "vitest";
import { inView } from "./inView";
afterEach(() => vi.unstubAllGlobals());
describe("inView", () => {
  it("triggers on entering and disconnects before changing roots and on destruction", () => {
    const callbacks: IntersectionObserverCallback[] = [],
      observers: {
        observe: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
      }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback);
          observers.push(this);
        }
      },
    );
    const onEnter = vi.fn();
    const node = {} as HTMLElement;
    const action = inView(node, { onEnter, rootMargin: "400px" });
    callbacks[0](
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(onEnter).not.toHaveBeenCalled();
    callbacks[0](
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(onEnter).toHaveBeenCalledOnce();
    action.update({
      onEnter,
      root: {} as Element,
      rootMargin: "160px 0px 0px",
    });
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(observers[1].observe).toHaveBeenCalledWith(node);
    action.destroy();
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
  });
});
