const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playfield = document.getElementById("playfield");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayButton = document.getElementById("overlayButton");
const statusText = document.getElementById("statusText");
const scoreText = document.getElementById("scoreText");
const comboText = document.getElementById("comboText");
const bestText = document.getElementById("bestText");
const accText = document.getElementById("accText");
const judgeText = document.getElementById("judgeText");
const timingText = document.getElementById("timingText");
const energyBar = document.getElementById("energyBar");
const volumeSlider = document.getElementById("volumeSlider");

const LANES = [
  { key: "d", label: "D", color: "#6f7a54" },
  { key: "f", label: "F", color: "#b98b3e" },
  { key: "j", label: "J", color: "#9a3f35" },
  { key: "k", label: "K", color: "#536a78" },
];

const KEY_TO_LANE = new Map(LANES.map((lane, index) => [lane.key, index]));
const BPM = 132;
const BEAT = 60 / BPM;
const TRAVEL_TIME = 1.82;
const COUNTDOWN_MS = 1800;
const STORAGE_KEY = "rhythm-lanes-best";
const MAX_SCORE_PER_NOTE = 1000;

const WINDOWS = [
  { name: "PERFECT", limit: 0.045, score: 1000, acc: 1, energy: 1.8 },
  { name: "GREAT", limit: 0.085, score: 720, acc: 0.82, energy: 1.0 },
  { name: "GOOD", limit: 0.125, score: 420, acc: 0.55, energy: 0.2 },
  { name: "BAD", limit: 0.165, score: 120, acc: 0.18, energy: -3.5 },
];
const MISS_WINDOW = 0.17;

const BASE_CHART = buildChart();
const SONG_LENGTH = BASE_CHART[BASE_CHART.length - 1].time + BEAT * 5;

let width = 0;
let height = 0;
let dpr = 1;
let state = "idle";
let songStartAt = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let energy = 78;
let judged = 0;
let accTotal = 0;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let chart = [];
let particles = [];
let keyFlashes = LANES.map(() => 0);
let lanePress = LANES.map(() => false);
let lastJudge = { name: "-", delta: 0, at: 0 };
let lastFrame = performance.now();
let audioCtx = null;
let masterGain = null;
let activeTrackGain = null;
let runToken = 0;

function init() {
  bestText.textContent = String(best);
  resize();
  resetRun(false);
  bindEvents();
  requestAnimationFrame(loop);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  startBtn.addEventListener("click", startRun);
  restartBtn.addEventListener("click", startRun);
  overlayButton.addEventListener("click", startRun);
  volumeSlider.addEventListener("input", updateVolume);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (KEY_TO_LANE.has(key)) {
      event.preventDefault();
      if (event.repeat) return;
      const lane = KEY_TO_LANE.get(key);
      lanePress[lane] = true;
      hitLane(lane);
      return;
    }
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      if (state !== "playing" && state !== "countdown" && state !== "arming") startRun();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (KEY_TO_LANE.has(key)) {
      lanePress[KEY_TO_LANE.get(key)] = false;
    }
  });

  playfield.addEventListener("pointerdown", (event) => {
    const lane = laneFromPointer(event);
    lanePress[lane] = true;
    hitLane(lane);
    playfield.setPointerCapture(event.pointerId);
  });

  playfield.addEventListener("pointerup", (event) => {
    lanePress = LANES.map(() => false);
  });

  playfield.addEventListener("pointercancel", () => {
    lanePress = LANES.map(() => false);
  });
}

function resize() {
  const rect = playfield.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(480, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetRun(showOverlay = true) {
  chart = BASE_CHART.map((note, index) => ({
    ...note,
    id: index,
    hit: false,
    missed: false,
  }));
  score = 0;
  combo = 0;
  maxCombo = 0;
  energy = 78;
  judged = 0;
  accTotal = 0;
  particles = [];
  keyFlashes = LANES.map(() => 0);
  lanePress = LANES.map(() => false);
  lastJudge = { name: "-", delta: 0, at: 0 };
  state = "idle";
  updateHud();
  setJudge("-", 0);
  statusText.textContent = "READY";
  overlayTitle.textContent = "READY";
  overlayButton.textContent = "Start";
  overlay.hidden = !showOverlay;
}

async function startRun() {
  const token = runToken + 1;
  runToken = token;
  stopCurrentTrack();
  resetRun(false);
  state = "arming";
  statusText.textContent = "SYNC";
  overlay.hidden = true;
  await ensureAudio();
  if (token !== runToken || state !== "arming") return;
  state = "countdown";
  songStartAt = performance.now() + COUNTDOWN_MS;
  const leadTime = Math.max(0.08, (songStartAt - performance.now()) / 1000);
  scheduleTrack(audioCtx ? audioCtx.currentTime + leadTime : 0);
}

function loop(now) {
  const dt = Math.min(40, now - lastFrame);
  lastFrame = now;

  if (state === "countdown" && now >= songStartAt) {
    state = "playing";
    statusText.textContent = "PLAY";
  }

  if (state === "playing") {
    const time = getSongTime(now);
    markMisses(time);
    if (energy <= 0) {
      finishRun("FAILED");
    } else if (time > SONG_LENGTH) {
      finishRun("CLEAR");
    }
  }

  updateParticles(dt);
  draw(now);
  requestAnimationFrame(loop);
}

function hitLane(lane) {
  keyFlashes[lane] = 1;
  burstLane(lane, 12);

  if (state === "idle" || state === "ended") {
    startRun();
    return;
  }
  if (state !== "playing") return;

  const time = getSongTime();
  let nearest = null;
  let nearestDelta = Infinity;
  for (const note of chart) {
    if (note.lane !== lane || note.hit || note.missed) continue;
    const delta = note.time - time;
    const abs = Math.abs(delta);
    if (abs < nearestDelta) {
      nearest = note;
      nearestDelta = abs;
    }
    if (delta > MISS_WINDOW) break;
  }

  if (!nearest || nearestDelta > MISS_WINDOW) {
    registerMiss(0, true);
    return;
  }

  nearest.hit = true;
  const judgment = WINDOWS.find((entry) => nearestDelta <= entry.limit) || WINDOWS[WINDOWS.length - 1];
  score += judgment.score + combo * 4;
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);
  energy = clamp(energy + judgment.energy, 0, 100);
  judged += 1;
  accTotal += judgment.acc;
  setJudge(judgment.name, -Math.round((nearest.time - time) * 1000));
  burstLane(lane, judgment.name === "PERFECT" ? 34 : 22);
  updateHud();
}

function markMisses(time) {
  for (const note of chart) {
    if (note.hit || note.missed) continue;
    if (time - note.time > MISS_WINDOW) {
      note.missed = true;
      registerMiss(Math.round((time - note.time) * 1000), false);
    }
    if (note.time - time > 1) break;
  }
}

function registerMiss(delta, emptyPress) {
  combo = 0;
  energy = clamp(energy - (emptyPress ? 3 : 8), 0, 100);
  if (!emptyPress) {
    judged += 1;
  }
  setJudge("MISS", delta);
  updateHud();
}

function finishRun(label) {
  runToken += 1;
  state = "ended";
  statusText.textContent = label;
  if (label === "FAILED") {
    stopCurrentTrack();
  }
  best = Math.max(best, score);
  localStorage.setItem(STORAGE_KEY, String(best));
  overlayTitle.textContent = `${label} ${score}`;
  overlayButton.textContent = "Restart";
  overlay.hidden = false;
  updateHud();
}

function updateHud() {
  scoreText.textContent = String(score);
  comboText.textContent = String(combo);
  bestText.textContent = String(best);
  const accuracy = judged ? Math.round((accTotal / judged) * 1000) / 10 : 100;
  accText.textContent = `${accuracy}%`;
  energyBar.style.transform = `scaleX(${clamp(energy, 0, 100) / 100})`;
}

function setJudge(name, delta) {
  lastJudge = { name, delta, at: performance.now() };
  judgeText.textContent = name;
  timingText.textContent = `${delta > 0 ? "+" : ""}${delta} ms`;
}

function getSongTime(now = performance.now()) {
  return (now - songStartAt) / 1000;
}

function laneFromPointer(event) {
  const rect = playfield.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width - 1);
  return clamp(Math.floor((x / rect.width) * LANES.length), 0, LANES.length - 1);
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  const time = state === "idle" ? -1 : getSongTime(now);
  const top = 26;
  const hitY = height - 92;
  const laneWidth = width / LANES.length;

  drawStageGrid(top, hitY, laneWidth, now);
  drawNotes(time, top, hitY, laneWidth);
  drawHitLine(hitY, laneWidth, now);
  drawParticles();
  drawCenterReadout(now);

  keyFlashes = keyFlashes.map((value) => Math.max(0, value - 0.055));
}

function drawStageGrid(top, hitY, laneWidth, now) {
  const pulse = (Math.sin(now / 140) + 1) / 2;
  ctx.save();
  for (let lane = 0; lane < LANES.length; lane += 1) {
    const x = lane * laneWidth;
    const active = lanePress[lane] || keyFlashes[lane] > 0;
    ctx.fillStyle = active
      ? hexToRgba(LANES[lane].color, 0.18 + keyFlashes[lane] * 0.18)
      : "rgba(255,255,255,0.025)";
    ctx.fillRect(x + 1, top, laneWidth - 2, hitY - top + 58);

    ctx.strokeStyle = "rgba(247,244,232,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, top);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();

    ctx.fillStyle = hexToRgba(LANES[lane].color, 0.16 + pulse * 0.08);
    ctx.fillRect(x + 10, top + 8, laneWidth - 20, 3);
  }

  ctx.strokeStyle = "rgba(247,244,232,0.10)";
  ctx.beginPath();
  ctx.moveTo(width - 0.5, top);
  ctx.lineTo(width - 0.5, height);
  ctx.stroke();
  ctx.restore();
}

function drawNotes(time, top, hitY, laneWidth) {
  const travel = hitY - top;
  for (const note of chart) {
    if (note.hit || note.missed) continue;
    const untilHit = note.time - time;
    const y = hitY - (untilHit / TRAVEL_TIME) * travel;
    if (y < top - 52) continue;
    if (y > hitY + 92) continue;

    const x = note.lane * laneWidth + 12;
    const noteW = laneWidth - 24;
    const noteH = 22;
    const color = LANES[note.lane].color;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    roundRect(ctx, x, y - noteH / 2, noteW, noteH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.36)";
    roundRect(ctx, x + 8, y - noteH / 2 + 4, noteW - 16, 4, 3);
    ctx.fill();
    ctx.restore();
  }
}

function drawHitLine(hitY, laneWidth, now) {
  ctx.save();
  ctx.fillStyle = "rgba(247,244,232,0.13)";
  ctx.fillRect(18, hitY - 3, width - 36, 6);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(18, hitY + 13, width - 36, 1);
  for (let lane = 0; lane < LANES.length; lane += 1) {
    const x = lane * laneWidth + laneWidth / 2;
    const glow = keyFlashes[lane];
    ctx.strokeStyle = hexToRgba(LANES[lane].color, 0.45 + glow * 0.45);
    ctx.lineWidth = 3 + glow * 6;
    ctx.beginPath();
    ctx.arc(x, hitY, 20 + glow * 12 + Math.sin(now / 100 + lane) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCenterReadout(now) {
  if (state === "countdown") {
    const left = Math.max(0, songStartAt - now);
    const count = Math.max(1, Math.ceil(left / 600));
    ctx.save();
    ctx.fillStyle = "rgba(247,244,232,0.90)";
    ctx.font = "900 76px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), width / 2, height * 0.42);
    ctx.restore();
    return;
  }

  const age = now - lastJudge.at;
  if (age < 620 && lastJudge.name !== "-") {
    const alpha = 1 - age / 620;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = judgeColor(lastJudge.name);
    ctx.font = "900 34px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lastJudge.name, width / 2, height * 0.38 - (1 - alpha) * 18);
    ctx.restore();
  }
}

function burstLane(lane, amount) {
  const laneWidth = width / LANES.length;
  const x = lane * laneWidth + laneWidth / 2;
  const y = height - 92;
  const color = LANES[lane].color;
  for (let i = 0; i < amount; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = 1.4 + Math.random() * 4.2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function updateParticles(dt) {
  const step = dt / 16.67;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.vy += 0.08 * step;
    p.life -= 0.035 * step;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function buildChart() {
  const notes = [];
  const patterns = [
    [[0, 0], [1, 1], [2, 2], [3, 3]],
    [[0, 3], [0.5, 2], [1.5, 1], [2, 0], [3, 2]],
    [[0, 0], [0.75, 1], [1.5, 2], [2.25, 3], [3, 1]],
    [[0, [0, 3]], [1, 1], [2, 2], [3, [0, 2]]],
    [[0, 1], [0.5, 0], [1, 2], [1.5, 3], [2.5, 2], [3, 0]],
    [[0, 3], [0.5, 1], [1, [0, 2]], [2, 1], [2.5, 3], [3.5, 0]],
    [[0, 0], [0.5, 2], [1, 1], [1.5, 3], [2, [0, 2]], [3, [1, 3]]],
    [[0, [0, 1]], [0.75, 2], [1.5, 3], [2, [0, 3]], [3, 1]],
  ];

  for (let measure = 0; measure < 32; measure += 1) {
    const base = measure * 4 * BEAT;
    const intro = measure < 2;
    const pattern = intro ? patterns[measure] : patterns[measure % patterns.length];
    for (const [beat, laneValue] of pattern) {
      const lanes = Array.isArray(laneValue) ? laneValue : [laneValue];
      for (const lane of lanes) {
        notes.push({ time: base + beat * BEAT, lane });
      }
    }
    if (measure >= 12 && measure % 4 === 3) {
      notes.push({ time: base + 3.5 * BEAT, lane: measure % 8 === 3 ? 2 : 1 });
    }
  }

  return notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
}

async function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    updateVolume();
  }
  if (audioCtx.state !== "running") {
    await audioCtx.resume();
  }
}

function updateVolume() {
  if (!masterGain) return;
  const volume = Number(volumeSlider.value) / 100;
  masterGain.gain.setTargetAtTime(volume * 0.32, audioCtx.currentTime, 0.02);
}

function scheduleTrack(startAt) {
  if (!audioCtx || !masterGain) return;
  activeTrackGain = audioCtx.createGain();
  activeTrackGain.gain.setValueAtTime(1, audioCtx.currentTime);
  activeTrackGain.connect(masterGain);
  const bars = 32;
  const progression = [48, 43, 45, 40];
  for (let bar = 0; bar < bars; bar += 1) {
    const barTime = startAt + bar * 4 * BEAT;
    for (let beat = 0; beat < 4; beat += 1) {
      const t = barTime + beat * BEAT;
      scheduleKick(t);
      if (beat === 1 || beat === 3) scheduleSnare(t);
      scheduleBass(t, midiToFreq(progression[bar % progression.length] + (beat % 2 ? 7 : 0)));
    }
    for (let eighth = 0; eighth < 8; eighth += 1) {
      scheduleHat(barTime + eighth * BEAT / 2, eighth % 2 ? 0.07 : 0.11);
    }
  }

  for (const note of BASE_CHART) {
    const pitch = 72 + note.lane * 3 + (Math.floor(note.time / (4 * BEAT)) % 4) * 2;
    scheduleBlip(startAt + note.time, midiToFreq(pitch));
  }
}

function stopCurrentTrack() {
  if (!audioCtx || !activeTrackGain) return;
  const gain = activeTrackGain;
  const now = audioCtx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0.0001, now, 0.025);
  window.setTimeout(() => {
    try {
      gain.disconnect();
    } catch (error) {
      // Rapid restarts can disconnect the same node before this cleanup fires.
    }
  }, 500);
  activeTrackGain = null;
}

function scheduleKick(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.9, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(gain);
  gain.connect(activeTrackGain || masterGain);
  osc.start(time);
  osc.stop(time + 0.2);
}

function scheduleSnare(time) {
  const noise = audioCtx.createBufferSource();
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.16, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  noise.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 1100;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.34, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(activeTrackGain || masterGain);
  noise.start(time);
}

function scheduleHat(time, level) {
  const noise = audioCtx.createBufferSource();
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.045, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  noise.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 6200;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(level, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.043);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(activeTrackGain || masterGain);
  noise.start(time);
}

function scheduleBass(time, freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + BEAT * 0.72);
  osc.connect(gain);
  gain.connect(activeTrackGain || masterGain);
  osc.start(time);
  osc.stop(time + BEAT * 0.76);
}

function scheduleBlip(time, freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.08, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  osc.connect(gain);
  gain.connect(activeTrackGain || masterGain);
  osc.start(time);
  osc.stop(time + 0.09);
}

function midiToFreq(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function judgeColor(name) {
  if (name === "PERFECT") return "#b98b3e";
  if (name === "GREAT") return "#6f7a54";
  if (name === "GOOD") return "#536a78";
  if (name === "BAD") return "#65506f";
  return "#9a3f35";
}

function roundRect(target, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  target.beginPath();
  target.moveTo(x + radius, y);
  target.arcTo(x + w, y, x + w, y + h, radius);
  target.arcTo(x + w, y + h, x, y + h, radius);
  target.arcTo(x, y + h, x, y, radius);
  target.arcTo(x, y, x + w, y, radius);
  target.closePath();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
