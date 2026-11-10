import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared";

/**
 * The few works a peek shows: from the group the person is best known for,
 * released ones with a poster, newest first. Appearances, mentions and
 * shorts are left out.
 */
export function peekWorks(person: PersonPageDto, count = 4): CreatorWorkDto[] {
  const group =
    person.groups.find((g) => g.key === person.knownFor) ?? person.groups[0];
  return (group?.works ?? [])
    .filter((w) => w.kind === "WORK" && w.posterUrl && !w.upcoming)
    .reverse()
    .slice(0, count);
}
