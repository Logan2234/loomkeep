export function scrollToAdminAnchor(element: HTMLElement) {
  if (window.location.hash !== `#${element.id}`) return;

  const frame = requestAnimationFrame(() => {
    if (window.location.hash === `#${element.id}`) {
      element.scrollIntoView({ block: "start" });
    }
  });

  return { destroy: () => cancelAnimationFrame(frame) };
}
