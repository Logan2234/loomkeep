export interface InlineSegment {
  text: string;
  code?: boolean;
  bold?: boolean;
}

/**
 * Splits a line of CHANGELOG Markdown into `code` and **bold** runs, so the
 * markup renders as elements rather than through {@html}. Anything else
 * stays plain text.
 */
export function inlineSegments(source: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let bold = false;

  for (const part of source.split(/(`[^`]+`|\*\*)/)) {
    if (part === "**") bold = !bold;
    else if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      segments.push({ text: part.slice(1, -1), code: true, bold });
    else if (part) segments.push({ text: part, bold });
  }

  return segments;
}
