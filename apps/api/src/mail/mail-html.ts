// Pure HTML helpers shared by the layout and the templates: escaping,
// URL sanitising, inline markdown, and the Séance palette.

/** Escapes dynamic text before it is placed in HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const QUACKBACK_EMOJI_ALIASES: Record<string, string> = {
  sparkles: "✨",
  wrench: "🔧",
  bug: "🐛",
  electric_plug: "🔌",
  books: "📚",
  house: "🏠",
};

export function renderQuackbackEmojiAliases(text: string): string {
  return text.replace(
    /:(sparkles|wrench|bug|electric_plug|books|house):/g,
    (_match, name: string) => QUACKBACK_EMOJI_ALIASES[name],
  );
}

export function isAllowedUrl(
  value: string,
  attribute: "href" | "src",
): boolean {
  const normalized = value
    .replace(
      /&#(?:x([0-9a-f]+)|([0-9]+));/gi,
      (match, hex: string | undefined, decimal: string | undefined) => {
        const numeric = hex ?? decimal;
        if (!numeric) return match;
        const codePoint = Number.parseInt(numeric, hex === undefined ? 10 : 16);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      },
    )
    .replace(/&(colon|tab|newline);/gi, (_match, entity: string) => {
      if (entity.toLowerCase() === "colon") return ":";
      return "";
    })
    .split("")
    .filter((character) => {
      const codePoint = character.charCodeAt(0);
      return (
        character.trim().length > 0 && codePoint > 0x1f && codePoint !== 0x7f
      );
    })
    .join("")
    .toLowerCase();

  if (attribute === "src") return /^https?:/.test(normalized);
  return /^(?:https?:|mailto:)/.test(normalized);
}

export function sanitizeHtmlUrls(html: string): string {
  return html.replace(
    /\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (
      match,
      attribute: "href" | "src",
      doubleQuoted,
      singleQuoted,
      unquoted,
    ) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted;
      return isAllowedUrl(value, attribute.toLowerCase() as "href" | "src")
        ? match
        : "";
    },
  );
}

/** Bold/italic/link inline spans within a line — the rest is passed through as-is. */
export function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) =>
      isAllowedUrl(url, "href") ? `<a href="${url}">${label}</a>` : label,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

// Séance palette (light/"programme" variant — the only one that renders
// reliably across mail clients, which ignore prefers-color-scheme and web
// fonts). See design-identity-seance memory for the source palette.
export const COLOR_BG = "#F7F5F3";
export const COLOR_SURFACE = "#FFFFFF";
export const COLOR_BORDER = "#D3C7A8";
export const COLOR_TEXT = "#1C1712";
export const COLOR_ACCENT = "#8A5F0A";
export const COLOR_MUTED = "#6B6354";
