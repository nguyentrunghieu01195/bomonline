import './style.css';
import { io } from 'socket.io-client';

// Point to custom API URL (e.g., hosted on Render) if provided as an environment variable VITE_API_URL.
// Otherwise, detect if running locally (port 5173) or fall back to current host.
const BACKEND_URL = import.meta.env.VITE_API_URL || (
  window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : `${window.location.protocol}//${window.location.host}`
);
const socket = io(BACKEND_URL, { autoConnect: false });

let currentUser = null; // { id, username, wins, kills, token }

/* ==========================================================================
   BOOM NEON - SOUND SYNTHESIZER (Web Audio API)
   ========================================================================== */
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmInterval = null;
    this.bgmSequence = [
      [261.63, 100], [293.66, 100], [329.63, 100], [349.23, 100],
      [392.00, 100], [349.23, 100], [329.63, 100], [293.66, 100]
    ];
    this.bgmIndex = 0;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPlaceBomb() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playExplosion() {
    if (this.muted) return;
    this.init();
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.4);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 0.35);
    oscGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.4);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playPowerUp() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  }

  playHit() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playWin() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.3);
    });
  }

  playLose() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [392.00, 369.99, 349.23, 311.13];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.15, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.4);
    });
  }

  startBGM() {
    if (this.muted) return;
    this.init();
    this.stopBGM();
    const playNote = () => {
      if (this.muted || !this.ctx) return;
      const [freq] = this.bgmSequence[this.bgmIndex];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
      this.bgmIndex = (this.bgmIndex + 1) % this.bgmSequence.length;
    };
    this.bgmInterval = setInterval(playNote, 300);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopBGM();
    else this.startBGM();
    return this.muted;
  }
}
const sound = new SoundSynthesizer();

/* ==========================================================================
   CHARACTERS DATA
   ========================================================================== */
const CHARACTERS = [
  {
    id: 'cyber_boy',
    name: 'Cyber Boy',
    avatar: '🤖',
    color: '#00f0ff',
    stats: { speed: 3.5, bombCount: 1, fireRange: 2, lives: 3 },
    desc: 'Tốc độ cân bằng, công nghệ tối tân.'
  },
  {
    id: 'neon_girl',
    name: 'Neon Girl',
    avatar: '🦊',
    color: '#ff007f',
    stats: { speed: 4.2, bombCount: 1, fireRange: 1, lives: 3 },
    desc: 'Di chuyển cực nhanh nhưng hỏa lực yếu lúc đầu.'
  },
  {
    id: 'glitch_bot',
    name: 'Glitch Bot',
    avatar: '👾',
    color: '#39ff14',
    stats: { speed: 3.0, bombCount: 2, fireRange: 2, lives: 2 },
    desc: 'Lượng bom dồi dào, sinh lực yếu hơn.'
  },
  {
    id: 'tank_mech',
    name: 'Tank Mech',
    avatar: '🐻',
    color: '#fff01f',
    stats: { speed: 2.5, bombCount: 1, fireRange: 3, lives: 4 },
    desc: 'Nhiều mạng sống, hỏa lực cực mạnh, đi hơi chậm.'
  }
];

/* ==========================================================================
   PARTICLE SYSTEM FOR EXPLOSIONS
   ========================================================================== */
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 3 + 1;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

/* ==========================================================================
   EXPLOSION LOGIC
   ========================================================================== */
class Explosion {
  constructor(gridX, gridY, range, mapGrid, onBurnTile, owner) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.range = range;
    this.owner = owner;
    this.tiles = [];
    this.duration = 45;
    this.maxDuration = 45;
    this.particles = [];
    this.calculateImpact(mapGrid, onBurnTile);
  }

  calculateImpact(mapGrid, onBurnTile) {
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;
    
    this.tiles.push({ x: this.gridX, y: this.gridY, type: 'center' });
    onBurnTile(this.gridX, this.gridY);

    const directions = [{dx:1, dy:0}, {dx:-1, dy:0}, {dx:0, dy:1}, {dx:0, dy:-1}];
    for (const dir of directions) {
      for (let r = 1; r <= this.range; r++) {
        const tx = this.gridX + dir.dx * r;
        const ty = this.gridY + dir.dy * r;
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) break;
        const cell = mapGrid[ty][tx];
        if (cell === 1) break;

        this.tiles.push({ x: tx, y: ty });
        onBurnTile(tx, ty);
        if (cell === 2) break;
      }
    }
  }

  update() {
    this.duration--;
    this.particles.forEach(p => p.update());
    this.particles = this.particles.filter(p => p.alpha > 0);
  }

  spawnParticles(canvasX, canvasY, tileSize) {
    const colors = ['#fff01f', '#ff007f', '#ff8c00', '#ff3c00'];
    for (let i = 0; i < 5; i++) {
      const px = canvasX + tileSize / 2 + (Math.random() - 0.5) * tileSize;
      const py = canvasY + tileSize / 2 + (Math.random() - 0.5) * tileSize;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(px, py, color));
    }
  }

  draw(ctx, tileSize) {
    ctx.save();
    const ratio = this.duration / this.maxDuration;
    ctx.globalAlpha = Math.sin(ratio * Math.PI);
    this.tiles.forEach(tile => {
      const cx = tile.x * tileSize;
      const cy = tile.y * tileSize;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff007f';
      ctx.fillStyle = '#ff8c00';
      ctx.fillRect(cx + 2, cy + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = '#fff01f';
      ctx.fillRect(cx + 6, cy + 6, tileSize - 12, tileSize - 12);
      if (Math.random() < 0.15 && this.duration > 15) {
        this.spawnParticles(cx, cy, tileSize);
      }
    });
    ctx.restore();
    this.particles.forEach(p => p.draw(ctx));
  }
}

/* ==========================================================================
   BOMB ENTITY
   ========================================================================== */
class Bomb {
  constructor(gridX, gridY, range, owner) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.range = range;
    this.owner = owner;
    this.timer = 150;
    this.exploded = false;
    this.pulseScale = 1.0;
  }

  update() {
    this.timer--;
    this.pulseScale = 1.0 + Math.sin(this.timer * 0.15) * 0.08;
    if (this.timer <= 0) this.exploded = true;
  }

  draw(ctx, tileSize) {
    const cx = this.gridX * tileSize + tileSize / 2;
    const cy = this.gridY * tileSize + tileSize / 2;
    const radius = (tileSize / 2.5) * this.pulseScale;

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    const fuseBlink = Math.floor(this.timer / 10) % 2 === 0;

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.quadraticCurveTo(cx + 10, cy - radius - 10, cx + 15, cy - radius - 5);
    ctx.strokeStyle = '#a0a0c0';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (fuseBlink) {
      ctx.beginPath();
      ctx.arc(cx + 15, cy - radius - 5, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff01f';
      ctx.shadowColor = '#fff01f';
      ctx.shadowBlur = 20;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = fuseBlink ? '#202040' : '#101025';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = fuseBlink ? '#ff007f' : '#800040';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = fuseBlink ? 20 : 0;
    ctx.fill();
    ctx.restore();
  }
}

/* ==========================================================================
   POWER-UP ENTITY
   ========================================================================== */
class PowerUp {
  constructor(gridX, gridY, type) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.type = type;
    this.floatOffset = 0;
    this.pulseDirection = 1;
  }

  update() {
    this.floatOffset += 0.05 * this.pulseDirection;
    if (Math.abs(this.floatOffset) > 4) this.pulseDirection *= -1;
  }

  draw(ctx, tileSize) {
    const cx = this.gridX * tileSize + tileSize / 2;
    const cy = this.gridY * tileSize + tileSize / 2 + this.floatOffset;
    ctx.save();
    ctx.shadowBlur = 12;
    let icon = '🎁';
    let glowColor = '#9d4edd';
    switch (this.type) {
      case 'speed': icon = '👟'; glowColor = '#00f0ff'; break;
      case 'bomb': icon = '💣'; glowColor = '#ff007f'; break;
      case 'fire': icon = '🔥'; glowColor = '#fff01f'; break;
      case 'life': icon = '❤️'; glowColor = '#39ff14'; break;
    }
    ctx.shadowColor = glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize / 2.8, 0, Math.PI * 2);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `${Math.floor(tileSize * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy);
    ctx.restore();
  }
}

/* ==========================================================================
   PLAYER & BOT CLASS
   ========================================================================== */
class Player {
  constructor(id, name, avatar, color, gridX, gridY, stats, isBot = false, isOnlineEnemy = false) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.color = color;
    this.isBot = isBot;
    this.isOnlineEnemy = isOnlineEnemy;
    
    this.tileSize = 40;
    this.x = gridX * this.tileSize + this.tileSize / 2;
    this.y = gridY * this.tileSize + this.tileSize / 2;
    
    this.speed = stats.speed;
    this.maxBombs = stats.bombCount;
    this.activeBombsCount = 0;
    this.fireRange = stats.fireRange;
    this.lives = stats.lives;
    this.maxLives = stats.lives;
    this.score = 0;
    this.kills = 0;
    
    this.dead = false;
    this.invulnerableFrames = 0;
    this.direction = 'down';
    this.moving = false;
    this.size = 28;

    this.targetX = this.x;
    this.targetY = this.y;
    
    // BOT AI VARS
    this.botDecisionTimer = 0;
    this.botPath = [];
  }

  getGridPos() {
    return {
      x: Math.floor(this.x / this.tileSize),
      y: Math.floor(this.y / this.tileSize)
    };
  }

  damage() {
    if (this.invulnerableFrames > 0 || this.dead) return;
    this.lives--;
    this.invulnerableFrames = 120;
    sound.playHit();
    if (this.lives <= 0) this.dead = true;
  }

  addScore(pts) {
    this.score += pts;
  }

  applyPowerUp(type) {
    sound.playPowerUp();
    switch (type) {
      case 'speed': this.speed = Math.min(this.speed + 0.5, 6); break;
      case 'bomb': this.maxBombs = Math.min(this.maxBombs + 1, 8); break;
      case 'fire': this.fireRange = Math.min(this.fireRange + 1, 8); break;
      case 'life': this.lives = Math.min(this.lives + 1, this.maxLives); break;
    }
  }

  update(keys, mapGrid, bombs, explosions, otherPlayers) {
    if (this.dead) return;
    if (this.invulnerableFrames > 0) this.invulnerableFrames--;

    if (this.isOnlineEnemy) {
      // Interpolate position from server updates
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        this.x += dx * 0.3;
        this.y += dy * 0.3;
        this.moving = true;
      } else {
        this.x = this.targetX;
        this.y = this.targetY;
        this.moving = false;
      }
      return;
    }

    this.moving = false;

    if (!this.isBot) {
      let dx = 0, dy = 0;
      if (keys.up) { dy = -1; this.direction = 'up'; }
      else if (keys.down) { dy = 1; this.direction = 'down'; }
      else if (keys.left) { dx = -1; this.direction = 'left'; }
      else if (keys.right) { dx = 1; this.direction = 'right'; }
      if (dx !== 0 || dy !== 0) {
        this.move(dx, dy, mapGrid, bombs);
        this.moving = true;
      }
    } else {
      this.updateAI(mapGrid, bombs, explosions, otherPlayers);
    }
  }

  move(dx, dy, mapGrid, bombs) {
    const halfSize = this.size / 2;
    const currentGrid = this.getGridPos();
    let nextX = this.x + dx * this.speed;
    let nextY = this.y + dy * this.speed;
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;

    const checkCollidable = (gx, gy) => {
      if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return true;
      const cell = mapGrid[gy][gx];
      if (cell === 1 || cell === 2) return true;

      const bomb = bombs.find(b => b.gridX === gx && b.gridY === gy);
      if (bomb) {
        const playerLeft = this.x - halfSize;
        const playerRight = this.x + halfSize;
        const playerTop = this.y - halfSize;
        const playerBottom = this.y + halfSize;
        const bombLeft = bomb.gridX * this.tileSize;
        const bombRight = (bomb.gridX + 1) * this.tileSize;
        const bombTop = bomb.gridY * this.tileSize;
        const bombBottom = (bomb.gridY + 1) * this.tileSize;
        const isOverlapping = (playerLeft < bombRight && playerRight > bombLeft &&
                               playerTop < bombBottom && playerBottom > bombTop);
        if (isOverlapping) return false;
        return true;
      }
      return false;
    };

    const getCorners = (tx, ty) => [
      { x: tx - halfSize, y: ty - halfSize },
      { x: tx + halfSize, y: ty - halfSize },
      { x: tx - halfSize, y: ty + halfSize },
      { x: tx + halfSize, y: ty + halfSize }
    ];

    let corners = getCorners(nextX, nextY);
    let collision = corners.some(c => checkCollidable(Math.floor(c.x / this.tileSize), Math.floor(c.y / this.tileSize)));

    if (!collision) {
      this.x = nextX;
      this.y = nextY;
      return;
    }

    // Corner sliding
    if (dy !== 0) {
      const idealX = currentGrid.x * this.tileSize + this.tileSize / 2;
      const offsetX = this.x - idealX;
      if (Math.abs(offsetX) < 16) {
        const slideSpeed = Math.min(this.speed, Math.abs(offsetX));
        const slideDx = offsetX > 0 ? -1 : 1;
        let testX = this.x + slideDx * slideSpeed;
        let testY = this.y + dy * this.speed;
        let testColl = getCorners(testX, testY).some(c => checkCollidable(Math.floor(c.x / this.tileSize), Math.floor(c.y / this.tileSize)));
        if (!testColl) { this.x = testX; this.y = testY; this.moving = true; }
      }
    }

    if (dx !== 0) {
      const idealY = currentGrid.y * this.tileSize + this.tileSize / 2;
      const offsetY = this.y - idealY;
      if (Math.abs(offsetY) < 16) {
        const slideSpeed = Math.min(this.speed, Math.abs(offsetY));
        const slideDy = offsetY > 0 ? -1 : 1;
        let testX = this.x + dx * this.speed;
        let testY = this.y + slideDy * slideSpeed;
        let testColl = getCorners(testX, testY).some(c => checkCollidable(Math.floor(c.x / this.tileSize), Math.floor(c.y / this.tileSize)));
        if (!testColl) { this.x = testX; this.y = testY; this.moving = true; }
      }
    }
  }

  updateAI(mapGrid, bombs, explosions, otherPlayers) {
    this.botDecisionTimer--;
    const currentGrid = this.getGridPos();
    const dangerGrid = this.calculateDangerGrid(mapGrid, bombs);
    const standsOnDanger = dangerGrid[currentGrid.y][currentGrid.x] > 0;

    if (standsOnDanger) {
      const pathIsSafe = this.botPath.length > 0 && this.botPath.every(node => dangerGrid[node.y][node.x] === 0);
      if (!pathIsSafe || this.botDecisionTimer <= 0) {
        const safePath = this.findPathToSafety(currentGrid, mapGrid, dangerGrid, bombs);
        if (safePath) {
          this.botPath = safePath;
          this.botDecisionTimer = 15;
        } else {
          this.botPath = [];
        }
      }
    } else {
      if (this.botPath.length === 0 || this.botDecisionTimer <= 0) {
        this.botDecisionTimer = 30;
        let target = this.findAITargets(currentGrid, mapGrid, dangerGrid, otherPlayers, bombs);
        if (target) {
          const path = this.findPathBFS(currentGrid, target, mapGrid, dangerGrid, bombs);
          if (path && path.length > 0) this.botPath = path;
        }
      }
    }

    if (this.botPath.length > 0) {
      const nextStep = this.botPath[0];
      const targetX = nextStep.x * this.tileSize + this.tileSize / 2;
      const targetY = nextStep.y * this.tileSize + this.tileSize / 2;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.x = targetX;
        this.y = targetY;
        this.botPath.shift();
      } else {
        const stepDx = Math.sign(dx);
        const stepDy = Math.sign(dy);
        if (stepDx !== 0) this.direction = stepDx > 0 ? 'right' : 'left';
        if (stepDy !== 0) this.direction = stepDy > 0 ? 'down' : 'up';
        this.move(stepDx, stepDy, mapGrid, bombs);
        this.moving = true;
      }
    }

    if (!standsOnDanger && this.activeBombsCount < this.maxBombs && this.botPath.length === 0) {
      let shouldBomb = false;
      const dirs = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}];
      for (const d of dirs) {
        const nx = currentGrid.x + d.x;
        const ny = currentGrid.y + d.y;
        if (nx >= 0 && nx < mapGrid[0].length && ny >= 0 && ny < mapGrid.length) {
          if (mapGrid[ny][nx] === 2) { shouldBomb = true; break; }
        }
      }
      otherPlayers.forEach(p => {
        if (p.id !== this.id && !p.dead) {
          const enemyPos = p.getGridPos();
          const dist = Math.abs(enemyPos.x - currentGrid.x) + Math.abs(enemyPos.y - currentGrid.y);
          if (dist <= 2) shouldBomb = true;
        }
      });
      if (shouldBomb) this.layBombTrigger = true;
    }
  }

  calculateDangerGrid(mapGrid, bombs) {
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;
    const danger = Array(rows).fill(0).map(() => Array(cols).fill(0));
    bombs.forEach(bomb => {
      danger[bomb.gridY][bomb.gridX] = 2;
      const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
      directions.forEach(dir => {
        for (let r = 1; r <= bomb.range; r++) {
          const tx = bomb.gridX + dir.x * r;
          const ty = bomb.gridY + dir.y * r;
          if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) break;
          if (mapGrid[ty][tx] === 1) break;
          danger[ty][tx] = 1;
          if (mapGrid[ty][tx] === 2) break;
        }
      });
    });
    return danger;
  }

  findPathToSafety(start, mapGrid, dangerGrid, bombs) {
    const queue = [[start]];
    const visited = new Set([`${start.x},${start.y}`]);
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;
    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];
      if (dangerGrid[node.y][node.x] === 0) {
        path.shift();
        return path;
      }
      const neighbors = [{ x: node.x + 1, y: node.y }, { x: node.x - 1, y: node.y }, { x: node.x, y: node.y + 1 }, { x: node.x, y: node.y - 1 }];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows) {
          const key = `${n.x},${n.y}`;
          const isWalkable = mapGrid[n.y][n.x] === 0 && !bombs.some(b => b.gridX === n.x && b.gridY === n.y);
          if (isWalkable && !visited.has(key)) {
            visited.add(key);
            queue.push([...path, n]);
          }
        }
      }
    }
    return null;
  }

  findPathBFS(start, target, mapGrid, dangerGrid, bombs) {
    const queue = [[start]];
    const visited = new Set([`${start.x},${start.y}`]);
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;
    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];
      if (node.x === target.x && node.y === target.y) {
        path.shift();
        return path;
      }
      const neighbors = [{ x: node.x + 1, y: node.y }, { x: node.x - 1, y: node.y }, { x: node.x, y: node.y + 1 }, { x: node.x, y: node.y - 1 }];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows) {
          const key = `${n.x},${n.y}`;
          const isWalkable = mapGrid[n.y][n.x] === 0 && !bombs.some(b => b.gridX === n.x && b.gridY === n.y) && dangerGrid[n.y][n.x] === 0;
          if (isWalkable && !visited.has(key)) {
            visited.add(key);
            queue.push([...path, n]);
          }
        }
      }
    }
    return null;
  }

  findAITargets(start, mapGrid, dangerGrid, otherPlayers, bombs) {
    const cols = mapGrid[0].length;
    const rows = mapGrid.length;
    const queue = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    let closestBrick = null;
    let closestEnemy = null;
    while (queue.length > 0) {
      const node = queue.shift();
      for (const p of otherPlayers) {
        if (p.id !== this.id && !p.dead) {
          const ep = p.getGridPos();
          if (ep.x === node.x && ep.y === node.y) { closestEnemy = node; break; }
        }
      }
      if (closestEnemy) break;

      const neighbors = [{ x: node.x + 1, y: node.y }, { x: node.x - 1, y: node.y }, { x: node.x, y: node.y + 1 }, { x: node.x, y: node.y - 1 }];
      for (let n of neighbors) {
        if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows) {
          const key = `${n.x},${n.y}`;
          if (!visited.has(key)) {
            visited.add(key);
            const cell = mapGrid[n.y][n.x];
            if (cell === 2 && !closestBrick) closestBrick = node;
            if (cell === 0 && !bombs.some(b => b.gridX === n.x && b.gridY === n.y)) queue.push(n);
          }
        }
      }
    }
    return closestEnemy || closestBrick;
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    if (this.invulnerableFrames > 0 && Math.floor(this.invulnerableFrames / 6) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    const cx = this.x;
    const cy = this.y;
    const r = this.size / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#101025';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    let visorW = r * 1.2, visorH = r * 0.4;
    switch (this.direction) {
      case 'up':
        ctx.beginPath();
        ctx.arc(cx, cy - 3, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        break;
      case 'down':
        ctx.roundRect(cx - visorW / 2, cy - r * 0.3, visorW, visorH, 4);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - visorW / 3, cy - r * 0.15, 3, 3);
        ctx.fillRect(cx + visorW / 3 - 3, cy - r * 0.15, 3, 3);
        break;
      case 'left':
        ctx.roundRect(cx - r * 0.9, cy - r * 0.3, visorW * 0.7, visorH, 4);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r * 0.7, cy - r * 0.15, 3, 3);
        break;
      case 'right':
        ctx.roundRect(cx + r * 0.2, cy - r * 0.3, visorW * 0.7, visorH, 4);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + r * 0.5, cy - r * 0.15, 3, 3);
        break;
    }

    if (this.moving && Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(cx - r * 0.4, cy + r, 4, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.4, cy + r, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff01f';
      ctx.shadowColor = '#fff01f';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx - r * 0.4, cy + r - 1, 3, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.4, cy + r - 1, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    ctx.shadowBlur = 5;
    ctx.shadowColor = '#000';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.avatar, cx, cy - r - 8);
    ctx.restore();
  }
}

/* ==========================================================================
   MAIN GAME ENGINE CLASS
   ========================================================================== */
class Game {
  constructor(mode, playersData, onGameOver) {
    this.mode = mode; // 'solo', 'local', or 'online'
    this.playersData = playersData; // chosen characters [{id, color, name, avatar, stats}]
    this.onGameOver = onGameOver;
    
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.cols = 15;
    this.rows = 13;
    this.tileSize = 40;
    this.canvas.width = this.cols * this.tileSize;
    this.canvas.height = this.rows * this.tileSize;

    this.grid = [];
    this.players = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    
    this.timeLimit = 180;
    this.timerInterval = null;
    this.running = false;
    this.paused = false;
    this.keys = {};
    this.keysP2 = {};
    this.screenShake = 0;

    this.setupListeners = [];
    
    if (this.mode === 'online') {
      this.initOnlineGame();
    } else {
      this.initMap();
      this.initPlayers();
      this.setupInputs();
      this.startTimer();
      this.running = true;
      this.gameLoop();
      sound.startBGM();
    }
  }

  /* ==========================================================================
     MAP GENERATOR (LOCAL ONLY)
     ========================================================================== */
  initMap() {
    this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          this.grid[r][c] = 1;
        } else if (r % 2 === 0 && c % 2 === 0) {
          this.grid[r][c] = 1;
        } else {
          const isSpawnZone = (r <= 2 && c <= 2) || (r <= 2 && c >= this.cols - 3) || (r >= this.rows - 3 && c <= 2) || (r >= this.rows - 3 && c >= this.cols - 3);
          if (!isSpawnZone && Math.random() < 0.45) this.grid[r][c] = 2;
        }
      }
    }
  }

  initPlayers() {
    this.players = [];
    const p1Char = this.playersData[0];
    this.players.push(new Player('player_1', p1Char.name, p1Char.avatar, p1Char.color, 1, 1, p1Char.stats, false));

    if (this.mode === 'local') {
      const p2Char = this.playersData[1];
      this.players.push(new Player('player_2', p2Char.name, p2Char.avatar, p2Char.color, 13, 11, p2Char.stats, false));
    } else {
      const botChar1 = CHARACTERS[(CHARACTERS.findIndex(c => c.id === p1Char.id) + 1) % CHARACTERS.length];
      this.players.push(new Player('bot_1', `BOT ${botChar1.name}`, botChar1.avatar, botChar1.color, 13, 11, botChar1.stats, true));
    }

    const botChar2 = CHARACTERS[(CHARACTERS.findIndex(c => c.id === p1Char.id) + 2) % CHARACTERS.length];
    this.players.push(new Player('bot_2', `BOT ${botChar2.name}`, botChar2.avatar, botChar2.color, 13, 1, botChar2.stats, true));

    const botChar3 = CHARACTERS[(CHARACTERS.findIndex(c => c.id === p1Char.id) + 3) % CHARACTERS.length];
    this.players.push(new Player('bot_3', `BOT ${botChar3.name}`, botChar3.avatar, botChar3.color, 1, 11, botChar3.stats, true));

    this.updateStatsUI();
  }

  /* ==========================================================================
     ONLINE INITIALIZATION
     ========================================================================== */
  initOnlineGame() {
    // grid and playersData are pre-calculated by room state
    const data = this.playersData; // passed from app.js socket 'game_start': { grid, players }
    this.grid = data.grid;
    
    this.players = data.players.map(p => {
      const charConfig = CHARACTERS.find(c => c.id === p.characterId) || CHARACTERS[0];
      const isMe = (p.id === currentUser.id);
      return new Player(
        p.id,
        p.username,
        charConfig.avatar,
        charConfig.color,
        p.spawnX,
        p.spawnY,
        charConfig.stats,
        false,      // isBot
        !isMe       // isOnlineEnemy
      );
    });

    this.setupInputs();
    this.setupOnlineSocketSync();
    this.startTimer();
    this.running = true;
    this.gameLoop();
    sound.startBGM();

    document.getElementById('arena-message').innerText = "LET THE BATTLE BEGIN!";
    setTimeout(() => { document.getElementById('arena-message').innerText = ""; }, 2000);
  }

  setupOnlineSocketSync() {
    // 1. Move updates
    const onPlayerUpdate = (data) => {
      const enemy = this.players.find(p => p.id === data.id);
      if (enemy && enemy.isOnlineEnemy) {
        enemy.targetX = data.x;
        enemy.targetY = data.y;
        enemy.direction = data.direction;
        enemy.moving = data.moving;
      }
    };
    socket.on('player_update', onPlayerUpdate);
    this.setupListeners.push({ event: 'player_update', fn: onPlayerUpdate });

    // 2. Bomb placed updates
    const onBombPlaced = (data) => {
      const owner = this.players.find(p => p.id === data.ownerId);
      if (owner) {
        const bomb = new Bomb(data.gridX, data.gridY, owner.fireRange, owner);
        this.bombs.push(bomb);
        owner.activeBombsCount++;
        sound.playPlaceBomb();
      }
    };
    socket.on('bomb_placed', onBombPlaced);
    this.setupListeners.push({ event: 'bomb_placed', fn: onBombPlaced });

    // 3. Brick destroyed sync
    const onBrickDestroyed = ({ gridX, gridY, powerUpType }) => {
      this.grid[gridY][gridX] = 0;
      this.powerups = this.powerups.filter(pu => !(pu.gridX === gridX && pu.gridY === gridY));
      if (powerUpType) {
        this.powerups.push(new PowerUp(gridX, gridY, powerUpType));
      }
    };
    socket.on('brick_destroyed', onBrickDestroyed);
    this.setupListeners.push({ event: 'brick_destroyed', fn: onBrickDestroyed });

    // 4. Powerup collected sync
    const onPowerupCollected = ({ gridX, gridY, playerId }) => {
      this.powerups = this.powerups.filter(pu => !(pu.gridX === gridX && pu.gridY === gridY));
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        const itemType = this.powerups.find(pu => pu.gridX === gridX && pu.gridY === gridY)?.type;
        player.applyPowerUp(itemType);
        player.addScore(100);
        this.updateStatsUI();
      }
    };
    socket.on('powerup_collected', onPowerupCollected);
    this.setupListeners.push({ event: 'powerup_collected', fn: onPowerupCollected });

    // 5. Player status (damage, death) sync
    const onPlayerStatus = ({ playerId, lives, dead }) => {
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        player.lives = lives;
        player.dead = dead;
        this.updateStatsUI();
      }
    };
    socket.on('player_status', onPlayerStatus);
    this.setupListeners.push({ event: 'player_status', fn: onPlayerStatus });

    // 6. Game Over sync
    const onGameOverSocket = ({ winnerId, roomUpdate }) => {
      const winner = this.players.find(p => p.id === winnerId);
      this.endMatch(winner);
    };
    socket.on('game_over', onGameOverSocket);
    this.setupListeners.push({ event: 'game_over', fn: onGameOverSocket });
  }

  setupInputs() {
    this.keys = { up: false, down: false, left: false, right: false };
    this.keysP2 = { up: false, down: false, left: false, right: false };

    this.keydownHandler = (e) => {
      if (!this.running || this.paused) return;
      
      const localPlayerId = this.mode === 'online' ? currentUser.id : 'player_1';
      const localPlayer = this.players.find(p => p.id === localPlayerId);

      if (e.code === 'KeyW') this.keys.up = true;
      if (e.code === 'KeyS') this.keys.down = true;
      if (e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this.placeBomb(localPlayer);
      }

      if (this.mode === 'local') {
        if (e.code === 'ArrowUp') this.keysP2.up = true;
        if (e.code === 'ArrowDown') this.keysP2.down = true;
        if (e.code === 'ArrowLeft') this.keysP2.left = true;
        if (e.code === 'ArrowRight') this.keysP2.right = true;
        if (e.code === 'Enter') {
          e.preventDefault();
          this.placeBomb(this.players.find(p => p.id === 'player_2'));
        }
      }
    };

    this.keyupHandler = (e) => {
      if (e.code === 'KeyW') this.keys.up = false;
      if (e.code === 'KeyS') this.keys.down = false;
      if (e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'KeyD') this.keys.right = false;

      if (this.mode === 'local') {
        if (e.code === 'ArrowUp') this.keysP2.up = false;
        if (e.code === 'ArrowDown') this.keysP2.down = false;
        if (e.code === 'ArrowLeft') this.keysP2.left = false;
        if (e.code === 'ArrowRight') this.keysP2.right = false;
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.paused || !this.running) return;
      this.timeLimit--;
      const m = Math.floor(this.timeLimit / 60).toString().padStart(2, '0');
      const s = (this.timeLimit % 60).toString().padStart(2, '0');
      document.getElementById('game-timer').innerText = `${m}:${s}`;
      if (this.timeLimit <= 0) {
        this.endMatch(null, "TIME IS UP!");
      }
    }, 1000);
  }

  /* ==========================================================================
     PLACE BOMB
     ========================================================================== */
  placeBomb(player) {
    if (!player || player.dead) return;
    const grid = player.getGridPos();

    if (this.mode === 'online') {
      // Emit to server to broadcast bomb
      socket.emit('place_bomb', { gridX: grid.x, gridY: grid.y });
      return;
    }

    if (player.activeBombsCount >= player.maxBombs) return;
    if (this.bombs.some(b => b.gridX === grid.x && b.gridY === grid.y)) return;

    const bomb = new Bomb(grid.x, grid.y, player.fireRange, player);
    this.bombs.push(bomb);
    player.activeBombsCount++;
    sound.playPlaceBomb();
  }

  /* ==========================================================================
     GAME LOOP & PHYSICS UPDATES
     ========================================================================== */
  gameLoop() {
    if (!this.running) return;
    if (!this.paused) {
      this.updatePhysics();
      this.drawArena();
    }
    requestAnimationFrame(() => this.gameLoop());
  }

  updatePhysics() {
    const localPlayerId = this.mode === 'online' ? currentUser.id : 'player_1';
    const p1 = this.players.find(p => p.id === localPlayerId);

    // 1. Update Players
    this.players.forEach(p => {
      if (p.isBot) {
        if (p.layBombTrigger) { p.layBombTrigger = false; this.placeBomb(p); }
        const others = this.players.filter(op => op.id !== p.id && !op.dead);
        p.update(null, this.grid, this.bombs, this.explosions, others);
      } else {
        const controls = p.id === localPlayerId ? this.keys : this.keysP2;
        p.update(controls, this.grid, this.bombs, this.explosions, this.players);
      }
    });

    // Send coordinates updates to server in online mode
    if (this.mode === 'online' && p1 && !p1.dead && p1.moving) {
      socket.emit('player_move', {
        x: p1.x,
        y: p1.y,
        direction: p1.direction,
        moving: p1.moving
      });
    }

    this.powerups.forEach(pu => pu.update());
    this.bombs.forEach(b => b.update());
    
    const exploded = this.bombs.filter(b => b.exploded);
    if (exploded.length > 0) {
      exploded.forEach(b => this.triggerExplosion(b));
      this.bombs = this.bombs.filter(b => !b.exploded);
    }

    this.explosions.forEach(exp => exp.update());
    this.explosions = this.explosions.filter(exp => exp.duration > 0);

    // Damage checks
    if (p1 && !p1.dead) {
      const gp = p1.getGridPos();
      const inFire = this.explosions.some(exp => exp.tiles.some(t => t.x === gp.x && t.y === gp.y));
      if (inFire) {
        p1.damage();
        this.updateStatsUI();
        
        if (this.mode === 'online') {
          socket.emit('player_damaged', { lives: p1.lives });
        } else if (p1.lives <= 0) {
          const fatExp = this.explosions.find(exp => exp.tiles.some(t => t.x === gp.x && t.y === gp.y));
          if (fatExp && fatExp.owner && fatExp.owner.id !== p1.id) {
            fatExp.owner.addScore(500);
            fatExp.owner.kills++;
            this.updateStatsUI();
          }
        }
      }
    }

    // Power-up check
    if (p1 && !p1.dead) {
      const gp = p1.getGridPos();
      const itemIdx = this.powerups.findIndex(pu => pu.gridX === gp.x && pu.gridY === gp.y);
      if (itemIdx !== -1) {
        const item = this.powerups[itemIdx];
        p1.applyPowerUp(item.type);
        p1.addScore(100);
        this.powerups.splice(itemIdx, 1);
        this.updateStatsUI();
        if (this.mode === 'online') {
          socket.emit('pickup_powerup', { gridX: gp.x, gridY: gp.y });
        }
      }
    }

    // Check Victory (local only)
    if (this.mode !== 'online') {
      const alivePlayers = this.players.filter(p => !p.dead);
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
        this.endMatch(winner);
      }
    } else {
      // In online mode, the last survivor's client tells the server the game is over
      const alivePlayers = this.players.filter(p => !p.dead);
      if (alivePlayers.length === 1 && alivePlayers[0].id === currentUser.id && this.running) {
        socket.emit('game_over_client', {
          winnerId: currentUser.id,
          kills: p1.kills
        });
      } else if (alivePlayers.length === 0 && this.running) {
        socket.emit('game_over_client', {
          winnerId: null,
          kills: p1.kills
        });
      }
    }

    if (this.screenShake > 0) this.screenShake -= 0.5;
  }

  triggerExplosion(bomb) {
    if (bomb.owner) {
      bomb.owner.activeBombsCount = Math.max(0, bomb.owner.activeBombsCount - 1);
    }
    this.screenShake = 6;
    sound.playExplosion();

    const onBurnTile = (bx, by) => {
      // Brick Destroyed logic
      if (this.grid[by][bx] === 2) {
        this.grid[by][bx] = 0;
        if (bomb.owner) bomb.owner.addScore(50);

        // In online mode, only the bomb owner generates the powerup to avoid sync mismatches
        if (this.mode === 'online') {
          const localPlayerId = currentUser.id;
          if (bomb.owner && bomb.owner.id === localPlayerId) {
            let pickedType = null;
            if (Math.random() < 0.28) {
              const types = ['speed', 'bomb', 'fire', 'life'];
              pickedType = types[Math.floor(Math.random() * types.length)];
            }
            // Emit to server to sync brick destroyed and power-up spawn
            socket.emit('brick_destroyed', { gridX: bx, gridY: by, powerUpType: pickedType });
            
            // Apply locally
            this.powerups = this.powerups.filter(pu => !(pu.gridX === bx && pu.gridY === by));
            if (pickedType) this.powerups.push(new PowerUp(bx, by, pickedType));
          }
        } else {
          // Offline mode
          if (Math.random() < 0.28) {
            const types = ['speed', 'bomb', 'fire', 'life'];
            const pickedType = types[Math.floor(Math.random() * types.length)];
            this.powerups.push(new PowerUp(bx, by, pickedType));
          }
        }
      }

      // Chain reaction
      const otherBomb = this.bombs.find(b => b.gridX === bx && b.gridY === by && !b.exploded);
      if (otherBomb) otherBomb.exploded = true;

      // Clear burnt power-ups
      if (this.mode !== 'online') {
        this.powerups = this.powerups.filter(pu => !(pu.gridX === bx && pu.gridY === by));
      }
    };

    const exp = new Explosion(bomb.gridX, bomb.gridY, bomb.range, this.grid, onBurnTile, bomb.owner);
    this.explosions.push(exp);
  }

  drawArena() {
    this.ctx.save();
    this.ctx.fillStyle = '#04040a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.screenShake > 0) {
      this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cx = c * this.tileSize;
        const cy = r * this.tileSize;
        const cell = this.grid[r][c];

        if (cell === 1) {
          this.ctx.fillStyle = 'rgba(15, 15, 30, 0.9)';
          this.ctx.fillRect(cx, cy, this.tileSize, this.tileSize);
          this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(cx + 2, cy + 2, this.tileSize - 4, this.tileSize - 4);
          this.ctx.fillStyle = '#00f0ff';
          this.ctx.fillRect(cx + this.tileSize / 2 - 3, cy + this.tileSize / 2 - 3, 6, 6);
        } else if (cell === 2) {
          this.ctx.fillStyle = 'rgba(35, 15, 25, 0.8)';
          this.ctx.fillRect(cx + 1, cy + 1, this.tileSize - 2, this.tileSize - 2);
          this.ctx.strokeStyle = '#ff007f';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(cx + 2, cy + 2, this.tileSize - 4, this.tileSize - 4);
          this.ctx.beginPath();
          this.ctx.moveTo(cx + 5, cy + 5);
          this.ctx.lineTo(cx + this.tileSize - 5, cy + this.tileSize - 5);
          this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
          this.ctx.stroke();
        } else {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          this.ctx.fillRect(cx + this.tileSize / 2 - 1, cy + this.tileSize / 2 - 1, 2, 2);
        }
      }
    }

    this.powerups.forEach(pu => pu.draw(this.ctx, this.tileSize));
    this.bombs.forEach(b => b.draw(this.ctx, this.tileSize));
    this.explosions.forEach(exp => exp.draw(this.ctx, this.tileSize));
    this.players.forEach(p => p.draw(this.ctx));
    this.ctx.restore();
  }

  updateStatsUI() {
    const container = document.getElementById('player-stats-container');
    const leaderboard = document.getElementById('leaderboard-container');
    if (!container || !leaderboard) return;

    container.innerHTML = this.players.map((p, idx) => {
      const isLocalP1 = (this.mode === 'online' ? p.id === currentUser.id : p.id === 'player_1');
      const isLocalP2 = (p.id === 'player_2');
      const label = isLocalP1 ? '(P1)' : isLocalP2 ? '(P2)' : '';
      let cardClass = p.dead ? 'dead' : '';
      if (isLocalP1) cardClass += ' player-1';
      else if (isLocalP2) cardClass += ' player-2';
      else cardClass += ' bot';

      return `
        <div class="player-stat-card ${cardClass}">
          <div class="player-info-top">
            <span class="avatar">${p.avatar}</span>
            <span class="name">${p.name.substring(0,10)} ${label}</span>
          </div>
          <div class="player-indicators">
            <div class="indicator" title="Lives">❤️ <span>${p.dead ? 0 : p.lives}</span></div>
            <div class="indicator" title="Bombs">💣 <span>${p.maxBombs}</span></div>
            <div class="indicator" title="Fire Range">🔥 <span>${p.fireRange}</span></div>
          </div>
        </div>
      `;
    }).join('');

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    leaderboard.innerHTML = sorted.map((p, idx) => {
      const isLocalP1 = (this.mode === 'online' ? p.id === currentUser.id : p.id === 'player_1');
      const isLocalP2 = (p.id === 'player_2');
      const highlightClass = isLocalP1 ? 'highlight-1' : isLocalP2 ? 'highlight-2' : '';
      return `
        <div class="leaderboard-item ${highlightClass}">
          <span>#${idx + 1} ${p.avatar} ${p.name.substring(0, 10)}</span>
          <span class="score">${p.score}</span>
        </div>
      `;
    }).join('');
  }

  endMatch(winner, reason = "") {
    this.running = false;
    sound.stopBGM();
    clearInterval(this.timerInterval);
    setTimeout(() => { this.onGameOver(winner, reason); }, 1500);
  }

  togglePause() {
    if (this.mode === 'online') return false; // Disable pausing in online multiplayer
    this.paused = !this.paused;
    document.getElementById('arena-message').innerText = this.paused ? "GAME PAUSED" : "";
    return this.paused;
  }

  destroy() {
    this.running = false;
    sound.stopBGM();
    clearInterval(this.timerInterval);
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    
    // Clear WebSockets event listeners
    this.setupListeners.forEach(listener => {
      socket.off(listener.event, listener.fn);
    });
    this.setupListeners = [];
  }
}

/* ==========================================================================
   APP SCREENS ORCHESTRATION & ONLINE LOBBY MANAGER
   ========================================================================== */
class App {
  constructor() {
    this.mode = 'solo';
    this.selectedChars = [null, null];
    this.activeGame = null;
    this.currentRoom = null;
    
    this.setupMenuHandlers();
    this.setupCharacterSelect();
    this.setupGameControls();
    this.setupAuthHandlers();
    this.setupLobbyHandlers();
    this.setupRoomHandlers();
    this.setupSocketHandlers();

    // Check if user already logged in previously
    this.checkAutoLogin();
  }

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    setTimeout(() => { target.classList.add('active'); }, 50);
  }

  setupMenuHandlers() {
    document.getElementById('btn-solo').addEventListener('click', () => {
      this.mode = 'solo';
      this.selectedChars = [CHARACTERS[0], null];
      this.switchScreen('char-select-screen');
      this.renderCharacterGrid();
    });

    document.getElementById('btn-local').addEventListener('click', () => {
      this.mode = 'local';
      this.selectedChars = [CHARACTERS[0], CHARACTERS[1]];
      this.switchScreen('char-select-screen');
      this.renderCharacterGrid();
    });

    document.getElementById('btn-online').addEventListener('click', () => {
      this.mode = 'online';
      if (currentUser) {
        this.enterLobby();
      } else {
        this.switchScreen('auth-screen');
      }
    });

    const modal = document.getElementById('how-modal');
    document.getElementById('btn-how').addEventListener('click', () => { modal.classList.remove('hidden'); });
    document.querySelector('.close-btn').addEventListener('click', () => { modal.classList.add('hidden'); });
    window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  }

  /* ==========================================================================
     AUTHENTICATION HANDLERS
     ========================================================================== */
  setupAuthHandlers() {
    let authMode = 'login'; // 'login' or 'register'
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authTitle = document.getElementById('auth-title');
    const authForm = document.getElementById('auth-form');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const errorMsg = document.getElementById('auth-error-msg');

    tabLogin.addEventListener('click', () => {
      authMode = 'login';
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      authTitle.innerText = 'ACCESS DENIED';
      btnSubmit.innerText = 'AUTHORIZE';
      errorMsg.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
      authMode = 'register';
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      authTitle.innerText = 'CREATE PROFILE';
      btnSubmit.innerText = 'REGISTER';
      errorMsg.classList.add('hidden');
    });

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;

      errorMsg.classList.add('hidden');

      try {
        const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
        const res = await fetch(BACKEND_URL + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.error) {
          errorMsg.innerText = data.error;
          errorMsg.classList.remove('hidden');
        } else {
          // Success login
          localStorage.setItem('boom_neon_token', data.token);
          currentUser = {
            id: data.user.id,
            username: data.user.username,
            wins: data.user.wins,
            kills: data.user.kills,
            token: data.token
          };
          this.enterLobby();
        }
      } catch (err) {
        errorMsg.innerText = 'Cannot connect to Server!';
        errorMsg.classList.remove('hidden');
      }
    });

    document.getElementById('btn-auth-back').addEventListener('click', () => {
      this.switchScreen('menu-screen');
    });
  }

  async checkAutoLogin() {
    const token = localStorage.getItem('boom_neon_token');
    if (!token) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.error) {
        currentUser = {
          id: data.id,
          username: data.username,
          wins: data.wins,
          kills: data.kills,
          token: token
        };
      } else {
        localStorage.removeItem('boom_neon_token');
      }
    } catch (err) {
      console.warn('Backend server offline, auto-login skipped.');
    }
  }

  enterLobby() {
    this.switchScreen('lobby-screen');
    
    // Connect WebSockets
    if (!socket.connected) {
      socket.connect();
      socket.emit('authenticate', { id: currentUser.id, username: currentUser.username });
    }

    // Refresh UI
    document.getElementById('profile-username').innerText = currentUser.username;
    document.getElementById('profile-wins').innerText = currentUser.wins;
    document.getElementById('profile-kills').innerText = currentUser.kills;

    // Load rooms list & leaderboard
    socket.emit('get_rooms');
    this.loadGlobalLeaderboard();
  }

  async loadGlobalLeaderboard() {
    const leaderboardEl = document.getElementById('global-leaderboard');
    try {
      const res = await fetch(BACKEND_URL + '/api/leaderboard');
      const data = await res.json();
      leaderboardEl.innerHTML = data.map((u, idx) => `
        <div class="leaderboard-row">
          <span>#${idx + 1} 👤 ${u.username}</span>
          <span>Wins: ${u.wins}</span>
        </div>
      `).join('');
    } catch (err) {
      leaderboardEl.innerHTML = '<div class="no-rooms">Failed to load leaderboard</div>';
    }
  }

  /* ==========================================================================
     LOBBY HANDLERS
     ========================================================================== */
  setupLobbyHandlers() {
    document.getElementById('btn-create-room').addEventListener('click', () => {
      socket.emit('create_room', { characterId: 'cyber_boy' });
    });

    document.getElementById('btn-join-code').addEventListener('click', () => {
      const code = document.getElementById('join-code-input').value.trim();
      if (code.length === 4) {
        socket.emit('join_room', { roomCode: code, characterId: 'cyber_boy' });
      }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('boom_neon_token');
      currentUser = null;
      if (socket.connected) socket.disconnect();
      this.switchScreen('menu-screen');
    });

    document.getElementById('btn-lobby-back').addEventListener('click', () => {
      if (socket.connected) socket.disconnect();
      this.switchScreen('menu-screen');
    });
  }

  /* ==========================================================================
     ROOM WAITING HANDLERS
     ========================================================================== */
  setupRoomHandlers() {
    document.getElementById('btn-room-leave').addEventListener('click', () => {
      socket.emit('leave_room');
      this.enterLobby();
    });

    document.getElementById('btn-room-ready').addEventListener('click', () => {
      socket.emit('toggle_ready');
    });

    document.getElementById('btn-room-start').addEventListener('click', () => {
      // Host generates the map and sends it
      const tempGame = new Game('solo', [CHARACTERS[0]], () => {});
      const initialGrid = tempGame.grid;
      tempGame.destroy(); // garbage collect immediately
      
      socket.emit('start_game', { grid: initialGrid });
    });
  }

  renderRoomWaitingUI() {
    if (!this.currentRoom) return;
    const pilotsList = document.getElementById('room-pilots-list');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const btnReady = document.getElementById('btn-room-ready');
    const btnStart = document.getElementById('btn-room-start');

    roomCodeDisplay.innerText = this.currentRoom.code;

    // Render 4 pilot slots
    let html = '';
    for (let i = 0; i < 4; i++) {
      const p = this.currentRoom.players[i];
      if (p) {
        const charConfig = CHARACTERS.find(c => c.id === p.characterId) || CHARACTERS[0];
        const isHost = (p.id === this.currentRoom.hostId);
        const readyText = isHost ? 'HOST' : (p.ready ? 'READY' : 'WAITING');
        html += `
          <div class="pilot-card ${p.ready || isHost ? 'ready' : ''}">
            ${isHost ? '<span class="host-tag">HOST</span>' : ''}
            <div class="chibi">${charConfig.avatar}</div>
            <div class="username">${p.username}</div>
            <div class="ready-status">${readyText}</div>
          </div>
        `;
      } else {
        html += `
          <div class="pilot-card empty">
            <span>EMPTY SLOT</span>
          </div>
        `;
      }
    }
    pilotsList.innerHTML = html;

    // Character Circles rendering
    const charSelectContainer = document.getElementById('room-char-list');
    const myPlayer = this.currentRoom.players.find(p => p.id === currentUser.id);
    charSelectContainer.innerHTML = CHARACTERS.map(c => `
      <div class="char-circle-item ${myPlayer?.characterId === c.id ? 'selected' : ''}" data-id="${c.id}" title="${c.name}">
        ${c.avatar}
      </div>
    `).join('');

    // Attach click triggers on character circles
    charSelectContainer.querySelectorAll('.char-circle-item').forEach(circle => {
      circle.addEventListener('click', () => {
        const charId = circle.getAttribute('data-id');
        socket.emit('change_character', { characterId: charId });
      });
    });

    // Check host actions
    const isMeHost = (this.currentRoom.hostId === currentUser.id);
    if (isMeHost) {
      btnReady.classList.add('hidden');
      btnStart.classList.remove('hidden');
      const allReady = this.currentRoom.players.every(p => p.ready);
      if (allReady) {
        btnStart.classList.remove('disabled');
        btnStart.removeAttribute('disabled');
      } else {
        btnStart.classList.add('disabled');
        btnStart.setAttribute('disabled', 'true');
      }
    } else {
      btnStart.classList.add('hidden');
      btnReady.classList.remove('hidden');
      btnReady.innerText = myPlayer?.ready ? 'UNREADY' : 'READY';
      if (myPlayer?.ready) {
        btnReady.classList.add('secondary');
      } else {
        btnReady.classList.remove('secondary');
      }
    }
  }

  /* ==========================================================================
     SOCKET.IO NET NET EVENTS
     ========================================================================== */
  setupSocketHandlers() {
    socket.on('room_created', (room) => {
      this.currentRoom = room;
      this.switchScreen('room-screen');
      this.renderRoomWaitingUI();
    });

    socket.on('room_update', (room) => {
      this.currentRoom = room;
      this.renderRoomWaitingUI();
    });

    socket.on('join_error', (msg) => {
      alert(msg);
    });

    socket.on('game_start', ({ grid, players }) => {
      this.switchScreen('game-screen');
      if (this.activeGame) this.activeGame.destroy();
      
      // Start multiplayer online game engine
      this.activeGame = new Game('online', { grid, players }, (winner, reason) => {
        this.handleGameOver(winner, reason);
      });
    });

    socket.on('game_over', ({ roomUpdate }) => {
      if (roomUpdate) {
        this.currentRoom = roomUpdate;
      }
    });

    socket.on('room_list', (list) => {
      const container = document.getElementById('rooms-list-container');
      if (!container) return;

      if (list.length === 0) {
        container.innerHTML = '<div class="no-rooms">No active rooms. Create one to start!</div>';
        return;
      }

      container.innerHTML = list.map(r => `
        <div class="room-row">
          <div class="room-info">
            <span class="room-name">Battle Room #${r.code}</span>
            <span class="room-details">Host: ${r.hostName} | Status: ${r.status.toUpperCase()}</span>
          </div>
          <button class="neon-btn info small join-btn-lobby" data-code="${r.code}" ${r.status === 'playing' || r.playerCount >= 4 ? 'disabled' : ''}>
            ${r.status === 'playing' ? 'PLAYING' : r.playerCount >= 4 ? 'FULL' : 'JOIN'}
          </button>
        </div>
      `).join('');

      container.querySelectorAll('.join-btn-lobby').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-code');
          socket.emit('join_room', { roomCode: code, characterId: 'cyber_boy' });
        });
      });
    });
  }

  /* ==========================================================================
     LOCAL / OFFLINE CHARACTER GRID RENDERING
     ========================================================================== */
  renderCharacterGrid() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = CHARACTERS.map(char => {
      const isP1 = this.selectedChars[0]?.id === char.id;
      const isP2 = this.selectedChars[1]?.id === char.id;
      let badge = '';
      let cardClass = '';
      if (isP1) {
        badge = `<span class="char-badge p1">P1 READY</span>`;
        cardClass = 'selected';
      } else if (isP2 && this.mode === 'local') {
        badge = `<span class="char-badge p2">P2 READY</span>`;
        cardClass = 'selected-p2';
      }

      return `
        <div class="char-card glass-card ${cardClass}" data-id="${char.id}">
          ${badge}
          <div class="char-avatar-container">${char.avatar}</div>
          <h3>${char.name}</h3>
          <div class="char-stats">
            <div class="stat-row">
              <span>SPEED</span>
              <div class="stat-bar"><div class="stat-fill" style="width: ${(char.stats.speed / 6) * 100}%"></div></div>
            </div>
            <div class="stat-row">
              <span>BOMBS</span>
              <div class="stat-bar"><div class="stat-fill" style="width: ${(char.stats.bombCount / 4) * 100}%"></div></div>
            </div>
            <div class="stat-row">
              <span>FIRE RANGE</span>
              <div class="stat-bar"><div class="stat-fill" style="width: ${(char.stats.fireRange / 5) * 100}%"></div></div>
            </div>
            <div class="stat-row">
              <span>LIVES</span>
              <div class="stat-bar"><div class="stat-fill" style="width: ${(char.stats.lives / 5) * 100}%"></div></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const picked = CHARACTERS.find(c => c.id === id);
        if (this.mode === 'solo') {
          this.selectedChars[0] = picked;
        } else {
          if (this.selectedChars[0].id === id) {
            // No-op
          } else {
            this.selectedChars[1] = picked;
          }
        }
        this.renderCharacterGrid();
        this.validateReadyState();
      });
    });

    this.validateReadyState();
  }

  validateReadyState() {
    const readyBtn = document.getElementById('btn-char-ready');
    if (this.mode === 'solo' && this.selectedChars[0]) {
      readyBtn.classList.remove('disabled');
      readyBtn.removeAttribute('disabled');
    } else if (this.mode === 'local' && this.selectedChars[0] && this.selectedChars[1]) {
      readyBtn.classList.remove('disabled');
      readyBtn.removeAttribute('disabled');
    } else {
      readyBtn.classList.add('disabled');
      readyBtn.setAttribute('disabled', 'true');
    }
  }

  setupCharacterSelect() {
    document.getElementById('btn-char-back').addEventListener('click', () => {
      this.switchScreen('menu-screen');
    });

    document.getElementById('btn-char-ready').addEventListener('click', () => {
      this.switchScreen('game-screen');
      this.startGame();
    });
  }

  startGame() {
    if (this.activeGame) this.activeGame.destroy();
    this.activeGame = new Game(this.mode, this.selectedChars, (winner, reason) => {
      this.handleGameOver(winner, reason);
    });
  }

  setupGameControls() {
    const pauseBtn = document.getElementById('btn-pause');
    pauseBtn.addEventListener('click', () => {
      if (this.activeGame) {
        const isPaused = this.activeGame.togglePause();
        pauseBtn.innerText = isPaused ? "▶️" : "⏸️";
      }
    });

    const muteBtn = document.getElementById('btn-mute');
    muteBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      muteBtn.innerText = isMuted ? "🔇" : "🔊";
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
      if (confirm("Are you sure you want to quit the match?")) {
        if (this.activeGame) this.activeGame.destroy();
        if (this.mode === 'online') {
          socket.emit('leave_room');
          this.enterLobby();
        } else {
          this.switchScreen('menu-screen');
        }
      }
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.mode === 'online') {
        // Online players must go back to waiting room
        this.switchScreen('room-screen');
        this.renderRoomWaitingUI();
      } else {
        this.switchScreen('game-screen');
        this.startGame();
      }
    });

    document.getElementById('btn-menu').addEventListener('click', () => {
      if (this.mode === 'online') {
        socket.emit('leave_room');
        this.enterLobby();
      } else {
        this.switchScreen('menu-screen');
      }
    });
  }

  handleGameOver(winner, reason) {
    this.switchScreen('gameover-screen');
    const title = document.getElementById('gameover-title');
    const subtitle = document.getElementById('gameover-subtitle');
    const summary = document.getElementById('match-summary');
    const restartBtn = document.getElementById('btn-restart');

    if (this.mode === 'online') {
      restartBtn.innerText = 'ROOM LOBBY';
    } else {
      restartBtn.innerText = 'REPLAY';
    }

    if (reason === "TIME IS UP!") {
      title.innerText = "TIME OUT!";
      subtitle.innerText = "The match ended in a draw.";
      sound.playLose();
    } else if (winner) {
      title.innerText = "VICTORY!";
      const localPlayerId = this.mode === 'online' ? currentUser.id : 'player_1';
      const isMeWinner = (winner.id === localPlayerId);
      subtitle.innerText = isMeWinner ? `You won the neon battle!` : `${winner.name} won the neon battle!`;
      if (isMeWinner) sound.playWin();
      else sound.playLose();
    } else {
      title.innerText = "DRAW GAME!";
      subtitle.innerText = "All players were vaporized simultaneously.";
      sound.playLose();
    }

    const sorted = [...this.activeGame.players].sort((a, b) => b.score - a.score);
    summary.innerHTML = sorted.map((p, idx) => {
      const isWinner = winner && p.id === winner.id;
      return `
        <div class="summary-row ${isWinner ? 'winner' : ''}">
          <span>#${idx + 1} ${p.avatar} ${p.name} ${isWinner ? '🏆' : ''}</span>
          <span>Score: ${p.score} (Kills: ${p.kills})</span>
        </div>
      `;
    }).join('');

    // If online, update local currentStats
    if (this.mode === 'online') {
      const myP = this.activeGame.players.find(p => p.id === currentUser.id);
      if (myP) {
        currentUser.kills += myP.kills;
        if (winner && winner.id === currentUser.id) currentUser.wins += 1;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
