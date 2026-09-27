const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const angleSlider = document.querySelector("#angleSlider");
const lightSlider = document.querySelector("#lightSlider");
const angleReadout = document.querySelector("#angleReadout");
const shapeName = document.querySelector("#shapeName");
const autoBtn = document.querySelector("#autoBtn");
const levelNumber = document.querySelector("#levelNumber");
const levelPrompt = document.querySelector("#levelPrompt");
const levelHint = document.querySelector("#levelHint");
const levelMeter = document.querySelector("#levelMeter");
const levelStatus = document.querySelector("#levelStatus");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const nudgeLeftBtn = document.querySelector("#nudgeLeftBtn");
const nudgeRightBtn = document.querySelector("#nudgeRightBtn");

const WIDTH = 1280;
const HEIGHT = 720;
const ILLUSION_DEG = 118;
const ILLUSION_RAD = degToRad(ILLUSION_DEG);
const SAMPLE_COUNT = 96;

const scene = {
  angle: 26,
  targetAngle: null,
  light: 1,
  auto: false,
  dragging: false,
  lastX: 0,
  time: 0,
  levelIndex: 0,
  solveHold: 0,
  solved: false,
  levelPulse: 0,
};

const COLORS = {
  ink: "#f7f1e5",
  muted: "#aeb9b2",
  dark: "#101314",
  floor: "#18201f",
  amber: "#ffc65a",
  amberDeep: "#ff8f3d",
  cyan: "#70d6ff",
  rose: "#ff6f91",
  green: "#8bd8bd",
  metal: "#d7b47d",
  metalDark: "#7a5a38",
};

const SHAPES = {
  vase: { name: "宽肚花瓶", width: vaseWidth },
  keyhole: { name: "钥匙孔", width: keyholeWidth },
  apple: { name: "圆苹果", width: appleWidth },
  rocket: { name: "小火箭", width: rocketWidth },
  hourglass: { name: "沙漏", width: hourglassWidth },
  bell: { name: "铜铃", width: bellWidth },
  arch: { name: "拱门", width: archWidth },
  diamond: { name: "钻石", width: diamondWidth },
};

const LEVELS = [
  {
    primary: SHAPES.vase,
    secondary: SHAPES.keyhole,
    targetShape: SHAPES.vase,
    targetAngle: 0,
    prompt: "投影出：宽肚花瓶",
    hint: "宽肚、细颈、底部有小脚。",
    tolerance: 4.5,
  },
  {
    primary: SHAPES.vase,
    secondary: SHAPES.keyhole,
    targetShape: SHAPES.keyhole,
    targetAngle: ILLUSION_DEG,
    prompt: "投影出：钥匙孔",
    hint: "上半部圆，下半部窄直。",
    tolerance: 4.5,
  },
  {
    primary: SHAPES.apple,
    secondary: SHAPES.rocket,
    targetShape: SHAPES.apple,
    targetAngle: 0,
    prompt: "投影出：圆苹果",
    hint: "中间饱满，顶部和底部都收进去。",
    tolerance: 5,
  },
  {
    primary: SHAPES.apple,
    secondary: SHAPES.rocket,
    targetShape: SHAPES.rocket,
    targetAngle: ILLUSION_DEG,
    prompt: "投影出：小火箭",
    hint: "尖尖的头，窄腰，底部有展开的尾翼。",
    tolerance: 5,
  },
  {
    primary: SHAPES.hourglass,
    secondary: SHAPES.bell,
    targetShape: SHAPES.hourglass,
    targetAngle: 0,
    prompt: "投影出：沙漏",
    hint: "上下展开，中间明显收腰。",
    tolerance: 5,
  },
  {
    primary: SHAPES.hourglass,
    secondary: SHAPES.bell,
    targetShape: SHAPES.bell,
    targetAngle: ILLUSION_DEG,
    prompt: "投影出：铜铃",
    hint: "顶部小，越往下越宽，底沿圆润。",
    tolerance: 5,
  },
  {
    primary: SHAPES.arch,
    secondary: SHAPES.diamond,
    targetShape: SHAPES.arch,
    targetAngle: 0,
    prompt: "投影出：拱门",
    hint: "圆顶，下面像一扇竖直的门。",
    tolerance: 5,
  },
  {
    primary: SHAPES.arch,
    secondary: SHAPES.diamond,
    targetShape: SHAPES.diamond,
    targetAngle: ILLUSION_DEG,
    prompt: "投影出：钻石",
    hint: "上下尖，中间最宽。",
    tolerance: 5,
  },
];

let profiles = buildProfiles(LEVELS[0]);

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gaussian(value) {
  return Math.exp(-(value * value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function angleDistance(a, b) {
  const diff = Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
  return diff;
}

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildProfiles(level) {
  const rows = [];
  const sinB = Math.sin(ILLUSION_RAD);
  const cosB = Math.cos(ILLUSION_RAD);

  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const y = lerp(-1, 1, i / (SAMPLE_COUNT - 1));
    const primary = level.primary.width(y);
    const secondary = level.secondary.width(y);
    const left = solveAmbiguousPoint(-1, y, primary, secondary, sinB, cosB);
    const right = solveAmbiguousPoint(1, y, primary, secondary, sinB, cosB);
    rows.push({ y, primary, secondary, left, right });
  }

  return rows;
}

function solveAmbiguousPoint(side, y, primary, secondary, sinB, cosB) {
  return {
    x: side * ((primary * cosB - secondary) / sinB),
    y,
    z: side * primary,
  };
}

function vaseWidth(y) {
  const body = 0.34 + 0.42 * gaussian((y + 0.16) / 0.58);
  const shoulder = 0.13 * gaussian((y - 0.26) / 0.22);
  const neckCut = 0.28 * gaussian((y - 0.68) / 0.24);
  const rim = 0.2 * gaussian((y - 0.94) / 0.09);
  const foot = 0.2 * gaussian((y + 0.93) / 0.1);
  return clamp(body + shoulder - neckCut + rim + foot, 0.16, 0.86);
}

function keyholeWidth(y) {
  if (y > -0.07) {
    const center = 0.35;
    const radius = 0.62;
    const dy = (y - center) / radius;
    const circle = dy > -1 && dy < 1 ? Math.sqrt(1 - dy * dy) * 0.58 : 0;
    return clamp(circle + 0.05, 0.08, 0.66);
  }

  if (y > -0.79) {
    return 0.2 + 0.035 * Math.cos((y + 0.2) * 9);
  }

  return 0.34 + 0.14 * gaussian((y + 0.93) / 0.1);
}

function appleWidth(y) {
  const round = Math.abs(y + 0.02) < 0.92 ? Math.sqrt(1 - ((y + 0.02) / 0.92) ** 2) : 0;
  const shoulder = 0.18 * gaussian((y - 0.2) / 0.34);
  const topDip = 0.18 * gaussian((y - 0.91) / 0.08);
  const bottomDip = 0.12 * gaussian((y + 0.91) / 0.09);
  return clamp(0.1 + round * 0.58 + shoulder - topDip - bottomDip, 0.08, 0.72);
}

function rocketWidth(y) {
  if (y > 0.62) {
    return clamp((1 - y) * 1.35 + 0.08, 0.08, 0.45);
  }

  if (y < -0.72) {
    const fin = 0.28 + 0.22 * gaussian((y + 0.88) / 0.1);
    return clamp(fin, 0.22, 0.52);
  }

  const body = 0.28 + 0.05 * gaussian((y + 0.18) / 0.7);
  const waist = 0.06 * gaussian((y + 0.58) / 0.16);
  return clamp(body - waist, 0.2, 0.36);
}

function hourglassWidth(y) {
  const topBottom = 0.25 + 0.47 * Math.abs(y) ** 0.78;
  const rim = 0.11 * gaussian((Math.abs(y) - 0.92) / 0.09);
  const waist = 0.15 * gaussian(y / 0.22);
  return clamp(topBottom + rim - waist, 0.16, 0.76);
}

function bellWidth(y) {
  const t = (1 - y) / 2;
  const flare = 0.16 + 0.5 * t ** 1.6;
  const dome = 0.2 * gaussian((y - 0.78) / 0.17);
  const lip = 0.13 * gaussian((y + 0.92) / 0.08);
  return clamp(flare + dome + lip, 0.14, 0.78);
}

function archWidth(y) {
  if (y > -0.14) {
    const dy = (y + 0.14) / 1.02;
    const dome = dy >= 0 && dy <= 1 ? Math.sqrt(1 - dy * dy) * 0.58 : 0;
    return clamp(0.18 + dome, 0.2, 0.66);
  }

  return 0.46 + 0.04 * gaussian((y + 0.88) / 0.12);
}

function diamondWidth(y) {
  const point = 0.1 + 0.64 * (1 - Math.abs(y) ** 0.9);
  const facet = 0.08 * Math.cos((y + 1) * Math.PI * 2);
  return clamp(point + facet, 0.08, 0.72);
}

function setAngle(value) {
  scene.angle = ((value % 360) + 360) % 360;
  angleSlider.value = scene.angle;
  updateReadout();
}

function updateReadout() {
  angleReadout.textContent = `${Math.round(scene.angle)}°`;
  const level = currentLevel();
  const distance = targetDistance(scene.angle, level);

  if (scene.solved) {
    shapeName.textContent = "已完成";
  } else if (distance <= level.tolerance) {
    shapeName.textContent = "目标锁定";
  } else if (distance < level.tolerance * 3) {
    shapeName.textContent = "快到了";
  } else {
    shapeName.textContent = `目标: ${level.targetShape.name}`;
  }
}

function currentLevel() {
  return LEVELS[scene.levelIndex];
}

function targetAngles(level = currentLevel()) {
  return [level.targetAngle, (level.targetAngle + 180) % 360];
}

function targetDistance(angle, level = currentLevel()) {
  return Math.min(...targetAngles(level).map((target) => angleDistance(angle, target)));
}

function targetProgress(angle, level = currentLevel()) {
  const distance = targetDistance(angle, level);
  return clamp(1 - distance / (level.tolerance * 4), 0, 1);
}

function startLevel(index, animateAway = true) {
  scene.levelIndex = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
  profiles = buildProfiles(currentLevel());
  scene.solved = false;
  scene.solveHold = 0;
  scene.levelPulse = 0;
  scene.auto = false;
  autoBtn.classList.remove("is-on");
  autoBtn.querySelector("span").textContent = "▶";

  if (animateAway) {
    const level = currentLevel();
    let start = (level.targetAngle + 52 + scene.levelIndex * 31) % 360;
    if (targetDistance(start, level) < 38) {
      start = (start + 63) % 360;
    }
    scene.targetAngle = start;
  }

  updateLevelDom();
  updateReadout();
}

function updateLevelDom() {
  const level = currentLevel();
  levelNumber.textContent = `第 ${scene.levelIndex + 1} / ${LEVELS.length} 关`;
  levelPrompt.textContent = level.prompt;
  levelHint.textContent = level.hint;
  levelStatus.textContent = scene.solved ? "影子已匹配" : "寻找目标影子";
  levelMeter.style.width = `${Math.round(targetProgress(scene.angle, level) * 100)}%`;
  nextLevelBtn.hidden = !scene.solved;
  nextLevelBtn.textContent = scene.levelIndex === LEVELS.length - 1 ? "再来一轮" : "下一关";
}

function solveLevel() {
  if (scene.solved) {
    return;
  }

  scene.solved = true;
  scene.levelPulse = 1;
  levelStatus.textContent = scene.levelIndex === LEVELS.length - 1 ? "全部完成" : "过关";
  nextLevelBtn.hidden = false;
  nextLevelBtn.textContent = scene.levelIndex === LEVELS.length - 1 ? "再来一轮" : "下一关";
  shapeName.textContent = "已完成";
}

function update(dt) {
  scene.time += dt;
  scene.levelPulse = Math.max(0, scene.levelPulse - dt * 1.8);

  if (scene.auto) {
    setAngle(scene.angle + dt * 28);
  }

  if (scene.targetAngle !== null) {
    const diff = ((((scene.targetAngle - scene.angle + 180) % 360) + 360) % 360) - 180;
    if (Math.abs(diff) < 0.08) {
      setAngle(scene.targetAngle);
      scene.targetAngle = null;
    } else {
      setAngle(scene.angle + diff * clamp(dt * 7, 0, 1));
    }
  }

  const level = currentLevel();
  const progress = targetProgress(scene.angle, level);
  levelMeter.style.width = `${Math.round(progress * 100)}%`;

  if (!scene.solved && targetDistance(scene.angle, level) <= level.tolerance) {
    scene.solveHold += dt;
    levelStatus.textContent = "保持住";
    if (scene.solveHold >= 0.48) {
      solveLevel();
    }
  } else if (!scene.solved) {
    scene.solveHold = 0;
    levelStatus.textContent = progress > 0.72 ? "很接近" : "寻找目标影子";
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawRoom();
  drawBeam();
  drawScreen();
  drawTargetGhost();
  drawShadow();
  drawTurntable();
  drawSculpture();
  drawLamp();
  drawAngleDial();
  drawAngleMarks();
}

function drawRoom() {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#172022");
  sky.addColorStop(0.48, "#202928");
  sky.addColorStop(1, "#111615");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = COLORS.floor;
  ctx.beginPath();
  ctx.moveTo(0, 465);
  ctx.lineTo(WIDTH, 425);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i += 1) {
    const y = 480 + i * 22;
    ctx.beginPath();
    ctx.moveTo(0, y + i * 4);
    ctx.lineTo(WIDTH, y - i * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const x = 170 + i * 90;
    ctx.beginPath();
    ctx.moveTo(x, 450);
    ctx.lineTo(x + (i - 5) * 54, HEIGHT);
    ctx.stroke();
  }
}

function drawBeam() {
  const lamp = { x: 98, y: 328 };
  const object = { x: 505, y: 350 };
  const screenTop = { x: 948, y: 92 };
  const screenBottom = { x: 948, y: 600 };
  const beamAlpha = 0.12 * scene.light;

  ctx.save();
  const beam = ctx.createLinearGradient(lamp.x, lamp.y, screenTop.x, screenTop.y);
  beam.addColorStop(0, `rgba(255, 198, 90, ${beamAlpha * 1.7})`);
  beam.addColorStop(0.45, `rgba(255, 198, 90, ${beamAlpha})`);
  beam.addColorStop(1, `rgba(112, 214, 255, ${beamAlpha * 0.72})`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(lamp.x, lamp.y - 42);
  ctx.quadraticCurveTo(object.x, object.y - 190, screenTop.x, screenTop.y);
  ctx.lineTo(screenBottom.x, screenBottom.y);
  ctx.quadraticCurveTo(object.x, object.y + 150, lamp.x, lamp.y + 42);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.42 * scene.light;
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i += 1) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(lamp.x + 6, lamp.y + lerp(-34, 34, t));
    ctx.lineTo(952, lerp(screenTop.y, screenBottom.y, t));
    ctx.stroke();
  }
  ctx.restore();
}

function drawLamp() {
  ctx.save();
  ctx.translate(92, 328);
  ctx.fillStyle = "#2a302f";
  roundRect(-62, 62, 120, 18, 8);
  ctx.fill();

  ctx.strokeStyle = "#4e5751";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-18, 62);
  ctx.lineTo(-6, 26);
  ctx.lineTo(28, 0);
  ctx.stroke();

  const glow = ctx.createRadialGradient(34, 0, 3, 34, 0, 78);
  glow.addColorStop(0, `rgba(255, 198, 90, ${0.38 * scene.light})`);
  glow.addColorStop(1, "rgba(255, 198, 90, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(36, 0, 86, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#343b38";
  ctx.beginPath();
  ctx.moveTo(-18, -44);
  ctx.lineTo(52, -28);
  ctx.lineTo(58, 28);
  ctx.lineTo(-18, 44);
  ctx.quadraticCurveTo(-34, 0, -18, -44);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.amber;
  ctx.beginPath();
  ctx.ellipse(46, 0, 16, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScreen() {
  ctx.save();
  ctx.translate(925, 72);
  ctx.fillStyle = "#262f31";
  roundRect(-28, -17, 324, 546, 8);
  ctx.fill();

  const screen = ctx.createLinearGradient(0, 0, 0, 496);
  screen.addColorStop(0, "#e9e2cc");
  screen.addColorStop(1, "#cfc2a9");
  ctx.fillStyle = screen;
  roundRect(0, 0, 268, 496, 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(62, 50, 38, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * 52);
    ctx.lineTo(268, i * 52 + 10);
    ctx.stroke();
  }

  ctx.fillStyle = "#313c3d";
  roundRect(20, 514, 230, 20, 8);
  ctx.fill();
  ctx.restore();
}

function drawShadow() {
  const screen = { cx: 1059, cy: 320, scaleX: 125, scaleY: 205 };
  const { right, left } = getShadowSides(scene.angle, screen);
  const closeness = targetProgress(scene.angle);

  ctx.save();
  ctx.shadowColor = `rgba(27, 17, 12, ${0.34 + scene.light * 0.18})`;
  ctx.shadowBlur = 22 + scene.light * 18;
  ctx.fillStyle = `rgba(24, 19, 15, ${0.42 + scene.light * 0.16})`;
  pathFromSides(right, left);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(112, 214, 255, ${0.18 + closeness * 0.46})`;
  ctx.lineWidth = 3;
  pathFromSides(right, left);
  ctx.stroke();
  ctx.restore();
}

function drawTargetGhost() {
  const level = currentLevel();
  const screen = { cx: 1059, cy: 320, scaleX: 125, scaleY: 205 };
  const { right, left } = getShadowSides(level.targetAngle, screen);
  const pulse = scene.solved ? 0.28 + Math.sin(scene.time * 10) * 0.08 : 0;

  ctx.save();
  ctx.setLineDash([10, 7]);
  ctx.fillStyle = `rgba(255, 198, 90, ${0.08 + pulse})`;
  pathFromSides(right, left);
  ctx.fill();
  ctx.strokeStyle = scene.solved ? COLORS.green : COLORS.amber;
  ctx.lineWidth = scene.solved ? 4 : 3;
  pathFromSides(right, left);
  ctx.stroke();
  ctx.setLineDash([]);

  if (scene.levelPulse > 0) {
    ctx.globalAlpha = scene.levelPulse;
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 5;
    roundRect(924, 71, 270, 498, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function getShadowSides(angleDeg, screen) {
  const angle = degToRad(angleDeg);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const topToBottom = [...profiles].reverse();
  const right = [];
  const left = [];

  topToBottom.forEach((row) => {
    const a = shadowPoint(row.left, sin, cos, screen);
    const b = shadowPoint(row.right, sin, cos, screen);
    if (a.x > b.x) {
      right.push(a);
      left.push(b);
    } else {
      right.push(b);
      left.push(a);
    }
  });

  return { right, left };
}

function shadowPoint(point, sin, cos, screen) {
  const zRot = -point.x * sin + point.z * cos;
  return {
    x: screen.cx + zRot * screen.scaleX,
    y: screen.cy - point.y * screen.scaleY,
  };
}

function pathFromSides(right, left) {
  ctx.beginPath();
  ctx.moveTo(right[0].x, right[0].y);
  right.forEach((point) => ctx.lineTo(point.x, point.y));
  [...left].reverse().forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function drawTurntable() {
  ctx.save();
  ctx.translate(505, 512);
  ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 182, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#303b39";
  ctx.beginPath();
  ctx.ellipse(0, 0, 172, 44, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 198, 90, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 134, 33, 0, 0, Math.PI * 2);
  ctx.stroke();

  const a = degToRad(scene.angle);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(a) * 118, Math.cos(a) * 28);
  ctx.stroke();
  ctx.restore();
}

function drawSculpture() {
  const segments = [];
  const leftRail = profiles.map((row) => row.left);
  const rightRail = profiles.map((row) => row.right);

  for (let i = 0; i < profiles.length - 1; i += 1) {
    segments.push(makeSegment(leftRail[i], leftRail[i + 1], COLORS.metal, 3.2));
    segments.push(makeSegment(rightRail[i], rightRail[i + 1], COLORS.metal, 3.2));
  }

  for (let i = 4; i < profiles.length; i += 8) {
    segments.push(makeSegment(leftRail[i], rightRail[i], COLORS.cyan, 2.1));
  }

  for (let i = 8; i < profiles.length - 8; i += 16) {
    const a = leftRail[i];
    const b = rightRail[profiles.length - 1 - i];
    segments.push(makeSegment(a, b, "rgba(255, 111, 145, 0.84)", 1.8));
  }

  segments.sort((a, b) => a.depth - b.depth);

  ctx.save();
  segments.forEach((segment) => drawSegment(segment));
  profiles
    .filter((_, index) => index % 12 === 0)
    .forEach((row) => {
      drawNode(project3d(row.left), 5);
      drawNode(project3d(row.right), 5);
    });
  ctx.restore();
}

function makeSegment(a, b, color, width) {
  const pa = project3d(a);
  const pb = project3d(b);
  return {
    a: pa,
    b: pb,
    color,
    width,
    depth: (pa.depth + pb.depth) / 2,
  };
}

function project3d(point) {
  const a = degToRad(scene.angle);
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const x = point.x * cos + point.z * sin;
  const z = -point.x * sin + point.z * cos;
  const perspective = 1 / (1 + z * 0.16);
  return {
    x: 505 + x * 125 * perspective,
    y: 339 - point.y * 188 * perspective + z * 9,
    depth: z,
    scale: perspective,
  };
}

function drawSegment(segment) {
  const depthShade = clamp((segment.depth + 1.2) / 2.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = 0.62 + depthShade * 0.36;
  ctx.strokeStyle = segment.color;
  ctx.lineWidth = segment.width * (0.85 + segment.a.scale * 0.2);
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(segment.a.x, segment.a.y);
  ctx.lineTo(segment.b.x, segment.b.y);
  ctx.stroke();
  ctx.restore();
}

function drawNode(point, radius) {
  ctx.save();
  ctx.fillStyle = COLORS.amber;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * point.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAngleDial() {
  const cx = 206;
  const cy = 258;
  const radius = 48;
  const angle = degToRad(scene.angle - 90);
  const level = currentLevel();

  ctx.save();
  ctx.fillStyle = "rgba(12, 15, 16, 0.58)";
  roundRect(34, 188, 232, 126, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = COLORS.rose;
  targetAngles(level).forEach((target, index) => {
    const mark = degToRad(target - 90);
    ctx.setLineDash(index === 0 ? [] : [6, 5]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(mark) * radius, cy + Math.sin(mark) * radius);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  ctx.stroke();

  ctx.fillStyle = COLORS.ink;
  ctx.font = "900 16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("360°", 56, 228);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.fillText(`${level.targetShape.name}`, 56, 251);
  ctx.restore();
}

function drawAngleMarks() {
  const closeness = targetProgress(scene.angle);

  if (closeness <= 0.75) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = (closeness - 0.75) / 0.25;
  ctx.fillStyle = "rgba(139, 216, 189, 0.16)";
  ctx.fillRect(925, 72, 268, 496);
  ctx.strokeStyle = scene.solved ? COLORS.green : COLORS.rose;
  ctx.lineWidth = 3;
  roundRect(924, 71, 270, 498, 8);
  ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

let lastTime = 0;

function loop(now) {
  if (!lastTime) {
    lastTime = now;
  }
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function syncFromSlider() {
  scene.targetAngle = null;
  setAngle(Number(angleSlider.value));
}

angleSlider.addEventListener("input", syncFromSlider);
lightSlider.addEventListener("input", () => {
  scene.light = Number(lightSlider.value);
});

autoBtn.addEventListener("click", () => {
  scene.auto = !scene.auto;
  autoBtn.classList.toggle("is-on", scene.auto);
  autoBtn.querySelector("span").textContent = scene.auto ? "Ⅱ" : "▶";
});

nextLevelBtn.addEventListener("click", () => {
  startLevel(scene.levelIndex + 1);
});

nudgeLeftBtn.addEventListener("click", () => {
  scene.auto = false;
  autoBtn.classList.remove("is-on");
  autoBtn.querySelector("span").textContent = "▶";
  scene.targetAngle = null;
  setAngle(scene.angle - 12);
});

nudgeRightBtn.addEventListener("click", () => {
  scene.auto = false;
  autoBtn.classList.remove("is-on");
  autoBtn.querySelector("span").textContent = "▶";
  scene.targetAngle = null;
  setAngle(scene.angle + 12);
});

canvas.addEventListener("pointerdown", (event) => {
  scene.dragging = true;
  scene.lastX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
  canvas.focus();
});

canvas.addEventListener("pointermove", (event) => {
  if (!scene.dragging) {
    return;
  }
  const dx = event.clientX - scene.lastX;
  scene.lastX = event.clientX;
  scene.targetAngle = null;
  setAngle(scene.angle + dx * 0.42);
});

canvas.addEventListener("pointerup", (event) => {
  scene.dragging = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    scene.targetAngle = null;
    setAngle(scene.angle + event.deltaY * 0.08);
  },
  { passive: false },
);

document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft") {
    event.preventDefault();
    scene.targetAngle = null;
    setAngle(scene.angle - 4);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    scene.targetAngle = null;
    setAngle(scene.angle + 4);
  } else if (event.code === "Space") {
    event.preventDefault();
    autoBtn.click();
  }
});

resizeCanvas();
startLevel(0, false);
setAngle(scene.angle);
requestAnimationFrame(loop);
window.addEventListener("resize", resizeCanvas);
