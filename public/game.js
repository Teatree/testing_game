// ============================================================
//  CLOWN CHAOS — Multiplayer Browser Platformer
//  v2: Anime chibi art + ASCII level editor
// ============================================================

const GW = 1024, GH = 600;
const SPEED = 280, JUMP = -560, GRAVITY = 1200, BOUNCE_VEL = -750;
const TILE = 48;
const FW = 64, FH = 64;
const SEND_RATE = 50;

// --- Rich anime palettes ---
const HAIR_COLORS = [
  '#FF4D6A','#FF85A1','#FFA07A','#FFD700','#A8E6CF','#88D8B0',
  '#7EC8E3','#9B8EC8','#C89BEC','#FF6FB7','#45D9FF','#FFF176',
  '#FF8A65','#CE93D8','#80DEEA','#F48FB1'
];
const OUTFIT_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD',
  '#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F1948A','#82E0AA',
  '#F8C471','#AED6F1','#D7BDE2','#A3E4D7'
];
const SHOE_COLORS = ['#E74C3C','#F39C12','#27AE60','#2980B9','#8E44AD','#E91E63'];
const SKIN_TONES = ['#FDDCB1','#F5C49C','#E8B88A','#D4A373','#C49068','#FFE0BD','#FFF0DB'];
const EYE_COLORS = ['#2196F3','#4CAF50','#9C27B0','#FF5722','#00BCD4','#E91E63','#FF9800','#3F51B5'];
const BLUSH = 'rgba(255,120,150,0.45)';

// ============================================================
//  SEEDED RNG
// ============================================================
function mulberry32(s) {
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(r, a) { return a[Math.floor(r() * a.length)]; }
function hashSeed(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
function hexToRgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function darken(h, a = 50) { const [r, g, b] = hexToRgb(h); return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`; }
function lighten(h, a = 70) { const [r, g, b] = hexToRgb(h); return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`; }

// ============================================================
//  CHARACTER TRAITS
// ============================================================
function getTraits(seed) {
  const r = mulberry32(hashSeed(seed));
  return {
    hair: pick(r, HAIR_COLORS),
    outfit: pick(r, OUTFIT_COLORS),
    shoes: pick(r, SHOE_COLORS),
    skin: pick(r, SKIN_TONES),
    eyes: pick(r, EYE_COLORS),
    hairStyle: Math.floor(r() * 5),  // 0=long, 1=twintails, 2=short-cute, 3=spiky, 4=big-poof
    accessory: Math.floor(r() * 5),  // 0=bow, 1=star-clip, 2=flower, 3=crown, 4=none
    noseSize: 2.5 + r() * 2,
  };
}

// ============================================================
//  POSE SYSTEM (animation data)
// ============================================================
const POSES = {
  idle: [
    { by: 0, ls: 0, la: 0, ra: 0, ht: 0, lean: 0, sq: 1 },
    { by: -1.5, ls: 0, la: 0.05, ra: -0.05, ht: 0, lean: 0, sq: 1 },
  ],
  run: [
    { by: -2, ls: 7, la: 0.4, ra: -0.4, ht: 1, lean: 3, sq: 0.97 },
    { by: 0, ls: 2, la: 0.1, ra: -0.1, ht: 0, lean: 1, sq: 1 },
    { by: -2, ls: -7, la: -0.4, ra: 0.4, ht: -1, lean: 3, sq: 0.97 },
    { by: 0, ls: -2, la: -0.1, ra: 0.1, ht: 0, lean: 1, sq: 1 },
  ],
  jump: [
    { by: -3, ls: -4, la: -0.7, ra: -0.7, ht: 0, lean: 0, sq: 1.05 },
  ],
  fall: [
    { by: 0, ls: 4, la: 0.35, ra: 0.35, ht: 0, lean: 0, sq: 0.96 },
  ],
  dance: [
    { by: -2, ls: 5, la: -1.0, ra: -1.0, ht: 3, lean: 0, sq: 0.9 },
    { by: 1, ls: -3, la: 0.6, ra: -0.8, ht: -2, lean: 4, sq: 1.08 },
    { by: -3, ls: 4, la: -0.8, ra: 1.0, ht: 2, lean: -4, sq: 0.88 },
    { by: 0, ls: -5, la: 0.9, ra: 0.9, ht: 0, lean: 0, sq: 1.1 },
  ],
};

// ============================================================
//  ANIME CHARACTER DRAWING
// ============================================================
function drawCharacter(ctx, t, pose, ox, oy) {
  const cx = ox + FW / 2;
  const p = pose;
  const headCY = oy + 20 + p.by;
  const bodyCY = oy + 42 + p.by;

  ctx.save();

  // --- BIG SHOES ---
  const shoeY = oy + 56 + p.by;
  ctx.fillStyle = t.shoes;
  drawRoundRect(ctx, cx - 15 + (p.ls > 0 ? p.ls : 0), shoeY, 15, 8, 3);
  drawRoundRect(ctx, cx + 1 + (p.ls < 0 ? -p.ls : 0), shoeY, 15, 8, 3);
  // shoe highlights
  ctx.fillStyle = lighten(t.shoes, 50);
  ctx.beginPath();
  ctx.ellipse(cx - 9 + (p.ls > 0 ? p.ls : 0), shoeY + 2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8 + (p.ls < 0 ? -p.ls : 0), shoeY + 2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- LEGS ---
  ctx.fillStyle = darken(t.outfit, 25);
  ctx.fillRect(cx - 7 + Math.max(0, p.ls), oy + 46 + p.by, 6, 11);
  ctx.fillRect(cx + 2 + Math.min(0, -p.ls), oy + 46 + p.by, 6, 11);

  // --- BODY (cute oval) ---
  const bw = 13 * p.sq;
  ctx.fillStyle = t.outfit;
  ctx.beginPath();
  ctx.ellipse(cx + p.lean, bodyCY, bw, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // outfit shading
  ctx.fillStyle = darken(t.outfit, 20);
  ctx.beginPath();
  ctx.ellipse(cx + p.lean + 2, bodyCY + 3, bw - 2, 5, 0, 0, Math.PI);
  ctx.fill();
  // collar ruffle
  ctx.fillStyle = '#FFF';
  ctx.globalAlpha = 0.9;
  for (let a = -0.8; a <= 0.8; a += 0.25) {
    ctx.beginPath();
    ctx.ellipse(cx + p.lean + Math.sin(a) * 10, oy + 33 + p.by, 4, 3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // buttons
  ctx.fillStyle = '#FFD700';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + p.lean, bodyCY - 4 + i * 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- ARMS ---
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  // Left arm
  ctx.save();
  ctx.translate(cx - 12 + p.lean, oy + 36 + p.by);
  ctx.rotate(p.la);
  ctx.strokeStyle = t.outfit;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, 11); ctx.stroke();
  ctx.strokeStyle = darken(t.outfit, 30);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-1, 2); ctx.lineTo(-8, 12); ctx.stroke();
  ctx.fillStyle = t.skin;
  ctx.beginPath(); ctx.arc(-7, 12, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Right arm
  ctx.save();
  ctx.translate(cx + 12 + p.lean, oy + 36 + p.by);
  ctx.rotate(p.ra);
  ctx.strokeStyle = t.outfit;
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 11); ctx.stroke();
  ctx.strokeStyle = darken(t.outfit, 30);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(8, 12); ctx.stroke();
  ctx.fillStyle = t.skin;
  ctx.beginPath(); ctx.arc(7, 12, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- HEAD ---
  const hx = cx + p.ht;
  // Head shadow
  ctx.fillStyle = darken(t.skin, 20);
  ctx.beginPath();
  ctx.ellipse(hx + 1, headCY + 2, 15, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = t.skin;
  ctx.beginPath();
  ctx.ellipse(hx, headCY, 15, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Skin highlight
  ctx.fillStyle = lighten(t.skin, 30);
  ctx.beginPath();
  ctx.ellipse(hx - 4, headCY - 5, 7, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- ANIME EYES ---
  const eyeY = headCY - 1;
  const eyeSpacing = 7;
  for (let side = -1; side <= 1; side += 2) {
    const ex = hx + side * eyeSpacing;
    // White
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 5.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris (large)
    ctx.fillStyle = t.eyes;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 1, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris gradient (darker bottom)
    ctx.fillStyle = darken(t.eyes, 40);
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 3, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(ex, eyeY + 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Big highlight
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.ellipse(ex - 1.5, eyeY - 2, 2, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Small highlight
    ctx.beginPath();
    ctx.arc(ex + 2, eyeY + 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Eyelid line
    ctx.strokeStyle = darken(t.hair, 30);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY - 1, 5.5, 5, 0, Math.PI + 0.3, -0.3);
    ctx.stroke();
    // Eyelashes
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ex + side * 4.5, eyeY - 4);
    ctx.lineTo(ex + side * 6.5, eyeY - 6);
    ctx.stroke();
  }

  // --- BLUSH ---
  ctx.fillStyle = BLUSH;
  ctx.beginPath();
  ctx.ellipse(hx - 11, eyeY + 5, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + 11, eyeY + 5, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- RED NOSE (cute small) ---
  ctx.fillStyle = '#FF1744';
  ctx.beginPath();
  ctx.arc(hx, headCY + 5, t.noseSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(hx - 1, headCY + 4, t.noseSize * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // --- MOUTH ---
  ctx.strokeStyle = '#C62828';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(hx, headCY + 6, 3, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // --- HAIR ---
  drawHair(ctx, t, hx, headCY, oy + p.by);

  // --- ACCESSORY ---
  drawAccessory(ctx, t, hx, headCY, oy + p.by);

  ctx.restore();
}

function drawHair(ctx, t, hx, headCY, baseY) {
  const hairTop = baseY + 4;
  ctx.fillStyle = t.hair;

  switch (t.hairStyle) {
    case 0: // Long flowing
      // Main volume
      ctx.beginPath();
      ctx.ellipse(hx, hairTop + 4, 18, 12, 0, Math.PI, 0);
      ctx.fill();
      // Side strands flowing down
      ctx.beginPath();
      ctx.moveTo(hx - 16, headCY - 2);
      ctx.quadraticCurveTo(hx - 20, headCY + 15, hx - 14, headCY + 25);
      ctx.quadraticCurveTo(hx - 10, headCY + 20, hx - 12, headCY - 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + 16, headCY - 2);
      ctx.quadraticCurveTo(hx + 20, headCY + 15, hx + 14, headCY + 25);
      ctx.quadraticCurveTo(hx + 10, headCY + 20, hx + 12, headCY - 2);
      ctx.fill();
      // Bangs
      drawBangs(ctx, t, hx, hairTop + 8);
      // Highlight
      ctx.fillStyle = lighten(t.hair, 50);
      ctx.beginPath();
      ctx.ellipse(hx - 5, hairTop + 4, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 1: // Twintails
      ctx.beginPath();
      ctx.ellipse(hx, hairTop + 5, 17, 10, 0, Math.PI, 0);
      ctx.fill();
      // Left twintail
      ctx.beginPath();
      ctx.moveTo(hx - 13, hairTop + 8);
      ctx.quadraticCurveTo(hx - 22, headCY + 10, hx - 16, headCY + 30);
      ctx.quadraticCurveTo(hx - 12, headCY + 25, hx - 10, hairTop + 10);
      ctx.fill();
      // Right twintail
      ctx.beginPath();
      ctx.moveTo(hx + 13, hairTop + 8);
      ctx.quadraticCurveTo(hx + 22, headCY + 10, hx + 16, headCY + 30);
      ctx.quadraticCurveTo(hx + 12, headCY + 25, hx + 10, hairTop + 10);
      ctx.fill();
      drawBangs(ctx, t, hx, hairTop + 8);
      // Ties
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(hx - 14, hairTop + 10, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + 14, hairTop + 10, 3, 0, Math.PI * 2); ctx.fill();
      // Highlight
      ctx.fillStyle = lighten(t.hair, 50);
      ctx.beginPath(); ctx.ellipse(hx - 4, hairTop + 3, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;

    case 2: // Short cute bob
      ctx.beginPath();
      ctx.ellipse(hx, hairTop + 6, 18, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trim the bottom
      ctx.fillStyle = t.hair;
      ctx.beginPath();
      ctx.ellipse(hx, headCY + 4, 16, 8, 0, 0, Math.PI);
      ctx.fill();
      drawBangs(ctx, t, hx, hairTop + 9);
      ctx.fillStyle = lighten(t.hair, 50);
      ctx.beginPath(); ctx.ellipse(hx - 6, hairTop + 5, 5, 4, -0.2, 0, Math.PI * 2); ctx.fill();
      break;

    case 3: // Spiky anime protagonist
      const spikes = [
        [-12, -8], [-6, -14], [0, -16], [6, -14], [12, -8],
        [-15, -3], [15, -3], [-9, -12], [9, -12]
      ];
      for (const [sx, sy] of spikes) {
        ctx.beginPath();
        ctx.moveTo(hx + sx - 4, hairTop + 12);
        ctx.lineTo(hx + sx, hairTop + sy);
        ctx.lineTo(hx + sx + 4, hairTop + 12);
        ctx.fill();
      }
      // Base cap
      ctx.beginPath();
      ctx.ellipse(hx, hairTop + 8, 16, 8, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = lighten(t.hair, 45);
      ctx.beginPath(); ctx.ellipse(hx - 3, hairTop + 3, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;

    case 4: // Big poofy afro/cloud
      ctx.beginPath();
      ctx.arc(hx, hairTop + 4, 20, 0, Math.PI * 2);
      ctx.fill();
      for (let a = 0; a < Math.PI * 2; a += 0.7) {
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * 14, hairTop + 4 + Math.sin(a) * 10, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = lighten(t.hair, 45);
      ctx.beginPath();
      ctx.arc(hx - 6, hairTop - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function drawBangs(ctx, t, hx, by) {
  ctx.fillStyle = t.hair;
  // Center bangs
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + i * 5 - 3, by - 4);
    ctx.quadraticCurveTo(hx + i * 5, by + 6, hx + i * 5 + 3, by - 4);
    ctx.fill();
  }
}

function drawAccessory(ctx, t, hx, headCY, baseY) {
  const ax = hx + 12, ay = baseY + 6;
  switch (t.accessory) {
    case 0: // Bow
      ctx.fillStyle = '#FF4081';
      ctx.beginPath();
      ctx.ellipse(ax - 5, ay, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ax + 5, ay, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E91E63';
      ctx.beginPath(); ctx.arc(ax, ay, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 1: // Star clip
      drawStar(ctx, ax, ay, 5, 5, '#FFD700');
      break;
    case 2: // Flower
      ctx.fillStyle = '#FF80AB';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) {
        ctx.beginPath();
        ctx.arc(ax + Math.cos(a) * 4, ay + Math.sin(a) * 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath(); ctx.arc(ax, ay, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 3: // Tiny crown
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(ax - 6, ay + 3);
      ctx.lineTo(ax - 6, ay - 2);
      ctx.lineTo(ax - 3, ay + 1);
      ctx.lineTo(ax, ay - 4);
      ctx.lineTo(ax + 3, ay + 1);
      ctx.lineTo(ax + 6, ay - 2);
      ctx.lineTo(ax + 6, ay + 3);
      ctx.closePath();
      ctx.fill();
      // Gem
      ctx.fillStyle = '#E91E63';
      ctx.beginPath(); ctx.arc(ax, ay - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 4: // None
      break;
  }
}

function drawStar(ctx, cx, cy, r, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI / points) - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.4;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
//  SPRITESHEET GENERATOR
// ============================================================
function generateSpritesheet(scene, seed) {
  const t = getTraits(seed);
  const frameList = [
    ['idle', 0], ['idle', 1],
    ['run', 0], ['run', 1], ['run', 2], ['run', 3],
    ['jump', 0], ['fall', 0],
    ['dance', 0], ['dance', 1], ['dance', 2], ['dance', 3]
  ];
  const canvas = document.createElement('canvas');
  canvas.width = FW * frameList.length;
  canvas.height = FH;
  const ctx = canvas.getContext('2d');

  frameList.forEach(([type, sub], i) => {
    drawCharacter(ctx, t, POSES[type][sub], i * FW, 0);
  });

  const key = 'clown_' + seed;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, canvas, { frameWidth: FW, frameHeight: FH });

  const a = scene.anims;
  if (!a.exists(key + '_idle'))
    a.create({ key: key + '_idle', frames: a.generateFrameNumbers(key, { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
  if (!a.exists(key + '_run'))
    a.create({ key: key + '_run', frames: a.generateFrameNumbers(key, { start: 2, end: 5 }), frameRate: 10, repeat: -1 });
  if (!a.exists(key + '_jump'))
    a.create({ key: key + '_jump', frames: [{ key, frame: 6 }], frameRate: 1 });
  if (!a.exists(key + '_fall'))
    a.create({ key: key + '_fall', frames: [{ key, frame: 7 }], frameRate: 1 });
  if (!a.exists(key + '_dance'))
    a.create({ key: key + '_dance', frames: a.generateFrameNumbers(key, { start: 8, end: 11 }), frameRate: 6, repeat: -1 });

  return key;
}

// ============================================================
//  LEVEL LOADER (parses level.txt)
// ============================================================
function parseLevel(text) {
  const lines = text.split('\n')
    .filter(l => !l.startsWith('#') && l.trim().length > 0);
  const grid = [];
  let maxW = 0;
  for (const line of lines) {
    const row = [...line];
    grid.push(row);
    if (row.length > maxW) maxW = row.length;
  }
  // Pad short rows
  for (const row of grid) {
    while (row.length < maxW) row.push('.');
  }
  return { grid, cols: maxW, rows: grid.length };
}

// ============================================================
//  LEVEL RENDERER
// ============================================================
const TILE_COLORS = {
  '#': { fill: '#3D2066', border: '#FFD700', highlight: '#5E35B1' },
  '-': { fill: '#FF80AB', border: '#FF4081' },
  '=': { stripe1: '#D32F2F', stripe2: '#FFFFFF' },
  '@': { fill: '#76FF03', border: '#64DD17', glow: '#B2FF59' },
};

function buildLevel(scene, levelData) {
  const { grid, cols, rows } = levelData;
  const worldW = cols * TILE, worldH = rows * TILE;
  const spawns = [];
  const platforms = scene.physics.add.staticGroup();
  const bouncePads = scene.physics.add.staticGroup();
  const decorations = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;

      switch (ch) {
        case '#': { // Solid block
          const tc = TILE_COLORS['#'];
          const g = scene.add.graphics();
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.fill).color);
          g.fillRoundedRect(x - TILE / 2 + 1, y - TILE / 2 + 1, TILE - 2, TILE - 2, 4);
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.highlight).color);
          g.fillRoundedRect(x - TILE / 2 + 3, y - TILE / 2 + 3, TILE - 6, 6, 2);
          g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(tc.border).color);
          g.strokeRoundedRect(x - TILE / 2 + 1, y - TILE / 2 + 1, TILE - 2, TILE - 2, 4);
          const block = scene.add.zone(x, y, TILE, TILE);
          scene.physics.add.existing(block, true);
          platforms.add(block);
          break;
        }
        case '-': { // One-way platform
          const tc = TILE_COLORS['-'];
          const g = scene.add.graphics();
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.fill).color);
          g.fillRoundedRect(x - TILE / 2, y - 4, TILE, 8, 3);
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.border).color);
          g.fillRoundedRect(x - TILE / 2 + 2, y - 4, TILE - 4, 3, 2);
          // Glow
          g.fillStyle(0xFF80AB, 0.15);
          g.fillRect(x - TILE / 2, y - 8, TILE, 4);
          const plat = scene.add.zone(x, y - 2, TILE, 6);
          scene.physics.add.existing(plat, true);
          plat.body.checkCollision.down = false;
          plat.body.checkCollision.left = false;
          plat.body.checkCollision.right = false;
          platforms.add(plat);
          break;
        }
        case '=': { // Ground
          const g = scene.add.graphics();
          const tc = TILE_COLORS['='];
          const stripeW = 12;
          for (let sx = 0; sx < TILE; sx += stripeW * 2) {
            g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.stripe1).color);
            g.fillRect(x - TILE / 2 + sx, y - TILE / 2, stripeW, TILE);
            g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.stripe2).color);
            g.fillRect(x - TILE / 2 + sx + stripeW, y - TILE / 2, stripeW, TILE);
          }
          // Top edge gold line
          g.fillStyle(0xFFD700);
          g.fillRect(x - TILE / 2, y - TILE / 2, TILE, 3);
          const ground = scene.add.zone(x, y, TILE, TILE);
          scene.physics.add.existing(ground, true);
          platforms.add(ground);
          break;
        }
        case '@': { // Bounce pad
          const tc = TILE_COLORS['@'];
          const g = scene.add.graphics();
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.glow).color, 0.3);
          g.fillEllipse(x, y - 2, TILE - 4, 16);
          g.fillStyle(Phaser.Display.Color.HexStringToColor(tc.fill).color);
          g.fillRoundedRect(x - TILE / 2 + 4, y - 4, TILE - 8, 8, 4);
          g.lineStyle(2, Phaser.Display.Color.HexStringToColor(tc.border).color);
          g.strokeRoundedRect(x - TILE / 2 + 4, y - 4, TILE - 8, 8, 4);
          // Spring lines
          g.lineStyle(2, 0x33691E);
          g.beginPath();
          for (let i = 0; i < 3; i++) {
            const bx = x - 8 + i * 8;
            g.moveTo(bx, y + 4);
            g.lineTo(bx + 2, y + 10);
            g.lineTo(bx + 4, y + 4);
          }
          g.strokePath();
          const pad = scene.add.zone(x, y - 2, TILE - 8, 6);
          scene.physics.add.existing(pad, true);
          bouncePads.add(pad);
          break;
        }
        case 'P': // Spawn
          spawns.push({ x, y: y - TILE / 2 });
          break;
        case '*': // Balloon
          decorations.push({ type: 'balloon', x, y });
          break;
        case '~': // Confetti
          decorations.push({ type: 'confetti', x, y });
          break;
      }
    }
  }

  return { platforms, bouncePads, spawns, decorations, worldW, worldH };
}

function drawDecorations(scene, decorations) {
  const rng = mulberry32(999);
  for (const d of decorations) {
    if (d.type === 'balloon') {
      const colors = [0xFF4081, 0xFFD740, 0x69F0AE, 0x40C4FF, 0xE040FB, 0xFF6E40];
      const color = colors[Math.floor(rng() * colors.length)];
      const g = scene.add.graphics();
      // String
      g.lineStyle(1, 0xFFFFFF, 0.5);
      g.beginPath(); g.moveTo(d.x, d.y + 14); g.lineTo(d.x, d.y + 30); g.strokePath();
      // Balloon
      g.fillStyle(color, 0.8);
      g.fillEllipse(d.x, d.y, 16, 20);
      // Highlight
      g.fillStyle(0xFFFFFF, 0.4);
      g.fillEllipse(d.x - 3, d.y - 4, 5, 6);
      // Float animation
      scene.tweens.add({
        targets: g,
        y: -6,
        duration: 1500 + rng() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      g.setDepth(-1);
    } else if (d.type === 'confetti') {
      for (let i = 0; i < 5; i++) {
        const colors = [0xFF4081, 0xFFD740, 0x69F0AE, 0x40C4FF, 0xE040FB];
        const g = scene.add.graphics();
        const cx = d.x - 12 + rng() * 24;
        const cy = d.y - 12 + rng() * 24;
        g.fillStyle(colors[i % colors.length], 0.7);
        g.fillRect(cx, cy, 3 + rng() * 3, 3 + rng() * 3);
        scene.tweens.add({
          targets: g,
          y: -4 + rng() * 8,
          angle: 360,
          duration: 2000 + rng() * 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        g.setDepth(-1);
      }
    }
  }
}

// ============================================================
//  BACKGROUND
// ============================================================
function drawBackground(scene, worldW, worldH) {
  const g = scene.add.graphics();
  // Gradient sky
  for (let y = 0; y < worldH; y++) {
    const t = y / worldH;
    const r = Math.floor(18 + t * 25);
    const gr = Math.floor(8 + t * 12);
    const b = Math.floor(38 + t * 50);
    g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b));
    g.fillRect(0, y, worldW, 1);
  }
  // Stars
  const rng = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const sx = rng() * worldW, sy = rng() * worldH * 0.7;
    const sz = 0.5 + rng() * 2;
    g.fillStyle(0xffffff, 0.2 + rng() * 0.6);
    g.fillCircle(sx, sy, sz);
  }
  // Distant circus tent silhouettes
  g.fillStyle(0x2d1b4e, 0.6);
  for (let tx = 100; tx < worldW; tx += 500 + rng() * 300) {
    const tw = 120 + rng() * 100;
    const th = 80 + rng() * 60;
    g.fillTriangle(tx, worldH - th, tx + tw / 2, worldH - th - 80 - rng() * 40, tx + tw, worldH - th);
    g.fillRect(tx, worldH - th, tw, th);
  }
  // Bunting
  const colors = [0xff1744, 0xffea00, 0x00e676, 0x2196f3, 0xff4081, 0xd500f9];
  g.lineStyle(1.5, 0xffffff, 0.25);
  g.beginPath();
  g.moveTo(0, 50);
  for (let x = 0; x <= worldW; x += 8) g.lineTo(x, 50 + Math.sin(x * 0.015) * 18);
  g.strokePath();
  for (let x = 15; x < worldW; x += 45) {
    const fy = 50 + Math.sin(x * 0.015) * 18;
    g.fillStyle(colors[Math.floor(x / 45) % colors.length], 0.55);
    g.fillTriangle(x - 7, fy, x + 7, fy, x, fy + 15);
  }
  g.setDepth(-10);
}

// ============================================================
//  NAME TAG
// ============================================================
function createNameTag(scene, text, color) {
  return scene.add.text(0, -44, text, {
    fontSize: '12px', fontFamily: '"Segoe UI", sans-serif', fontStyle: 'bold',
    color: color || '#fff', stroke: '#000', strokeThickness: 3, align: 'center'
  }).setOrigin(0.5);
}

// ============================================================
//  GAME SCENE
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.remotePlayers = new Map();
    this.lastSendTime = 0;
    this.myState = 'idle';
    this.dancing = false;
    this.touchState = { left: false, right: false, jump: false, dance: false };
    this.levelReady = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#120826');

    // Show loading text
    this.loadingText = this.add.text(GW / 2, GH / 2, 'Loading level...', {
      fontSize: '24px', color: '#FF80AB', fontFamily: '"Segoe UI", sans-serif'
    }).setOrigin(0.5).setScrollFactor(0);

    // Load level from file
    fetch('/level.txt')
      .then(res => res.text())
      .then(text => {
        this.loadingText.destroy();
        const levelData = parseLevel(text);
        this.initLevel(levelData);
      })
      .catch(() => {
        // Fallback: simple default level
        this.loadingText.setText('Using default level');
        setTimeout(() => {
          this.loadingText.destroy();
          const fallback =
            '........................................\n' +
            '........................................\n' +
            '......----..........----..........----.\n' +
            '........................................\n' +
            '..----........-##-..........----.......\n' +
            '........................................\n' +
            '......----..........----........-##-...\n' +
            '........................................\n' +
            '-##-..........----...P......----...-##-\n' +
            '........................................\n' +
            '....----..........####..........----...\n' +
            '........................................\n' +
            '..####.....----........----......####..\n' +
            '........................................\n' +
            '......----......@....@......----.......\n' +
            '........................................\n' +
            '........................................\n' +
            '========================================\n';
          this.initLevel(parseLevel(fallback));
        }, 500);
      });
  }

  initLevel(levelData) {
    const { platforms, bouncePads, spawns, decorations, worldW, worldH } = buildLevel(this, levelData);
    this.platforms = platforms;
    this.bouncePads = bouncePads;
    this.spawnPoints = spawns.length > 0 ? spawns : [{ x: worldW / 2, y: 100 }];

    drawBackground(this, worldW, worldH);
    drawDecorations(this, decorations);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this.createPlayer();
    this.setupControls();
    this.setupMultiplayer();
    this.setupTouchControls();
    this.levelReady = true;
  }

  createPlayer() {
    this.mySeed = 'p_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    const key = generateSpritesheet(this, this.mySeed);
    const spawn = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];

    this.player = this.physics.add.sprite(spawn.x, spawn.y, key);
    this.player.setScale(1.3);
    this.player.setBounce(0.05);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(24, 48);
    this.player.body.setOffset(20, 14);
    this.player.setDepth(5);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.bouncePads, (player) => {
      player.body.setVelocityY(BOUNCE_VEL);
    });

    this.player.play(key + '_idle');
    this.myTag = createNameTag(this, 'You', '#69F0AE');
    this.myTag.setDepth(6);

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dance: Phaser.Input.Keyboard.KeyCodes.E,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE
    });
  }

  setupTouchControls() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.touchState[key] = true; };
      const off = (e) => { e.preventDefault(); this.touchState[key] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('mousedown', () => { this.touchState[key] = true; });
      el.addEventListener('mouseup', () => { this.touchState[key] = false; });
    };
    bind('btn-left', 'left');
    bind('btn-right', 'right');
    bind('btn-jump', 'jump');
    bind('btn-dance', 'dance');
  }

  setupMultiplayer() {
    const roomId = window.location.pathname.replace(/^\//, '') || 'lobby';
    document.getElementById('room-id').textContent = `Room: ${roomId}`;
    document.getElementById('copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Link', 1500);
      });
    });

    this.socket = io();
    this.socket.emit('join', { roomId, character: this.mySeed });

    this.socket.on('currentPlayers', (players) => {
      Object.values(players).forEach(p => {
        if (p.id !== this.socket.id) this.addRemotePlayer(p);
      });
    });
    this.socket.on('playerJoined', (p) => {
      if (p.id !== this.socket.id) this.addRemotePlayer(p);
    });
    this.socket.on('playerMoved', (data) => {
      const rp = this.remotePlayers.get(data.id);
      if (rp) {
        rp.targetX = data.x;
        rp.targetY = data.y;
        rp.sprite.setFlipX(data.flipX);
        if (data.state && rp.lastState !== data.state) {
          const ak = rp.texKey + '_' + data.state;
          if (rp.sprite.anims.exists(ak)) rp.sprite.play(ak, true);
          rp.lastState = data.state;
        }
      }
    });
    this.socket.on('playerLeft', (id) => {
      const rp = this.remotePlayers.get(id);
      if (rp) {
        rp.sprite.destroy();
        if (rp.tag) rp.tag.destroy();
        this.remotePlayers.delete(id);
      }
    });
    this.socket.on('playerCount', (count) => {
      document.getElementById('player-count').textContent = `Players: ${count}`;
    });
  }

  addRemotePlayer(data) {
    if (this.remotePlayers.has(data.id)) return;
    const key = generateSpritesheet(this, data.character);
    const sprite = this.add.sprite(data.x, data.y, key).setScale(1.3).setDepth(4);
    sprite.play(key + '_idle');
    const tag = createNameTag(this, data.id.slice(0, 6), '#FFD740');
    tag.setDepth(4);
    this.remotePlayers.set(data.id, {
      sprite, tag, texKey: key,
      targetX: data.x, targetY: data.y, lastState: 'idle'
    });
  }

  update(time) {
    if (!this.levelReady || !this.player?.body) return;

    const body = this.player.body;
    const onGround = body.blocked.down;
    const left = this.cursors.left.isDown || this.wasd.left.isDown || this.touchState.left;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || this.touchState.right;
    const jumpBtn = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                    Phaser.Input.Keyboard.JustDown(this.wasd.jump) ||
                    this.touchState.jump;
    const danceBtn = Phaser.Input.Keyboard.JustDown(this.wasd.dance) || this.touchState.dance;

    if ((left || right || jumpBtn) && this.dancing) this.dancing = false;
    if (danceBtn && onGround && !left && !right) {
      this.dancing = !this.dancing;
      this.touchState.dance = false;
    }

    if (this.dancing && onGround) {
      body.setVelocityX(0);
      this.myState = 'dance';
    } else if (left) {
      body.setVelocityX(-SPEED);
      this.player.setFlipX(true);
      if (onGround) this.myState = 'run';
    } else if (right) {
      body.setVelocityX(SPEED);
      this.player.setFlipX(false);
      if (onGround) this.myState = 'run';
    } else {
      body.setVelocityX(0);
      if (onGround && !this.dancing) this.myState = 'idle';
    }

    if (jumpBtn && onGround) {
      body.setVelocityY(JUMP);
      this.dancing = false;
    }

    if (!onGround) this.myState = body.velocity.y < 0 ? 'jump' : 'fall';

    const animKey = this.player.texture.key + '_' + this.myState;
    if (this.player.anims.currentAnim?.key !== animKey) this.player.play(animKey, true);

    this.myTag.setPosition(this.player.x, this.player.y - 48);

    // Interpolate remotes
    this.remotePlayers.forEach(rp => {
      rp.sprite.x = Phaser.Math.Linear(rp.sprite.x, rp.targetX, 0.18);
      rp.sprite.y = Phaser.Math.Linear(rp.sprite.y, rp.targetY, 0.18);
      rp.tag.setPosition(rp.sprite.x, rp.sprite.y - 48);
    });

    // Network send
    if (this.socket && time - this.lastSendTime > SEND_RATE) {
      this.lastSendTime = time;
      this.socket.emit('update', {
        x: this.player.x, y: this.player.y,
        state: this.myState, flipX: this.player.flipX
      });
    }
  }
}

// ============================================================
//  BOOT
// ============================================================
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GW,
  height: GH,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: GRAVITY }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
});
