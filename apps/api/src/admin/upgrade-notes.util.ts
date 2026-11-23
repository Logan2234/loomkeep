import type { AdminUpgradeNoteDto } from "@loomkeep/shared";
import { isNewerVersion } from "./update-check.service";

const VERSION_HEADING = /^## (\d+\.\d+\.\d+)\b/;
const ACTION_HEADINGS = /^### (Breaking changes|Before upgrading\b)/;

/**
 * The CHANGELOG bullets a self-hoster must read before going from `current`
 * to `latest`: those under "Breaking changes" or "Before upgrading…" of each
 * version in (current, latest], oldest first. A bullet's wrapped lines are
 * joined and its links reduced to their text.
 */
export function upgradeNotesBetween(
  changelog: string,
  current: string,
  latest: string,
): AdminUpgradeNoteDto[] {
  const notes: AdminUpgradeNoteDto[] = [];
  let version: string | null = null;
  let inAction = false;
  let items: string[] = [];

  const close = () => {
    if (version !== null && items.length > 0) notes.push({ version, items });
    items = [];
  };

  for (const line of changelog.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      close();
      const match = VERSION_HEADING.exec(line);
      version =
        match &&
        isNewerVersion(match[1], current) &&
        !isNewerVersion(match[1], latest)
          ? match[1]
          : null;
      inAction = false;
    } else if (line.startsWith("### ")) {
      inAction = ACTION_HEADINGS.test(line);
    } else if (version !== null && inAction) {
      if (line.startsWith("- ")) items.push(line.slice(2).trim());
      else if (/^\s+\S/.test(line) && items.length > 0)
        items[items.length - 1] += ` ${line.trim()}`;
    }
  }

  close();

  return notes
    .map((note) => ({
      ...note,
      items: note.items.map((item) =>
        item.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
      ),
    }))
    .reverse();
}
