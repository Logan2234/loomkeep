/** Repeats stripping so malformed markup cannot expose a new tag after one pass. */
export function stripTags(
  text: string,
  {
    brToNewline = false,
    stripEmptyTags = true,
  }: { brToNewline?: boolean; stripEmptyTags?: boolean } = {},
): string {
  let result = brToNewline ? text.replace(/<br\s*\/?>/gi, "\n") : text;
  let previous: string;
  const tags = stripEmptyTags ? /<[^>]*>/g : /<[^>]+>/g;

  do {
    previous = result;
    result = previous.replace(tags, "");
  } while (result !== previous);

  return result.trim();
}
