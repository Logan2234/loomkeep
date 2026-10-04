export interface MovieReleaseDate {
  country: string;
  date: string;
  /** TMDB release type: 1 premiere, 2 limited cinema, 3 cinema, 4 digital, 5 physical, 6 TV. */
  type: number;
}

export interface MovieReleaseInfo {
  upcoming: boolean;
  publicDate: string | null;
  localDate: string | null;
  localType: "cinema" | "digital" | null;
  region: string;
}

export function movieReleaseDates(value: unknown): MovieReleaseDate[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is MovieReleaseDate =>
      r !== null &&
      typeof r === "object" &&
      typeof r.country === "string" &&
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      Number.isFinite(Date.parse(r.date)) &&
      Number.isInteger(r.type),
  );
}

export function movieReleaseInfo(
  dates: MovieReleaseDate[],
  status: string | null | undefined,
  region: string,
  now = new Date(),
): MovieReleaseInfo {
  const first = (values: MovieReleaseDate[]) =>
    values.map((r) => r.date).sort()[0] ?? null;
  const publicDate = first(dates.filter((r) => r.type >= 2 && r.type <= 6));
  const local = dates.filter((r) => r.country === region);
  const cinema = first(local.filter((r) => r.type === 2 || r.type === 3));
  const digital = first(local.filter((r) => r.type === 4));
  return {
    upcoming:
      publicDate !== null
        ? publicDate > now.toISOString().slice(0, 10)
        : ["Rumored", "Planned", "In Production", "Post Production"].includes(
            status ?? "",
          ),
    publicDate,
    localDate: cinema ?? digital,
    localType: cinema ? "cinema" : digital ? "digital" : null,
    region,
  };
}

/**
 * An announced anime that hasn't started airing yet (AniList's own status).
 * Like an unreleased film, it can be followed — shown as upcoming — but not
 * completed, rated or reviewed until it airs.
 */
export function isAnimeUnaired(status: string | null | undefined): boolean {
  return status === "NOT_YET_RELEASED";
}
