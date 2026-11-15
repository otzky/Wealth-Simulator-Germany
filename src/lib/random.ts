/** Small, fast pseudo-random generator (mulberry32). Same seed, same numbers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal random numbers (Box-Muller), driven by a seeded generator. */
export function normalGenerator(seed: number): () => number {
  return gaussian(mulberry32(seed));
}

/** Standard normal random numbers from a given source of uniform numbers. */
export function gaussian(next: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u <= Number.EPSILON) u = next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Seed for one simulated path, derived from the plan's seed so that every path has its own numbers. */
export function pathSeed(seed: number, path: number): number {
  return (Math.imul(seed ^ 0x5bd1e995, 0x27d4eb2d) + Math.imul(path + 1, 0x9e3779b1)) >>> 0;
}
