/**
 * Procedural Pixel-Art Sprite Generator (Offscreen HTML5 Canvases)
 * 100% Code-Generated Authentic Pixel Art Assets:
 * - 4 Stage Biomes (Sunny Day, Golden Sunset, Starlight Night, Cyber Cosmos)
 * - 6 Bird Skins (Classic, Crimson, Azure, Emerald, Gold, Phoenix)
 * - Collectible Coins & Power-Up Sprites
 */

export type BirdSkinId = 'classic' | 'crimson' | 'azure' | 'gold' | 'emerald' | 'phoenix';
export type StageThemeId = 'day' | 'sunset' | 'night' | 'cosmos';

export interface BirdSkinMeta {
  id: BirdSkinId;
  nameAr: string;
  nameEn: string;
  badgeText: string;
  primaryHex: string;
  secondaryHex: string;
}

export const BIRD_SKINS: BirdSkinMeta[] = [
  {
    id: 'classic',
    nameAr: 'الكلاسيكي الأصفر',
    nameEn: 'Classic Wing',
    badgeText: 'Original',
    primaryHex: '#f8e71c',
    secondaryHex: '#f5a623',
  },
  {
    id: 'crimson',
    nameAr: 'الصقر القرمزي',
    nameEn: 'Crimson Falcon',
    badgeText: 'Arcade Red',
    primaryHex: '#ef4444',
    secondaryHex: '#b91c1c',
  },
  {
    id: 'azure',
    nameAr: 'طائر السماء',
    nameEn: 'Azure Sky',
    badgeText: 'Ice Blue',
    primaryHex: '#38bdf8',
    secondaryHex: '#0284c7',
  },
  {
    id: 'emerald',
    nameAr: 'الزمرد السيبراني',
    nameEn: 'Cyber Emerald',
    badgeText: 'Retro Neon',
    primaryHex: '#34d399',
    secondaryHex: '#059669',
  },
  {
    id: 'gold',
    nameAr: 'البطل الذهبي',
    nameEn: 'Royal Gold',
    badgeText: 'Champion',
    primaryHex: '#facc15',
    secondaryHex: '#ca8a04',
  },
  {
    id: 'phoenix',
    nameAr: 'عنقاء اللهب',
    nameEn: 'Cosmic Phoenix',
    badgeText: 'Mythic',
    primaryHex: '#c084fc',
    secondaryHex: '#f97316',
  },
];

export interface SpriteAtlas {
  backgrounds: Record<StageThemeId, HTMLCanvasElement>;
  groundStrip: HTMLCanvasElement;
  birdSkins: Record<BirdSkinId, [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]>;
  medals: {
    bronze: HTMLCanvasElement;
    silver: HTMLCanvasElement;
    gold: HTMLCanvasElement;
    platinum: HTMLCanvasElement;
  };
}

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

const SKIN_PALETTES: Record<BirdSkinId, Record<string, string>> = {
  classic: {
    K: '#543847',
    Y: '#f8e71c',
    G: '#e5c100',
    O: '#f5a623',
    W: '#ffffff',
    C: '#f7f2d7',
    R: '#f75a1b',
    D: '#d03b0d',
  },
  crimson: {
    K: '#3b1d2e',
    Y: '#f84b4b',
    G: '#dc2626',
    O: '#f59e0b',
    W: '#ffffff',
    C: '#fee2e2',
    R: '#fbbf24',
    D: '#d97706',
  },
  azure: {
    K: '#1e293b',
    Y: '#38bdf8',
    G: '#0ea5e9',
    O: '#e0f2fe',
    W: '#ffffff',
    C: '#bae6fd',
    R: '#fb7185',
    D: '#e11d48',
  },
  gold: {
    K: '#422006',
    Y: '#fef08a',
    G: '#facc15',
    O: '#eab308',
    W: '#ffffff',
    C: '#fef9c3',
    R: '#ef4444',
    D: '#b91c1c',
  },
  emerald: {
    K: '#064e3b',
    Y: '#34d399',
    G: '#10b981',
    O: '#059669',
    W: '#ffffff',
    C: '#d1fae5',
    R: '#f59e0b',
    D: '#b45309',
  },
  phoenix: {
    K: '#2e1065',
    Y: '#c084fc',
    G: '#9333ea',
    O: '#fb923c',
    W: '#ffffff',
    C: '#fde047',
    R: '#f43f5e',
    D: '#be123c',
  },
};

function createBirdSprite(skin: BirdSkinId, wingState: 0 | 1 | 2): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas(34, 24);
  const palette = SKIN_PALETTES[skin];

  const baseRows = [
    '......KKKKKK.....',
    '....KKYYYYGWKK...',
    '...KYYYYYYKWWWK..',
    '..KYYYYYYYKWWKWWK',
    '.KYYYYYYYYKWWKWWK',
    '.KYYYYYYYYYKWWWWK',
    '.KYYYYYYYYYYKKKKK',
    '.KYYYYYYYYYKRRRRK',
    '..KOOOOOOOOKKKKKK',
    '...KOOOOOOOOKDDDK',
    '....KKOOOOOOKKKKK',
    '......KKKKKK.....',
  ];

  const wingOverlays: Record<0 | 1 | 2, string[]> = {
    0: [
      '.................',
      '.................',
      '....KKKKK........',
      '...KWWWWWK.......',
      '..KWWWWWWWK......',
      '..KCCCCCCCK......',
      '...KKKKKKK.......',
      '.................',
      '.................',
      '.................',
      '.................',
      '.................',
    ],
    1: [
      '.................',
      '.................',
      '.................',
      '.................',
      '...KKKKKKK.......',
      '..KWWWWWWWK......',
      '..KCCCCCCCK......',
      "...KKKKKKK.......",
      '.................',
      '.................',
      '.................',
      '.................',
    ],
    2: [
      '.................',
      '.................',
      '.................',
      '.................',
      '.................',
      '...KKKKKKK.......',
      '..KWWWWWWWK......',
      '..KCCCCCCCK......',
      '...KKKKKKK.......',
      '.................',
      '.................',
      '.................',
    ],
  };

  const overlay = wingOverlays[wingState];

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 17; x++) {
      const wingChar = overlay[y][x];
      const ch = wingChar !== '.' ? wingChar : baseRows[y][x];
      if (ch !== '.' && palette[ch]) {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  }

  return canvas;
}

/**
 * Generates 4 distinct 288x400 stage backgrounds (Day, Sunset, Night, Cosmos)
 */
function createBackgroundSprite(theme: StageThemeId): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas(288, 400);

  const schemes: Record<
    StageThemeId,
    {
      skyTop: string;
      skyBottom: string;
      cloudFill: string;
      cloudShade: string;
      bldgBack: string;
      bldgFront: string;
      bldgBorder: string;
      winColor: string;
      bushOutline: string;
      bushMain: string;
      bushLight: string;
      hasStars: boolean;
      sunOrMoonColor: string;
    }
  > = {
    day: {
      skyTop: '#70c5ce',
      skyBottom: '#70c5ce',
      cloudFill: '#eff9fb',
      cloudShade: '#d5eef2',
      bldgBack: '#a8e0b8',
      bldgFront: '#85cc9f',
      bldgBorder: '#65b082',
      winColor: '#d8f5df',
      bushOutline: '#40a850',
      bushMain: '#5ee270',
      bushLight: '#85f293',
      hasStars: false,
      sunOrMoonColor: '#fff59d',
    },
    sunset: {
      skyTop: '#4c1d95',
      skyBottom: '#f97316',
      cloudFill: '#fed7aa',
      cloudShade: '#fdba74',
      bldgBack: '#7c2d12',
      bldgFront: '#581c87',
      bldgBorder: '#3b0764',
      winColor: '#fde047',
      bushOutline: '#14532d',
      bushMain: '#15803d',
      bushLight: '#22c55e',
      hasStars: true,
      sunOrMoonColor: '#fb923c',
    },
    night: {
      skyTop: '#008793',
      skyBottom: '#0f172a',
      cloudFill: '#8fd3dc',
      cloudShade: '#6cbcc7',
      bldgBack: '#468a8c',
      bldgFront: '#347474',
      bldgBorder: '#235959',
      winColor: '#b5f2ea',
      bushOutline: '#1b633c',
      bushMain: '#2c8a56',
      bushLight: '#42a86f',
      hasStars: true,
      sunOrMoonColor: '#fef08a',
    },
    cosmos: {
      skyTop: '#090d16',
      skyBottom: '#1e1b4b',
      cloudFill: '#4f46e5',
      cloudShade: '#312e81',
      bldgBack: '#1e293b',
      bldgFront: '#0f172a',
      bldgBorder: '#38bdf8',
      winColor: '#22d3ee',
      bushOutline: '#047857',
      bushMain: '#059669',
      bushLight: '#34d399',
      hasStars: true,
      sunOrMoonColor: '#38bdf8',
    },
  };

  const s = schemes[theme];

  // Banded pixel sky gradient
  const bands = 20;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i < bands / 2 ? s.skyTop : s.skyBottom;
    ctx.fillRect(0, i * 20, 288, 20);
  }
  // Smooth middle dither band for sunset/night/cosmos
  if (theme !== 'day') {
    const grad = ctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, s.skyTop);
    grad.addColorStop(1, s.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 288, 320);
  }

  // Pixel Sun or Moon
  ctx.fillStyle = s.sunOrMoonColor;
  ctx.fillRect(216, 46, 24, 24);
  ctx.fillRect(212, 50, 32, 16);
  ctx.fillRect(220, 42, 16, 32);

  if (s.hasStars) {
    ctx.fillStyle = '#ffffff';
    const stars = [
      [24, 34], [68, 18], [114, 52], [160, 26], [192, 44], [258, 20],
      [42, 88], [96, 74], [184, 82], [248, 96], [140, 110], [28, 134],
    ];
    for (const [sx, sy] of stars) {
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  const drawCloudPuff = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = s.cloudShade;
    ctx.fillRect(cx - r, cy - r + 4, r * 2, r * 2);
    ctx.fillStyle = s.cloudFill;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2 - 4);
  };

  const puffPositions = [
    [16, 310, 22], [44, 300, 28], [76, 312, 20],
    [108, 306, 24], [142, 296, 30], [176, 308, 22],
    [208, 302, 26], [242, 298, 28], [274, 310, 22],
  ];
  for (const [cx, cy, r] of puffPositions) {
    drawCloudPuff(cx, cy, r);
  }
  ctx.fillStyle = s.cloudFill;
  ctx.fillRect(0, 312, 288, 55);
  ctx.fillStyle = s.cloudShade;
  ctx.fillRect(0, 336, 288, 35);

  const buildings = [
    { x: 4, w: 32, h: 74, front: false },
    { x: 30, w: 28, h: 56, front: true },
    { x: 56, w: 38, h: 88, front: false },
    { x: 88, w: 26, h: 64, front: true },
    { x: 112, w: 34, h: 78, front: false },
    { x: 142, w: 30, h: 52, front: true },
    { x: 170, w: 40, h: 92, front: false },
    { x: 204, w: 28, h: 68, front: true },
    { x: 230, w: 34, h: 80, front: false },
    { x: 260, w: 28, h: 60, front: true },
  ];

  for (const b of buildings) {
    const by = 374 - b.h;
    ctx.fillStyle = s.bldgBorder;
    ctx.fillRect(b.x - 2, by - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = b.front ? s.bldgFront : s.bldgBack;
    ctx.fillRect(b.x, by, b.w, b.h);

    ctx.fillStyle = s.winColor;
    for (let wy = by + 6; wy < 360; wy += 10) {
      for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 8) {
        ctx.fillRect(wx, wy, 4, 6);
      }
    }
  }

  for (let bx = -8; bx < 300; bx += 24) {
    const bh = 26 + ((bx * 7) % 12);
    const by = 400 - bh;
    ctx.fillStyle = s.bushOutline;
    ctx.fillRect(bx - 2, by - 2, 28, bh + 2);
    ctx.fillStyle = s.bushMain;
    ctx.fillRect(bx, by, 24, bh);
    ctx.fillStyle = s.bushLight;
    ctx.fillRect(bx + 2, by + 2, 20, 6);
  }

  return canvas;
}

function createGroundStrip(): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas(336, 112);

  ctx.fillStyle = '#543847';
  ctx.fillRect(0, 0, 336, 2);

  ctx.fillStyle = '#d6f589';
  ctx.fillRect(0, 2, 336, 2);

  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, 4, 336, 14);

  for (let x = -24; x < 360; x += 24) {
    ctx.fillStyle = '#9ce659';
    for (let i = 0; i < 14; i += 2) {
      ctx.fillRect(x + 12 - i, 4 + i, 10, 2);
    }
    ctx.fillStyle = '#558c22';
    for (let i = 0; i < 14; i += 2) {
      ctx.fillRect(x + 22 - i, 4 + i, 4, 2);
    }
  }

  ctx.fillStyle = '#543847';
  ctx.fillRect(0, 18, 336, 2);

  ctx.fillStyle = '#d2aa4e';
  ctx.fillRect(0, 20, 336, 4);

  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, 24, 336, 88);

  ctx.fillStyle = '#d0c878';
  for (let x = 0; x < 336; x += 24) {
    ctx.fillRect(x + 4, 32, 6, 4);
    ctx.fillRect(x + 16, 44, 4, 4);
    ctx.fillRect(x + 8, 62, 8, 4);
    ctx.fillRect(x + 18, 78, 4, 6);
    ctx.fillRect(x + 2, 94, 6, 4);
  }

  return canvas;
}

function createMedalSprite(type: 'bronze' | 'silver' | 'gold' | 'platinum'): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas(44, 44);

  const schemes = {
    bronze: {
      base: '#d97324',
      light: '#f4a259',
      dark: '#9e4710',
      center: '#b85b18',
    },
    silver: {
      base: '#b8c4c8',
      light: '#f0f5f7',
      dark: '#7a888e',
      center: '#98a6ac',
    },
    gold: {
      base: '#f2b911',
      light: '#fff078',
      dark: '#b37c00',
      center: '#d89b00',
    },
    platinum: {
      base: '#e5f2f7',
      light: '#ffffff',
      dark: '#88b3c8',
      center: '#bce0f0',
    },
  };

  const c = schemes[type];

  for (let y = 0; y < 44; y += 2) {
    for (let x = 0; x < 44; x += 2) {
      const dx = x + 1 - 22;
      const dy = y + 1 - 22;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 20) {
        if (dist > 18) {
          ctx.fillStyle = '#543847';
        } else if (dist > 14) {
          ctx.fillStyle = dx + dy < 0 ? c.light : c.dark;
        } else if (dist > 12.5) {
          ctx.fillStyle = c.dark;
        } else {
          ctx.fillStyle = c.center;
        }
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  ctx.fillStyle = c.light;
  ctx.fillRect(20, 12, 4, 20);
  ctx.fillRect(12, 20, 20, 4);
  ctx.fillRect(16, 16, 12, 12);

  return canvas;
}

export function buildSpriteAtlas(): SpriteAtlas {
  const birdSkins = {} as Record<BirdSkinId, [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]>;
  for (const skin of BIRD_SKINS) {
    birdSkins[skin.id] = [
      createBirdSprite(skin.id, 0),
      createBirdSprite(skin.id, 1),
      createBirdSprite(skin.id, 2),
    ];
  }

  return {
    backgrounds: {
      day: createBackgroundSprite('day'),
      sunset: createBackgroundSprite('sunset'),
      night: createBackgroundSprite('night'),
      cosmos: createBackgroundSprite('cosmos'),
    },
    groundStrip: createGroundStrip(),
    birdSkins,
    medals: {
      bronze: createMedalSprite('bronze'),
      silver: createMedalSprite('silver'),
      gold: createMedalSprite('gold'),
      platinum: createMedalSprite('platinum'),
    },
  };
}

/**
 * Draws a vibrant pixel-art pipe at (x, y) with width=52 and height=h.
 */
export function drawPixelPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isTopPipe: boolean
): void {
  if (h <= 0) return;
  const rx = Math.round(x);
  const ry = Math.round(y);
  const lipHeight = Math.min(24, h);
  const bodyX = rx + 2;
  const bodyW = w - 4;

  const drawVerticalGradientTube = (tx: number, ty: number, tw: number, th: number) => {
    if (th <= 0) return;
    ctx.fillStyle = '#543847';
    ctx.fillRect(tx, ty, tw, th);

    const ix = tx + 2;
    const iy = ty;
    const iw = tw - 4;

    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(ix, iy, iw, th);

    ctx.fillStyle = '#9ce659';
    ctx.fillRect(ix + 2, iy, 8, th);
    ctx.fillStyle = '#c8f786';
    ctx.fillRect(ix + 4, iy, 4, th);
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(ix + 12, iy, 2, th);
    ctx.fillStyle = '#9ce659';
    ctx.fillRect(ix + 14, iy, 2, th);

    ctx.fillStyle = '#558c22';
    ctx.fillRect(ix + iw - 12, iy, 12, th);
    ctx.fillStyle = '#3e6b15';
    ctx.fillRect(ix + iw - 6, iy, 4, th);
  };

  if (isTopPipe) {
    const shaftH = Math.max(0, h - lipHeight);
    drawVerticalGradientTube(bodyX, ry, bodyW, shaftH);

    const lipY = ry + shaftH;
    drawVerticalGradientTube(rx, lipY, w, lipHeight);

    ctx.fillStyle = '#543847';
    ctx.fillRect(rx, lipY, w, 2);
    ctx.fillRect(rx, lipY + lipHeight - 2, w, 2);
    ctx.fillStyle = '#9ce659';
    ctx.fillRect(rx + 2, lipY + 2, w - 4, 2);
  } else {
    const shaftH = Math.max(0, h - lipHeight);
    drawVerticalGradientTube(rx, ry, w, lipHeight);

    ctx.fillStyle = '#543847';
    ctx.fillRect(rx, ry, w, 2);
    ctx.fillRect(rx, ry + lipHeight - 2, w, 2);
    ctx.fillStyle = '#9ce659';
    ctx.fillRect(rx + 2, ry + 2, w - 4, 2);

    drawVerticalGradientTube(bodyX, ry + lipHeight, bodyW, shaftH);
  }
}

/**
 * Draws an animated spinning pixel-art Gold Coin at (x, y)
 */
export function drawPixelCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frameCount: number
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const phase = Math.floor(frameCount / 6) % 4;
  const widths = [14, 10, 6, 10];
  const w = widths[phase];
  const h = 14;

  ctx.fillStyle = '#543847';
  ctx.fillRect(rx - w / 2 - 2, ry - h / 2 - 2, w + 4, h + 4);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(rx - w / 2, ry - h / 2, w, h);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(rx - w / 2 + 2, ry - h / 2 + 2, Math.max(2, w - 4), 4);
}

/**
 * Draws an in-game Power-Up Orb (Shield / Magnet / SlowMo)
 */
export function drawPixelPowerUp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'shield' | 'magnet' | 'slowmo',
  frameCount: number
): void {
  const rx = Math.round(x);
  const ry = Math.round(y + Math.sin(frameCount * 0.12) * 3);

  const colors = {
    shield: { outer: '#0284c7', inner: '#38bdf8', core: '#e0f2fe', glyph: 'S' },
    magnet: { outer: '#b91c1c', inner: '#ef4444', core: '#fef2f2', glyph: 'M' },
    slowmo: { outer: '#6d28d9', inner: '#a855f7', core: '#f3e8ff', glyph: 'T' },
  }[type];

  ctx.fillStyle = '#543847';
  ctx.fillRect(rx - 10, ry - 10, 20, 20);
  ctx.fillStyle = colors.outer;
  ctx.fillRect(rx - 8, ry - 8, 16, 16);
  ctx.fillStyle = colors.inner;
  ctx.fillRect(rx - 6, ry - 6, 12, 12);
  ctx.fillStyle = colors.core;
  ctx.fillRect(rx - 2, ry - 4, 4, 8);
  ctx.fillRect(rx - 4, ry - 2, 8, 4);
}

const PIXEL_FONT_5X7: Record<string, string[]> = {
  '0': ['11111', '11011', '11011', '11011', '11011', '11011', '11111'],
  '1': ['00110', '01110', '00110', '00110', '00110', '00110', '01111'],
  '2': ['11111', '00011', '00011', '11111', '11000', '11000', '11111'],
  '3': ['11111', '00011', '00011', '01111', '00011', '00011', '11111'],
  '4': ['11011', '11011', '11011', '11111', '00011', '00011', '00011'],
  '5': ['11111', '11000', '11000', '11111', '00011', '00011', '11111'],
  '6': ['11111', '11000', '11000', '11111', '11011', '11011', '11111'],
  '7': ['11111', '11011', '00011', '00011', '00011', '00011', '00011'],
  '8': ['11111', '11011', '11011', '11111', '11011', '11011', '11111'],
  '9': ['11111', '11011', '11011', '11111', '00011', '00011', '11111'],
  'A': ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
  'B': ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
  'C': ['01111', '11000', '11000', '11000', '11000', '11000', '01111'],
  'D': ['11110', '11011', '11011', '11011', '11011', '11011', '11110'],
  'E': ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
  'F': ['11111', '11000', '11000', '11110', '11000', '11000', '11000'],
  'G': ['01111', '11000', '11000', '11011', '11011', '11011', '01111'],
  'H': ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  'K': ['11011', '11010', '11100', '11100', '11010', '11011', '11011'],
  'L': ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
  'M': ['11011', '11111', '11111', '11011', '11011', '11011', '11011'],
  'N': ['11011', '11111', '11111', '11111', '11011', '11011', '11011'],
  'O': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  'P': ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
  'R': ['11110', '11011', '11011', '11110', '11010', '11011', '11011'],
  'S': ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['11011', '11011', '11011', '11011', '11011', '11011', '01110'],
  'V': ['11011', '11011', '11011', '11011', '11011', '01110', '00100'],
  'W': ['11011', '11011', '11011', '11011', '11111', '11111', '11011'],
  'Y': ['11011', '11011', '11011', '01110', '00100', '00100', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  fillColor: string,
  outlineColor: string = '#000000',
  align: 'left' | 'center' | 'right' = 'center',
  topHighlightColor?: string
): void {
  const upper = text.toUpperCase();
  const charW = 5 * scale;
  const spacing = scale;
  const totalW = upper.length * charW + Math.max(0, upper.length - 1) * spacing;

  let startX = Math.round(x);
  if (align === 'center') startX = Math.round(x - totalW / 2);
  else if (align === 'right') startX = Math.round(x - totalW);

  const startY = Math.round(y);

  ctx.fillStyle = outlineColor;
  for (let i = 0; i < upper.length; i++) {
    const glyph = PIXEL_FONT_5X7[upper[i]] || PIXEL_FONT_5X7[' '];
    const gx = startX + i * (charW + spacing);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === '1') {
          const px = gx + c * scale;
          const py = startY + r * scale;
          ctx.fillRect(px - scale, py, scale, scale);
          ctx.fillRect(px + scale, py, scale, scale);
          ctx.fillRect(px, py - scale, scale, scale);
          ctx.fillRect(px, py + scale, scale, scale);
          ctx.fillRect(px - scale, py - scale, scale, scale);
          ctx.fillRect(px + scale, py - scale, scale, scale);
          ctx.fillRect(px - scale, py + scale, scale, scale);
          ctx.fillRect(px + scale, py + scale, scale, scale);
          ctx.fillRect(px, py + scale * 1.5, scale, scale);
        }
      }
    }
  }

  for (let i = 0; i < upper.length; i++) {
    const glyph = PIXEL_FONT_5X7[upper[i]] || PIXEL_FONT_5X7[' '];
    const gx = startX + i * (charW + spacing);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === '1') {
          const px = gx + c * scale;
          const py = startY + r * scale;
          ctx.fillStyle = topHighlightColor && r < 3 ? topHighlightColor : fillColor;
          ctx.fillRect(px, py, scale, scale);
        }
      }
    }
  }
}
