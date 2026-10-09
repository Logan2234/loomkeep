import { mentionToken } from "./chat-markdown";

/** A work mentioned while writing: shown as `#Title`, sent as a token. */
export interface Mention {
  title: string;
  href: string;
}

const TOKEN =
  /#\[([^\]\n]{1,120})\]\((\/app\/(?:media\/(?:movie|series|anime)|games|books|music)\/[^\s()]+)\)/g;
const LINK = /https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/g;

/** `#Title` as written becomes the token a message stores. */
export function serializeMentions(text: string, mentions: Mention[]): string {
  // Longest titles first: "#Dune" mustn't eat the start of "#Dune 2".
  return [...mentions]
    .sort((a, b) => b.title.length - a.title.length)
    .reduce(
      (out, { title, href }) =>
        out.split(`#${title}`).join(mentionToken(title, href)),
      text,
    );
}

/** A stored text back to what the composer shows, and its mentions. */
export function deserializeMentions(text: string): {
  text: string;
  mentions: Mention[];
} {
  const mentions: Mention[] = [];
  const plain = text.replace(TOKEN, (_, title: string, href: string) => {
    if (!mentions.some((m) => m.title === title)) {
      mentions.push({ title, href });
    }

    return `#${title}`;
  });
  return { text: plain, mentions };
}

/** The `#query` being typed right before the caret, if any. */
export function mentionAtCaret(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const typed = /(?:^|\s)#([^\s#[\]][^#\n[\]]{0,40})$/.exec(
    text.slice(0, caret),
  );
  if (!typed) return null;
  return { start: caret - typed[1].length - 1, query: typed[1] };
}

/** The composer's text in runs, its links and mentions marked for the underline. */
export function highlightRuns(
  text: string,
  mentions: Mention[],
): { text: string; marked: boolean }[] {
  const ranges: [number, number][] = [];

  for (const match of text.matchAll(LINK)) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  for (const { title } of mentions) {
    const needle = `#${title}`;
    let at = text.indexOf(needle);

    while (at !== -1) {
      ranges.push([at, at + needle.length]);
      at = text.indexOf(needle, at + needle.length);
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const runs: { text: string; marked: boolean }[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start < cursor) continue;

    if (start > cursor) {
      runs.push({ text: text.slice(cursor, start), marked: false });
    }

    runs.push({ text: text.slice(start, end), marked: true });
    cursor = end;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), marked: false });
  }

  return runs;
}
