// "Que regarder ce soir ?": one work per day, drawn from nothing but the day
// and a seed — no stored pick. Days are dealt from a shuffle of the list: a
// cycle of n days shows each of n works once, in an order reshuffled every
// cycle, so two days in a row never land on the same work (n ≥ 2), and a
// work comes back only once all the others have had their turn.

const DAY_MS = 86_400_000;

/** Days since the epoch, counted on the viewer's own calendar. */
export const localDayNumber = (date: Date): number =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );

// FNV-1a: turns the seed and the cycle into a 32-bit number.
function hash(value: string): number {
  let h = 0x811c9dc5;

  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

// mulberry32: a small, well-mixed PRNG — Math.random can't be seeded.
function random(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const next = random(seed);

  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
}

const cycleOrder = (n: number, seed: string, cycle: number) =>
  shuffle(n, hash(`${seed}:${cycle}`));

/**
 * Index (0..n-1) of the work to show on `day` among `n`, or -1 when there's
 * none. The same `seed` (the user) and day always give the same index.
 */
export function dailyPick(n: number, seed: string, day: number): number {
  if (n <= 0) return -1;
  if (n === 1) return 0;
  // Two works can only alternate — a shuffle couldn't promise that.
  if (n === 2) return (day + hash(seed)) % 2;

  const cycle = Math.floor(day / n);
  const position = day - cycle * n;
  const order = cycleOrder(n, seed, cycle);

  // A cycle's first day could deal the work the previous cycle ended on:
  // swapping its first two keeps the rule, and never touches the last slot
  // the next cycle compares against (n ≥ 3).
  if (order[0] === cycleOrder(n, seed, cycle - 1)[n - 1]) {
    [order[0], order[1]] = [order[1], order[0]];
  }

  return order[position];
}
