import type { Levels } from './habitData';

function mulberry(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
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

function person(x: number, y: number, scale: number, tone: string) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <circle cx="0" cy="-16" r="4" fill="${tone}"/>
    <polygon points="-5,-12 5,-12 4,4 -4,4" fill="${tone}"/>
  </g>`;
}

function fox(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="-10,2 10,2 12,-6 -4,-8" fill="#d9773f"/>
    <polygon points="12,-6 20,-2 12,-1" fill="#d9773f"/>
    <polygon points="-4,-8 -12,-14 -8,-6" fill="#d9773f"/>
    <polygon points="-10,2 -14,10 -8,10" fill="#d9773f"/>
    <polygon points="6,2 4,10 10,10" fill="#d9773f"/>
    <polygon points="-14,10 -6,4 -3,10" fill="#fff" opacity="0.85"/>
  </g>`;
}

function bird(x: number, y: number, scale: number) {
  return `<path d="M ${x - 8},${y} Q ${x},${y - 6} ${x + 8},${y} Q ${x},${y - 2} ${x - 8},${y}" fill="none" stroke="#e8a8c0" stroke-width="1.6" transform="scale(${scale})" />`;
}

function deer(x: number, y: number, scale: number) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <polygon points="-12,4 10,4 12,-6 -6,-8" fill="#a97a52"/>
    <polygon points="-6,-8 -10,-16 -4,-10" fill="#a97a52"/>
    <line x1="-9" y1="-14" x2="-13" y2="-19" stroke="#a97a52" stroke-width="1.4"/>
    <line x1="-9" y1="-14" x2="-6" y2="-20" stroke="#a97a52" stroke-width="1.4"/>
    <polygon points="-12,4 -15,12 -9,12" fill="#a97a52"/>
    <polygon points="4,4 2,12 8,12" fill="#a97a52"/>
  </g>`;
}

export function renderWorldSvg(levels: Levels): string {
  const { blue, green, brown, grey, pink } = levels;

  const skyTop = ['#161a24', '#1c2534', '#2a3a4d', '#3f6a8c', '#5fa3c9', '#8fd0ee'][blue];
  const skyBot = ['#20242e', '#2a3140', '#3d4a55', '#5a7d8f', '#9dc6d9', '#c9ecf5'][blue];
  const groundBase = ['#4a4034', '#564a3a', '#5f5b3d', '#5d6b3e', '#5a7a3f', '#4f8f45'][green];
  const groundEdge = ['#3a3226', '#453b2d', '#4a4a2c', '#485631', '#456530', '#3f7735'][green];

  let out = `<defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skyTop}"/>
      <stop offset="1" stop-color="${skyBot}"/>
    </linearGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${groundBase}"/>
      <stop offset="1" stop-color="${groundEdge}"/>
    </linearGradient>
  </defs>`;

  out += `<rect x="0" y="0" width="700" height="420" fill="url(#skyGrad)"/>`;

  if (blue <= 1) {
    const rnd = mulberry(42);
    let stars = '';
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 700;
      const y = rnd() * 160;
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="#ffffff" opacity="${(0.3 + rnd() * 0.5).toFixed(2)}"/>`;
    }
    out += stars;
  } else {
    out += `<circle cx="580" cy="70" r="${28 + blue * 3}" fill="#fff6d8" opacity="0.85"/>`;
  }

  if (blue >= 2) {
    const cloudCount = blue - 1;
    for (let i = 0; i < cloudCount; i++) {
      const cx = 90 + i * 160;
      const cy = 60 + (i % 2) * 30;
      out += `<g opacity="0.55" fill="#ffffff">
        <ellipse cx="${cx}" cy="${cy}" rx="34" ry="12"/>
        <ellipse cx="${cx + 22}" cy="${cy + 4}" rx="24" ry="10"/>
        <ellipse cx="${cx - 22}" cy="${cy + 5}" rx="22" ry="9"/>
      </g>`;
    }
  }

  const groundY = 300;
  out += `<polygon points="0,${groundY} 700,${groundY} 700,420 0,420" fill="url(#groundGrad)"/>`;

  const rnd2 = mulberry(7);
  for (let i = 0; i < 26; i++) {
    const x = rnd2() * 700;
    const y = groundY + rnd2() * 120;
    const w = 30 + rnd2() * 40;
    const h = 14 + rnd2() * 18;
    const shade = rnd2() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    out += `<polygon points="${x},${y} ${x + w},${y + (rnd2() * 6 - 3)} ${x + w * 0.4},${y + h}" fill="${shade}"/>`;
  }

  if (blue >= 3) {
    const waterW = 90 + (blue - 3) * 70;
    const wx = 480;
    const wy = 330;
    out += `<ellipse cx="${wx}" cy="${wy}" rx="${waterW}" ry="${waterW * 0.28}" fill="#2f6f93" opacity="0.85"/>`;
    out += `<ellipse cx="${wx - waterW * 0.15}" cy="${wy - 4}" rx="${waterW * 0.7}" ry="${waterW * 0.18}" fill="#4a95bb" opacity="0.6"/>`;
  }

  const greenTones = ['#3b6d2b', '#488033', '#59993d', '#6bb249'];
  if (green >= 1) {
    const rnd3 = mulberry(101);
    for (let i = 0; i < green * 2; i++) {
      const x = 20 + rnd3() * 640;
      const y = 305 + rnd3() * 95;
      out += bush(x, y, 0.9 + rnd3() * 0.6, greenTones[Math.min(3, Math.floor(green / 2))]);
    }
  }
  if (green >= 2) {
    const rnd4 = mulberry(205);
    for (let i = 0; i < green * 2; i++) {
      const x = 20 + rnd4() * 640;
      const y = 300 + rnd4() * 90;
      out += tree(x, y, 0.8 + rnd4() * 0.7, greenTones[Math.min(3, Math.floor(green / 2))]);
    }
  }

  if (brown >= 1) out += hut(140, 300, 1);
  if (brown >= 2) out += hut(180, 305, 0.85);
  if (brown >= 3) out += statue(360, 292, 1.1);
  if (brown >= 4) {
    out += hut(120, 300, 1.2);
    out += hut(200, 296, 0.9);
  }
  if (brown >= 5) {
    out += `<g transform="translate(320,270)">
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
      out += person(400 + i * 22, 310, 1, greyTones[i % 3]);
    }
  }

  if (pink >= 1 && green >= 1) {
    out += bird(200, 120, 1.4);
    out += bird(230, 100, 1.2);
  }
  if (pink >= 2 && green >= 1) out += bird(500, 90, 1.3);
  if (pink >= 3 && green >= 2) out += fox(240, 330, 1.1);
  if (pink >= 4 && green >= 3) out += fox(560, 320, 1);
  if (pink >= 5 && green >= 4) out += deer(90, 300, 1.15);

  const total = blue + green + brown + grey + pink;
  if (total === 0) {
    out += `<rect x="0" y="0" width="700" height="420" fill="#000000" opacity="0.12"/>`;
  }

  return out;
}
