import { DOMAINS } from "#lib/constants/domains.js";
import { m } from "#lib/paraglide/messages.js";
import {
  POLL_OPTIONS_MIN,
  type Domain,
  type LibrarySagasDto,
  type MessageWorkDto,
  type PickDomain,
  type SagaDomain,
} from "@loomkeep/shared";
import { matchingTitle } from "./attachments";

/** `/pick <name>`: the names are English, like the commands themselves. */
const PICK_NAMES: Record<PickDomain, string> = {
  MEDIA: "video",
  GAMES: "games",
  BOOKS: "books",
  MUSIC: "music",
};

const PILE: Record<PickDomain, () => string> = {
  MEDIA: m.media_status_planned,
  GAMES: m.game_status_backlog,
  BOOKS: m.book_status_to_read,
  MUSIC: m.pile_tile_to_listen,
};

export interface PickChoice {
  name: string;
  domain: PickDomain;
  label: string;
  pile: string;
}

/**
 * What `/pick` offers: the viewer's domains that have a pile, in the order of
 * their settings, the ones they turned off left out, filtered by what follows
 * `/pick `.
 */
export function pickChoices(
  ordered: Domain[],
  enabled: (domain: Domain) => boolean,
  query: string,
): PickChoice[] {
  const typed = query.trim().toLowerCase();
  return ordered
    .filter((d): d is PickDomain => d in PICK_NAMES && enabled(d))
    .map((domain) => ({
      name: PICK_NAMES[domain],
      domain,
      label: DOMAINS[domain].label,
      pile: PILE[domain](),
    }))
    .filter(
      (choice) =>
        !typed ||
        choice.name.startsWith(typed) ||
        matchingTitle(choice.label, typed),
    );
}

export interface SagaChoice {
  domain: SagaDomain;
  key: string;
  title: string;
  imageUrl: string | null;
  seen: number;
  released: number;
}

type AnySagas = LibrarySagasDto<{
  title: string;
  posterUrl?: string | null;
  coverUrl?: string | null;
}>;

/**
 * The sagas `/saga` offers: the viewer's own, in progress first, then the
 * ones waiting on a sequel, then the finished ones — each domain in the
 * viewer's order.
 */
export function sagaChoices(
  sagas: { domain: SagaDomain; list: AnySagas | undefined }[],
  query: string,
): SagaChoice[] {
  const groups = ["inProgress", "waiting", "finished"] as const;
  return groups.flatMap((group) =>
    sagas.flatMap(({ domain, list }) =>
      (list?.[group] ?? [])
        .filter(
          (saga) =>
            matchingTitle(saga.title, query) ||
            saga.members.some((member) => matchingTitle(member.title, query)),
        )
        .map((saga) => ({
          domain,
          key: saga.key,
          title: saga.title,
          imageUrl:
            saga.members[0]?.posterUrl ?? saga.members[0]?.coverUrl ?? null,
          seen: saga.seen,
          released: saga.released,
        })),
    ),
  );
}

/** A `/poll` option being written: text, or a work picked with `#`. */
export interface PollOptionDraft {
  text: string;
  work: MessageWorkDto | null;
}

/** Ready to send: a question, and at least two options with something in them. */
export function pollReady(
  question: string,
  options: PollOptionDraft[],
): boolean {
  const filled = options.filter((o) => o.work || o.text.trim());
  return question.trim().length > 0 && filled.length >= POLL_OPTIONS_MIN;
}

/** What `/where` looks for: TMDB's films and series, the ones with platforms. */
export const WHERE_KINDS = ["MOVIE", "SERIES"] as const;
