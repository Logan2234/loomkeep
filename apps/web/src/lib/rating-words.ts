import { m } from "$lib/paraglide/messages.js";

// Index = integer rating. Functions, not strings, so the word follows a
// locale switch without a reload.
const WORDS = [
  m.reviews_rating_word_0,
  m.reviews_rating_word_1,
  m.reviews_rating_word_2,
  m.reviews_rating_word_3,
  m.reviews_rating_word_4,
  m.reviews_rating_word_5,
  m.reviews_rating_word_6,
  m.reviews_rating_word_7,
  m.reviews_rating_word_8,
  m.reviews_rating_word_9,
  m.reviews_rating_word_10,
];

/** The qualitative label for a /10 rating ("Très bien" for 8); legacy half-points round. */
export function ratingWord(rating: number): string {
  return WORDS[Math.min(10, Math.max(0, Math.round(rating)))]();
}
