// ============================================================
//  CLOWN CHAOS — Multiplayer Browser Platformer
// ============================================================

// --- Constants ---
const GW = 1024, GH = 600;
const SPEED = 260, JUMP = -520, GRAVITY = 1100;
const FW = 48, FH = 64; // sprite frame size
const SEND_RATE = 50; // ms between network sends

const HAIR_COLORS  = ['#FF1744','#FF9100','#FFEA00','#00E676','#00B0FF','#D500F9','#FF4081','#651FFF'];
const SUIT_COLORS  = ['#F44336','#4CAF50','#2196F3','#FF9800','#9C27B0','#00BCD4','#E91E63','#8BC34A'];
const SHOE_COLORS  = ['#D32F2F','#FDD835','#1B5E20','#1565C0','#6A1B9A','#E65100'];
const SKIN_TONES   = ['#FDDCB1','#F5C49C','#D4A373','#A67C52','#8D5524','#FFE0BD'];
const EYE_COLORS   = ['#2196F3','#4CAF50','#9C27B0','#FF5722','#795548','#607D8B'];

// --- Seeded RNG ---
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

// --- Character trait generation ---
function getTraits(seed) {
  const rng = mulberry32(hashSeed(seed));
  return {
    hair: pick(rng, HAIR_COLORS),
    suit: pick(rng, SUIT_COLORS),
    shoes: pick(rng, SHOE_COLORS),
    skin: pick(rng, SKIN_TONES),
    eyes: pick(rng, EYE_COLORS),
    noseSize: 3 + Math.floor(rng() * 3),
    hairStyle: Math.floor(rng() * 4), // 0=poof, 1=mohawk, 2=twin, 3=big
    hatType: Math.floor(rng() * 5),   // 0=none, 1=party, 2=top, 3=flower, 4=crown
    seed
  };
}

// --- Sprite drawing ---
function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function darken(hex, amt = 40) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}

function lighten(hex, amt = 60) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}

// Draw a single clown frame at (ox, oy) on the given canvas context
function drawClown(ctx, t, frameType, frameSub, ox, oy) {
  const cx = ox + FW / 2; // center x
  ctx.save();
  ctx.translate(0, 0);

  // Animation offsets
  let bodyOff = 0, legLOff = 0, legROff = 0, armLAng = 0, armRAng = 0;
  let squash = 1, lean = 0;

  switch (frameType) {
    case 'idle':
      bodyOff = frameSub === 0 ? 0 : -1;
      break;
    case 'run':
      bodyOff = (frameSub % 2 === 0) ? -1 : 0;
      lean = (frameSub % 2 === 0) ? 2 : -2;
      legLOff = [6, 2, -4, -1][frameSub];
      legROff = [-4, -1, 6, 2][frameSub];
      armLAng = [0.3, 0, -0.3, 0][frameSub];
      armRAng = [-0.3, 0, 0.3, 0][frameSub];
      break;
    case 'jump':
      bodyOff = -2;
      legLOff = -3; legROff = -3;
      armLAng = -0.6; armRAng = -0.6;
      break;
    case 'fall':
      bodyOff = 0;
      legLOff = 3; legROff = 3;
      armLAng = 0.4; armRAng = 0.4;
      break;
    case 'dance':
      squash = [1, 0.9, 1, 1.1][frameSub];
      bodyOff = [0, 2, -2, 0][frameSub];
      armLAng = [-0.8, 0.5, -1.0, 0.3][frameSub];
      armRAng = [0.8, -0.5, 1.0, -0.3][frameSub];
      legLOff = [3, -3, 5, -2][frameSub];
      legROff = [-3, 3, -2, 5][frameSub];
      break;
  }

  const headY = oy + 16 + bodyOff;
  const bodyTop = oy + 28 + bodyOff;
  const bodyBot = oy + 44 + bodyOff;

  // --- Shoes ---
  ctx.fillStyle = t.shoes;
  ctx.fillRect(cx - 14 + legLOff, oy + 56, 14, 8);
  ctx.fillRect(cx + 1 + legROff, oy + 56, 14, 8);
  ctx.fillStyle = darken(t.shoes);
  ctx.fillRect(cx - 14 + legLOff, oy + 62, 14, 2);
  ctx.fillRect(cx + 1 + legROff, oy + 62, 14, 2);

  // --- Legs ---
  ctx.fillStyle = darken(t.suit, 30);
  ctx.fillRect(cx - 8 + legLOff, bodyBot, 7, 13);
  ctx.fillRect(cx + 2 + legROff, bodyBot, 7, 13);

  // --- Body ---
  ctx.fillStyle = t.suit;
  const bw = 22 * squash, bh = bodyBot - bodyTop;
  ctx.beginPath();
  ctx.ellipse(cx + lean, bodyTop + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Suit buttons
  ctx.fillStyle = '#FFF';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + lean, bodyTop + 5 + i * 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Collar / ruffle
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const rx = cx + lean + Math.cos(a) * 12;
    const ry = bodyTop + Math.sin(a) * 4;
    ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  ctx.fill();

  // --- Arms ---
  ctx.strokeStyle = t.suit;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // Left arm
  ctx.save();
  ctx.translate(cx - 10 + lean, bodyTop + 6);
  ctx.rotate(armLAng);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, 12); ctx.stroke();
  // Hand
  ctx.fillStyle = t.skin;
  ctx.beginPath(); ctx.arc(-8, 13, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Right arm
  ctx.save();
  ctx.translate(cx + 10 + lean, bodyTop + 6);
  ctx.rotate(armRAng);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 12); ctx.stroke();
  ctx.fillStyle = t.skin;
  ctx.beginPath(); ctx.arc(8, 13, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- Head ---
  ctx.fillStyle = t.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, 11, 0, Math.PI * 2);
  ctx.fill();

  // --- Anime Eyes ---
  const eyeY = headY - 1;
  // White
  ctx.fillStyle = '#FFF';
  ctx.beginPath(); ctx.ellipse(cx - 5, eyeY, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 5, eyeY, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Iris
  ctx.fillStyle = t.eyes;
  ctx.beginPath(); ctx.arc(cx - 5, eyeY + 1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5, eyeY + 1, 3, 0, Math.PI * 2); ctx.fill();
  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx - 5, eyeY + 1, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 5, eyeY + 1, 1.5, 0, Math.PI * 2); ctx.fill();
  // Highlight
  ctx.fillStyle = '#FFF';
  ctx.beginPath(); ctx.arc(cx - 3.5, eyeY - 1, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6.5, eyeY - 1, 1.2, 0, Math.PI * 2); ctx.fill();

  // --- Red Nose ---
  ctx.fillStyle = '#FF1744';
  ctx.beginPath(); ctx.arc(cx, headY + 5, t.noseSize, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(cx - 1, headY + 4, t.noseSize * 0.4, 0, Math.PI * 2); ctx.fill();

  // --- Mouth ---
  ctx.strokeStyle = '#C62828';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, headY + 6, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // --- Hair ---
  ctx.fillStyle = t.hair;
  const hx = cx, hy = headY - 10;
  switch (t.hairStyle) {
    case 0: // poof - big round afro
      for (let a = 0; a < Math.PI * 2; a += 0.6) {
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * 8, hy + Math.sin(a) * 5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 1: // mohawk
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy + 5);
      ctx.lineTo(hx, hy - 10);
      ctx.lineTo(hx + 4, hy + 5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 3);
      ctx.lineTo(hx, hy - 6);
      ctx.lineTo(hx + 3, hy + 3);
      ctx.fill();
      break;
    case 2: // twin puffs
      ctx.beginPath(); ctx.arc(hx - 9, hy + 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + 9, hy + 2, 7, 0, Math.PI * 2); ctx.fill();
      break;
    case 3: // big poof
      ctx.beginPath();
      ctx.arc(hx, hy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lighten(t.hair, 40);
      ctx.beginPath();
      ctx.arc(hx - 3, hy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // --- Hat ---
  switch (t.hatType) {
    case 1: // party hat
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(hx - 7, hy + 2);
      ctx.lineTo(hx, hy - 16);
      ctx.lineTo(hx + 7, hy + 2);
      ctx.fill();
      ctx.fillStyle = '#FF1744';
      ctx.beginPath(); ctx.arc(hx, hy - 16, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 2: // top hat
      ctx.fillStyle = '#212121';
      ctx.fillRect(hx - 9, hy - 2, 18, 3);
      ctx.fillRect(hx - 6, hy - 16, 12, 14);
      ctx.fillStyle = t.hair;
      ctx.fillRect(hx - 5, hy - 8, 10, 2);
      break;
    case 3: // flower
      ctx.fillStyle = '#FF4081';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.arc(hx + 8 + Math.cos(a) * 4, hy - 4 + Math.sin(a) * 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath(); ctx.arc(hx + 8, hy - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 4: // crown
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy);
      ctx.lineTo(hx - 8, hy - 8);
      ctx.lineTo(hx - 4, hy - 4);
      ctx.lineTo(hx, hy - 10);
      ctx.lineTo(hx + 4, hy - 4);
      ctx.lineTo(hx + 8, hy - 8);
      ctx.lineTo(hx + 8, hy);
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.restore();
}

// Generate a full spritesheet texture for a character
function generateSpritesheet(scene, seed) {
  const t = getTraits(seed);
  // Frame layout: idle(0-1) run(2-5) jump(6) fall(7) dance(8-11)
  const totalFrames = 12;
  const canvas = document.createElement('canvas');
  canvas.width = FW * totalFrames;
  canvas.height = FH;
  const ctx = canvas.getContext('2d');

  const frames = [
    ['idle', 0], ['idle', 1],
    ['run', 0], ['run', 1], ['run', 2], ['run', 3],
    ['jump', 0], ['fall', 0],
    ['dance', 0], ['dance', 1], ['dance', 2], ['dance', 3]
  ];

  frames.forEach(([type, sub], i) => {
    drawClown(ctx, t, type, sub, i * FW, 0);
  });

  const key = 'clown_' + seed;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, canvas, { frameWidth: FW, frameHeight: FH });

  // Create animations
  const anims = scene.anims;
  if (!anims.exists(key + '_idle'))
    anims.create({ key: key + '_idle', frames: anims.generateFrameNumbers(key, { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
  if (!anims.exists(key + '_run'))
    anims.create({ key: key + '_run', frames: anims.generateFrameNumbers(key, { start: 2, end: 5 }), frameRate: 10, repeat: -1 });
  if (!anims.exists(key + '_jump'))
    anims.create({ key: key + '_jump', frames: [{ key, frame: 6 }], frameRate: 1 });
  if (!anims.exists(key + '_fall'))
    anims.create({ key: key + '_fall', frames: [{ key, frame: 7 }], frameRate: 1 });
  if (!anims.exists(key + '_dance'))
    anims.create({ key: key + '_dance', frames: anims.generateFrameNumbers(key, { start: 8, end: 11 }), frameRate: 6, repeat: -1 });

  return key;
}

// --- Name tag ---
function createNameTag(scene, text, color) {
  const tag = scene.add.text(0, -42, text, {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: color || '#fff',
    stroke: '#000',
    strokeThickness: 3,
    align: 'center'
  }).setOrigin(0.5);
  return tag;
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
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a0a2e');
    this.drawBackground();
    this.createLevel();
    this.createPlayer();
    this.setupControls();
    this.setupMultiplayer();
    this.setupTouchControls();
  }

  // --- Background ---
  drawBackground() {
    const g = this.add.graphics();

    // Gradient sky
    for (let y = 0; y < GH; y++) {
      const t = y / GH;
      const r = Math.floor(26 + t * 20);
      const gr = Math.floor(10 + t * 15);
      const b = Math.floor(46 + t * 40);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b));
      g.fillRect(0, y, GW, 1);
    }

    // Stars
    const rng = mulberry32(42);
    for (let i = 0; i < 60; i++) {
      const sx = rng() * GW, sy = rng() * GH * 0.6;
      const sz = 1 + rng() * 2;
      g.fillStyle(0xffffff, 0.3 + rng() * 0.7);
      g.fillCircle(sx, sy, sz);
    }

    // Distant circus tents (silhouettes)
    g.fillStyle(0x2d1b4e, 1);
    // Tent 1
    g.fillTriangle(100, GH - 80, 200, GH - 200, 300, GH - 80);
    g.fillRect(100, GH - 80, 200, 80);
    // Tent 2
    g.fillTriangle(600, GH - 60, 720, GH - 180, 840, GH - 60);
    g.fillRect(600, GH - 60, 240, 60);

    // Bunting flags across the top
    const colors = [0xff1744, 0xffea00, 0x00e676, 0x2196f3, 0xff4081, 0xd500f9];
    g.lineStyle(2, 0xffffff, 0.3);
    g.beginPath();
    g.moveTo(0, 60);
    for (let x = 0; x <= GW; x += 10) {
      g.lineTo(x, 60 + Math.sin(x * 0.02) * 15);
    }
    g.strokePath();

    for (let x = 20; x < GW; x += 50) {
      const flagY = 60 + Math.sin(x * 0.02) * 15;
      g.fillStyle(colors[Math.floor(x / 50) % colors.length], 0.6);
      g.fillTriangle(x - 8, flagY, x + 8, flagY, x, flagY + 16);
    }

    g.setDepth(-10);
  }

  // --- Level ---
  createLevel() {
    this.platforms = this.physics.add.staticGroup();

    // Platform definitions: [x, y, width, height, color]
    const platDefs = [
      // Ground
      [GW / 2, GH - 16, GW, 32, 0xc62828],
      // Floating platforms
      [150, 460, 140, 18, 0xff9800],
      [400, 400, 160, 18, 0x4caf50],
      [700, 440, 140, 18, 0x2196f3],
      [900, 360, 120, 18, 0x9c27b0],
      [250, 320, 130, 18, 0xff4081],
      [550, 280, 150, 18, 0xffeb3b],
      [100, 220, 110, 18, 0x00bcd4],
      [800, 220, 130, 18, 0xff5722],
      [450, 160, 140, 18, 0x8bc34a],
      [680, 120, 100, 18, 0xe91e63],
      [200, 130, 100, 18, 0x651fff],
    ];

    platDefs.forEach(([x, y, w, h, color]) => {
      const plat = this.add.rectangle(x, y, w, h, color);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);

      // Stripe decoration for ground
      if (w === GW) {
        const stripe = this.add.graphics();
        for (let sx = 0; sx < GW; sx += 40) {
          stripe.fillStyle(0xe53935, 1);
          stripe.fillRect(sx, y - h / 2, 20, h);
          stripe.fillStyle(0xffffff, 1);
          stripe.fillRect(sx + 20, y - h / 2, 20, h);
        }
      } else {
        // Highlight line on top
        const hl = this.add.rectangle(x, y - h / 2 + 2, w - 4, 3, 0xffffff, 0.3);
      }
    });
  }

  // --- Player ---
  createPlayer() {
    this.mySeed = 'player_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    const key = generateSpritesheet(this, this.mySeed);

    this.player = this.physics.add.sprite(200 + Math.random() * 600, 100, key);
    this.player.setScale(1.5);
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(20, 48);
    this.player.body.setOffset(14, 14);
    this.player.setDepth(5);

    this.physics.add.collider(this.player, this.platforms);
    this.player.play(key + '_idle');

    // Name tag
    this.myTag = createNameTag(this, 'You', '#00ff88');
    this.myTag.setDepth(6);

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, GW, GH);
    this.physics.world.setBounds(0, 0, GW, GH);
  }

  // --- Controls ---
  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
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
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchState[key] = true; });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this.touchState[key] = false; });
      el.addEventListener('mousedown', () => { this.touchState[key] = true; });
      el.addEventListener('mouseup', () => { this.touchState[key] = false; });
    };
    bind('btn-left', 'left');
    bind('btn-right', 'right');
    bind('btn-jump', 'jump');
    bind('btn-dance', 'dance');
  }

  // --- Multiplayer ---
  setupMultiplayer() {
    const roomId = window.location.pathname.replace('/', '') || 'lobby';
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
      Object.values(players).forEach((p) => {
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
          const animKey = rp.textureKey + '_' + data.state;
          if (rp.sprite.anims.exists(animKey)) {
            rp.sprite.play(animKey, true);
          }
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
    const sprite = this.add.sprite(data.x, data.y, key);
    sprite.setScale(1.5);
    sprite.setDepth(4);
    sprite.play(key + '_idle');

    const tag = createNameTag(this, data.id.slice(0, 6), '#ff9800');
    tag.setDepth(4);

    this.remotePlayers.set(data.id, {
      sprite,
      tag,
      textureKey: key,
      targetX: data.x,
      targetY: data.y,
      lastState: 'idle'
    });
  }

  // --- Update ---
  update(time) {
    if (!this.player || !this.player.body) return;

    const body = this.player.body;
    const onGround = body.blocked.down;
    const left = this.cursors.left.isDown || this.wasd.left.isDown || this.touchState.left;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || this.touchState.right;
    const jumpBtn = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                    Phaser.Input.Keyboard.JustDown(this.wasd.jump) ||
                    Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
                    this.touchState.jump;
    const danceBtn = Phaser.Input.Keyboard.JustDown(this.wasd.dance) || this.touchState.dance;

    // Cancel dance on movement
    if ((left || right || jumpBtn) && this.dancing) {
      this.dancing = false;
    }

    // Toggle dance
    if (danceBtn && onGround && !left && !right) {
      this.dancing = !this.dancing;
      // Reset touch dance to prevent repeated toggles
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

    if (!onGround) {
      this.myState = body.velocity.y < 0 ? 'jump' : 'fall';
    }

    // Play animation
    const animKey = this.player.texture.key + '_' + this.myState;
    if (this.player.anims.currentAnim?.key !== animKey) {
      this.player.play(animKey, true);
    }

    // Name tag follows player
    this.myTag.setPosition(this.player.x, this.player.y - 42);

    // Interpolate remote players
    this.remotePlayers.forEach((rp) => {
      rp.sprite.x = Phaser.Math.Linear(rp.sprite.x, rp.targetX, 0.2);
      rp.sprite.y = Phaser.Math.Linear(rp.sprite.y, rp.targetY, 0.2);
      rp.tag.setPosition(rp.sprite.x, rp.sprite.y - 42);
    });

    // Send state to server
    if (this.socket && time - this.lastSendTime > SEND_RATE) {
      this.lastSendTime = time;
      this.socket.emit('update', {
        x: this.player.x,
        y: this.player.y,
        state: this.myState,
        flipX: this.player.flipX
      });
    }
  }
}

// ============================================================
//  BOOT
// ============================================================
const config = {
  type: Phaser.AUTO,
  width: GW,
  height: GH,
  parent: 'game-container',
  pixelArt: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
};

const game = new Phaser.Game(config);
