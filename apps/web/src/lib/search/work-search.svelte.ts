import { keys } from "#lib/api/keys.js";
import { createApiQuery } from "#lib/api/query.svelte.js";
import { searchWorks } from "#lib/api/search.js";
import { debounce, SEARCH_DEBOUNCE_MS } from "#lib/debounce.js";

const MIN_LENGTH = 2;

/**
 * The unified search behind a field: what the instance knows answers at
 * once, then the catalogues' fuller answer takes its place. Call it while a
 * component initialises.
 */
export function createWorkSearch(query: () => string) {
  let searched = $state("");
  const debounced = debounce(
    (value: string) => (searched = value),
    SEARCH_DEBOUNCE_MS,
  );
  $effect(() => debounced.call(query().trim()));

  const enabled = $derived(searched.length >= MIN_LENGTH);

  const localQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "local"),
    fetch: () => searchWorks(searched, "local"),
    enabled,
    keepPreviousData: true,
  }));
  const allQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "all"),
    fetch: () => searchWorks(searched, "all"),
    enabled,
  }));

  return {
    /** Long enough a query to be searched. */
    get enabled() {
      return enabled;
    },
    get answer() {
      return allQuery.data ?? localQuery.data ?? undefined;
    },
    /** The catalogues answered: an empty domain is really empty. */
    get settled() {
      return !!allQuery.data;
    },
    get error() {
      return allQuery.error;
    },
  };
}
