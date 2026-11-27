/**
 * The TMDB networks the premieres calendar keeps. Unfiltered, TMDB lists
 * a couple hundred new series a month, most with no poster nor synopsis;
 * these networks bring that down to the few dozen people look for.
 *
 * `global`: the network releases worldwide on the same day, so the TMDB
 * date is also the French one. `providerIds`: the watch providers (TMDB ids,
 * as in `UserDto.watchProviderIds`) that carry the network's shows, for the
 * "my services" filter — JustWatch lists no offer before a release, so a
 * premiere can only be matched to someone's services through its network.
 */
export interface PremiereNetwork {
  id: number;
  name: string;
  global: boolean;
  providerIds: number[];
}

export const PREMIERE_NETWORKS: readonly PremiereNetwork[] = [
  { id: 213, name: "Netflix", global: true, providerIds: [8, 1796] },
  { id: 1024, name: "Prime Video", global: true, providerIds: [119, 2100] },
  { id: 2739, name: "Disney+", global: true, providerIds: [337] },
  { id: 2552, name: "Apple TV", global: true, providerIds: [350, 2243] },
  { id: 49, name: "HBO", global: false, providerIds: [1899, 1825] },
  { id: 3186, name: "HBO Max", global: false, providerIds: [1899, 1825] },
  {
    id: 4330,
    name: "Paramount+",
    global: false,
    providerIds: [531, 582, 1853, 2303],
  },
  { id: 453, name: "Hulu", global: false, providerIds: [] },
  { id: 3353, name: "Peacock", global: false, providerIds: [] },
  { id: 67, name: "Showtime", global: false, providerIds: [] },
  { id: 318, name: "STARZ", global: false, providerIds: [] },
  { id: 88, name: "FX", global: false, providerIds: [] },
  { id: 174, name: "AMC", global: false, providerIds: [] },
  { id: 6, name: "NBC", global: false, providerIds: [] },
  { id: 2, name: "ABC", global: false, providerIds: [] },
  { id: 16, name: "CBS", global: false, providerIds: [] },
  { id: 19, name: "FOX", global: false, providerIds: [] },
  { id: 285, name: "Canal+", global: false, providerIds: [381, 345] },
  { id: 290, name: "TF1", global: false, providerIds: [1754] },
  { id: 361, name: "France 2", global: false, providerIds: [] },
  { id: 712, name: "M6", global: false, providerIds: [147, 2672] },
  { id: 1628, name: "ARTE", global: false, providerIds: [234] },
  { id: 4, name: "BBC One", global: false, providerIds: [] },
  { id: 332, name: "BBC Two", global: false, providerIds: [] },
  { id: 26, name: "Channel 4", global: false, providerIds: [] },
  { id: 214, name: "Sky One", global: false, providerIds: [] },
];

/** The networks whose shows someone's watch providers carry. */
export function premiereNetworksFor(
  providerIds: readonly number[],
): Set<number> {
  const mine = new Set(providerIds);
  return new Set(
    PREMIERE_NETWORKS.filter((n) => n.providerIds.some((p) => mine.has(p))).map(
      (n) => n.id,
    ),
  );
}
