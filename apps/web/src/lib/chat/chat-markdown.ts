/**
 * The restricted markdown a message is written in: **bold**, *italic*,
 * ~~strike~~, `code`, ||spoiler|| and bare links. Parsed into nodes the
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
const MARKERS: [string, Wrapper][] = [
  ["||", "spoiler"],
  ["**", "strong"],
  ["~~", "strike"],
  ["*", "em"],
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
      const [token, type] = marker;
      const close = findClose(source, token, i + token.length, end);

      if (close !== -1) {
        flush();
        nodes.push({
          type,
          children: parse(source, i + token.length, close),
        });
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
      if (token === "*" && source.startsWith("**", i)) {
        i += 2;
        continue;
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
export function wrapSelection(
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
