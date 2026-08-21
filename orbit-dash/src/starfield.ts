// Deterministic starfield: a fixed backdrop of points, generated once and
// never re-randomized on re-render. Positions are normalized (0..1) so the
// caller can scale them to whatever board size it's drawing.

export type Star = { x: number; y: number; r: number; o: number };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStars(count: number, seed = 1337): Star[] {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(),
      y: rand(),
      r: 0.4 + rand() * rand() * 1.6,
      o: 0.25 + rand() * 0.55,
    });
  }
  return stars;
}
