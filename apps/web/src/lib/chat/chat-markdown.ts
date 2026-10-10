/**
 * The restricted markdown a message — or a work's comment — is written in:
 * **bold**, *italic*, ***both***, ~~strike~~, `code`, ||spoiler||, bare
 * links, #[Title](/app/…) work mentions, @[Name](/app/u/…) people (a
 * comment's mentions, turned into tokens for display by `withUserTokens`)
 * and episode codes (S02E05); and, line by line, `> ` quotes,
 * `- ` lists and ``` code blocks. Parsed into nodes the component renders
 * itself, never into HTML: a message is someone else's text, so nothing in
 * it may become markup.
 */
export type ChatNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; href: string }
  | { type: "mention"; title: string; href: string }
  | { type: "user"; label: string; href: string }
  | { type: "episode"; season: number; episode: number; code: string }
  | {
      type: "strong" | "em" | "strike" | "spoiler" | "quote";
      children: ChatNode[];
    }
  | { type: "list"; items: ChatNode[][] }
  | { type: "codeblock"; text: string };

type Wrapper = "strong" | "em" | "strike" | "spoiler";

// Longest markers first, so `**` is never read as two `*`.
const MARKERS: [string, Wrapper[]][] = [
  ["||", ["spoiler"]],
  ["***", ["strong", "em"]],
  ["**", ["strong"]],
  ["~~", ["strike"]],
  ["*", ["em"]],
];

const LINK = /https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/y;
/** A work page's path, the only target a mention may point at. */
const WORK_PATH =
  "\\/app\\/(?:media\\/(?:movie|series|anime)|games|books|music)\\/[^\\s()]+";
const MENTION = new RegExp(
  `#\\[([^\\]\\n]{1,120})\\]\\((${WORK_PATH})\\)`,
  "y",
);
const USER = /@\[([^\]\n]{1,60})\]\((\/app\/u\/[\w.-]+)\)/y;
const EPISODE = /S(\d{1,2}) ?E(\d{1,3})/iy;
const WORD = /[\p{L}\p{N}]/u;

export function parseChatMarkdown(source: string): ChatNode[] {
  const lines = source.split("\n");
  const nodes: ChatNode[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join("\n");
    nodes.push(...parseInline(text, 0, text.length));
    paragraph = [];
  };

  // Consecutive lines of one kind, from `index` on.
  const run = (index: number, matches: (line: string) => boolean) => {
    let last = index;
    while (last + 1 < lines.length && matches(lines[last + 1])) last++;
    return lines.slice(index, last + 1);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const close = lines.findIndex(
        (other, j) => j > i && other.trimEnd() === "```",
      );

      if (close !== -1) {
        flush();
        nodes.push({
          type: "codeblock",
          text: lines.slice(i + 1, close).join("\n"),
        });
        i = close;
        continue;
      }
    }

    if (/^> ?/.test(line)) {
      const quoted = run(i, (other) => /^> ?/.test(other));
      const text = quoted.map((l) => l.replace(/^> ?/, "")).join("\n");
      flush();
      nodes.push({
        type: "quote",
        children: parseInline(text, 0, text.length),
      });
      i += quoted.length - 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items = run(i, (other) => /^[-*] /.test(other));
      flush();
      nodes.push({
        type: "list",
        items: items.map((item) => parseInline(item, 2, item.length)),
      });
      i += items.length - 1;
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return nodes;
}

function parseInline(source: string, start: number, end: number): ChatNode[] {
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

    MENTION.lastIndex = i;
    const mention = (source[i] === "#" && MENTION.exec(source)) || null;

    if (mention && i + mention[0].length <= end) {
      flush();
      nodes.push({ type: "mention", title: mention[1], href: mention[2] });
      i += mention[0].length;
      continue;
    }

    USER.lastIndex = i;
    const user = (source[i] === "@" && USER.exec(source)) || null;

    if (user && i + user[0].length <= end) {
      flush();
      nodes.push({ type: "user", label: user[1], href: user[2] });
      i += user[0].length;
      continue;
    }

    EPISODE.lastIndex = i;
    const episode =
      (/[sS]/.test(source[i]) &&
        !WORD.test(source[i - 1] ?? "") &&
        EPISODE.exec(source)) ||
      null;

    if (
      episode &&
      i + episode[0].length <= end &&
      !WORD.test(source[i + episode[0].length] ?? "")
    ) {
      const season = Number(episode[1]);
      const number = Number(episode[2]);
      flush();
      nodes.push({
        type: "episode",
        season,
        episode: number,
        code: `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`,
      });
      i += episode[0].length;
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
            parseInline(source, i + token.length, close),
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
        case "codeblock":
          return ` ${node.text} `;
        case "link":
          return node.href;
        case "mention":
          return `#${node.title}`;
        case "user":
          return node.label;
        case "episode":
          return node.code;
        case "spoiler":
          return "•••";
        case "list":
          return ` ${node.items.map(flatten).join(" · ")} `;
        case "quote":
          return ` ${flatten(node.children)} `;
        default:
          return flatten(node.children);
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** A work mentioned inline, the way a message stores it. */
export function mentionToken(title: string, href: string): string {
  return `#[${title.replace(/[\]\n]/g, " ").trim()}](${href})`;
}

/**
 * The series an episode code in this message points at: the only one the
 * message mentions or carries a card of — or, mentioning none, the series a
 * work's discussion is about (`fallback`). With several, the code links
 * nowhere: guessing the wrong series would be worse.
 */
export function episodeSeries(
  nodes: ChatNode[],
  cardHrefs: string[],
  fallback: string | null = null,
): string | null {
  const series = new Set(cardHrefs.filter(isSeriesHref));

  const visit = (list: ChatNode[]) => {
    for (const node of list) {
      if (node.type === "mention" && isSeriesHref(node.href)) {
        series.add(node.href);
      } else if (node.type === "list") {
        node.items.forEach(visit);
      } else if ("children" in node) {
        visit(node.children);
      }
    }
  };

  visit(nodes);

  if (series.size === 0) return fallback;
  return series.size === 1 ? [...series][0] : null;
}

/**
 * A comment's text with its mentions as `@[@name](/app/u/name)` tokens, so
 * the parser links them; a mention whose text no longer sits at its offset
 * stays plain.
 */
export function withUserTokens(
  text: string,
  mentions: { username: string; start: number }[],
): string {
  return [...mentions]
    .sort((a, b) => b.start - a.start)
    .reduce((out, { username, start }) => {
      const written = `@${username}`;
      if (out.slice(start, start + written.length) !== written) return out;
      const token = `@[${written}](/app/u/${username})`;
      return out.slice(0, start) + token + out.slice(start + written.length);
    }, text);
}

/**
 * Where each picked person's `@username` sits in the text about to be sent:
 * the n-th time someone is picked, their n-th `@username` standing as a
 * word. A pick whose mention was erased since is dropped.
 */
export function placeUserMentions(
  text: string,
  picked: { id: string; username: string }[],
): { userId: string; start: number }[] {
  const placed: { userId: string; start: number }[] = [];
  const from = new Map<string, number>();

  for (const { id, username } of picked) {
    const written = `@${username}`;
    let at = text.indexOf(written, from.get(username) ?? 0);

    while (at !== -1) {
      const before = at === 0 ? "" : text[at - 1];
      const after = text[at + written.length] ?? "";
      if (!/[\w@.]/.test(before) && !/\w/.test(after)) break;
      at = text.indexOf(written, at + 1);
    }

    if (at === -1) continue;
    placed.push({ userId: id, start: at });
    from.set(username, at + written.length);
  }

  return placed;
}

function isSeriesHref(href: string): boolean {
  return /^\/app\/media\/(series|anime)\//.test(href);
}

/** The markers the selection bar and the shortcuts wrap a selection in. */
const CHAT_FORMATS = {
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

/** The format a keyboard shortcut asks for, as in Messages' composer. */
export function formatShortcut(event: KeyboardEvent): ChatFormat | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();

  if (event.shiftKey) {
    if (key === "s") return "spoiler";
    if (key === "x") return "strike";
    return null;
  }

  if (key === "b") return "bold";
  if (key === "i") return "italic";
  if (key === "e") return "code";
  return null;
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
