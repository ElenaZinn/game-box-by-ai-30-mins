const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const levelCode = document.getElementById("levelCode");
const levelName = document.getElementById("levelName");
const pieceCount = document.getElementById("pieceCount");
const distanceRead = document.getElementById("distanceRead");
const puzzleEl = document.getElementById("puzzle");
const logEl = document.getElementById("log");
const toastEl = document.getElementById("toast");
const startOverlay = document.getElementById("startOverlay");
const endOverlay = document.getElementById("endOverlay");
const beginButton = document.getElementById("beginButton");
const helpButton = document.getElementById("helpButton");
const soundButton = document.getElementById("soundButton");
const pulseButton = document.getElementById("pulseButton");
const nextButton = document.getElementById("nextButton");
const resetButton = document.getElementById("resetButton");
const replayButton = document.getElementById("replayButton");
const stayButton = document.getElementById("stayButton");
const rulesDialog = document.getElementById("rulesDialog");
const rulesCloseButton = document.getElementById("rulesCloseButton");
const rulesStartButton = document.getElementById("rulesStartButton");

const SAVE_KEY = "soundblind.echoPuzzle.v1";
const RULES_SEEN_KEY = "soundblind.echoPuzzle.rulesSeen.v1";
const WORLD = { w: 100, h: 68 };
const PIECES = 6;

const LEVELS = [
  {
    name: "静音玄关",
    start: { x: 16, y: 35 },
    target: { x: 76, y: 39 },
    tone: 622,
    color: "#c9a75a",
    echo: 0.9,
    rate: 1150,
    radius: 6.4,
    decoys: [],
    walls: [],
  },
  {
    name: "双声走廊",
    start: { x: 78, y: 54 },
    target: { x: 23, y: 19 },
    tone: 704,
    color: "#9fbd8a",
    echo: 1.05,
    rate: 1220,
    radius: 6.1,
    decoys: [
      { x: 72, y: 16, tone: 326 },
      { x: 49, y: 51, tone: 412 },
    ],
    walls: [],
  },
  {
    name: "窄墙回声",
    start: { x: 14, y: 54 },
    target: { x: 84, y: 16 },
    tone: 554,
    color: "#82a7bd",
    echo: 1.3,
    rate: 1320,
    radius: 5.9,
    decoys: [{ x: 30, y: 17, tone: 392 }],
    walls: [
      { x: 39, y: 6, w: 4, h: 31 },
      { x: 39, y: 46, w: 4, h: 17 },
      { x: 63, y: 22, w: 4, h: 40 },
    ],
  },
  {
    name: "摆钟暗室",
    start: { x: 50, y: 57 },
    target: { x: 50, y: 18, move: { ax: 23, ay: 6, speed: 0.0016 } },
    tone: 784,
    color: "#d2a0a6",
    echo: 1.18,
    rate: 980,
    radius: 6,
    decoys: [
      { x: 18, y: 31, tone: 262 },
      { x: 82, y: 32, tone: 262 },
    ],
    walls: [
      { x: 23, y: 27, w: 18, h: 4 },
      { x: 59, y: 27, w: 18, h: 4 },
    ],
  },
  {
    name: "雨室",
    start: { x: 12, y: 14 },
    target: { x: 83, y: 55 },
    tone: 466,
    color: "#88a58f",
    echo: 1.45,
    rate: 1500,
    radius: 5.7,
    rain: true,
    decoys: [
      { x: 21, y: 52, tone: 370 },
      { x: 67, y: 18, tone: 415 },
    ],
    walls: [
      { x: 28, y: 10, w: 4, h: 42 },
      { x: 48, y: 24, w: 4, h: 35 },
      { x: 68, y: 7, w: 4, h: 40 },
    ],
  },
  {
    name: "黑盒",
    start: { x: 50, y: 34 },
    target: { x: 78, y: 16, move: { ax: 12, ay: 18, speed: 0.0012 } },
    tone: 831,
    color: "#c9a75a",
    echo: 1.75,
    rate: 1180,
    radius: 5.3,
    decoys: [
      { x: 18, y: 16, tone: 311 },
      { x: 18, y: 55, tone: 370 },
      { x: 78, y: 55, tone: 494 },
    ],
    walls: [
      { x: 38, y: 8, w: 4, h: 23 },
      { x: 38, y: 43, w: 4, h: 18 },
      { x: 59, y: 8, w: 4, h: 18 },
      { x: 59, y: 35, w: 4, h: 26 },
    ],
  },
];

const state = {
  dpr: 1,
  width: 1,
  height: 1,
  levelIndex: 0,
  pieces: Array(PIECES).fill(false),
  player: { x: 16, y: 35 },
  keys: new Set(),
  pointer: null,
  pulses: [],
  glints: [],
  wallHits: [],
  started: false,
  found: false,
  complete: false,
  lastTime: 0,
  nextBeaconAt: 0,
  nextRainAt: 0,
  bumpAt: 0,
  toastTimer: 0,
  completionAnnounced: false,
  audio: null,
  puzzleArt: "",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function worldToScreen(point) {
  return {
    x: (point.x / WORLD.w) * state.width,
    y: (point.y / WORLD.h) * state.height,
  };
}

function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(((x - rect.left) / rect.width) * WORLD.w, 0, WORLD.w),
    y: clamp(((y - rect.top) / rect.height) * WORLD.h, 0, WORLD.h),
  };
}

function currentLevel() {
  return LEVELS[state.levelIndex];
}

function movingTarget(level, time = performance.now()) {
  const base = level.target;
  if (!base.move) return { x: base.x, y: base.y };
  const t = time * base.move.speed;
  return {
    x: clamp(base.x + Math.sin(t) * base.move.ax, 6, WORLD.w - 6),
    y: clamp(base.y + Math.cos(t * 0.82) * base.move.ay, 6, WORLD.h - 6),
  };
}

function createPuzzleArt() {
  const art = document.createElement("canvas");
  art.width = 900;
  art.height = 600;
  const g = art.getContext("2d");

  const bg = g.createLinearGradient(0, 0, 900, 600);
  bg.addColorStop(0, "#15120e");
  bg.addColorStop(0.42, "#243020");
  bg.addColorStop(1, "#4d252d");
  g.fillStyle = bg;
  g.fillRect(0, 0, 900, 600);

  g.fillStyle = "rgba(201,167,90,0.14)";
  for (let i = 0; i < 45; i += 1) {
    const x = (i * 67) % 900;
    const y = (i * 131) % 600;
    g.beginPath();
    g.arc(x, y, 1 + (i % 5), 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "#d8c58d";
  g.beginPath();
  g.arc(678, 142, 86, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(21,18,14,0.82)";
  g.beginPath();
  g.arc(705, 119, 84, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(224,214,189,0.2)";
  g.lineWidth = 8;
  for (let r = 88; r < 380; r += 62) {
    g.beginPath();
    g.arc(455, 302, r, 0.15, Math.PI * 1.84);
    g.stroke();
  }

  g.fillStyle = "#080807";
  g.beginPath();
  g.ellipse(416, 392, 126, 88, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(505, 300, 70, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(462, 248);
  g.lineTo(480, 170);
  g.lineTo(522, 245);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(528, 247);
  g.lineTo(593, 190);
  g.lineTo(575, 280);
  g.closePath();
  g.fill();

  g.strokeStyle = "#080807";
  g.lineWidth = 28;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(308, 385);
  g.bezierCurveTo(230, 350, 230, 249, 322, 240);
  g.stroke();

  g.fillStyle = "#d8c58d";
  g.beginPath();
  g.arc(480, 294, 8, 0, Math.PI * 2);
  g.arc(533, 290, 8, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(216,197,141,0.58)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(502, 311);
  g.quadraticCurveTo(506, 319, 512, 311);
  g.stroke();

  g.fillStyle = "rgba(201,167,90,0.8)";
  g.font = "700 46px Georgia, serif";
  g.fillText("ECHO", 80, 114);
  g.font = "400 24px Georgia, serif";
  g.fillText("six fragments in the dark", 82, 154);

  return art.toDataURL("image/png");
}

function setupPuzzle() {
  state.puzzleArt = createPuzzleArt();
  puzzleEl.innerHTML = "";
  for (let i = 0; i < PIECES; i += 1) {
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.dataset.index = i;
    piece.style.backgroundImage = `url(${state.puzzleArt})`;
    piece.style.backgroundSize = "300% 200%";
    piece.style.backgroundPosition = `${(i % 3) * 50}% ${Math.floor(i / 3) * 100}%`;
    puzzleEl.appendChild(piece);
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    if (Array.isArray(save.pieces)) {
      state.pieces = Array.from({ length: PIECES }, (_, i) => Boolean(save.pieces[i]));
    }
    if (Number.isInteger(save.levelIndex)) {
      state.levelIndex = clamp(save.levelIndex, 0, LEVELS.length - 1);
    }
  } catch (error) {
    console.warn("Save ignored", error);
  }
}

function saveGame() {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      pieces: state.pieces,
      levelIndex: state.levelIndex,
    }),
  );
}

function resetGame() {
  state.levelIndex = 0;
  state.pieces = Array(PIECES).fill(false);
  state.complete = false;
  state.found = false;
  state.completionAnnounced = false;
  endOverlay.hidden = true;
  localStorage.removeItem(SAVE_KEY);
  startLevel(0);
  showToast("碎片归零");
  appendLog("新的回声开始。");
}

function startLevel(index) {
  state.levelIndex = clamp(index, 0, LEVELS.length - 1);
  const level = currentLevel();
  state.player = { ...level.start };
  state.pulses = [];
  state.glints = [];
  state.wallHits = [];
  state.found = Boolean(state.pieces[state.levelIndex]);
  state.complete = state.pieces.every(Boolean);
  state.nextBeaconAt = 0;
  state.nextRainAt = 0;
  updateUI();
  saveGame();
}

function nextUnfoundLevel() {
  const after = state.pieces.findIndex((piece, i) => !piece && i > state.levelIndex);
  if (after !== -1) return after;
  const first = state.pieces.findIndex((piece) => !piece);
  return first === -1 ? state.levelIndex : first;
}

function goNext() {
  if (state.complete) {
    resetGame();
    return;
  }
  startLevel(nextUnfoundLevel());
}

function appendLog(text) {
  const line = document.createElement("div");
  line.textContent = text;
  logEl.prepend(line);
  while (logEl.children.length > 4) {
    logEl.lastElementChild.remove();
  }
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1300);
}

function updateUI() {
  const level = currentLevel();
  const foundCount = state.pieces.filter(Boolean).length;
  levelCode.textContent = String(state.levelIndex + 1).padStart(2, "0");
  levelName.textContent = level.name;
  pieceCount.textContent = `${foundCount}/${PIECES}`;
  nextButton.classList.toggle("ready", state.found || state.complete);

  [...puzzleEl.children].forEach((piece, i) => {
    piece.classList.toggle("unlocked", state.pieces[i]);
  });

  if (state.complete) {
    startOverlay.classList.add("hidden");
    endOverlay.hidden = false;
    if (!state.completionAnnounced) {
      appendLog("拼图完整，黑暗安静下来。");
      state.completionAnnounced = true;
    }
  } else {
    endOverlay.hidden = true;
  }
}

function ensureAudio() {
  if (state.audio) {
    if (state.audio.ctx.state === "suspended") {
      state.audio.ctx.resume();
    }
    return state.audio;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  const master = audioCtx.createGain();
  const compressor = audioCtx.createDynamicsCompressor();
  master.gain.value = 0.72;
  master.connect(compressor);
  compressor.connect(audioCtx.destination);
  state.audio = { ctx: audioCtx, master };
  return state.audio;
}

function playTone({
  freq,
  duration = 0.12,
  pan = 0,
  gain = 0.1,
  delay = 0,
  type = "sine",
  bend = 0,
}) {
  if (!state.started) return;
  const audio = ensureAudio();
  const t = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();
  const panner = audio.ctx.createStereoPanner();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (bend) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), t + duration);
  }
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.014);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  panner.pan.setValueAtTime(clamp(pan, -1, 1), t);
  osc.connect(amp);
  amp.connect(panner);
  panner.connect(audio.master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playNoise({ duration = 0.08, pan = 0, gain = 0.04, delay = 0, filter = 900 }) {
  if (!state.started) return;
  const audio = ensureAudio();
  const t = audio.ctx.currentTime + delay;
  const length = Math.ceil(audio.ctx.sampleRate * duration);
  const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = audio.ctx.createBufferSource();
  const amp = audio.ctx.createGain();
  const panner = audio.ctx.createStereoPanner();
  const biquad = audio.ctx.createBiquadFilter();
  biquad.type = "bandpass";
  biquad.frequency.value = filter;
  biquad.Q.value = 0.9;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  panner.pan.setValueAtTime(clamp(pan, -1, 1), t);
  source.buffer = buffer;
  source.connect(biquad);
  biquad.connect(amp);
  amp.connect(panner);
  panner.connect(audio.master);
  source.start(t);
}

function spatialValues(point) {
  const dx = point.x - state.player.x;
  const dy = point.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  const maxDist = Math.hypot(WORLD.w, WORLD.h);
  return {
    dist,
    pan: clamp(dx / (WORLD.w * 0.42), -1, 1),
    closeness: clamp(1 - dist / maxDist, 0, 1),
  };
}

function playBeacon(time) {
  const level = currentLevel();
  const target = movingTarget(level, time);
  const sound = spatialValues(target);
  const closeBoost = Math.pow(sound.closeness, 2.2);
  const gain = 0.035 + closeBoost * 0.19;
  const echoDelay = 0.055 + (sound.dist / 100) * level.echo;

  playTone({
    freq: level.tone,
    duration: 0.11,
    pan: sound.pan,
    gain,
    type: "sine",
    bend: 6,
  });
  playTone({
    freq: level.tone * 0.5,
    duration: 0.16,
    pan: -sound.pan * 0.68,
    gain: gain * 0.34,
    delay: echoDelay,
    type: "triangle",
  });

  level.decoys.forEach((decoy, i) => {
    if (Math.random() > 0.54) return;
    const decoySound = spatialValues(decoy);
    playTone({
      freq: decoy.tone,
      duration: 0.09,
      pan: decoySound.pan,
      gain: 0.025 + decoySound.closeness * 0.04,
      delay: 0.05 + i * 0.06,
      type: "sawtooth",
    });
  });
}

function playRain(time) {
  const level = currentLevel();
  if (!level.rain || time < state.nextRainAt) return;
  state.nextRainAt = time + 70 + Math.random() * 130;
  playNoise({
    duration: 0.045,
    pan: Math.random() * 2 - 1,
    gain: 0.014 + Math.random() * 0.02,
    filter: 1100 + Math.random() * 1700,
  });
}

function pulse() {
  if (!state.started) {
    startExperience();
    return;
  }
  if (state.complete) return;

  const level = currentLevel();
  const target = movingTarget(level);
  const d = distance(state.player, target);
  const pulseColor = level.color;
  state.pulses.push({
    x: state.player.x,
    y: state.player.y,
    radius: 0,
    life: 1,
    color: pulseColor,
  });

  playNoise({ duration: 0.07, gain: 0.07, filter: 720 });
  echoFromPoint(target, level.tone * 1.5, level.color, true);
  level.decoys.forEach((decoy) => echoFromPoint(decoy, decoy.tone, "#8f7b6b", false));
  level.walls.forEach((wall) => echoFromWall(wall));

  if (d <= level.radius) {
    collectPiece();
  } else if (d < level.radius * 1.85) {
    showToast("很近");
  }
}

function echoFromPoint(point, tone, color, important) {
  const sound = spatialValues(point);
  const delay = 0.045 + sound.dist * 0.0075;
  const gain = important ? 0.13 : 0.054;
  playTone({
    freq: tone,
    duration: important ? 0.13 : 0.08,
    pan: sound.pan,
    gain: gain * (0.28 + sound.closeness),
    delay,
    type: important ? "sine" : "square",
  });
  state.glints.push({
    x: point.x,
    y: point.y,
    color,
    life: important ? 0.5 : 0.3,
    delay,
  });
}

function echoFromWall(wall) {
  const nearest = {
    x: clamp(state.player.x, wall.x, wall.x + wall.w),
    y: clamp(state.player.y, wall.y, wall.y + wall.h),
  };
  const sound = spatialValues(nearest);
  playNoise({
    duration: 0.052,
    pan: sound.pan,
    gain: 0.035 + sound.closeness * 0.04,
    delay: 0.04 + sound.dist * 0.0045,
    filter: 520,
  });
  state.wallHits.push({ ...wall, life: 0.42 });
}

function collectPiece() {
  if (state.found) return;
  state.found = true;
  state.pieces[state.levelIndex] = true;
  state.complete = state.pieces.every(Boolean);
  saveGame();
  updateUI();
  appendLog(`${currentLevel().name} 找到碎片。`);
  showToast(state.complete ? "拼图完成" : "碎片入位");

  for (let i = 0; i < 5; i += 1) {
    playTone({
      freq: currentLevel().tone * (1 + i * 0.12),
      duration: 0.1,
      pan: -0.45 + i * 0.22,
      gain: 0.07,
      delay: i * 0.08,
      type: "triangle",
    });
  }

  if (!state.complete) {
    setTimeout(() => {
      if (state.found) goNext();
    }, 1800);
  }
}

function isInsideWall(point, wall, margin = 1.15) {
  return (
    point.x >= wall.x - margin &&
    point.x <= wall.x + wall.w + margin &&
    point.y >= wall.y - margin &&
    point.y <= wall.y + wall.h + margin
  );
}

function isBlocked(point) {
  if (point.x < 3 || point.x > WORLD.w - 3 || point.y < 3 || point.y > WORLD.h - 3) {
    return true;
  }
  return currentLevel().walls.some((wall) => isInsideWall(point, wall));
}

function movePlayer(dt) {
  let x = 0;
  let y = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("a")) x -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("d")) x += 1;
  if (state.keys.has("ArrowUp") || state.keys.has("w")) y -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("s")) y += 1;

  if (state.pointer?.active) {
    const dx = state.pointer.x - state.pointer.originX;
    const dy = state.pointer.y - state.pointer.originY;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      x += dx / len;
      y += dy / len;
    }
  }

  if (!x && !y) return;
  const dir = normalize(x, y);
  const speed = state.complete ? 0 : 21;
  const step = { x: dir.x * speed * dt, y: dir.y * speed * dt };
  const nextX = { x: state.player.x + step.x, y: state.player.y };
  const nextY = { x: state.player.x, y: state.player.y + step.y };
  let bumped = false;

  if (!isBlocked(nextX)) {
    state.player.x = nextX.x;
  } else {
    bumped = true;
  }
  if (!isBlocked(nextY)) {
    state.player.y = nextY.y;
  } else {
    bumped = true;
  }

  if (bumped && performance.now() - state.bumpAt > 260) {
    state.bumpAt = performance.now();
    playNoise({ duration: 0.05, gain: 0.04, filter: 420 });
  }
}

function update(time) {
  const dt = Math.min(0.05, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;

  if (state.started && !state.complete) {
    movePlayer(dt);
    const level = currentLevel();
    const target = movingTarget(level, time);
    const d = distance(state.player, target);
    distanceRead.textContent = d < 9 ? "近" : d < 24 ? "中" : "远";

    if (!state.found && d <= level.radius * 0.42) {
      collectPiece();
    }

    if (!state.found && time >= state.nextBeaconAt) {
      playBeacon(time);
      state.nextBeaconAt = time + level.rate + Math.random() * 260;
    }
    playRain(time);
  }

  state.pulses.forEach((pulseItem) => {
    pulseItem.radius += dt * 54;
    pulseItem.life -= dt * 0.72;
  });
  state.pulses = state.pulses.filter((pulseItem) => pulseItem.life > 0);

  state.glints.forEach((glint) => {
    glint.delay -= dt;
    if (glint.delay <= 0) glint.life -= dt * 1.6;
  });
  state.glints = state.glints.filter((glint) => glint.life > 0);

  state.wallHits.forEach((hit) => {
    hit.life -= dt * 1.5;
  });
  state.wallHits = state.wallHits.filter((hit) => hit.life > 0);

  draw(time);
  requestAnimationFrame(update);
}

function draw(time) {
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackground(time);
  drawRoom();
  drawPulses();
  drawWallHits();
  drawGlints();
  drawPlayer(time);
  if (state.complete) drawComplete(time);
}

function drawBackground(time) {
  const level = currentLevel();
  const target = movingTarget(level, time);
  const d = distance(state.player, target);
  const closeness = clamp(1 - d / 70, 0, 1);

  const g = ctx.createRadialGradient(
    state.width * 0.52,
    state.height * 0.46,
    0,
    state.width * 0.52,
    state.height * 0.46,
    Math.max(state.width, state.height) * 0.78,
  );
  g.addColorStop(0, `rgba(28, 31, 22, ${0.18 + closeness * 0.18})`);
  g.addColorStop(0.48, "rgba(13, 12, 10, 0.96)");
  g.addColorStop(1, "#050504");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#e0d6bd";
  ctx.lineWidth = 1;
  const drift = (time * 0.012) % 18;
  for (let x = -20 + drift; x < state.width + 20; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - state.height * 0.28, state.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRoom() {
  ctx.save();
  ctx.strokeStyle = "rgba(224,214,189,0.16)";
  ctx.lineWidth = 1.5;
  const pad = worldToScreen({ x: 3, y: 3 });
  const far = worldToScreen({ x: WORLD.w - 3, y: WORLD.h - 3 });
  ctx.strokeRect(pad.x, pad.y, far.x - pad.x, far.y - pad.y);
  ctx.restore();
}

function drawPulses() {
  state.pulses.forEach((pulseItem) => {
    const p = worldToScreen(pulseItem);
    const radius = (pulseItem.radius / WORLD.w) * state.width;
    ctx.save();
    ctx.globalAlpha = clamp(pulseItem.life, 0, 1) * 0.55;
    ctx.strokeStyle = pulseItem.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = pulseItem.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawWallHits() {
  state.wallHits.forEach((wall) => {
    const a = worldToScreen({ x: wall.x, y: wall.y });
    const b = worldToScreen({ x: wall.x + wall.w, y: wall.y + wall.h });
    ctx.save();
    ctx.globalAlpha = clamp(wall.life, 0, 1) * 0.5;
    ctx.fillStyle = "rgba(224,214,189,0.2)";
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.restore();
  });
}

function drawGlints() {
  state.glints.forEach((glint) => {
    if (glint.delay > 0) return;
    const p = worldToScreen(glint);
    const alpha = clamp(glint.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = glint.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + (1 - alpha) * 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = glint.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPlayer(time) {
  const p = worldToScreen(state.player);
  const breath = 1 + Math.sin(time * 0.004) * 0.12;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = "rgba(224,214,189,0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8 * breath, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(201,167,90,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawComplete(time) {
  ctx.save();
  ctx.globalAlpha = 0.22 + Math.sin(time * 0.004) * 0.05;
  ctx.fillStyle = "#c9a75a";
  ctx.font = "700 64px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("ECHO", state.width / 2, state.height / 2);
  ctx.restore();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  state.width = Math.max(1, Math.floor(rect.width * state.dpr));
  state.height = Math.max(1, Math.floor(rect.height * state.dpr));
  canvas.width = state.width;
  canvas.height = state.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function openRules() {
  rulesDialog.hidden = false;
  rulesStartButton.textContent = state.started ? "继续听" : "开始听";
  rulesStartButton.focus();
}

function closeRules(markSeen = true) {
  rulesDialog.hidden = true;
  if (markSeen) {
    localStorage.setItem(RULES_SEEN_KEY, "1");
  }
}

function startExperience() {
  state.started = true;
  ensureAudio();
  startOverlay.classList.add("hidden");
  closeRules();
  showToast("听");
  appendLog("第一声回声出现。");
  pulse();
}

function bindEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
      state.keys.add(key);
      event.preventDefault();
    }
    if (event.code === "Space") {
      pulse();
      event.preventDefault();
    }
    if (event.key === "Escape" && !rulesDialog.hidden) {
      closeRules();
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    state.keys.delete(key);
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    state.pointer = {
      active: true,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      downAt: performance.now(),
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointer?.active) return;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    const dx = state.pointer.x - state.pointer.originX;
    const dy = state.pointer.y - state.pointer.originY;
    state.pointer.moved = Math.hypot(dx, dy) > 8;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!state.pointer) return;
    const wasTap = !state.pointer.moved && performance.now() - state.pointer.downAt < 260;
    state.pointer.active = false;
    if (wasTap) {
      pulse();
    }
  });

  beginButton.addEventListener("click", startExperience);
  helpButton.addEventListener("click", openRules);
  soundButton.addEventListener("click", () => {
    startExperience();
  });
  pulseButton.addEventListener("click", pulse);
  nextButton.addEventListener("click", goNext);
  resetButton.addEventListener("click", resetGame);
  replayButton.addEventListener("click", resetGame);
  stayButton.addEventListener("click", () => {
    endOverlay.hidden = true;
  });
  rulesCloseButton.addEventListener("click", () => closeRules());
  rulesStartButton.addEventListener("click", startExperience);
  rulesDialog.addEventListener("click", (event) => {
    if (event.target === rulesDialog) closeRules();
  });
}

function init() {
  setupPuzzle();
  loadSave();
  bindEvents();
  resize();
  startLevel(state.levelIndex);
  if (!localStorage.getItem(RULES_SEEN_KEY)) {
    openRules();
  }
  requestAnimationFrame(update);
}

init();
