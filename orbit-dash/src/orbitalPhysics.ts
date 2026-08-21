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

export const SUN = { mass: 26000, radius: 26, color: '#ffd166' };

export const PLANETS: PlanetDef[] = [
  {
    id: 'inner',
    color: '#8ecae6',
    mass: 900,
    radius: 10,
    orbitRadius: 150,
    angularSpeed: 0.85,
    phase0: 0.6,
  },
  {
    id: 'outer',
    color: '#ff8fa3',
    mass: 2400,
    radius: 16,
    orbitRadius: 270,
    angularSpeed: 0.4,
    phase0: 3.4,
  },
];

export const LAUNCH_PAD: Vec2 = { x: 0, y: -360 };
export const VIEW_RADIUS = 460; // world units from origin shown at the board edge when un-zoomed
// Deliberately far past the planets: reaching it means surviving a genuine
// multi-slingshot outbound coast, not one lucky close pass.
export const ESCAPE_RADIUS = 1250;

const MIN_GRAVITY_DIST = 6;
export const COLLISION_MARGIN = 6;

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
    if (dist <= b.radius + 6) {
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
