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

function tree(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="0,-4 4,10 -4,10" fill="#6b4a30"/>
    <polygon points="-16,4 16,4 0,-30" fill="${tone}"/>
    <polygon points="-12,-8 12,-8 0,-34" fill="${tone}" opacity="0.85"/>
  </g>`;
}

function bush(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="-10,4 10,4 6,-8 -6,-8" fill="${tone}"/>
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
function walkerClass(x: number) {
  return x < WIDTH / 2 ? 'walker walk-in-left' : 'walker walk-in-right';
}

function walker(x: number, inner: string) {
  return `<g class="${walkerClass(x)}">${inner}</g>`;
}

function person(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(x, `
    <circle cx="0" cy="-16" r="4" fill="${tone}"/>
    <polygon points="-5,-12 5,-12 4,4 -4,4" fill="${tone}"/>
  `)}</g>`;
}

function fox(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(x, `
    <polygon points="-10,2 10,2 12,-6 -4,-8" fill="#d9773f"/>
    <polygon points="12,-6 20,-2 12,-1" fill="#d9773f"/>
    <polygon points="-4,-8 -12,-14 -8,-6" fill="#d9773f"/>
    <polygon points="-10,2 -14,10 -8,10" fill="#d9773f"/>
    <polygon points="6,2 4,10 10,10" fill="#d9773f"/>
    <polygon points="-14,10 -6,4 -3,10" fill="#fff" opacity="0.85"/>
  `)}</g>`;
}

function bird(x: number, y: number, scale: number) {
  return `<g class="${walkerClass(x)}"><path d="M ${x - 8},${y} Q ${x},${y - 6} ${x + 8},${y} Q ${x},${y - 2} ${x - 8},${y}" fill="none" stroke="#e8a8c0" stroke-width="1.6" transform="scale(${scale})" /></g>`;
}

function deer(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">${walker(x, `
    <polygon points="-12,4 10,4 12,-6 -6,-8" fill="#a97a52"/>
    <polygon points="-6,-8 -10,-16 -4,-10" fill="#a97a52"/>
    <line x1="-9" y1="-14" x2="-13" y2="-19" stroke="#a97a52" stroke-width="1.4"/>
    <line x1="-9" y1="-14" x2="-6" y2="-20" stroke="#a97a52" stroke-width="1.4"/>
    <polygon points="-12,4 -15,12 -9,12" fill="#a97a52"/>
    <polygon points="4,4 2,12 8,12" fill="#a97a52"/>
  `)}</g>`;
}

export function renderWorldSvg(levels: Levels): string {
  const { blue, green, brown, grey, pink } = levels;

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
    <style>
      .walker { animation-duration: 1.3s; animation-timing-function: cubic-bezier(.2,.7,.25,1); animation-fill-mode: backwards; }
      .walk-in-left { animation-name: walkInLeft; }
      .walk-in-right { animation-name: walkInRight; }
      @keyframes walkInLeft { from { transform: translateX(-90px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes walkInRight { from { transform: translateX(90px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

      .fog-bank { animation: fogDrift 22s linear infinite, fogFade 3.5s ease-out forwards; }
      .fog-bank.fog-b { animation-duration: 30s, 3.5s; animation-delay: -6s, 0.4s; }
      .fog-bank.fog-c { animation-duration: 26s, 3.5s; animation-delay: -14s, 0.8s; }
      @keyframes fogDrift {
        from { transform: translateX(-140px); }
        to { transform: translateX(140px); }
      }
      @keyframes fogFade {
        0% { opacity: 0.85; }
        70% { opacity: 0.85; }
        100% { opacity: 0.32; }
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
      out += `<g opacity="0.55" fill="#ffffff">
        <ellipse cx="${cx}" cy="${cy}" rx="34" ry="12"/>
        <ellipse cx="${cx + 22}" cy="${cy + 4}" rx="24" ry="10"/>
        <ellipse cx="${cx - 22}" cy="${cy + 5}" rx="22" ry="9"/>
      </g>`;
    }
  }

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

  // water — sits mid-depth on the plane, widens with level
  if (blue >= 3) {
    const waterScale = 1 + (blue - 3) * 0.4;
    const { x: wx, y: wy, scale } = project(0.66, 0.3);
    const waterW = 100 * waterScale * scale;
    out += `<ellipse cx="${wx}" cy="${wy}" rx="${waterW}" ry="${waterW * 0.28}" fill="#2f6f93" opacity="0.85"/>`;
    out += `<ellipse cx="${wx - waterW * 0.15}" cy="${wy - 3}" rx="${waterW * 0.7}" ry="${waterW * 0.18}" fill="#4a95bb" opacity="0.6"/>`;
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

  const greyTones = ['#7a746a', '#8c867a', '#9c968a'];
  if (grey >= 1) {
    for (let i = 0; i < grey; i++) {
      const { x, y, scale } = project(0.6 + i * 0.06, 0.62);
      out += person(x, y, scale, greyTones[i % 3]);
    }
  }

  if (pink >= 1 && green >= 1) {
    out += bird(200, 110, 1.4);
    out += bird(232, 92, 1.2);
  }
  if (pink >= 2 && green >= 1) out += bird(500, 82, 1.3);
  if (pink >= 3 && green >= 2) {
    const { x, y, scale } = project(0.3, 0.75);
    out += fox(x, y, scale * 1.1);
  }
  if (pink >= 4 && green >= 3) {
    const { x, y, scale } = project(0.82, 0.68);
    out += fox(x, y, scale);
  }
  if (pink >= 5 && green >= 4) {
    const { x, y, scale } = project(0.1, 0.72);
    out += deer(x, y, scale * 1.15);
  }

  // rolling fog: a few soft banks drift in on load and settle into a thin
  // ground haze, so the world feels like it's waking up rather than just
  // appearing
  const fogY = lerp(HORIZON_Y, SURFACE_FRONT_Y, 0.42);
  out += `<g opacity="0.9">
    <ellipse class="fog-bank" cx="120" cy="${fogY}" rx="150" ry="22" fill="#ffffff"/>
    <ellipse class="fog-bank fog-b" cx="380" cy="${fogY + 14}" rx="190" ry="26" fill="#ffffff"/>
    <ellipse class="fog-bank fog-c" cx="600" cy="${fogY - 8}" rx="160" ry="20" fill="#ffffff"/>
  </g>`;

  const total = blue + green + brown + grey + pink;
  if (total === 0) {
    out += `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#000000" opacity="0.1"/>`;
  }

  return out;
}
