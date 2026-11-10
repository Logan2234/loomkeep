// The poster that becomes the work's page: a View Transition carrying it from
// wherever it was tapped to the hero of the page it opens, and back.

const TRANSITION_NAME = "work-poster";
const WORK_PATH = /^\/app\/(media\/[^/]+|games|books|music)\/[^/]+$/;
/** A card's link can sit beside its poster (PosterCard) rather than around it. */
const MAX_ANCESTORS = 3;

export const isWorkPath = (pathname: string): boolean =>
  WORK_PATH.test(pathname);

/** The poster belonging to a link, the closest one when a parent holds several. */
export const posterOfLink = (link: Element): HTMLElement | null =>
  nearest(link, "[data-work-poster]");

function nearest(link: Element, selector: string): HTMLElement | null {
  let scope: Element | null = link;

  for (let level = 0; scope && level <= MAX_ANCESTORS; level++) {
    const found = scope.querySelector<HTMLElement>(selector);
    if (found) return found;
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

const PORTRAIT_TRANSITION_NAME = "creator-portrait";
const CREATOR_PATH = /^\/app\/people\/[^/]+\/[^/]+$/;

export const isCreatorPath = (pathname: string): boolean =>
  CREATOR_PATH.test(pathname);

/**
 * On the page being left for a person's page: the photo of the link just
 * tapped, a cast card's or the peek's. A name alone has none, and the page
 * opens with the usual slide.
 */
export function tappedPortrait(
  target: Element | null,
  pathname: string,
): HTMLElement | null {
  const link = target?.closest<HTMLAnchorElement>("a[href]");
  if (!link) return null;
  const href = link.getAttribute("href") ?? "";
  if (new URL(href, location.href).pathname !== pathname) return null;
  return nearest(link, "[data-creator-portrait]");
}

/** On the page back from a person's page: the photo of the link that opened it. */
export function portraitLinkingTo(pathname: string): HTMLElement | null {
  // A director who also acts is linked twice: by name first, then by card.
  for (const link of document.querySelectorAll(
    `a[href="${CSS.escape(pathname)}"]`,
  )) {
    const portrait = nearest(link, "[data-creator-portrait]");
    if (portrait) return portrait;
  }

  return null;
}

export const detailPortrait = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-detail-portrait]");

export function namePortrait(portrait: HTMLElement | null): () => void {
  if (!portrait) return () => {};

  portrait.style.viewTransitionName = PORTRAIT_TRANSITION_NAME;

  return () => {
    portrait.style.viewTransitionName = "";
  };
}

/** The image a page still loading shows where its poster will be. */
export const pendingPoster = $state<{ src: string | null }>({ src: null });

/** The same for a person's page and its portrait. */
export const pendingPortrait = $state<{ src: string | null }>({ src: null });
