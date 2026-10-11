import { liveStyles, mentionToken, type LiveStyle } from "./chat-markdown";

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

/** A stretch of the composer's text drawn one way under the field. */
export interface ComposerRun {
  text: string;
  styles: LiveStyle[];
  /** A link or a mentioned work: underlined. */
  underlined: boolean;
  /** A marker of a span the caret is out of: kept, but not drawn. */
  hidden: boolean;
}

/**
 * The composer's text in runs for the layer drawn under the field: styled as
 * it'll read once sent, its links and mentions underlined. A span's markers
 * only show while the caret (or the selection) touches it; elsewhere they
 * still take their place, the field holding them, but aren't drawn.
 */
export function composerRuns(
  text: string,
  mentions: Mention[],
  caret: { start: number; end: number } | null = null,
): ComposerRun[] {
  const underlined = Array.from({ length: text.length }, () => false);

  const underline = (from: number, to: number) => {
    for (let k = from; k < to; k++) underlined[k] = true;
  };

  for (const match of text.matchAll(LINK)) {
    underline(match.index, match.index + match[0].length);
  }

  for (const { title } of mentions) {
    const needle = `#${title}`;
    let at = text.indexOf(needle);

    while (at !== -1) {
      underline(at, at + needle.length);
      at = text.indexOf(needle, at + needle.length);
    }
  }

  const { styles, spanOf, spans } = liveStyles(text);
  const hidden = spanOf.map((index) => {
    if (index === -1) return false;
    const { from, to } = spans[index];
    return !caret || caret.end < from || caret.start > to;
  });
  const keyOf = (k: number) =>
    `${underlined[k]}|${hidden[k]}|${[...styles[k]].sort().join(",")}`;
  const runs: ComposerRun[] = [];
  let start = 0;

  for (let k = 1; k <= text.length; k++) {
    if (k < text.length && keyOf(k) === keyOf(start)) continue;
    runs.push({
      text: text.slice(start, k),
      styles: [...styles[start]].sort(),
      underlined: underlined[start],
      hidden: hidden[start],
    });
    start = k;
  }

  return runs;
}

const STYLE_CLASS: Record<LiveStyle, string> = {
  marker: "text-dim",
  // A stroke rather than a heavier weight, and the font's synthesized
  // oblique for italic: neither changes a character's width, so the text
  // under the field stays in line with its caret.
  strong: "[-webkit-text-stroke:0.45px_currentColor]",
  em: "italic [font-synthesis:style]",
  strike: "line-through",
  code: "bg-surface-2 text-accent rounded-sm",
  spoiler:
    "rounded-sm bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent)_0_6px,transparent_6px_12px)]",
};

/** The classes a run is drawn with under the field. */
export function composerRunClass(run: ComposerRun): string {
  if (run.hidden) return "text-transparent";
  return [
    ...run.styles.map((style) => STYLE_CLASS[style]),
    run.underlined
      ? "decoration-accent underline decoration-2 underline-offset-[3px]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
