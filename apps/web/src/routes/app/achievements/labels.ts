// Display text and glyph for one achievement, resolved from its registry
// key. The entry-level pieces (name/description/icon) live in
// $lib/achievement-labels.ts, shared with anywhere else an AchievementDto
// renders on its own — this file keeps only what depends on this route's
// own concepts (AchievementGroup, family sections).
import { entryIcon } from "$lib/achievement-labels";
import { formatDate, formatNumber } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type { AchievementFamily, AchievementTier } from "@loomkeep/shared";
import type { AchievementGroup } from "./achievements";

export {
  achievementDescription,
  achievementName,
  entryIcon,
} from "$lib/achievement-labels";

export function tierLabel(tier: AchievementTier | null): string {
  if (tier === "bronze") return m.gamification_tier_bronze();
  if (tier === "silver") return m.gamification_tier_silver();
  if (tier === "gold") return m.gamification_tier_gold();
  return m.gamification_tier_single();
}

export function familyLabel(family: AchievementFamily): string {
  switch (family) {
    case "volume":
      return m.gamification_family_volume();
    case "ritual":
      return m.gamification_family_ritual();
    case "exploration":
      return m.gamification_family_exploration();
    case "completion":
      return m.gamification_family_completion();
    case "seasonal":
      return m.gamification_family_seasonal();
    case "social":
      return m.gamification_family_social();
    case "account":
      return m.gamification_family_account();
    case "misc":
      return m.gamification_family_misc();
  }
}

export function groupIcon(group: AchievementGroup): IconName {
  return entryIcon(group.entries[0]);
}

/**
 * The one line of context under the tier ladder: where the user stands, and
 * what is left. Everything in it is derived from what the API returns — no
 * "unlocked on Twin Peaks S02E07"-style provenance exists in the data.
 */
/** A run of note text; `strong` marks the value the sentence is really about. */
export interface NoteSegment {
  text: string;
  strong?: boolean;
}

// Renders a one-placeholder message as three segments, so the value it
// carries can be emphasised against the dim sentence around it. Keeps the
// translations as whole, natural sentences rather than prefix/suffix
// fragments a translator would have to reassemble.
//
// The marker is plain ASCII on purpose: an earlier version used a NUL
// character, which a source-file edit silently turned into an empty string —
// and `split("")` splits per character, so the note rendered as "E8n".
// Hence the guard below: anything unexpected falls back to the plain
// sentence, unemphasised but correct.
const MARKER = "<<@>>";

function emphasise(
  render: (value: string) => string,
  value: string,
): NoteSegment[] {
  const parts = render(MARKER).split(MARKER);
  if (parts.length !== 2) return [{ text: render(value) }];

  return [
    { text: parts[0] },
    { text: value, strong: true },
    { text: parts[1] },
  ];
}

export function contextNote(group: AchievementGroup): NoteSegment[] {
  if (group.masked) return [{ text: m.gamification_note_secret() }];

  const highest = group.entries.filter((e) => e.unlocked).at(-1);
  const segments: NoteSegment[] = [];

  // "Never unlocked" and "every tier earned" are deliberately unsaid: the
  // stamp, the empty rail and the pips already show both, and repeating them
  // in prose is noise.
  if (!highest || !highest.unlockedAt) {
    // Nothing to say yet.
  } else if (highest.tier) {
    segments.push(
      ...emphasise(
        (date) =>
          m.gamification_note_unlocked_on({
            tier: tierLabel(highest.tier),
            date,
          }),
        formatDate(highest.unlockedAt),
      ),
    );
  } else {
    segments.push(
      ...emphasise(
        (date) => m.gamification_note_unlocked_single({ date }),
        formatDate(highest.unlockedAt),
      ),
    );
  }

  const next = group.next;

  if (next?.progress) {
    const count = formatNumber(next.progress.target - next.progress.current);

    if (segments.length > 0) segments.push({ text: " " });

    segments.push(
      ...emphasise(
        (value) =>
          next.tier
            ? m.gamification_note_remaining({
                count: value,
                tier: tierLabel(next.tier),
              })
            : m.gamification_note_remaining_simple({ count: value }),
        count,
      ),
    );
  }

  return segments;
}
