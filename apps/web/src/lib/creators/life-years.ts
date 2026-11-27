/** "1967", or "1929 – 2018": the years a person lived. */
export function lifeYears(
  birthday: string | null,
  deathday: string | null,
): string | null {
  const born = birthday?.slice(0, 4);
  const died = deathday?.slice(0, 4);
  if (!born) return died ? `† ${died}` : null;
  return died ? `${born} – ${died}` : born;
}
