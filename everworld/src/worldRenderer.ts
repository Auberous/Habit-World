import type { Levels } from './habitData';

function mulberry(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const WIDTH = 700;
const HEIGHT = 420;

// The world is framed as a "high oblique" view: you look down and out across
// the land at an angle, rather than straight down. That keeps the horizon,
// sky, sun/moon and clouds in frame alongside the ground, which is what lets
// weather and time-of-day read as part of the world instead of a HUD.
const HORIZON_Y = 172;
const SURFACE_FRONT_Y = 392;
const EDGE_BOTTOM_Y = HEIGHT;

// The ground plane is a trapezoid that narrows toward the horizon (the far
// edge) and widens toward the viewer (the front edge) — simple one-point
// perspective. `project` turns a lateral position `u` (0 = left, 1 = right)
// and a depth `depth` (0 = far / at the horizon, 1 = near / front edge) into
// screen coordinates and a size scale, so anything placed on the ground gets
// smaller and sits higher the further away it is.
const BACK_X0 = -10;
const BACK_X1 = 710;
const FRONT_X0 = -60;
const FRONT_X1 = 760;

function project(u: number, depth: number) {
  const d = Math.min(1, Math.max(0, depth));
  const y = lerp(HORIZON_Y, SURFACE_FRONT_Y, d);
  const xStart = lerp(BACK_X0, FRONT_X0, d);
  const xWidth = lerp(BACK_X1 - BACK_X0, FRONT_X1 - FRONT_X0, d);
  const x = xStart + u * xWidth;
  const scale = lerp(0.42, 1.1, d);
  return { x, y, scale };
}

// ---- Animation helpers -----------------------------------------------------
// Every moving thing below is animated in pure CSS (looping @keyframes),
// not a JS render loop — renderWorldSvg() stays a pure, cheap
// `Levels -> SVG string` function that can run once per habit toggle, and
// the browser's compositor handles the actual motion for free. Anything
// that needs a *per-instance* path (an animal wandering to a different spot
// than its neighbour) gets its own uniquely-named @keyframes block, built
// with the same seeded-RNG approach as the rest of the file so re-renders
// (e.g. toggling one habit) don't reshuffle every other creature's motion.
interface AnimCtx {
  rnd: () => number;
  extraCss: string[];
  nextId: (prefix: string) => string;
}

function makeAnimCtx(seed: number): AnimCtx {
  const rnd = mulberry(seed);
  let counter = 0;
  return {
    rnd,
    extraCss: [],
    nextId: (prefix: string) => `${prefix}${counter++}`,
  };
}

// A short, local wander loop: the creature drifts to two nearby points and
// back, entirely within its own already-scaled/positioned <g>, so the
// offsets are small pixel deltas rather than world coordinates.
function wanderAnim(ctx: AnimCtx, radiusX: number, radiusY: number, duration: number) {
  const id = ctx.nextId('wd');
  const dx1 = (ctx.rnd() * 2 - 1) * radiusX;
  const dy1 = (ctx.rnd() * 2 - 1) * radiusY;
  const dx2 = (ctx.rnd() * 2 - 1) * radiusX;
  const dy2 = (ctx.rnd() * 2 - 1) * radiusY;
  const delay = (ctx.rnd() * duration).toFixed(1);
  ctx.extraCss.push(`@keyframes ${id} {
    0%, 100% { transform: translate(0,0); }
    33% { transform: translate(${dx1.toFixed(1)}px, ${dy1.toFixed(1)}px); }
    66% { transform: translate(${dx2.toFixed(1)}px, ${dy2.toFixed(1)}px); }
  }`);
  return `animation: ${id} ${duration}s ease-in-out infinite; animation-delay: -${delay}s;`;
}

function tree(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="0,-4 4,10 -4,10" fill="#6b4a30"/>
    <g class="sway">
      <polygon points="-16,4 16,4 0,-30" fill="${tone}"/>
      <polygon points="-12,-8 12,-8 0,-34" fill="${tone}" opacity="0.85"/>
    </g>
  </g>`;
}

function bush(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <g class="sway sway-small">
      <polygon points="-10,4 10,4 6,-8 -6,-8" fill="${tone}"/>
    </g>
  </g>`;
}

function hut(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="-14,10 14,10 14,-4 -14,-4" fill="#8a6a45"/>
    <polygon points="-18,-4 18,-4 0,-22" fill="#6b4e30"/>
    <rect x="-4" y="0" width="8" height="10" fill="#4a3520"/>
  </g>`;
}

function statue(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect x="-9" y="-2" width="18" height="6" fill="#9a9186"/>
    <rect x="-4" y="-22" width="8" height="20" fill="#b0a89b"/>
    <circle cx="0" cy="-26" r="5" fill="#b0a89b"/>
  </g>`;
}

// Creatures and townsfolk walk in from whichever side edge they're closer
// to, so the world feels inhabited rather than assembled. `walker()` wraps a
// shape in an inner group carrying the walk-in animation, nested inside the
// caller's placement transform so the animation offset stays in local units.
// An optional wander animation nests *inside* that, so the one-shot entrance
// and the continuous idle motion are each their own <g> with their own CSS
// animation — composed by nesting rather than fighting over one `transform`.
function walkerClass(x: number) {
  return x < WIDTH / 2 ? 'walker walk-in-left' : 'walker walk-in-right';
}

function walker(x: number, inner: string, wanderStyle?: string) {
  const body = wanderStyle ? `<g style="${wanderStyle}">${inner}</g>` : inner;
  return `<g class="${walkerClass(x)}">${body}</g>`;
}

function person(x: number, y: number, scale: number, tone: string, ctx: AnimCtx, building: boolean) {
  const armAnim = building
    ? `<g class="hammer-arm" style="transform-origin: 3px -10px;"><rect x="2" y="-13" width="7" height="2.4" fill="${tone}"/></g>`
    : '';
  const wander = building ? undefined : wanderAnim(ctx, 6, 1.2, 5 + ctx.rnd() * 2);
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(
    x,
    `
    <circle cx="0" cy="-16" r="4" fill="${tone}"/>
    <polygon points="-5,-12 5,-12 4,4 -4,4" fill="${tone}"/>
    ${armAnim}
  `,
    wander
  )}</g>`;
}

function fox(x: number, y: number, scale: number, ctx: AnimCtx) {
  const wander = wanderAnim(ctx, 10, 2.5, 6 + ctx.rnd() * 3);
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(
    x,
    `
    <polygon points="-10,2 10,2 12,-6 -4,-8" fill="#d9773f"/>
    <polygon points="12,-6 20,-2 12,-1" fill="#d9773f"/>
    <polygon points="-4,-8 -12,-14 -8,-6" fill="#d9773f"/>
    <polygon points="-10,2 -14,10 -8,10" fill="#d9773f"/>
    <polygon points="6,2 4,10 10,10" fill="#d9773f"/>
    <polygon points="-14,10 -6,4 -3,10" fill="#fff" opacity="0.85"/>
  `,
    wander
  )}</g>`;
}

// Birds fly a continuous loop on an SVG motion path (`offset-path`), which
// gives a natural curved flight for free — cheaper and smoother than
// hand-authoring waypoints, and each bird just needs its own loop size.
function bird(x: number, y: number, scale: number, ctx: AnimCtx) {
  const id = ctx.nextId('fly');
  const rx = 40 + ctx.rnd() * 30;
  const ry = 14 + ctx.rnd() * 10;
  const duration = (9 + ctx.rnd() * 6).toFixed(1);
  const delay = (ctx.rnd() * 10).toFixed(1);
  ctx.extraCss.push(`.${id} {
    offset-path: path("M ${-rx},0 A ${rx},${ry} 0 1 0 ${rx},0 A ${rx},${ry} 0 1 0 ${-rx},0");
    offset-rotate: auto;
    animation: ${id}fly ${duration}s linear infinite;
    animation-delay: -${delay}s;
  }
  @keyframes ${id}fly { to { offset-distance: 100%; } }`);
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <g class="${id}">
      <path d="M -8,0 Q 0,-6 8,0 Q 0,-2 -8,0" fill="none" stroke="#e8a8c0" stroke-width="1.6"/>
    </g>
  </g>`;
}

function deer(x: number, y: number, scale: number, ctx: AnimCtx) {
  const wander = wanderAnim(ctx, 8, 2, 7 + ctx.rnd() * 3);
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(
    x,
    `
    <polygon points="-12,4 10,4 12,-6 -6,-8" fill="#a97a52"/>
    <polygon points="-6,-8 -10,-16 -4,-10" fill="#a97a52"/>
    <line x1="-9" y1="-14" x2="-13" y2="-19" stroke="#a97a52" stroke-width="1.4"/>
    <line x1="-9" y1="-14" x2="-6" y2="-20" stroke="#a97a52" stroke-width="1.4"/>
    <polygon points="-12,4 -15,12 -9,12" fill="#a97a52"/>
    <polygon points="4,4 2,12 8,12" fill="#a97a52"/>
  `,
    wander
  )}</g>`;
}

// A jagged horizon-line silhouette, standing in for a distant mountain
// range. Purely a backdrop layer (drawn behind the ground plane, at the
// horizon) — its tier tracks overall world vitality rather than any single
// colour, since "does this world have a dramatic skyline" reads as a
// whole-world trait rather than one habit's reward.
function mountainRange(tier: number): string {
  if (tier <= 0) return '';
  const rnd = mulberry(501);
  const peakCount = 4 + tier;
  const baseY = HORIZON_Y + 6;
  const heightBase = 16 + tier * 20;

  const points: [number, number][] = [];
  for (let i = 0; i <= peakCount; i++) {
    const x = -20 + (WIDTH + 40) * (i / peakCount);
    const h = heightBase * (0.55 + rnd() * 0.6);
    points.push([x, baseY - h]);
  }

  let path = `M -20,${baseY} `;
  points.forEach(([x, y]) => {
    path += `L ${x.toFixed(1)},${y.toFixed(1)} `;
  });
  path += `L ${WIDTH + 20},${baseY} Z`;

  const tone = tier >= 3 ? '#5c6672' : tier === 2 ? '#4a5460' : '#3d4652';
  let out = `<path d="${path}" fill="${tone}" opacity="0.9"/>`;

  if (tier >= 3) {
    points.forEach(([x, y]) => {
      out += `<polygon points="${(x - 7).toFixed(1)},${(y + 9).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)} ${(x + 7).toFixed(1)},${(y + 9).toFixed(1)}" fill="#eef4f8" opacity="0.9"/>`;
    });
  }

  return out;
}

export function renderWorldSvg(levels: Levels): string {
  const { blue, green, brown, grey, pink } = levels;
  const total = blue + green + brown + grey + pink;
  const mountainTier = total === 0 ? 0 : total < 6 ? 1 : total < 14 ? 2 : 3;
  const ctx = makeAnimCtx(909);

  const skyTop = ['#161a24', '#1c2534', '#2a3a4d', '#3f6a8c', '#5fa3c9', '#8fd0ee'][blue];
  const skyBot = ['#20242e', '#2a3140', '#3d4a55', '#5a7d8f', '#9dc6d9', '#c9ecf5'][blue];
  const groundBase = ['#4a4034', '#564a3a', '#5f5b3d', '#5d6b3e', '#5a7a3f', '#4f8f45'][green];
  const groundEdge = ['#3a3226', '#453b2d', '#4a4a2c', '#485631', '#456530', '#3f7735'][green];
  const cliffTone = ['#2c241a', '#332a1e', '#3a3020', '#3a3c22', '#334322', '#2e4a26'][green];

  let out = `<defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skyTop}"/>
      <stop offset="1" stop-color="${skyBot}"/>
    </linearGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${groundBase}"/>
      <stop offset="1" stop-color="${groundEdge}"/>
    </linearGradient>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skyBot}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${skyBot}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="fogGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="fogTurbulence" x="-60%" y="-60%" width="220%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="2" seed="11" result="noise">
        <animate attributeName="baseFrequency" values="0.014 0.03;0.02 0.038;0.014 0.03" dur="16s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="34" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="3.5"/>
    </filter>
    <pattern id="waterfallPattern" width="6" height="10" patternUnits="userSpaceOnUse">
      <rect width="6" height="10" fill="#bfe6f2"/>
      <rect width="6" height="5" fill="#eef8fb" opacity="0.7"/>
      <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 10" dur="0.5s" repeatCount="indefinite"/>
    </pattern>
    <style>
      .walker { animation-duration: 1.3s; animation-timing-function: cubic-bezier(.2,.7,.25,1); animation-fill-mode: backwards; }
      .walk-in-left { animation-name: walkInLeft; }
      .walk-in-right { animation-name: walkInRight; }
      @keyframes walkInLeft { from { transform: translateX(-90px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes walkInRight { from { transform: translateX(90px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

      .fog-layer { mix-blend-mode: screen; }
      .fog-bank { animation: fogDrift 34s ease-in-out infinite, fogFade 4s ease-out forwards; }
      .fog-bank.fog-b { animation-duration: 42s, 4s; animation-delay: -12s, 0.5s; }
      .fog-bank.fog-c { animation-duration: 38s, 4s; animation-delay: -22s, 1s; }
      @keyframes fogDrift {
        0% { transform: translateX(-90px); }
        50% { transform: translateX(70px); }
        100% { transform: translateX(-90px); }
      }
      @keyframes fogFade {
        0% { opacity: 0.9; }
        70% { opacity: 0.9; }
        100% { opacity: 0.4; }
      }

      /* Trees/bushes sway in a gentle wind — pivoting at each shape's own
         base (fill-box) means no per-instance pixel math is needed. */
      .sway { transform-box: fill-box; transform-origin: bottom center; animation: sway 4.2s ease-in-out infinite; }
      .sway-small { animation-duration: 3.4s; }
      @keyframes sway { 0%, 100% { transform: rotate(-2.4deg); } 50% { transform: rotate(2.4deg); } }

      .cloud-drift { animation: cloudDrift 20s ease-in-out infinite; }
      @keyframes cloudDrift { 0%, 100% { transform: translateX(-10px); } 50% { transform: translateX(10px); } }

      .river-flow { animation: riverFlow 1s linear infinite; }
      @keyframes riverFlow { to { stroke-dashoffset: -14; } }

      .hammer-arm { animation: hammer 0.9s ease-in-out infinite; }
      @keyframes hammer { 0%, 100% { transform: rotate(0deg); } 40% { transform: rotate(-35deg); } 55% { transform: rotate(10deg); } }

      .rain-drop { animation: rainFall 0.9s linear infinite; }
      @keyframes rainFall {
        0% { transform: translateY(-8px); opacity: 0; }
        20% { opacity: 0.8; }
        100% { transform: translateY(26px); opacity: 0; }
      }
    </style>
  </defs>`;

  // --- Sky (full-bleed, so it stays visible behind/around the land plane) ---
  out += `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#skyGrad)"/>`;

  if (blue <= 1) {
    const rnd = mulberry(42);
    let stars = '';
    for (let i = 0; i < 40; i++) {
      const x = rnd() * WIDTH;
      const y = rnd() * (HORIZON_Y - 10);
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="#ffffff" opacity="${(0.3 + rnd() * 0.5).toFixed(2)}"/>`;
    }
    out += stars;
  } else {
    // sun position drifts higher/brighter as the sky level rises
    const sunX = 560;
    const sunY = 66 - blue * 4;
    out += `<circle cx="${sunX}" cy="${sunY}" r="${26 + blue * 3}" fill="#fff6d8" opacity="0.9"/>`;
    out += `<circle cx="${sunX}" cy="${sunY}" r="${44 + blue * 4}" fill="#fff6d8" opacity="0.18"/>`;
  }

  if (blue >= 2) {
    const cloudCount = blue - 1;
    for (let i = 0; i < cloudCount; i++) {
      const cx = 80 + i * 160;
      const cy = 50 + (i % 2) * 26;
      out += `<g class="cloud-drift" style="animation-delay:-${(i * 3.5).toFixed(1)}s" opacity="0.55" fill="#ffffff">
        <ellipse cx="${cx}" cy="${cy}" rx="34" ry="12"/>
        <ellipse cx="${cx + 22}" cy="${cy + 4}" rx="24" ry="10"/>
        <ellipse cx="${cx - 22}" cy="${cy + 5}" rx="22" ry="9"/>
      </g>`;
    }
  }

  // --- Mountains: a distant backdrop silhouette, sitting at the horizon
  // behind the ground plane so the ground's near/far edges cover their base ---
  out += mountainRange(mountainTier);

  // --- Ground plane: an oblique trapezoid, so the land recedes to a horizon
  // instead of filling the frame like a top-down map ---
  out += `<polygon points="${BACK_X0},${HORIZON_Y} ${BACK_X1},${HORIZON_Y} ${FRONT_X1},${SURFACE_FRONT_Y} ${FRONT_X0},${SURFACE_FRONT_Y}" fill="url(#groundGrad)"/>`;

  // atmospheric haze where the far ground meets the sky
  const hazeFrontY = lerp(HORIZON_Y, SURFACE_FRONT_Y, 0.3);
  out += `<polygon points="${BACK_X0},${HORIZON_Y} ${BACK_X1},${HORIZON_Y} ${lerp(FRONT_X1, BACK_X1, 0.7)},${hazeFrontY} ${lerp(FRONT_X0, BACK_X0, 0.7)},${hazeFrontY}" fill="url(#haze)"/>`;

  // the land's leading edge, given a little thickness so it reads as a
  // grounded slab rather than a flat map tile
  out += `<polygon points="${FRONT_X0},${SURFACE_FRONT_Y} ${FRONT_X1},${SURFACE_FRONT_Y} ${FRONT_X1},${EDGE_BOTTOM_Y} ${FRONT_X0},${EDGE_BOTTOM_Y}" fill="${cliffTone}"/>`;
  out += `<rect x="${FRONT_X0}" y="${SURFACE_FRONT_Y}" width="${FRONT_X1 - FRONT_X0}" height="5" fill="rgba(0,0,0,0.2)"/>`;

  // scattered ground shading, sized by depth for perspective
  const rnd2 = mulberry(7);
  for (let i = 0; i < 30; i++) {
    const depth = rnd2();
    const { x, y, scale } = project(rnd2(), depth);
    const w = (30 + rnd2() * 40) * scale;
    const h = (14 + rnd2() * 18) * scale;
    const shade = rnd2() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    out += `<polygon points="${x},${y} ${x + w},${y + (rnd2() * 6 - 3)} ${x + w * 0.4},${y + h}" fill="${shade}"/>`;
  }

  // dry cracked-earth fissures when nothing has grown yet
  if (green === 0) {
    const rndC = mulberry(313);
    for (let i = 0; i < 14; i++) {
      const depth = 0.15 + rndC() * 0.8;
      const { x, y, scale } = project(rndC(), depth);
      const len = (24 + rndC() * 30) * scale;
      const ang = rndC() * Math.PI * 2;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len * 0.35;
      out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(0,0,0,0.25)" stroke-width="${(1.2 * scale).toFixed(2)}"/>`;
    }
  }

  // river — a winding, flowing watercourse from the horizon down toward the
  // viewer, widening with level. The animated dashed overlay is the classic
  // "flow" trick: a dash pattern whose offset scrolls along the path.
  let riverEnd: { x: number; y: number; scale: number } | null = null;
  if (blue >= 3) {
    const p1 = project(0.72, 0.1);
    const p2 = project(0.58, 0.34);
    const p3 = project(0.68, 0.58);
    const p4 = project(0.56, 0.85);
    riverEnd = p1;
    const widthScale = 1 + (blue - 3) * 0.4;
    const w = 9 * widthScale * p3.scale;
    const d = `M ${p1.x},${p1.y} Q ${p2.x},${p2.y} ${p3.x},${p3.y} Q ${(p3.x + p4.x) / 2},${(p3.y + p4.y) / 2 + 10} ${p4.x},${p4.y}`;
    out += `<path d="${d}" fill="none" stroke="#2f6f93" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="0.88"/>`;
    out += `<path class="river-flow" d="${d}" fill="none" stroke="#7fc4e0" stroke-width="${(w * 0.35).toFixed(1)}" stroke-linecap="round" stroke-dasharray="4 10" opacity="0.7"/>`;
  }

  // waterfall — once the mountains are tall enough and the river exists,
  // a short cascade connects them: real payoff for "a stream that grows
  // into a river and a waterfall off a mountain" from the world's story.
  if (blue >= 4 && mountainTier >= 2 && riverEnd) {
    const fallH = 32;
    out += `<rect x="${(riverEnd.x - 3).toFixed(1)}" y="${(riverEnd.y - fallH).toFixed(1)}" width="6" height="${fallH}" fill="url(#waterfallPattern)" opacity="0.9"/>`;
  }

  const greenTones = ['#3b6d2b', '#488033', '#59993d', '#6bb249'];
  const greenRnd = mulberry(101);
  const treeRnd = mulberry(205);
  if (green >= 1) {
    for (let i = 0; i < green * 3; i++) {
      const depth = 0.08 + greenRnd() * 0.9;
      const { x, y, scale } = project(greenRnd(), depth);
      out += bush(x, y, (0.9 + greenRnd() * 0.5) * scale, greenTones[Math.min(3, Math.floor(green / 2))]);
    }
  }
  if (green >= 2) {
    for (let i = 0; i < green * 2; i++) {
      const depth = 0.1 + treeRnd() * 0.85;
      const { x, y, scale } = project(treeRnd(), depth);
      out += tree(x, y, (0.8 + treeRnd() * 0.6) * scale, greenTones[Math.min(3, Math.floor(green / 2))]);
    }
  }

  if (brown >= 1) {
    const { x, y, scale } = project(0.22, 0.38);
    out += hut(x, y, scale);
  }
  if (brown >= 2) {
    const { x, y, scale } = project(0.32, 0.3);
    out += hut(x, y, scale * 0.9);
  }
  if (brown >= 3) {
    const { x, y, scale } = project(0.55, 0.42);
    out += statue(x, y, scale * 1.1);
  }
  if (brown >= 4) {
    const a = project(0.14, 0.55);
    const b = project(0.36, 0.46);
    out += hut(a.x, a.y, a.scale * 1.1);
    out += hut(b.x, b.y, b.scale * 0.9);
  }
  if (brown >= 5) {
    const { x, y, scale } = project(0.5, 0.58);
    out += `<g transform="translate(${x},${y}) scale(${scale})">
      <polygon points="-30,30 30,30 30,-10 -30,-10" fill="#8f7256"/>
      <polygon points="-36,-10 36,-10 0,-40" fill="#6b4e30"/>
      <rect x="-8" y="6" width="16" height="24" fill="#4a3520"/>
      <rect x="-24" y="0" width="10" height="18" fill="#4a3520" opacity="0.7"/>
      <rect x="14" y="0" width="10" height="18" fill="#4a3520" opacity="0.7"/>
    </g>`;
  }

  // villagers: the newest arrival (highest index) is still hammering away
  // at the latest structure; the rest potter around the settlement — a
  // small nod to "people building small villages" rather than a static crowd
  const greyTones = ['#7a746a', '#8c867a', '#9c968a'];
  if (grey >= 1) {
    for (let i = 0; i < grey; i++) {
      const { x, y, scale } = project(0.6 + i * 0.06, 0.62);
      const building = brown >= 1 && i === grey - 1;
      out += person(x, y, scale, greyTones[i % 3], ctx, building);
    }
  }

  if (pink >= 1 && green >= 1) {
    out += bird(200, 110, 1.4, ctx);
    out += bird(232, 92, 1.2, ctx);
  }
  if (pink >= 2 && green >= 1) out += bird(500, 82, 1.3, ctx);
  if (pink >= 3 && green >= 2) {
    const { x, y, scale } = project(0.3, 0.75);
    out += fox(x, y, scale * 1.1, ctx);
  }
  if (pink >= 4 && green >= 3) {
    const { x, y, scale } = project(0.82, 0.68);
    out += fox(x, y, scale, ctx);
  }
  if (pink >= 5 && green >= 4) {
    const { x, y, scale } = project(0.1, 0.72);
    out += deer(x, y, scale * 1.15, ctx);
  }

  // rolling fog: turbulence-warped banks drift and slowly boil on load,
  // then settle into a thin ground haze, so the world feels like it's
  // waking up rather than just appearing
  const fogY = lerp(HORIZON_Y, SURFACE_FRONT_Y, 0.42);
  out += `<g class="fog-layer" filter="url(#fogTurbulence)">
    <ellipse class="fog-bank" cx="90" cy="${fogY - 6}" rx="170" ry="30" fill="url(#fogGrad)"/>
    <ellipse class="fog-bank fog-b" cx="330" cy="${fogY + 16}" rx="220" ry="36" fill="url(#fogGrad)"/>
    <ellipse class="fog-bank fog-c" cx="560" cy="${fogY - 10}" rx="190" ry="30" fill="url(#fogGrad)"/>
    <ellipse class="fog-bank fog-b" cx="700" cy="${fogY + 8}" rx="180" ry="28" fill="url(#fogGrad)"/>
  </g>`;

  // weather: at the highest sky level, a passing rain shower — followed by
  // a rainbow, exactly the kind of "beautiful, non-destructive weather
  // event" the world is meant to build toward.
  if (blue === 5) {
    const rndR = mulberry(701);
    let rain = '<g opacity="0.55">';
    for (let i = 0; i < 26; i++) {
      const x = rndR() * WIDTH;
      const y = rndR() * (HORIZON_Y - 20);
      const delay = (rndR() * 1.2).toFixed(2);
      rain += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 3).toFixed(1)}" y2="${(y + 14).toFixed(1)}" stroke="#cfe8f5" stroke-width="1.1" class="rain-drop" style="animation-delay:-${delay}s"/>`;
    }
    rain += '</g>';
    out += rain;

    const arcCx = WIDTH * 0.52;
    const arcCy = HORIZON_Y + 44;
    const arcR = 150;
    const bands = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
    let rainbow = '<g opacity="0.5">';
    bands.forEach((c, i) => {
      const r = arcR - i * 6;
      rainbow += `<path d="M ${arcCx - r},${arcCy} A ${r},${r} 0 0 1 ${arcCx + r},${arcCy}" fill="none" stroke="${c}" stroke-width="5"/>`;
    });
    rainbow += '</g>';
    out += rainbow;
  }

  if (total === 0) {
    out += `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#000000" opacity="0.1"/>`;
  }

  if (ctx.extraCss.length > 0) {
    out += `<style>${ctx.extraCss.join('\n')}</style>`;
  }

  return out;
}
