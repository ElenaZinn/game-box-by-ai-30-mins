const {
  Engine,
  World,
  Bodies,
  Body,
  Composite,
  Events,
  Vector,
} = Matter;

const board = document.getElementById("board");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");
const statusText = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");
const againBtn = document.getElementById("againBtn");
const gameOverPanel = document.getElementById("gameOver");
const soundToggle = document.getElementById("soundToggle");
const catdexGrid = document.getElementById("catdexGrid");

const CAT_TIERS = [
  { name: "豆豆", radius: 17, score: 1, fur: "#c6a15d", stripe: "#6d4b2d", ear: "#a56d63", eye: "#3f4b58" },
  { name: "糯糯", radius: 23, score: 3, fur: "#a86a55", stripe: "#603830", ear: "#b17a6e", eye: "#465d52" },
  { name: "橘宝", radius: 30, score: 7, fur: "#b8793b", stripe: "#5f3a24", ear: "#a7675e", eye: "#53614b" },
  { name: "奶盖", radius: 38, score: 14, fur: "#d8c9aa", stripe: "#7b6148", ear: "#b98b7b", eye: "#4d5c70" },
  { name: "虎虎", radius: 47, score: 28, fur: "#9b5f35", stripe: "#3b2b22", ear: "#9d695e", eye: "#59654a" },
  { name: "蓝莓", radius: 57, score: 56, fur: "#65778a", stripe: "#344452", ear: "#8f7580", eye: "#313642" },
  { name: "芝士", radius: 68, score: 112, fur: "#b89447", stripe: "#6f4b2b", ear: "#a86f60", eye: "#4b593c" },
  { name: "团长", radius: 80, score: 224, fur: "#756386", stripe: "#3f344e", ear: "#8d6f7c", eye: "#314d4d" },
  { name: "猫王", radius: 94, score: 448, fur: "#242521", stripe: "#a5823b", ear: "#7f4f5a", eye: "#b7893f" },
];

const MAX_SPAWN_LEVEL = 3;
const FAIL_GRACE = 1500;
const DROP_COOLDOWN = 430;
const STORAGE_KEY = "merge-cats-best-score";

let engine;
let runnerFrame = 0;
let walls = [];
let width = 0;
let height = 0;
let dpr = 1;
let dropX = 0;
let currentLevel = 0;
let nextLevel = 1;
let canDropAt = 0;
let score = 0;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let gameOver = false;
let failStartedAt = null;
let particles = [];
let unlocked = new Set([0]);
let lastTime = performance.now();

function init() {
  bestText.textContent = String(best);
  createCatdex();
  setupEngine();
  resize();
  restart();
  bindEvents();
  requestAnimationFrame(loop);
}

function setupEngine() {
  engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 1.05;

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      maybeMerge(pair.bodyA, pair.bodyB);
    }
  });
}

function bindEvents() {
  window.addEventListener("resize", resize);
  restartBtn.addEventListener("click", restart);
  againBtn.addEventListener("click", restart);
  board.addEventListener("pointermove", onPointerMove);
  board.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      dropCat();
    }
    if (event.key.toLowerCase() === "r") {
      restart();
    }
  });
}

function resize() {
  const rect = board.getBoundingClientRect();
  width = Math.max(300, rect.width);
  height = Math.max(460, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dropX = clamp(dropX || width / 2, 42, width - 42);
  buildWalls();
}

function buildWalls() {
  if (!engine) return;
  if (walls.length) {
    World.remove(engine.world, walls);
  }
  const t = 54;
  walls = [
    Bodies.rectangle(-t / 2, height / 2, t, height * 2, { isStatic: true, label: "wall" }),
    Bodies.rectangle(width + t / 2, height / 2, t, height * 2, { isStatic: true, label: "wall" }),
    Bodies.rectangle(width / 2, height + t / 2 - 8, width + t * 2, t, { isStatic: true, label: "floor" }),
  ];
  World.add(engine.world, walls);
}

function restart() {
  const all = Composite.allBodies(engine.world).filter((body) => body.label !== "wall" && body.label !== "floor");
  World.remove(engine.world, all);
  particles = [];
  score = 0;
  failStartedAt = null;
  gameOver = false;
  canDropAt = performance.now() + 250;
  currentLevel = randomSpawnLevel();
  nextLevel = randomSpawnLevel();
  unlocked = new Set([0]);
  updateHud();
  updateCatdex();
  gameOverPanel.hidden = true;
  statusText.textContent = "READY";
}

function onPointerMove(event) {
  const rect = board.getBoundingClientRect();
  dropX = clamp(event.clientX - rect.left, 42, width - 42);
}

function onPointerDown(event) {
  onPointerMove(event);
  dropCat();
}

function dropCat() {
  if (gameOver || performance.now() < canDropAt) return;
  const tier = CAT_TIERS[currentLevel];
  const body = Bodies.circle(dropX, 44, tier.radius, {
    label: "cat",
    restitution: 0.18,
    friction: 0.58,
    frictionAir: 0.012,
    density: 0.0012 + currentLevel * 0.00018,
    chamfer: { radius: tier.radius },
  });
  body.plugin = {
    level: currentLevel,
    bornAt: performance.now(),
    merging: false,
    wobble: Math.random() * Math.PI * 2,
  };
  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
  World.add(engine.world, body);
  playTone(220 + currentLevel * 36, 0.035, "triangle");

  currentLevel = nextLevel;
  nextLevel = randomSpawnLevel();
  canDropAt = performance.now() + DROP_COOLDOWN;
  updateHud();
}

function randomSpawnLevel() {
  const roll = Math.random();
  if (roll < 0.60) return 0;
  if (roll < 0.84) return 1;
  if (roll < 0.96) return 2;
  return MAX_SPAWN_LEVEL;
}

function maybeMerge(a, b) {
  if (gameOver || a.label !== "cat" || b.label !== "cat") return;
  const pa = a.plugin || {};
  const pb = b.plugin || {};
  if (pa.merging || pb.merging || pa.level !== pb.level) return;
  if (pa.level >= CAT_TIERS.length - 1) return;
  const now = performance.now();
  if (now - pa.bornAt < 120 || now - pb.bornAt < 120) return;

  const distance = Vector.magnitude(Vector.sub(a.position, b.position));
  const maxDistance = (CAT_TIERS[pa.level].radius * 2.25);
  if (distance > maxDistance) return;

  pa.merging = true;
  pb.merging = true;

  const level = pa.level + 1;
  const x = (a.position.x + b.position.x) / 2;
  const y = (a.position.y + b.position.y) / 2;
  const vx = (a.velocity.x + b.velocity.x) / 2;
  const vy = (a.velocity.y + b.velocity.y) / 2;

  World.remove(engine.world, [a, b]);
  const tier = CAT_TIERS[level];
  const merged = Bodies.circle(x, y, tier.radius, {
    label: "cat",
    restitution: 0.16,
    friction: 0.6,
    frictionAir: 0.012,
    density: 0.00135 + level * 0.00019,
  });
  merged.plugin = {
    level,
    bornAt: now,
    merging: false,
    wobble: Math.random() * Math.PI * 2,
    popUntil: now + 240,
  };
  Body.setVelocity(merged, { x: vx * 0.6, y: Math.min(vy * 0.35 - 2.2, -1.4) });
  World.add(engine.world, merged);

  score += tier.score;
  best = Math.max(best, score);
  localStorage.setItem(STORAGE_KEY, String(best));
  unlocked.add(level);
  burst(x, y, tier);
  playTone(360 + level * 44, 0.065, "sine");
  updateHud();
  updateCatdex();
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(best);
  drawNext();
}

function createCatdex() {
  catdexGrid.innerHTML = "";
  CAT_TIERS.forEach((tier, level) => {
    const item = document.createElement("div");
    item.className = "catdex-item";
    item.dataset.level = String(level);
    const c = document.createElement("canvas");
    c.width = 86;
    c.height = 86;
    item.appendChild(c);
    catdexGrid.appendChild(item);
    drawCat(c.getContext("2d"), 43, 43, Math.min(30, tier.radius * 0.72), level, 0, 1);
  });
}

function updateCatdex() {
  document.querySelectorAll(".catdex-item").forEach((item) => {
    const level = Number(item.dataset.level);
    item.classList.toggle("unlocked", unlocked.has(level));
  });
}

function drawNext() {
  const s = nextCanvas.width;
  nextCtx.clearRect(0, 0, s, s);
  drawCat(nextCtx, s / 2, s / 2 + 4, CAT_TIERS[currentLevel].radius * 1.28, currentLevel, 0, 1);
}

function loop(now) {
  const dt = Math.min(32, now - lastTime);
  lastTime = now;
  Engine.update(engine, dt);
  checkFailure(now);
  draw(now);
  requestAnimationFrame(loop);
}

function checkFailure(now) {
  if (gameOver) return;
  const dangerY = 86;
  const bodies = Composite.allBodies(engine.world).filter((body) => body.label === "cat");
  const inDanger = bodies.some((body) => {
    const radius = CAT_TIERS[body.plugin.level].radius;
    const settled = Math.abs(body.velocity.y) < 0.35 && body.position.y > 80;
    return settled && body.position.y - radius < dangerY;
  });
  if (!inDanger) {
    failStartedAt = null;
    statusText.textContent = "PLAY";
    return;
  }
  failStartedAt = failStartedAt || now;
  statusText.textContent = "DANGER";
  if (now - failStartedAt > FAIL_GRACE) {
    gameOver = true;
    gameOverPanel.hidden = false;
    statusText.textContent = "FULL";
    playTone(130, 0.18, "sawtooth");
  }
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  drawBowl();
  drawGhost(now);

  const bodies = Composite.allBodies(engine.world);
  for (const body of bodies) {
    if (body.label !== "cat") continue;
    const level = body.plugin.level;
    const tier = CAT_TIERS[level];
    const pop = body.plugin.popUntil && body.plugin.popUntil > now
      ? 1 + (body.plugin.popUntil - now) / 240 * 0.18
      : 1;
    drawCat(ctx, body.position.x, body.position.y, tier.radius * pop, level, body.angle, 1);
  }

  drawParticles();
}

function drawBowl() {
  ctx.save();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(25, 32, 35, 0.24)";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(13, 2);
  ctx.lineTo(13, height - 18);
  ctx.quadraticCurveTo(width / 2, height + 11, width - 13, height - 18);
  ctx.lineTo(width - 13, 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
  ctx.beginPath();
  ctx.moveTo(20, 8);
  ctx.lineTo(20, height - 28);
  ctx.quadraticCurveTo(width / 2, height - 2, width - 20, height - 28);
  ctx.lineTo(width - 20, 8);
  ctx.stroke();
  ctx.restore();
}

function drawGhost(now) {
  if (gameOver || now < canDropAt - 40) return;
  const tier = CAT_TIERS[currentLevel];
  ctx.save();
  ctx.globalAlpha = 0.64;
  ctx.setLineDash([7, 7]);
  ctx.strokeStyle = "rgba(25, 32, 35, 0.28)";
  ctx.beginPath();
  ctx.moveTo(dropX, 28);
  ctx.lineTo(dropX, Math.min(height - 24, 140));
  ctx.stroke();
  ctx.setLineDash([]);
  drawCat(ctx, dropX, 43, tier.radius, currentLevel, Math.sin(now / 240) * 0.05, 0.72);
  ctx.restore();
}

function drawCat(target, x, y, radius, level, angle = 0, alpha = 1) {
  const tier = CAT_TIERS[level];
  target.save();
  target.translate(x, y);
  target.rotate(angle);
  target.globalAlpha *= alpha;

  const r = radius;
  const stripe = tier.stripe;
  const fur = tier.fur;
  const ear = tier.ear;
  const eye = tier.eye;

  target.fillStyle = "rgba(30, 25, 20, 0.14)";
  target.beginPath();
  target.ellipse(0, r * 0.77, r * 0.84, r * 0.18, 0, 0, Math.PI * 2);
  target.fill();

  target.fillStyle = fur;
  target.strokeStyle = "rgba(25, 32, 35, 0.20)";
  target.lineWidth = Math.max(1.4, r * 0.055);

  drawEar(target, -r * 0.48, -r * 0.48, r, fur, ear, -0.2);
  drawEar(target, r * 0.48, -r * 0.48, r, fur, ear, 0.2);

  target.beginPath();
  target.arc(0, 0, r, 0, Math.PI * 2);
  target.fill();
  target.stroke();

  target.fillStyle = "rgba(255, 255, 255, 0.38)";
  target.beginPath();
  target.ellipse(-r * 0.18, r * 0.18, r * 0.48, r * 0.34, -0.22, 0, Math.PI * 2);
  target.fill();

  target.strokeStyle = stripe;
  target.lineWidth = Math.max(1.5, r * 0.07);
  target.lineCap = "round";
  for (let i = -1; i <= 1; i += 1) {
    target.beginPath();
    target.moveTo(i * r * 0.18, -r * 0.82);
    target.quadraticCurveTo(i * r * 0.13, -r * 0.58, i * r * 0.08, -r * 0.43);
    target.stroke();
  }
  target.lineWidth = Math.max(1.1, r * 0.045);
  for (const side of [-1, 1]) {
    target.beginPath();
    target.moveTo(side * r * 0.78, -r * 0.06);
    target.quadraticCurveTo(side * r * 0.54, -r * 0.14, side * r * 0.4, -r * 0.24);
    target.stroke();
  }

  drawEye(target, -r * 0.34, -r * 0.1, r, eye);
  drawEye(target, r * 0.34, -r * 0.1, r, eye);

  target.fillStyle = "#f08372";
  target.beginPath();
  target.moveTo(0, r * 0.14);
  target.quadraticCurveTo(-r * 0.11, r * 0.08, -r * 0.15, r * 0.18);
  target.quadraticCurveTo(0, r * 0.27, r * 0.15, r * 0.18);
  target.quadraticCurveTo(r * 0.11, r * 0.08, 0, r * 0.14);
  target.fill();

  target.strokeStyle = "rgba(38, 28, 26, 0.78)";
  target.lineWidth = Math.max(1.1, r * 0.045);
  target.beginPath();
  target.moveTo(0, r * 0.22);
  target.lineTo(0, r * 0.34);
  target.moveTo(0, r * 0.34);
  target.quadraticCurveTo(-r * 0.16, r * 0.46, -r * 0.31, r * 0.32);
  target.moveTo(0, r * 0.34);
  target.quadraticCurveTo(r * 0.16, r * 0.46, r * 0.31, r * 0.32);
  target.stroke();

  target.strokeStyle = "rgba(255, 255, 255, 0.86)";
  target.lineWidth = Math.max(0.8, r * 0.028);
  for (const side of [-1, 1]) {
    for (const offset of [-0.12, 0, 0.12]) {
      target.beginPath();
      target.moveTo(side * r * 0.22, r * (0.19 + offset));
      target.lineTo(side * r * 0.92, r * (0.05 + offset * 0.7));
      target.stroke();
    }
  }

  if (level >= CAT_TIERS.length - 1) {
    drawCrown(target, 0, -r * 1.08, r * 0.52);
  }

  target.restore();
}

function drawEar(target, x, y, r, fur, inner, tilt) {
  target.save();
  target.translate(x, y);
  target.rotate(tilt);
  target.fillStyle = fur;
  target.beginPath();
  target.moveTo(0, -r * 0.62);
  target.lineTo(-r * 0.35, r * 0.14);
  target.quadraticCurveTo(0, r * 0.34, r * 0.35, r * 0.14);
  target.closePath();
  target.fill();
  target.stroke();
  target.fillStyle = inner;
  target.beginPath();
  target.moveTo(0, -r * 0.34);
  target.lineTo(-r * 0.18, r * 0.08);
  target.quadraticCurveTo(0, r * 0.17, r * 0.18, r * 0.08);
  target.closePath();
  target.fill();
  target.restore();
}

function drawEye(target, x, y, r, color) {
  target.fillStyle = "#fff9e8";
  target.beginPath();
  target.ellipse(x, y, r * 0.18, r * 0.23, 0, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = color;
  target.beginPath();
  target.ellipse(x, y + r * 0.01, r * 0.125, r * 0.16, 0, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = "#15191b";
  target.beginPath();
  target.ellipse(x, y + r * 0.015, r * 0.07, r * 0.13, 0, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = "rgba(255, 255, 255, 0.92)";
  target.beginPath();
  target.arc(x + r * 0.055, y - r * 0.07, r * 0.045, 0, Math.PI * 2);
  target.fill();
}

function drawCrown(target, x, y, size) {
  target.save();
  target.translate(x, y);
  target.fillStyle = "#f0c64d";
  target.strokeStyle = "rgba(73, 51, 12, 0.45)";
  target.lineWidth = 2;
  target.beginPath();
  target.moveTo(-size * 0.62, size * 0.2);
  target.lineTo(-size * 0.42, -size * 0.36);
  target.lineTo(-size * 0.08, size * 0.04);
  target.lineTo(size * 0.18, -size * 0.46);
  target.lineTo(size * 0.42, size * 0.05);
  target.lineTo(size * 0.66, -size * 0.28);
  target.lineTo(size * 0.52, size * 0.2);
  target.closePath();
  target.fill();
  target.stroke();
  target.restore();
}

function burst(x, y, tier) {
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.24;
    const speed = 1.6 + Math.random() * 3.2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: i % 3 === 0 ? tier.stripe : tier.fur,
      radius: 2 + Math.random() * 3,
    });
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.035;
    p.life -= 0.025;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let audioCtx;
function playTone(freq, duration, type) {
  if (!soundToggle.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (error) {
    soundToggle.checked = false;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init(); 
