import { ApiError } from "#lib/api/core.js";
import { addListItem } from "#lib/api/lists.js";
import { addWorkToLibrary } from "#lib/chat/work-library.js";
import { ErrorCode } from "@loomkeep/shared";
import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";

const CONTEXT = Symbol("search-selection");

/**
 * The search page's selection mode (PRV-09), shared with its result panels:
 * the works picked, each by its page link, which already names its domain
 * and catalogue id. Panels rendered elsewhere (a library page's preview)
 * find none and keep their plain cards.
 */
export class SearchSelection {
  active = $state(false);
  readonly works = new SvelteSet<string>();

  get count(): number {
    return this.works.size;
  }

  has(href: string): boolean {
    return this.works.has(href);
  }

  /** Unpicking the last work leaves selection mode, bar and ticks with it. */
  toggle(href: string): void {
    if (this.works.has(href)) this.works.delete(href);
    else this.works.add(href);
    this.active = this.works.size > 0;
  }

  exit(): void {
    this.active = false;
    this.works.clear();
  }
}

export function setSearchSelection(selection: SearchSelection): void {
  setContext(CONTEXT, selection);
}

export function getSearchSelection(): SearchSelection | undefined {
  return getContext<SearchSelection | undefined>(CONTEXT);
}

/** How many of the works went in, out of how many were sent. */
export interface BulkOutcome {
  done: number;
  total: number;
}

/** Each work to the library, in parallel: one failing doesn't hold the others. */
export async function addWorksToLibrary(hrefs: string[]): Promise<BulkOutcome> {
  const results = await Promise.allSettled(
    hrefs.map((href) => addWorkToLibrary({ href })),
  );
  return {
    done: results.filter((r) => r.status === "fulfilled").length,
    total: hrefs.length,
  };
}

/**
 * Each work to a list. A list holds catalogue items, which exist once
 * someone tracks the work, so each one is added to the library first. One
 * already in the list counts as done.
 */
export async function addWorksToList(
  listId: string,
  hrefs: string[],
): Promise<BulkOutcome> {
  const results = await Promise.allSettled(
    hrefs.map(async (href) => {
      const target = await addWorkToLibrary({ href });
      if (!target) throw new Error(`Not a work page: ${href}`);

      try {
        await addListItem(listId, target.targetType, target.targetId);
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.code !== ErrorCode.ListItemAlreadyExists
        )
          throw error;
      }
    }),
  );
  return {
    done: results.filter((r) => r.status === "fulfilled").length,
    total: hrefs.length,
  };
}

/**
 * Holding a result on a phone enters selection mode with it picked, as in a
 * library. For `use:longpress` on the grid of results.
 */
export function pressToSelect(selection: SearchSelection | undefined) {
  return {
    enabled: !!selection,
    pick: (target: Element) =>
      target.closest<HTMLElement>("[data-search-work]:not([data-tracked])"),
    onLongPress: (pressed: HTMLElement) => {
      const href = pressed.dataset.searchWork;
      if (href) selection?.toggle(href);
    },
  };
}

/**
 * A result card's link: in selection mode a click picks the work instead of
 * opening it, and on a keyboard X picks it from anywhere, as in a library.
 * A work already followed can't be picked: both actions would only add it
 * again.
 */
export function selectableWork(
  node: HTMLAnchorElement,
  params: { selection?: SearchSelection; href: string; tracked: boolean },
) {
  let { selection, href, tracked } = params;

  function sync() {
    if (selection?.active && !tracked) {
      node.setAttribute("role", "button");
      node.setAttribute("aria-pressed", String(selection.has(href)));
    } else {
      node.removeAttribute("role");
      node.removeAttribute("aria-pressed");
    }
  }

  function click(event: MouseEvent) {
    if (!selection?.active) return;
    event.preventDefault();
    if (!tracked) selection.toggle(href);
  }

  function keydown(event: KeyboardEvent) {
    if (!selection || tracked || event.key.toLowerCase() !== "x") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    selection.toggle(href);
  }

  node.addEventListener("click", click);
  node.addEventListener("keydown", keydown);
  const stop = $effect.root(() => {
    $effect(sync);
  });

  return {
    update(next: typeof params) {
      ({ selection, href, tracked } = next);
      sync();
    },
    destroy() {
      stop();
      node.removeEventListener("click", click);
      node.removeEventListener("keydown", keydown);
    },
  };
}
