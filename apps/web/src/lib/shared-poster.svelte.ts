// The poster that becomes the work's page: a View Transition carrying it from
// wherever it was tapped to the hero of the page it opens, and back.

const TRANSITION_NAME = "work-poster";
const WORK_PATH = /^\/app\/(media\/[^/]+|games|books|music)\/[^/]+$/;
/** A card's link can sit beside its poster (PosterCard) rather than around it. */
const MAX_ANCESTORS = 3;

export const isWorkPath = (pathname: string): boolean =>
  WORK_PATH.test(pathname);

/** The poster belonging to a link, the closest one when a parent holds several. */
export function posterOfLink(link: Element): HTMLElement | null {
  let scope: Element | null = link;

  for (let level = 0; scope && level <= MAX_ANCESTORS; level++) {
    const poster = scope.querySelector<HTMLElement>("[data-work-poster]");
    if (poster) return poster;
    scope = scope.parentElement;
  }

  return null;
}

/** On the page being left for `pathname`: the poster of the link just tapped. */
export function tappedPoster(
  target: Element | null,
  pathname: string,
): HTMLElement | null {
  const link = target?.closest<HTMLAnchorElement>("a[href]");
  if (!link) return null;
  const href = link.getAttribute("href") ?? "";
  return new URL(href, location.href).pathname === pathname
    ? posterOfLink(link)
    : null;
}

/** On the page back from `pathname`: the poster of the link that opened it. */
export function posterLinkingTo(pathname: string): HTMLElement | null {
  const link = document.querySelector(`a[href="${CSS.escape(pathname)}"]`);
  return link ? posterOfLink(link) : null;
}

export const detailPoster = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-detail-poster]");

export const posterImageSrc = (poster: HTMLElement | null): string | null =>
  poster?.querySelector("img")?.currentSrc || null;

export function namePoster(poster: HTMLElement | null): () => void {
  if (!poster) return () => {};

  poster.style.viewTransitionName = TRANSITION_NAME;

  return () => {
    poster.style.viewTransitionName = "";
  };
}

/** The image a page still loading shows where its poster will be. */
export const pendingPoster = $state<{ src: string | null }>({ src: null });
