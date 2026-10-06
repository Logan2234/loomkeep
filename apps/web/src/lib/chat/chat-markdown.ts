/**
 * The restricted markdown a message is written in: **bold**, *italic*,
 * ***both***, ~~strike~~, `code`, ||spoiler|| and bare links. Parsed into nodes the
 * component renders itself, never into HTML: a message is someone else's
 * text, so nothing in it may become markup.
 */
export type ChatNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; href: string }
  | { type: "strong" | "em" | "strike" | "spoiler"; children: ChatNode[] };

type Wrapper = Extract<ChatNode, { children: ChatNode[] }>["type"];

// Longest markers first, so `**` is never read as two `*`.
const MARKERS: [string, Wrapper[]][] = [
  ["||", ["spoiler"]],
  ["***", ["strong", "em"]],
  ["**", ["strong"]],
  ["~~", ["strike"]],
  ["*", ["em"]],
];

const LINK = /https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/y;

export function parseChatMarkdown(source: string): ChatNode[] {
  return parse(source, 0, source.length);
}

function parse(source: string, start: number, end: number): ChatNode[] {
  const nodes: ChatNode[] = [];
  let text = "";
  let i = start;

  const flush = () => {
    if (text) nodes.push({ type: "text", text });
    text = "";
  };

  while (i < end) {
    if (source[i] === "`") {
      const close = source.indexOf("`", i + 1);

      if (close !== -1 && close < end && close > i + 1) {
        flush();
        nodes.push({ type: "code", text: source.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    LINK.lastIndex = i;
    const link = (source[i] === "h" && LINK.exec(source)) || null;

    if (link && i + link[0].length <= end) {
      flush();
      nodes.push({ type: "link", href: link[0] });
      i += link[0].length;
      continue;
    }

    const marker = MARKERS.find(([token]) => source.startsWith(token, i));

    if (marker) {
      const [token, types] = marker;
      const close = findClose(source, token, i + token.length, end);

      if (close !== -1) {
        flush();
        nodes.push(
          ...types.reduceRight<ChatNode[]>(
            (children, type) => [{ type, children }],
            parse(source, i + token.length, close),
          ),
        );
        i = close + token.length;
        continue;
      }
    }

    text += source[i];
    i++;
  }

  flush();
  return nodes;
}

/** The closing marker, skipping code spans; an empty pair is no pair. */
function findClose(
  source: string,
  token: string,
  from: number,
  end: number,
): number {
  let i = from;

  while (i < end) {
    if (source[i] === "`") {
      const close = source.indexOf("`", i + 1);

      if (close !== -1 && close < end) {
        i = close + 1;
        continue;
      }
    }

    if (source.startsWith(token, i) && i > from) {
      // `**` closing a `*` span would read the first star as the end.
      if (token === "*" && source.startsWith("**", i) && i + 2 <= end) {
        i += 2;
        continue;
      }

      // `**bold *italic***`: the inner `*` closes first, the last two stars
      // are the bold's.
      if (token === "**" && source.startsWith("***", i)) {
        return i + 3 <= end ? i + 1 : -1;
      }

      return i + token.length <= end ? i : -1;
    }

    i++;
  }

  return -1;
}

/** One line for a conversation list: spoilers dotted out, markers dropped. */
export function chatPreview(source: string): string {
  return flatten(parseChatMarkdown(source));
}

function flatten(nodes: ChatNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.text;
        case "link":
          return node.href;
        case "spoiler":
          return "•••";
        default:
          return flatten(node.children);
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** The markers the selection bar and the shortcuts wrap a selection in. */
export const CHAT_FORMATS = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
  spoiler: "||",
} as const;
export type ChatFormat = keyof typeof CHAT_FORMATS;

/**
 * Wraps `value[start..end]` in the format's marker, and gives back the new
 * value with the selection still on the same words.
 */
function wrapSelection(
  value: string,
  start: number,
  end: number,
  format: ChatFormat,
): { value: string; start: number; end: number } {
  const marker = CHAT_FORMATS[format];
  return {
    value:
      value.slice(0, start) +
      marker +
      value.slice(start, end) +
      marker +
      value.slice(end),
    start: start + marker.length,
    end: end + marker.length,
  };
}

/** Bold and italic share the star: `***x***` is both, so they're counted. */
function starsOutside(value: string, start: number, end: number): number {
  let n = 0;
  while (n < 3 && value[start - 1 - n] === "*" && value[end + n] === "*") n++;
  return n;
}

function starsInside(value: string, start: number, end: number): number {
  let n = 0;

  while (
    n < 3 &&
    end - start > 2 * (n + 1) &&
    value[start + n] === "*" &&
    value[end - 1 - n] === "*"
  ) {
    n++;
  }

  return n;
}

function markedBy(stars: number, format: ChatFormat): boolean {
  return format === "bold" ? stars >= 2 : stars % 2 === 1;
}

function isStarFormat(format: ChatFormat): boolean {
  return format === "bold" || format === "italic";
}

/** The format's markers sit right around the selection: `**[gras]**`. */
function markedOutside(
  value: string,
  start: number,
  end: number,
  format: ChatFormat,
): boolean {
  if (isStarFormat(format)) {
    return markedBy(starsOutside(value, start, end), format);
  }

  const marker = CHAT_FORMATS[format];
  return (
    value.slice(Math.max(0, start - marker.length), start) === marker &&
    value.startsWith(marker, end)
  );
}

/** The selection takes its markers in: `[**gras**]`. */
function markedInside(
  value: string,
  start: number,
  end: number,
  format: ChatFormat,
): boolean {
  if (isStarFormat(format)) {
    return markedBy(starsInside(value, start, end), format);
  }

  const marker = CHAT_FORMATS[format];
  return (
    end - start > 2 * marker.length &&
    value.startsWith(marker, start) &&
    value.slice(end - marker.length, end) === marker
  );
}

/** The formats already applied to the selection, for the selection bar. */
export function selectionFormats(
  value: string,
  start: number,
  end: number,
): ChatFormat[] {
  return (Object.keys(CHAT_FORMATS) as ChatFormat[]).filter(
    (format) =>
      markedOutside(value, start, end, format) ||
      markedInside(value, start, end, format),
  );
}

/**
 * Applies the format to the selection, or takes it off when it's already
 * there — the selection bar's buttons and the shortcuts are toggles.
 */
export function toggleFormat(
  value: string,
  start: number,
  end: number,
  format: ChatFormat,
): { value: string; start: number; end: number } {
  const length = CHAT_FORMATS[format].length;

  if (markedOutside(value, start, end, format)) {
    return {
      value:
        value.slice(0, start - length) +
        value.slice(start, end) +
        value.slice(end + length),
      start: start - length,
      end: end - length,
    };
  }

  if (markedInside(value, start, end, format)) {
    return {
      value:
        value.slice(0, start) +
        value.slice(start + length, end - length) +
        value.slice(end),
      start,
      end: end - 2 * length,
    };
  }

  return wrapSelection(value, start, end, format);
}

/** `/spoiler rest` sends `rest` masked as a whole; anything else goes as typed. */
export function readSlashCommand(value: string): {
  text: string;
  spoiler: boolean;
} {
  const match = /^\/spoiler\s+([\s\S]*)$/.exec(value.trim());
  return match
    ? { text: match[1].trim(), spoiler: true }
    : { text: value.trim(), spoiler: false };
}
