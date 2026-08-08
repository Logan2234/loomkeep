import { randomInt } from "node:crypto";

const SUFFIX_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Turns a free-form label into a username candidate: lowercase ASCII, no separators. */
export function slugifyUsername(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents (NFKD diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return slug.slice(0, 30) || "user";
}

/** Short random alphanumeric suffix, for disambiguating a taken username candidate. */
export function randomUsernameSuffix(length: number): string {
  let suffix = "";

  for (let i = 0; i < length; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }

  return suffix;
}
