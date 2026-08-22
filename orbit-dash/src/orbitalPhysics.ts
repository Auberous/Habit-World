// Minimal Newtonian gravity sim: one fixed star, N planets on circular orbits,
// a single massless ship influenced by all of them. Tuned for game-feel, not
// astronomical accuracy.

export type Vec2 = { x: number; y: number };

export const vAdd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const vSub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const vScale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const vLen = (a: Vec2): number => Math.hypot(a.x, a.y);

export type PlanetDef = {
  id: string;
  color: string;
  mass: number;
  radius: number;
  orbitRadius: number;
  angularSpeed: number; // rad/s
  phase0: number;
};

export type BodyState = {
  id: string;
  color: string;
  mass: number;
  radius: number;
  pos: Vec2;
};

// Real solar system, scaled for play rather than for accuracy in any one
// dimension:
//  - Orbital distance: real AU ratios, linear (AU_TO_WORLD world units/AU).
//  - Orbital speed: derived from the real distance via Kepler's third law
//    (T^2 ∝ a^3), not hand-tuned per planet — so Mercury visibly swings
//    around while Neptune is nearly motionless during a single flight,
//    same as it would be for a real spacecraft.
//  - Body size & mass: real ratios compressed by a shared sqrt() so the
//    Sun doesn't have to be either invisible-Earth-sized or so huge it
//    swallows the screen — every solar-system diagram makes this same
//    trade, since no single linear scale can show both real distance and
//    real size at once. Ordering and roughly-real proportion (gas giants
//    dwarfing the inner planets, Sun dominant over everything) survive the
//    compression; the exact km-for-km ratio does not.
const AU_TO_WORLD = 150;
const KEPLER_K = 918.55; // tuned so Earth's angularSpeed lands at 0.5 rad/s

function auOrbit(au: number): number {
  return au * AU_TO_WORLD;
}

function keplerAngularSpeed(orbitRadius: number): number {
  return KEPLER_K / Math.pow(orbitRadius, 1.5);
}

export const SUN = { mass: 30000, radius: 34, color: '#ffd166' };

export const PLANETS: PlanetDef[] = [
  { id: 'mercury', color: '#b0a494', mass: 12, radius: 2.0, orbitRadius: auOrbit(0.39), angularSpeed: 0, phase0: 0.9 },
  { id: 'venus', color: '#e8d9a0', mass: 47, radius: 3.2, orbitRadius: auOrbit(0.72), angularSpeed: 0, phase0: 4.2 },
  { id: 'earth', color: '#4f9eea', mass: 52, radius: 3.3, orbitRadius: auOrbit(1.0), angularSpeed: 0, phase0: 2.5 },
  { id: 'mars', color: '#c1440e', mass: 17, radius: 2.4, orbitRadius: auOrbit(1.52), angularSpeed: 0, phase0: 5.6 },
  { id: 'jupiter', color: '#d8b98a', mass: 927, radius: 10.8, orbitRadius: auOrbit(5.2), angularSpeed: 0, phase0: 1.2 },
  { id: 'saturn', color: '#e3c88f', mass: 507, radius: 9.8, orbitRadius: auOrbit(9.58), angularSpeed: 0, phase0: 3.8 },
  { id: 'uranus', color: '#7fdbda', mass: 198, radius: 6.5, orbitRadius: auOrbit(19.22), angularSpeed: 0, phase0: 0.4 },
  { id: 'neptune', color: '#3457d5', mass: 215, radius: 6.4, orbitRadius: auOrbit(30.05), angularSpeed: 0, phase0: 5.0 },
].map((p) => ({ ...p, angularSpeed: keplerAngularSpeed(p.orbitRadius) }));

// Launched from Earth orbit, not from Earth itself (avoids spawning inside
// its collision radius) — top of the orbit, same convention as before.
export const LAUNCH_PAD: Vec2 = { x: 0, y: -auOrbit(1.0) };
export const VIEW_RADIUS = 320; // world units shown at the board edge when un-zoomed (a bit past Mars)
// Just past Neptune's real orbit: escaping now means surviving a genuine
// multi-planet gauntlet, not one lucky close pass near Earth.
export const ESCAPE_RADIUS = auOrbit(30.05) + 700;

export type Milestone = { distance: number; label: string };

/** Named waypoints on the way out, fired once per run as the ship's max
 * distance first crosses each threshold — turns "escape or nothing" into a
 * ladder of small wins on the way to the big one. */
export const MILESTONES: Milestone[] = [
  { distance: auOrbit(1.52), label: 'Cleared Mars orbit' },
  { distance: auOrbit(2.8), label: 'Crossed the asteroid belt' },
  { distance: auOrbit(5.2), label: 'Jupiter flyby complete' },
  { distance: auOrbit(9.58), label: 'Saturn flyby complete' },
  { distance: auOrbit(19.22), label: "Past Uranus' orbit" },
  { distance: auOrbit(30.05), label: 'Neptune flyby — edge of the known planets' },
];

const MIN_GRAVITY_DIST = 2;
export const COLLISION_MARGIN = 3;

/** Risk-zone radii around a body, for both collision checks and the on-screen rings. */
export function riskRadii(body: { radius: number }) {
  const crash = body.radius + COLLISION_MARGIN;
  return {
    crash, // red: inside this is a collision
    highRisk: crash * 2.3, // yellow: big assist, real risk
    safe: crash * 4.6, // green: gentle, reliable assist
  };
}

/** Local escape speed at distance r from the Sun alone (vis-viva, v_esc = sqrt(2GM/r)). */
export function localEscapeSpeed(distFromSun: number): number {
  return Math.sqrt((2 * G * SUN.mass) / Math.max(distFromSun, MIN_GRAVITY_DIST));
}

export function planetPosition(def: PlanetDef, t: number): Vec2 {
  const a = def.phase0 + def.angularSpeed * t;
  return { x: Math.cos(a) * def.orbitRadius, y: Math.sin(a) * def.orbitRadius };
}

export function computeBodies(t: number): BodyState[] {
  const bodies: BodyState[] = [
    { id: 'sun', color: SUN.color, mass: SUN.mass, radius: SUN.radius, pos: { x: 0, y: 0 } },
  ];
  for (const p of PLANETS) {
    bodies.push({ id: p.id, color: p.color, mass: p.mass, radius: p.radius, pos: planetPosition(p, t) });
  }
  return bodies;
}

const G = 420;

/** Gravitational acceleration on a massless ship from all bodies, plus which body (if any) it has collided with. */
export function gravityAccel(shipPos: Vec2, bodies: BodyState[]): { accel: Vec2; collidedWith: BodyState | null } {
  let ax = 0;
  let ay = 0;
  let collidedWith: BodyState | null = null;
  for (const b of bodies) {
    const dx = b.pos.x - shipPos.x;
    const dy = b.pos.y - shipPos.y;
    const dist = Math.max(Math.hypot(dx, dy), MIN_GRAVITY_DIST);
    if (dist <= b.radius + COLLISION_MARGIN) {
      collidedWith = b;
    }
    const f = (G * b.mass) / (dist * dist * dist);
    ax += f * dx;
    ay += f * dy;
  }
  return { accel: { x: ax, y: ay }, collidedWith };
}

/** Advances ship position/velocity by dt using fixed sub-steps for stability. */
export function integrateShip(
  pos: Vec2,
  vel: Vec2,
  t: number,
  dt: number,
  substeps = 4
): { pos: Vec2; vel: Vec2; t: number; collidedWith: BodyState | null } {
  const h = dt / substeps;
  let p = pos;
  let v = vel;
  let time = t;
  let collidedWith: BodyState | null = null;
  for (let i = 0; i < substeps; i++) {
    const bodies = computeBodies(time);
    const { accel, collidedWith: hit } = gravityAccel(p, bodies);
    if (hit) collidedWith = hit;
    v = vAdd(v, vScale(accel, h));
    p = vAdd(p, vScale(v, h));
    time += h;
    if (collidedWith) break;
  }
  return { pos: p, vel: v, t: time, collidedWith };
}
