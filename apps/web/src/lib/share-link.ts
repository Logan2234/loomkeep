const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/i;

/**
 * What a share from another app hands the share target (UX-05): the link, if
 * any, and what to search for if Loomkeep can't read it. Android apps put the
 * link in `url`, in `text` ("Regarde ça https://…"), or both, depending on
 * the app.
 */
export function readSharedLink(params: Pick<URLSearchParams, "get">): {
  link: string | null;
  searchTerm: string;
} {
  const url = params.get("url")?.trim() || null;
  const text = params.get("text")?.trim() ?? "";
  const link = url ?? URL_IN_TEXT.exec(text)?.[0] ?? null;
  const textWithoutLink = link ? text.replace(link, "").trim() : text;

  return {
    link,
    searchTerm: params.get("title")?.trim() || textWithoutLink,
  };
}

/** Whether the search box holds a pasted link rather than words. */
export function isPastedLink(query: string): boolean {
  return /^https?:\/\/\S+$/i.test(query.trim());
}
