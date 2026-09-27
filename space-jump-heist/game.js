const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const coinsEl = document.querySelector("#coins");
const eggsEl = document.querySelector("#eggs");
const distanceEl = document.querySelector("#distance");
const energyEl = document.querySelector("#energy");
const toastEl = document.querySelector("#toast");
const pauseBtn = document.querySelector("#pauseBtn");
const pauseIcon = document.querySelector("#pauseIcon");
const restartBtn = document.querySelector("#restartBtn");
const throwBtn = document.querySelector("#throwBtn");

const WORLD = {
  width: 960,
  height: 540,
  groundY: 424,
  gravity: 2350,
  jumpVelocity: -900,
  doubleJumpVelocity: -790,
  finishDistance: 980,
};

const COLORS = {
  ink: "#f8f5ef",
  shadow: "rgba(0, 0, 0, 0.24)",
  road: "#29373b",
  roadDark: "#1b2428",
  gold: "#ffcc4d",
  goldDark: "#c58224",
  mint: "#73d2b8",
  coral: "#ff6f61",
  violet: "#7c6bd6",
  warning: "#ff9d42",
  clue: "#5ac8fa",
  egg: "#fff2d8",
};

let state = "ready";
let lastTime = 0;
let toastTimer = 0;

const game = {
  score: 0,
  coins: 0,
  eggs: 3,
  distance: 0,
  speed: 340,
  energy: 3,
  time: 0,
  obstacleTimer: 0.85,
  coinTimer: 0.25,
  eventTimer: 1.35,
  boostTimer: 0,
  clueTimer: 0,
  eggCooldown: 0,
  shake: 0,
  flash: 0,
};

const player = {
  x: 132,
  y: WORLD.groundY - 74,
  width: 46,
  height: 74,
  vy: 0,
  onGround: true,
  jumps: 0,
  maxJumps: 2,
  invincible: 0,
  runCycle: 0,
};

let hazards = [];
let coins = [];
let bonuses = [];
let projectiles = [];
let particles = [];
let floaters = [];
let clouds = [];
let skyline = [];

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = WORLD.width * dpr;
  canvas.height = WORLD.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetGame() {
  state = "ready";
  game.score = 0;
  game.coins = 0;
  game.eggs = 3;
  game.distance = 0;
  game.speed = 340;
  game.energy = 3;
  game.time = 0;
  game.obstacleTimer = 0.7;
  game.coinTimer = 0.18;
  game.eventTimer = 1.05;
  game.boostTimer = 0;
  game.clueTimer = 0;
  game.eggCooldown = 0;
  game.shake = 0;
  game.flash = 0;

  player.x = 132;
  player.y = WORLD.groundY - player.height;
  player.vy = 0;
  player.onGround = true;
  player.jumps = 0;
  player.invincible = 0;
  player.runCycle = 0;

  hazards = [];
  coins = [];
  bonuses = [];
  projectiles = [];
  particles = [];
  floaters = [];
  makeBackdrop();
  showToast("准备追捕", 1.1);
  updateHud();
}

function makeBackdrop() {
  clouds = Array.from({ length: 7 }, (_, index) => ({
    x: index * 170 + random(-30, 50),
    y: random(50, 170),
    scale: random(0.72, 1.24),
    speed: random(12, 28),
  }));

  skyline = Array.from({ length: 24 }, (_, index) => ({
    x: index * 58,
    width: random(36, 72),
    height: random(68, 176),
    tone: index % 3,
    windows: Math.floor(random(2, 5)),
  }));
}

function startGame() {
  if (state === "ready") {
    state = "running";
    showToast("追捕开始", 0.8);
  }
}

function showToast(text, seconds = 0.9) {
  toastEl.textContent = text;
  toastEl.classList.add("is-visible");
  toastTimer = seconds;
}

function togglePause() {
  if (state === "running") {
    state = "paused";
    pauseIcon.textContent = "▶";
    showToast("暂停", 0.8);
  } else if (state === "paused") {
    state = "running";
    pauseIcon.textContent = "II";
    showToast("继续", 0.6);
  }
}

function requestJump() {
  if (state === "over" || state === "win") {
    resetGame();
    startGame();
    return;
  }

  startGame();

  if (state !== "running") {
    return;
  }

  if (player.onGround) {
    player.vy = WORLD.jumpVelocity;
    player.onGround = false;
    player.jumps = 1;
    burst(player.x + 16, WORLD.groundY - 4, 10, "#d9efe8", 160);
  } else if (player.jumps < player.maxJumps) {
    player.vy = WORLD.doubleJumpVelocity;
    player.jumps += 1;
    burst(player.x + 26, player.y + player.height - 8, 16, COLORS.mint, 190);
    addFloater("二段跳", player.x + 58, player.y + 24, COLORS.mint);
  }
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(game.score));
  coinsEl.textContent = String(game.coins);
  eggsEl.textContent = String(game.eggs);
  distanceEl.textContent = `${Math.floor(game.distance)}m`;
  energyEl.textContent = "|".repeat(game.energy) || "-";
}

function throwEgg() {
  if (state === "over" || state === "win") {
    resetGame();
    startGame();
    return;
  }

  startGame();

  if (state !== "running" || game.eggCooldown > 0) {
    return;
  }

  if (game.eggs <= 0) {
    showToast("没有鸡蛋", 0.75);
    return;
  }

  game.eggs -= 1;
  game.eggCooldown = 0.26;
  projectiles.push({
    x: player.x + player.width + 6,
    y: player.y + 35,
    vx: 780,
    vy: -85,
    radius: 10,
    rotation: random(-0.6, 0.6),
    life: 1.35,
    hit: false,
  });
  burst(player.x + player.width, player.y + 36, 6, COLORS.egg, 70);
  updateHud();
}

function spawnHazard() {
  const difficulty = game.distance / WORLD.finishDistance;
  const makeDrone = Math.random() < 0.36 + difficulty * 0.18;
  if (makeDrone) {
    hazards.push({
      type: "drone",
      x: WORLD.width + 40,
      y: Math.random() < 0.5 ? 220 : 286,
      width: 62,
      height: 34,
      phase: random(0, Math.PI * 2),
      hit: false,
    });
  } else {
    hazards.push({
      type: "barrier",
      x: WORLD.width + 40,
      y: WORLD.groundY - 50,
      width: 48,
      height: 50,
      phase: random(0, Math.PI * 2),
      hit: false,
    });
  }
}

function spawnCoins() {
  const highLane = Math.random() < 0.48;
  const baseY = highLane ? WORLD.groundY - 180 : WORLD.groundY - 92;
  const amount = Math.floor(random(4, 7));
  const arc = Math.random() < 0.45;

  for (let i = 0; i < amount; i += 1) {
    coins.push({
      x: WORLD.width + 28 + i * 40,
      y: baseY - (arc ? Math.sin((i / Math.max(1, amount - 1)) * Math.PI) * 36 : 0),
      radius: 12,
      phase: random(0, Math.PI * 2),
      collected: false,
    });
  }
}

function spawnBonus() {
  const roll = Math.random();
  const type = roll < 0.34 ? "rocket" : roll < 0.68 ? "clue" : "eggs";
  const config = {
    rocket: {
      y: random(WORLD.groundY - 180, WORLD.groundY - 132),
      width: 66,
      height: 34,
    },
    clue: {
      y: random(WORLD.groundY - 228, WORLD.groundY - 168),
      width: 52,
      height: 52,
    },
    eggs: {
      y: WORLD.groundY - 66,
      width: 58,
      height: 42,
    },
  }[type];

  bonuses.push({
    type,
    x: WORLD.width + 44,
    y: config.y,
    width: config.width,
    height: config.height,
    phase: random(0, Math.PI * 2),
    collected: false,
  });
}

function getSpeedMultiplier() {
  return 1 + (game.boostTimer > 0 ? 0.5 : 0) + (game.clueTimer > 0 ? 0.28 : 0);
}

function burst(x, y, count, color, spread = 120) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: random(-spread, spread),
      vy: random(-spread * 0.7, spread * 0.36),
      life: random(0.25, 0.64),
      maxLife: 0.64,
      size: random(2, 5),
      color,
    });
  }
}

function addFloater(text, x, y, color) {
  floaters.push({
    text,
    x,
    y,
    color,
    life: 0.7,
  });
}

function update(dt) {
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      toastEl.classList.remove("is-visible");
    }
  }

  if (state !== "running") {
    updateParticles(dt);
    return;
  }

  game.speed = 340 + clamp(game.distance * 0.22, 0, 170);
  game.boostTimer = Math.max(0, game.boostTimer - dt);
  game.clueTimer = Math.max(0, game.clueTimer - dt);
  game.eggCooldown = Math.max(0, game.eggCooldown - dt);
  const effectiveSpeed = game.speed * getSpeedMultiplier();

  game.time += dt;
  game.distance += (effectiveSpeed * dt) / 15.8;
  game.score += dt * 8 + effectiveSpeed * dt * 0.06;
  game.shake = Math.max(0, game.shake - dt * 18);
  game.flash = Math.max(0, game.flash - dt);

  player.invincible = Math.max(0, player.invincible - dt);
  player.vy += WORLD.gravity * dt;
  player.y += player.vy * dt;
  player.runCycle += dt * (player.onGround ? 14 : 6);

  if (player.y + player.height >= WORLD.groundY) {
    player.y = WORLD.groundY - player.height;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
  }

  game.obstacleTimer -= dt;
  if (game.obstacleTimer <= 0) {
    spawnHazard();
    game.obstacleTimer = random(0.88, 1.48) - clamp(game.distance / 2800, 0, 0.3);
  }

  game.coinTimer -= dt;
  if (game.coinTimer <= 0) {
    spawnCoins();
    game.coinTimer = random(0.88, 1.32);
  }

  game.eventTimer -= dt;
  if (game.eventTimer <= 0) {
    spawnBonus();
    game.eventTimer = random(2.3, 3.6);
  }

  const move = effectiveSpeed * dt;
  hazards.forEach((hazard) => {
    hazard.x -= move;
    hazard.phase += dt * 5;
    if (hazard.type === "drone") {
      hazard.y += Math.sin(hazard.phase) * dt * 22;
    }
  });
  coins.forEach((coin) => {
    coin.x -= move;
    coin.phase += dt * 7;
  });
  bonuses.forEach((bonus) => {
    bonus.x -= move;
    bonus.phase += dt * 6;
  });
  updateProjectiles(dt);

  checkCollisions();
  updateParticles(dt);
  hazards = hazards.filter((hazard) => !hazard.destroyed && hazard.x + hazard.width > -80);
  coins = coins.filter((coin) => coin.x + coin.radius > -80 && !coin.collected);
  bonuses = bonuses.filter((bonus) => bonus.x + bonus.width > -80 && !bonus.collected);
  projectiles = projectiles.filter(
    (projectile) =>
      !projectile.hit &&
      projectile.life > 0 &&
      projectile.x < WORLD.width + 90 &&
      projectile.y < WORLD.height + 60,
  );

  if (game.distance >= WORLD.finishDistance) {
    state = "win";
    game.score += 450;
    burst(player.x + 40, player.y + 24, 36, COLORS.gold, 240);
    showToast("抓到强盗", 1.6);
  }

  updateHud();
}

function updateParticles(dt) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 340 * dt;
    particle.life -= dt;
  });
  particles = particles.filter((particle) => particle.life > 0);

  floaters.forEach((floater) => {
    floater.y -= 44 * dt;
    floater.life -= dt;
  });
  floaters = floaters.filter((floater) => floater.life > 0);
}

function updateProjectiles(dt) {
  projectiles.forEach((projectile) => {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.vy += 430 * dt;
    projectile.rotation += dt * 10;
    projectile.life -= dt;
  });
}

function checkCollisions() {
  const playerBox = {
    x: player.x + 8,
    y: player.y + 8,
    width: player.width - 14,
    height: player.height - 12,
  };

  for (const coin of coins) {
    if (coin.collected) {
      continue;
    }
    const closestX = clamp(coin.x, playerBox.x, playerBox.x + playerBox.width);
    const closestY = clamp(coin.y, playerBox.y, playerBox.y + playerBox.height);
    const dx = coin.x - closestX;
    const dy = coin.y - closestY;
    if (dx * dx + dy * dy < coin.radius * coin.radius) {
      coin.collected = true;
      game.coins += 1;
      game.score += 35;
      burst(coin.x, coin.y, 9, COLORS.gold, 90);
      addFloater("+35", coin.x, coin.y - 16, COLORS.gold);
      if (game.coins % 12 === 0 && game.energy < 3) {
        game.energy += 1;
        addFloater("能量+1", player.x + 48, player.y + 8, COLORS.mint);
      }
    }
  }

  for (const bonus of bonuses) {
    if (bonus.collected) {
      continue;
    }

    const bonusBox = {
      x: bonus.x,
      y: bonus.y,
      width: bonus.width,
      height: bonus.height,
    };

    if (rectsOverlap(playerBox, bonusBox)) {
      applyBonus(bonus);
    }
  }

  checkProjectileHits();

  if (player.invincible > 0) {
    return;
  }

  for (const hazard of hazards) {
    if (hazard.hit) {
      continue;
    }
    const hazardBox = getHazardBox(hazard);

    if (rectsOverlap(playerBox, hazardBox)) {
      hazard.hit = true;
      player.invincible = 1.25;
      game.energy -= 1;
      game.shake = 8;
      game.flash = 0.18;
      burst(player.x + player.width / 2, player.y + player.height / 2, 18, COLORS.coral, 170);
      addFloater("-1", player.x + 46, player.y + 8, COLORS.coral);
      showToast(game.energy > 0 ? "小心" : "追捕失败", 0.9);

      if (game.energy <= 0) {
        state = "over";
      }
      break;
    }
  }
}

function applyBonus(bonus) {
  bonus.collected = true;
  const cx = bonus.x + bonus.width / 2;
  const cy = bonus.y + bonus.height / 2;

  if (bonus.type === "rocket") {
    game.boostTimer = Math.max(game.boostTimer, 2.8);
    game.distance += 24;
    game.score += 140;
    burst(cx, cy, 22, COLORS.warning, 180);
    addFloater("火箭加速", cx, cy - 20, COLORS.warning);
    showToast("加速火箭", 0.85);
  } else if (bonus.type === "clue") {
    game.clueTimer = Math.max(game.clueTimer, 3.3);
    game.distance += 62;
    game.score += 220;
    burst(cx, cy, 26, COLORS.clue, 210);
    addFloater("线索加速", cx, cy - 22, COLORS.clue);
    showToast("朝阳群众给线索", 1);
  } else {
    game.eggs = Math.min(9, game.eggs + 3);
    game.score += 80;
    burst(cx, cy, 18, COLORS.egg, 140);
    addFloater("鸡蛋+3", cx, cy - 18, COLORS.egg);
    showToast("鸡蛋补给", 0.85);
  }
}

function checkProjectileHits() {
  for (const projectile of projectiles) {
    if (projectile.hit) {
      continue;
    }

    for (const hazard of hazards) {
      if (hazard.hit || hazard.destroyed) {
        continue;
      }

      if (circleOverlapsRect(projectile, getHazardBox(hazard))) {
        projectile.hit = true;
        hazard.hit = true;
        hazard.destroyed = true;
        game.score += hazard.type === "drone" ? 120 : 90;
        game.shake = Math.max(game.shake, 3);
        burst(projectile.x, projectile.y, 24, COLORS.egg, 190);
        addFloater("命中", projectile.x, projectile.y - 14, COLORS.egg);
        break;
      }
    }
  }
}

function getHazardBox(hazard) {
  return hazard.type === "drone"
    ? {
        x: hazard.x + 8,
        y: hazard.y + 7,
        width: hazard.width - 16,
        height: hazard.height - 12,
      }
    : {
        x: hazard.x + 5,
        y: hazard.y + 7,
        width: hazard.width - 10,
        height: hazard.height - 9,
      };
}

function circleOverlapsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function draw() {
  ctx.save();
  if (game.shake > 0) {
    ctx.translate(random(-game.shake, game.shake), random(-game.shake, game.shake));
  }

  drawSky();
  drawClouds();
  drawSkyline();
  drawRoad();
  drawSpeedStreaks();
  drawRobber();

  coins.forEach(drawCoin);
  bonuses.forEach(drawBonus);
  hazards.forEach(drawHazard);
  projectiles.forEach(drawProjectile);
  drawPlayer();
  drawParticles();
  drawFinishMeter();
  drawActiveEffects();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255, 111, 97, ${game.flash * 1.6})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  if (state === "ready") {
    drawOverlay("夜巷追捕", "出发");
  } else if (state === "paused") {
    drawOverlay("暂停", "继续");
  } else if (state === "over") {
    drawOverlay("追捕失败", "再来一次");
  } else if (state === "win") {
    drawOverlay("抓到强盗", "任务完成");
  }

  ctx.restore();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, "#7a8ed7");
  gradient.addColorStop(0.42, "#f1a66d");
  gradient.addColorStop(0.78, "#32414a");
  gradient.addColorStop(1, "#1a2428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "#ffe59c";
  ctx.beginPath();
  ctx.arc(796, 86, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClouds() {
  ctx.save();
  clouds.forEach((cloud) => {
    const x = ((cloud.x - game.time * cloud.speed) % (WORLD.width + 180)) - 90;
    ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
    blob(x, cloud.y, 44 * cloud.scale, 18 * cloud.scale);
    blob(x + 35 * cloud.scale, cloud.y - 8 * cloud.scale, 58 * cloud.scale, 25 * cloud.scale);
    blob(x + 82 * cloud.scale, cloud.y, 46 * cloud.scale, 19 * cloud.scale);
  });
  ctx.restore();
}

function drawSkyline() {
  const scroll = (game.distance * 4.2) % 58;
  skyline.forEach((building, index) => {
    const x = building.x - scroll;
    const h = building.height;
    const y = WORLD.groundY - 60 - h;
    const palette = ["#253544", "#304155", "#3b435d"];
    ctx.fillStyle = palette[building.tone];
    ctx.fillRect(x, y, building.width, h + 64);
    ctx.fillStyle = "rgba(255, 220, 133, 0.55)";

    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < building.windows; col += 1) {
        if ((row + col + index) % 3 === 0) {
          const wx = x + 8 + col * 13;
          const wy = y + 16 + row * 22;
          if (wx < x + building.width - 8 && wy < WORLD.groundY - 78) {
            ctx.fillRect(wx, wy, 6, 9);
          }
        }
      }
    }
  });
}

function drawRoad() {
  ctx.fillStyle = COLORS.roadDark;
  ctx.fillRect(0, WORLD.groundY - 18, WORLD.width, 18);

  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);

  ctx.fillStyle = "#1d282c";
  for (let i = -1; i < 20; i += 1) {
    const x = i * 84 - ((game.distance * 11) % 84);
    ctx.fillRect(x, WORLD.groundY + 76, 48, 8);
  }

  ctx.fillStyle = "rgba(255, 204, 77, 0.58)";
  for (let i = -1; i < 18; i += 1) {
    const x = i * 96 - ((game.distance * 13) % 96);
    ctx.fillRect(x, WORLD.groundY + 22, 46, 5);
  }

  ctx.fillStyle = "rgba(115, 210, 184, 0.22)";
  ctx.fillRect(0, WORLD.groundY - 3, WORLD.width, 3);
}

function drawSpeedStreaks() {
  const multiplier = getSpeedMultiplier();
  if (multiplier <= 1) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.18 + (multiplier - 1) * 0.16;
  ctx.strokeStyle = game.boostTimer > 0 ? COLORS.warning : COLORS.clue;
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i += 1) {
    const x = (i * 92 - ((game.time * 620) % 92) + WORLD.width) % WORLD.width;
    const y = 90 + ((i * 47) % 260);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 54, y + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFinishMeter() {
  const width = 230;
  const x = WORLD.width - width - 28;
  const y = 22;
  const progress = clamp(game.distance / WORLD.finishDistance, 0, 1);

  ctx.save();
  ctx.fillStyle = "rgba(11, 15, 19, 0.48)";
  roundRect(x, y, width, 16, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.mint;
  roundRect(x + 3, y + 3, (width - 6) * progress, 10, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("追捕进度", x + width, y + 34);
  ctx.restore();
}

function drawActiveEffects() {
  const effects = [];
  if (game.boostTimer > 0) {
    effects.push({ label: "火箭", color: COLORS.warning, value: game.boostTimer / 2.8 });
  }
  if (game.clueTimer > 0) {
    effects.push({ label: "线索", color: COLORS.clue, value: game.clueTimer / 3.3 });
  }

  if (!effects.length) {
    return;
  }

  ctx.save();
  effects.forEach((effect, index) => {
    const x = 28;
    const y = 24 + index * 30;
    ctx.fillStyle = "rgba(11, 15, 19, 0.48)";
    roundRect(x, y, 126, 20, 8);
    ctx.fill();
    ctx.fillStyle = effect.color;
    roundRect(x + 4, y + 4, 78 * clamp(effect.value, 0, 1), 12, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(effect.label, x + 116, y + 14);
  });
  ctx.restore();
}

function drawPlayer() {
  const bob = player.onGround ? Math.sin(player.runCycle) * 2.5 : 0;
  const x = player.x;
  const y = player.y + bob;
  const stride = Math.sin(player.runCycle) * 9;
  const flicker = player.invincible > 0 && Math.floor(game.time * 18) % 2 === 0;

  if (flicker) {
    ctx.globalAlpha = 0.45;
  }

  ctx.save();
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 6;

  if (game.boostTimer > 0 || game.clueTimer > 0) {
    ctx.save();
    ctx.globalAlpha = game.boostTimer > 0 ? 0.86 : 0.58;
    ctx.fillStyle = game.boostTimer > 0 ? COLORS.warning : COLORS.clue;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 45);
    ctx.lineTo(x - 36 - Math.sin(game.time * 18) * 10, y + 34);
    ctx.lineTo(x + 4, y + 57);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = "#243038";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 64);
  ctx.lineTo(x + 12 - stride, WORLD.groundY - 4);
  ctx.moveTo(x + 32, y + 64);
  ctx.lineTo(x + 34 + stride, WORLD.groundY - 4);
  ctx.stroke();

  ctx.fillStyle = "#2f6170";
  roundRect(x + 8, y + 28, 34, 38, 8);
  ctx.fill();

  ctx.fillStyle = "#f4c17c";
  ctx.beginPath();
  ctx.arc(x + 25, y + 18, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#243038";
  ctx.fillRect(x + 8, y + 9, 35, 9);
  roundRect(x + 12, y - 2, 28, 12, 6);
  ctx.fill();

  ctx.fillStyle = COLORS.coral;
  ctx.beginPath();
  ctx.moveTo(x + 35, y + 32);
  ctx.lineTo(x + 68, y + 28 + Math.sin(game.time * 12) * 5);
  ctx.lineTo(x + 35, y + 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#233037";
  ctx.beginPath();
  ctx.arc(x + 18, y + 17, 2.3, 0, Math.PI * 2);
  ctx.arc(x + 31, y + 17, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#243038";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 39);
  ctx.lineTo(x - 6, y + 50 + Math.sin(player.runCycle) * 4);
  ctx.moveTo(x + 40, y + 40);
  ctx.lineTo(x + 54, y + 34 - Math.sin(player.runCycle) * 4);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawRobber() {
  const progress = clamp(game.distance / WORLD.finishDistance, 0, 1);
  const x = 780 - progress * 250 + Math.sin(game.time * 8) * 6;
  const y = WORLD.groundY - 72 + Math.sin(game.time * 13) * 2;
  const stride = Math.sin(game.time * 16) * 8;

  ctx.save();
  ctx.globalAlpha = state === "win" ? 0.35 : 0.82;
  ctx.strokeStyle = "#17191e";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 61);
  ctx.lineTo(x + 12 - stride, WORLD.groundY - 4);
  ctx.moveTo(x + 33, y + 61);
  ctx.lineTo(x + 36 + stride, WORLD.groundY - 4);
  ctx.stroke();

  ctx.fillStyle = "#1c2028";
  roundRect(x + 7, y + 29, 36, 36, 8);
  ctx.fill();

  ctx.fillStyle = "#d9a36d";
  ctx.beginPath();
  ctx.arc(x + 24, y + 18, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#181a20";
  ctx.fillRect(x + 8, y + 12, 34, 10);
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.ellipse(x + 57, y + 44, 16, 22, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7c4a15";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 47, y + 29);
  ctx.lineTo(x + 38, y + 37);
  ctx.stroke();
  ctx.restore();
}

function drawCoin(coin) {
  const pulse = Math.sin(coin.phase) * 0.12 + 1;
  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.scale(pulse, 1);
  ctx.fillStyle = COLORS.goldDark;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius - 5, -0.65, Math.PI * 1.25);
  ctx.stroke();
  ctx.restore();
}

function drawBonus(bonus) {
  if (bonus.type === "rocket") {
    drawRocketBonus(bonus);
  } else if (bonus.type === "clue") {
    drawClueBonus(bonus);
  } else {
    drawEggBonus(bonus);
  }
}

function drawRocketBonus(bonus) {
  const x = bonus.x;
  const y = bonus.y + Math.sin(bonus.phase) * 5;

  ctx.save();
  ctx.translate(x + bonus.width / 2, y + bonus.height / 2);
  ctx.rotate(Math.sin(bonus.phase * 0.6) * 0.08);
  ctx.fillStyle = "rgba(255, 157, 66, 0.2)";
  ctx.beginPath();
  ctx.ellipse(-6, 0, 44, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.warning;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(10, -13);
  ctx.lineTo(-23, -13);
  ctx.lineTo(-32, 0);
  ctx.lineTo(-23, 13);
  ctx.lineTo(10, 13);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f8f5ef";
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.coral;
  ctx.beginPath();
  ctx.moveTo(-33, -10);
  ctx.lineTo(-55 - Math.sin(bonus.phase * 3) * 5, 0);
  ctx.lineTo(-33, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawClueBonus(bonus) {
  const x = bonus.x;
  const y = bonus.y + Math.sin(bonus.phase) * 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(90, 200, 250, 0.18)";
  ctx.beginPath();
  ctx.arc(26, 26, 31, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff7e8";
  roundRect(8, 3, 34, 44, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.clue;
  ctx.fillRect(13, 12, 24, 5);
  ctx.fillRect(13, 23, 19, 5);
  ctx.fillStyle = COLORS.coral;
  ctx.font = "900 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("线", 25, 42);
  ctx.restore();
}

function drawEggBonus(bonus) {
  const x = bonus.x;
  const y = bonus.y + Math.sin(bonus.phase) * 3;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#b46b38";
  roundRect(2, 15, 54, 25, 7);
  ctx.fill();
  ctx.fillStyle = "#8f4e2c";
  ctx.fillRect(7, 25, 44, 5);

  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = COLORS.egg;
    ctx.beginPath();
    ctx.ellipse(15 + i * 14, 16, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.beginPath();
    ctx.ellipse(12 + i * 14, 12, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectile(projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(projectile.rotation);
  ctx.fillStyle = COLORS.egg;
  ctx.beginPath();
  ctx.ellipse(0, 0, projectile.radius * 0.82, projectile.radius * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.beginPath();
  ctx.ellipse(-3, -4, 2.4, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHazard(hazard) {
  if (hazard.type === "drone") {
    drawDrone(hazard);
  } else {
    drawBarrier(hazard);
  }
}

function drawBarrier(hazard) {
  const x = hazard.x;
  const y = hazard.y;

  ctx.save();
  ctx.fillStyle = "#433f3d";
  roundRect(x + 4, y + 7, hazard.width - 8, hazard.height - 7, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.warning;
  ctx.fillRect(x + 8, y + 11, hazard.width - 16, 30);
  ctx.strokeStyle = "#fff4df";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 38);
  ctx.lineTo(x + 36, y + 14);
  ctx.moveTo(x + 27, y + 41);
  ctx.lineTo(x + 45, y + 23);
  ctx.stroke();
  ctx.fillStyle = "#22282c";
  ctx.fillRect(x + 2, y + hazard.height - 8, hazard.width + 5, 8);
  ctx.restore();
}

function drawDrone(hazard) {
  const x = hazard.x;
  const y = hazard.y;
  const rotor = Math.sin(hazard.phase * 6) * 7;

  ctx.save();
  ctx.strokeStyle = "rgba(20, 24, 28, 0.72)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 8);
  ctx.lineTo(x + 3 + rotor, y + 3);
  ctx.moveTo(x + hazard.width - 12, y + 8);
  ctx.lineTo(x + hazard.width - 3 - rotor, y + 3);
  ctx.stroke();

  ctx.fillStyle = "#394753";
  roundRect(x + 10, y + 8, hazard.width - 20, 22, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.coral;
  ctx.beginPath();
  ctx.arc(x + hazard.width / 2, y + 19, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 111, 97, 0.17)";
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 30);
  ctx.lineTo(x + hazard.width - 24, y + 30);
  ctx.lineTo(x + hazard.width / 2, y + 78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  particles.forEach((particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  floaters.forEach((floater) => {
    ctx.save();
    ctx.globalAlpha = clamp(floater.life / 0.7, 0, 1);
    ctx.fillStyle = floater.color;
    ctx.font = "900 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.restore();
  });
}

function drawOverlay(title, action) {
  ctx.save();
  ctx.fillStyle = "rgba(10, 16, 20, 0.46)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = "center";
  ctx.font = "900 58px system-ui, sans-serif";
  ctx.fillText(title, WORLD.width / 2, 212);
  ctx.fillStyle = COLORS.mint;
  ctx.font = "900 28px system-ui, sans-serif";
  ctx.fillText(action, WORLD.width / 2, 262);
  ctx.restore();
}

function blob(x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.42, h * 0.78, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, y - h * 0.12, w * 0.36, h, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.58, y, w * 0.44, h * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
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

function loop(now) {
  if (!lastTime) {
    lastTime = now;
  }
  const dt = Math.min((now - lastTime) / 1000, 0.032);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resizeCanvas);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    requestJump();
  } else if (event.code === "KeyE" || event.code === "KeyJ" || event.code === "Enter") {
    event.preventDefault();
    throwEgg();
  } else if (event.code === "KeyP") {
    togglePause();
  } else if (event.code === "KeyR") {
    resetGame();
    startGame();
  }
});

canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  requestJump();
});

pauseBtn.addEventListener("click", () => {
  togglePause();
});

restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

throwBtn.addEventListener("click", () => {
  throwEgg();
});

resizeCanvas();
resetGame();
requestAnimationFrame(loop);
