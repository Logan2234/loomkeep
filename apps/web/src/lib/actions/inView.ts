type InViewOptions = IntersectionObserverInit & { onEnter: () => void };

export function inView(node: HTMLElement, options: InViewOptions) {
  let observer: IntersectionObserver;

  function observe(next: InViewOptions) {
    observer?.disconnect();
    const { onEnter, ...init } = next;
    observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) onEnter();
    }, init);
    observer.observe(node);
  }

  observe(options);
  return { update: observe, destroy: () => observer.disconnect() };
}
