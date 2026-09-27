const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const dungeonWrap = document.getElementById("dungeonWrap");
const statusText = document.getElementById("statusText");
const waitBtn = document.getElementById("waitBtn");
const restartBtn = document.getElementById("restartBtn");
const choiceOverlay = document.getElementById("choiceOverlay");
const choiceList = document.getElementById("choiceList");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverTitle = document.getElementById("gameOverTitle");
const againBtn = document.getElementById("againBtn");
const heroName = document.getElementById("heroName");
const heroLine = document.getElementById("heroLine");
const hpText = document.getElementById("hpText");
const atkText = document.getElementById("atkText");
const defText = document.getElementById("defText");
const fishText = document.getElementById("fishText");
const skillList = document.getElementById("skillList");
const relicList = document.getElementById("relicList");
const logList = document.getElementById("logList");

const GRID_W = 34;
const GRID_H = 24;
const MAX_FLOOR = 6;
const WALL = 0;
const FLOOR = 1;
const STAIRS = 2;
const HEAL_COST = 12;
const SAVE_KEY = "cat-rogue-best-fish";

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const ENEMY_TYPES = [
  { id: "dust", name: "尘团", hp: 8, atk: 3, def: 0, fish: 5, color: "#6f725f" },
  { id: "box", name: "纸箱怪", hp: 14, atk: 4, def: 1, fish: 8, color: "#8a6342" },
  { id: "can", name: "回声罐", hp: 18, atk: 6, def: 2, fish: 12, color: "#526677" },
  { id: "shade", name: "影爪", hp: 24, atk: 8, def: 2, fish: 18, color: "#594b62" },
];

const RELIC_POOL = [
  {
    id: "claws",
    name: "磨亮爪尖",
    text: "攻击 +2。",
    apply: () => {
      hero.atk += 2;
    },
  },
  {
    id: "cushion",
    name: "软垫背包",
    text: "最大生命 +8，并回复 8。",
    apply: () => {
      hero.maxHp += 8;
      hero.hp = Math.min(hero.maxHp, hero.hp + 8);
    },
  },
  {
    id: "collar",
    name: "守护铃铛",
    text: "防御 +1。",
    apply: () => {
      hero.def += 1;
    },
  },
  {
    id: "lucky",
    name: "招财尾巴",
    text: "击败敌人多获得 4 鱼干。",
    apply: () => {
      hero.bonusFish += 4;
    },
  },
  {
    id: "snack",
    name: "随身小鱼",
    text: "鱼干治疗多回复 5。",
    apply: () => {
      hero.healBonus += 5;
    },
  },
  {
    id: "purr",
    name: "呼噜引擎",
    text: "进入新楼层时回复 4。",
    apply: () => {
      hero.floorHeal += 4;
    },
  },
  {
    id: "focus",
    name: "专注胡须",
    text: "暴击率 +12%。",
    apply: () => {
      hero.crit += 0.12;
    },
  },
  {
    id: "nine",
    name: "第九条命",
    text: "首次倒下时以 12 生命复活。",
    apply: () => {
      hero.revives += 1;
    },
  },
  {
    id: "boots",
    name: "轻脚掌",
    text: "每下两层永久攻击 +1、防御 +1。",
    apply: () => {
      hero.scalingPaws += 1;
    },
  },
  {
    id: "boxCrown",
    name: "纸箱王冠",
    text: "撞墙会钻出一格洞，每次钻洞消耗 1 生命。",
    apply: () => {
      hero.canTunnel = true;
    },
  },
  {
    id: "fishCompass",
    name: "鱼骨罗盘",
    text: "普通怪物会优先追地上的鱼干，而不是追你。",
    apply: () => {
      hero.monstersChaseFish = true;
    },
  },
  {
    id: "moonBell",
    name: "月光铃铛",
    text: "每层首次倒下时，时间倒回到上一回合。",
    apply: () => {
      hero.rewindCharges += 1;
    },
  },
];

let width = 0;
let height = 0;
let dpr = 1;
let grid = [];
let rooms = [];
let enemies = [];
let items = [];
let particles = [];
let logs = [];
let phase = "playing";
let floor = 1;
let bestFish = Number(localStorage.getItem(SAVE_KEY) || 0);
let selectedCell = null;
let inputLocked = false;
let hero = null;
let turnSnapshots = [];

function init() {
  bindEvents();
  resize();
  newRun();
  requestAnimationFrame(draw);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  restartBtn.addEventListener("click", newRun);
  againBtn.addEventListener("click", newRun);
  waitBtn.addEventListener("click", () => playerWait());

  window.addEventListener("keydown", (event) => {
    if (phase !== "playing") return;
    const key = event.key.toLowerCase();
    if (["arrowup", "w"].includes(key)) {
      event.preventDefault();
      attemptMove(0, -1);
    } else if (["arrowdown", "s"].includes(key)) {
      event.preventDefault();
      attemptMove(0, 1);
    } else if (["arrowleft", "a"].includes(key)) {
      event.preventDefault();
      attemptMove(-1, 0);
    } else if (["arrowright", "d"].includes(key)) {
      event.preventDefault();
      attemptMove(1, 0);
    } else if (key === " " || key === ".") {
      event.preventDefault();
      playerWait();
    } else if (key === "q") {
      event.preventDefault();
      eatFish();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    selectedCell = cellFromPointer(event);
  });

  canvas.addEventListener("pointerleave", () => {
    selectedCell = null;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (phase !== "playing") return;
    const cell = cellFromPointer(event);
    if (!cell) return;
    const dx = cell.x - hero.x;
    const dy = cell.y - hero.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      attemptMove(dx, dy);
    }
  });
}

function resize() {
  const rect = dungeonWrap.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function newRun() {
  floor = 1;
  hero = {
    name: "豆包",
    maxHp: 28,
    hp: 28,
    atk: 5,
    def: 1,
    fish: 0,
    crit: 0.06,
    bonusFish: 0,
    healBonus: 0,
    floorHeal: 0,
    revives: 0,
    scalingPaws: 0,
    canTunnel: false,
    monstersChaseFish: false,
    rewindCharges: 0,
    floorRewindUsed: false,
    relics: [],
    x: 0,
    y: 0,
    hurtUntil: 0,
  };
  logs = [];
  particles = [];
  turnSnapshots = [];
  phase = "playing";
  inputLocked = false;
  choiceOverlay.hidden = true;
  gameOverOverlay.hidden = true;
  addLog(`豆包进入地牢。历史最多鱼干 ${bestFish}。`);
  generateFloor();
  updateUI();
}

function generateFloor() {
  grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(WALL));
  rooms = [];
  enemies = [];
  items = [];
  turnSnapshots = [];
  hero.floorRewindUsed = false;
  selectedCell = null;

  let attempts = 0;
  while (rooms.length < 11 && attempts < 180) {
    attempts += 1;
    const w = randomInt(4, 8);
    const h = randomInt(4, 7);
    const x = randomInt(1, GRID_W - w - 2);
    const y = randomInt(1, GRID_H - h - 2);
    const room = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
    if (rooms.some((other) => roomsOverlap(room, other))) continue;
    carveRoom(room);
    if (rooms.length) connectRooms(rooms[rooms.length - 1], room);
    rooms.push(room);
  }

  if (rooms.length < 4) {
    carveFallbackMap();
  }

  const start = rooms[0];
  const stairsRoom = rooms[rooms.length - 1];
  hero.x = start.cx;
  hero.y = start.cy;
  grid[stairsRoom.cy][stairsRoom.cx] = STAIRS;

  spawnFloorContent();
  if (floor > 1 && hero.floorHeal > 0) {
    healHero(hero.floorHeal);
    addLog(`呼噜引擎让豆包回复 ${hero.floorHeal}。`);
  }
  if (hero.scalingPaws > 0 && floor > 1 && floor % 2 === 1) {
    hero.atk += hero.scalingPaws;
    hero.def += hero.scalingPaws;
    addLog(`轻脚掌成长，攻击和防御各 +${hero.scalingPaws}。`);
  }
  statusText.textContent = `FLOOR ${floor}`;
}

function carveFallbackMap() {
  grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(WALL));
  rooms = [
    { x: 2, y: 3, w: 8, h: 7, cx: 6, cy: 6 },
    { x: 14, y: 4, w: 8, h: 6, cx: 18, cy: 7 },
    { x: 24, y: 13, w: 7, h: 6, cx: 27, cy: 16 },
    { x: 6, y: 15, w: 9, h: 6, cx: 10, cy: 18 },
  ];
  for (const room of rooms) carveRoom(room);
  for (let i = 1; i < rooms.length; i += 1) connectRooms(rooms[i - 1], rooms[i]);
}

function roomsOverlap(a, b) {
  return (
    a.x - 1 < b.x + b.w + 1 &&
    a.x + a.w + 1 > b.x - 1 &&
    a.y - 1 < b.y + b.h + 1 &&
    a.y + a.h + 1 > b.y - 1
  );
}

function carveRoom(room) {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      grid[y][x] = FLOOR;
    }
  }
}

function connectRooms(a, b) {
  if (Math.random() < 0.5) {
    carveHorizontal(a.cx, b.cx, a.cy);
    carveVertical(a.cy, b.cy, b.cx);
  } else {
    carveVertical(a.cy, b.cy, a.cx);
    carveHorizontal(a.cx, b.cx, b.cy);
  }
}

function carveHorizontal(x1, x2, y) {
  const min = Math.min(x1, x2);
  const max = Math.max(x1, x2);
  for (let x = min; x <= max; x += 1) grid[y][x] = FLOOR;
}

function carveVertical(y1, y2, x) {
  const min = Math.min(y1, y2);
  const max = Math.max(y1, y2);
  for (let y = min; y <= max; y += 1) grid[y][x] = FLOOR;
}

function spawnFloorContent() {
  const enemyCount = Math.min(6 + floor * 2, 18);
  const itemCount = 5 + Math.floor(floor / 2);
  const candidateRooms = rooms.slice(1, -1);

  for (let i = 0; i < enemyCount; i += 1) {
    const room = candidateRooms[randomInt(0, candidateRooms.length - 1)] || rooms[1];
    const pos = randomFloorInRoom(room);
    if (!pos || enemyAt(pos.x, pos.y)) continue;
    enemies.push(createEnemy(pos.x, pos.y));
  }

  for (let i = 0; i < itemCount; i += 1) {
    const room = rooms[randomInt(1, rooms.length - 1)];
    const pos = randomFloorInRoom(room);
    if (!pos || occupied(pos.x, pos.y)) continue;
    const roll = Math.random();
    const type = roll < 0.44 ? "fish" : roll < 0.72 ? "heart" : "bell";
    items.push({ x: pos.x, y: pos.y, type });
  }

  if (floor === MAX_FLOOR) {
    const bossRoom = rooms[rooms.length - 1];
    const boss = createEnemy(bossRoom.cx, Math.max(1, bossRoom.cy - 2), true);
    if (!occupied(boss.x, boss.y)) enemies.push(boss);
  }
}

function randomFloorInRoom(room) {
  if (!room) return null;
  for (let tries = 0; tries < 20; tries += 1) {
    const x = randomInt(room.x + 1, room.x + room.w - 2);
    const y = randomInt(room.y + 1, room.y + room.h - 2);
    if (isWalkable(x, y) && !occupied(x, y)) return { x, y };
  }
  return null;
}

function createEnemy(x, y, boss = false) {
  const maxType = Math.min(ENEMY_TYPES.length - 1, Math.floor((floor - 1) / 2) + (boss ? 3 : 0));
  const type = boss ? ENEMY_TYPES[ENEMY_TYPES.length - 1] : ENEMY_TYPES[randomInt(0, maxType)];
  const scale = boss ? floor + 5 : floor - 1;
  return {
    type: type.id,
    name: boss ? "守门影爪" : type.name,
    maxHp: type.hp + scale * 4,
    hp: type.hp + scale * 4,
    atk: type.atk + Math.floor(scale * 1.35),
    def: type.def + Math.floor(scale / 3),
    fish: type.fish + floor * 2 + (boss ? 45 : 0),
    color: type.color,
    boss,
    x,
    y,
    hurtUntil: 0,
  };
}

function attemptMove(dx, dy) {
  if (phase !== "playing" || inputLocked) return;
  const nx = hero.x + dx;
  const ny = hero.y + dy;
  if (!inside(nx, ny) || grid[ny][nx] === WALL) {
    if (hero.canTunnel && inside(nx, ny) && nx > 0 && ny > 0 && nx < GRID_W - 1 && ny < GRID_H - 1 && hero.hp > 1) {
      rememberTurn();
      grid[ny][nx] = FLOOR;
      hero.hp -= 1;
      hero.x = nx;
      hero.y = ny;
      burst(nx, ny, "#b7893f", 18);
      addLog("纸箱王冠咔哒一声，豆包在墙上钻出一个洞。");
      completePlayerTurn();
      return;
    }
    bump(hero.x + dx * 0.18, hero.y + dy * 0.18, "#d6c59b");
    return;
  }

  const enemy = enemyAt(nx, ny);
  if (enemy) {
    rememberTurn();
    attackEnemy(enemy);
    completePlayerTurn();
    return;
  }

  rememberTurn();
  hero.x = nx;
  hero.y = ny;
  pickupAt(nx, ny);
  if (grid[ny][nx] === STAIRS) {
    reachStairs();
    return;
  }
  completePlayerTurn();
}

function playerWait() {
  if (phase !== "playing" || inputLocked) return;
  rememberTurn();
  addLog("豆包竖起耳朵，等了一拍。");
  completePlayerTurn();
}

function eatFish() {
  if (phase !== "playing" || inputLocked) return;
  if (hero.hp >= hero.maxHp) {
    addLog("生命已经满了。");
    return;
  }
  if (hero.fish < HEAL_COST) {
    addLog(`鱼干不足，需要 ${HEAL_COST}。`);
    return;
  }
  rememberTurn();
  hero.fish -= HEAL_COST;
  const amount = 9 + hero.healBonus;
  healHero(amount);
  addLog(`豆包吃掉鱼干，回复 ${amount}。`);
  completePlayerTurn();
}

function completePlayerTurn() {
  if (phase !== "playing") return;
  inputLocked = true;
  window.setTimeout(() => {
    enemiesAct();
    inputLocked = false;
    checkHeroState();
    updateUI();
  }, 90);
  updateUI();
}

function rememberTurn() {
  if (!hero.rewindCharges || hero.floorRewindUsed) return;
  turnSnapshots.push({
    hero: {
      hp: hero.hp,
      fish: hero.fish,
      x: hero.x,
      y: hero.y,
      hurtUntil: hero.hurtUntil,
    },
    enemies: enemies.map((enemy) => ({ ...enemy })),
    items: items.map((item) => ({ ...item })),
    grid: grid.map((row) => row.slice()),
  });
  if (turnSnapshots.length > 6) {
    turnSnapshots.shift();
  }
}

function rewindTurn() {
  if (!turnSnapshots.length) return false;
  const snapshot = turnSnapshots.pop();
  hero.hp = Math.max(1, snapshot.hero.hp);
  hero.fish = snapshot.hero.fish;
  hero.x = snapshot.hero.x;
  hero.y = snapshot.hero.y;
  hero.hurtUntil = performance.now() + 360;
  enemies = snapshot.enemies.map((enemy) => ({ ...enemy }));
  items = snapshot.items.map((item) => ({ ...item }));
  grid = snapshot.grid.map((row) => row.slice());
  hero.floorRewindUsed = true;
  turnSnapshots = [];
  burst(hero.x, hero.y, "#b7893f", 42);
  addLog("月光铃铛响起，时间倒回到上一回合。");
  return true;
}

function attackEnemy(enemy) {
  const crit = Math.random() < hero.crit;
  const damage = Math.max(1, hero.atk + randomInt(0, 2) - enemy.def) * (crit ? 2 : 1);
  enemy.hp -= damage;
  enemy.hurtUntil = performance.now() + 240;
  burst(enemy.x, enemy.y, crit ? "#e8b746" : "#e96356", crit ? 22 : 14);
  addLog(`豆包抓击 ${enemy.name}，造成 ${damage}${crit ? " 暴击" : ""}。`);
  if (enemy.hp <= 0) {
    defeatEnemy(enemy);
  }
}

function defeatEnemy(enemy) {
  enemies = enemies.filter((item) => item !== enemy);
  const gain = enemy.fish + hero.bonusFish;
  hero.fish += gain;
  burst(enemy.x, enemy.y, "#e8b746", 24);
  addLog(`${enemy.name} 散开，获得 ${gain} 鱼干。`);
  if (Math.random() < 0.24) {
    items.push({ x: enemy.x, y: enemy.y, type: Math.random() < 0.58 ? "fish" : "heart" });
  }
}

function enemiesAct() {
  for (const enemy of [...enemies]) {
    if (phase !== "playing") return;
    const bait = hero.monstersChaseFish && !enemy.boss ? nearestBait(enemy) : null;
    if (!bait && distance(enemy, hero) === 1) {
      enemyAttack(enemy);
      continue;
    }
    const target = bait || { x: hero.x, y: hero.y, kind: "hero" };
    const seen = bait || manhattan(enemy.x, enemy.y, hero.x, hero.y) <= 9 || enemy.boss;
    const step = seen ? findNextStep(enemy.x, enemy.y, target.x, target.y) : randomEnemyStep(enemy);
    if (!step) continue;
    if (bait && step.x === bait.x && step.y === bait.y) {
      enemy.x = step.x;
      enemy.y = step.y;
      items = items.filter((item) => item !== bait.item);
      addLog(`${enemy.name} 被鱼骨罗盘骗走，吞掉了地上的鱼干。`);
      continue;
    }
    if (step.x === hero.x && step.y === hero.y) {
      enemyAttack(enemy);
      continue;
    }
    if (!enemyAt(step.x, step.y) && isWalkable(step.x, step.y)) {
      enemy.x = step.x;
      enemy.y = step.y;
    }
  }
}

function nearestBait(enemy) {
  const baitItems = items.filter((item) => item.type === "fish");
  if (!baitItems.length) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const item of baitItems) {
    const d = manhattan(enemy.x, enemy.y, item.x, item.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = item;
    }
  }
  if (!best || bestDistance > 14) return null;
  return { x: best.x, y: best.y, kind: "bait", item: best };
}

function enemyAttack(enemy) {
  const damage = Math.max(1, enemy.atk + randomInt(0, 1) - hero.def);
  hero.hp -= damage;
  hero.hurtUntil = performance.now() + 260;
  burst(hero.x, hero.y, "#805fc6", 14);
  addLog(`${enemy.name} 攻击豆包，造成 ${damage}。`);
}

function findNextStep(sx, sy, tx, ty) {
  const queue = [{ x: sx, y: sy }];
  const cameFrom = new Map([[keyOf(sx, sy), null]]);

  while (queue.length) {
    const cell = queue.shift();
    if (cell.x === tx && cell.y === ty) break;
    for (const dir of DIRS) {
      const nx = cell.x + dir.x;
      const ny = cell.y + dir.y;
      const key = keyOf(nx, ny);
      if (cameFrom.has(key)) continue;
      if (!inside(nx, ny) || grid[ny][nx] === WALL) continue;
      const blocker = enemyAt(nx, ny);
      if (blocker && !(nx === tx && ny === ty)) continue;
      cameFrom.set(key, cell);
      queue.push({ x: nx, y: ny });
    }
  }

  const targetKey = keyOf(tx, ty);
  if (!cameFrom.has(targetKey)) return null;
  let current = { x: tx, y: ty };
  let previous = cameFrom.get(targetKey);
  while (previous && !(previous.x === sx && previous.y === sy)) {
    current = previous;
    previous = cameFrom.get(keyOf(current.x, current.y));
  }
  return current;
}

function randomEnemyStep(enemy) {
  const options = DIRS
    .map((dir) => ({ x: enemy.x + dir.x, y: enemy.y + dir.y }))
    .filter((cell) => isWalkable(cell.x, cell.y) && !enemyAt(cell.x, cell.y));
  return options.length ? options[randomInt(0, options.length - 1)] : null;
}

function pickupAt(x, y) {
  const item = items.find((entry) => entry.x === x && entry.y === y);
  if (!item) return;
  items = items.filter((entry) => entry !== item);

  if (item.type === "fish") {
    const gain = 10 + floor * 2;
    hero.fish += gain;
    addLog(`捡到 ${gain} 鱼干。`);
    burst(x, y, "#e8b746", 16);
  } else if (item.type === "heart") {
    const amount = 8 + floor;
    healHero(amount);
    addLog(`吃到小鱼汤，回复 ${amount}。`);
    burst(x, y, "#e96356", 14);
  } else {
    hero.fish += 18;
    addLog("捡到铃铛宝物，获得 18 鱼干。");
    burst(x, y, "#805fc6", 18);
  }
}

function reachStairs() {
  if (floor >= MAX_FLOOR) {
    finishRun(true);
    return;
  }
  phase = "choosing";
  addLog(`第 ${floor} 层探索完成。`);
  showChoices();
  updateUI();
}

function showChoices() {
  const options = sampleRelics(3);
  choiceList.innerHTML = "";
  for (const relic of options) {
    const card = document.createElement("button");
    card.className = "choice-card";
    card.type = "button";
    const name = document.createElement("strong");
    name.textContent = relic.name;
    const text = document.createElement("span");
    text.textContent = relic.text;
    card.append(name, text);
    card.addEventListener("click", () => chooseRelic(relic));
    choiceList.appendChild(card);
  }
  choiceOverlay.hidden = false;
}

function chooseRelic(relic) {
  if (phase !== "choosing") return;
  hero.relics.push(relic);
  relic.apply();
  addLog(`获得强化：${relic.name}。`);
  floor += 1;
  phase = "playing";
  choiceOverlay.hidden = true;
  generateFloor();
  updateUI();
}

function sampleRelics(count) {
  const uniqueRelics = new Set(["nine", "boxCrown", "fishCompass", "moonBell"]);
  const available = RELIC_POOL.filter((relic) => {
    if (uniqueRelics.has(relic.id)) return !hero.relics.some((owned) => owned.id === relic.id);
    return true;
  });
  const picks = [];
  while (picks.length < count && available.length) {
    const index = randomInt(0, available.length - 1);
    picks.push(available.splice(index, 1)[0]);
  }
  return picks;
}

function healHero(amount) {
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
}

function checkHeroState() {
  if (hero.hp > 0 || phase !== "playing") return;
  if (hero.rewindCharges > 0 && !hero.floorRewindUsed && rewindTurn()) {
    inputLocked = false;
    return;
  }
  if (hero.revives > 0) {
    hero.revives -= 1;
    hero.hp = Math.min(hero.maxHp, 12);
    addLog("第九条命亮起，豆包重新站了起来。");
    burst(hero.x, hero.y, "#e8b746", 36);
    return;
  }
  finishRun(false);
}

function finishRun(cleared) {
  phase = "ended";
  inputLocked = false;
  bestFish = Math.max(bestFish, hero.fish);
  localStorage.setItem(SAVE_KEY, String(bestFish));
  gameOverTitle.textContent = cleared ? `通关了 · ${hero.fish} 鱼干` : `倒下了 · ${hero.fish} 鱼干`;
  gameOverOverlay.hidden = false;
  statusText.textContent = cleared ? "CLEAR" : "GAME OVER";
  addLog(cleared ? "豆包带着满袋鱼干离开地牢。" : "豆包被送回了入口。");
  updateUI();
}

function updateUI() {
  statusText.textContent = phase === "ended" ? statusText.textContent : `FLOOR ${floor}`;
  heroName.textContent = hero.name;
  heroLine.textContent = `楼层 ${floor}/${MAX_FLOOR} · 最多鱼干 ${bestFish}`;
  hpText.textContent = `${Math.max(0, hero.hp)}/${hero.maxHp}`;
  atkText.textContent = String(hero.atk);
  defText.textContent = String(hero.def);
  fishText.textContent = String(hero.fish);
  waitBtn.disabled = phase !== "playing";
  renderSkills();
  renderRelics();
  renderLogs();
}

function renderSkills() {
  skillList.innerHTML = "";
  const skills = [
    "WASD/方向键移动",
    "撞怪爪击",
    "空格等待",
    `Q 鱼干治疗(${HEAL_COST})`,
  ];
  if (hero.canTunnel) skills.push("撞墙钻洞");
  if (hero.monstersChaseFish) skills.push("怪物追鱼干");
  if (hero.rewindCharges && !hero.floorRewindUsed) skills.push("本层可回滚");
  for (const skill of skills) {
    const item = document.createElement("div");
    item.className = "pill";
    item.textContent = skill;
    skillList.appendChild(item);
  }
}

function renderRelics() {
  relicList.innerHTML = "";
  if (!hero.relics.length) {
    const item = document.createElement("div");
    item.className = "pill";
    item.textContent = "暂无";
    relicList.appendChild(item);
    return;
  }
  for (const relic of hero.relics) {
    const item = document.createElement("div");
    item.className = "pill";
    item.textContent = relic.name;
    relicList.appendChild(item);
  }
}

function renderLogs() {
  logList.innerHTML = "";
  for (const line of logs.slice(0, 14)) {
    const item = document.createElement("div");
    item.className = "log-line";
    item.textContent = line;
    logList.appendChild(item);
  }
}

function addLog(message) {
  logs.unshift(message);
  if (logs.length > 90) logs.length = 90;
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  const layout = getLayout();
  drawMap(layout);
  drawItems(layout, now);
  drawStairsHint(layout, now);
  drawEnemies(layout, now);
  drawHero(layout, now);
  drawParticles(layout);
  drawHover(layout);
  requestAnimationFrame(draw);
}

function getLayout() {
  const cell = Math.floor(Math.min(width / GRID_W, height / GRID_H));
  const tile = clamp(cell, 13, 30);
  const mapW = tile * GRID_W;
  const mapH = tile * GRID_H;
  return {
    tile,
    x: Math.floor((width - mapW) / 2),
    y: Math.floor((height - mapH) / 2),
    mapW,
    mapH,
  };
}

function drawMap(layout) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  roundRect(ctx, layout.x - 10, layout.y - 10, layout.mapW + 20, layout.mapH + 20, 8);
  ctx.fill();

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const px = layout.x + x * layout.tile;
      const py = layout.y + y * layout.tile;
      const tile = grid[y][x];
      if (tile === WALL) {
        ctx.fillStyle = "#68736d";
      } else if (tile === STAIRS) {
        ctx.fillStyle = "#f4e2a8";
      } else {
        ctx.fillStyle = (x + y) % 2 ? "#f8f3e4" : "#fffaf0";
      }
      ctx.fillRect(px, py, layout.tile, layout.tile);

      if (tile === WALL) {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(px + 2, py + 2, layout.tile - 4, 2);
      } else {
        ctx.strokeStyle = "rgba(31,35,30,0.055)";
        ctx.strokeRect(px + 0.5, py + 0.5, layout.tile - 1, layout.tile - 1);
      }
    }
  }
  ctx.restore();
}

function drawItems(layout, now) {
  for (const item of items) {
    const center = cellCenter(item.x, item.y, layout);
    const bob = Math.sin(now / 260 + item.x) * layout.tile * 0.04;
    if (item.type === "fish") {
      drawFish(center.x, center.y + bob, layout.tile * 0.28);
    } else if (item.type === "heart") {
      drawHeart(center.x, center.y + bob, layout.tile * 0.25);
    } else {
      drawBell(center.x, center.y + bob, layout.tile * 0.26);
    }
  }
}

function drawStairsHint(layout, now) {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (grid[y][x] !== STAIRS) continue;
      const center = cellCenter(x, y, layout);
      ctx.save();
      ctx.strokeStyle = `rgba(52,143,104,${0.35 + Math.sin(now / 260) * 0.12})`;
      ctx.lineWidth = Math.max(2, layout.tile * 0.08);
      ctx.beginPath();
      ctx.arc(center.x, center.y, layout.tile * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#348f68";
      ctx.font = `900 ${layout.tile * 0.5}px ui-rounded, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↓", center.x, center.y + layout.tile * 0.02);
      ctx.restore();
    }
  }
}

function drawEnemies(layout, now) {
  for (const enemy of enemies) {
    const center = cellCenter(enemy.x, enemy.y, layout);
    const hurt = now < enemy.hurtUntil;
    const r = layout.tile * (enemy.boss ? 0.39 : 0.32);
    ctx.save();
    ctx.translate(center.x, center.y);
    if (hurt) ctx.translate(Math.sin(now / 22) * 2, 0);
    ctx.fillStyle = "rgba(31,35,30,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.86, r * 0.86, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hurt ? "#fffaf0" : enemy.color;
    ctx.strokeStyle = "rgba(31,35,30,0.28)";
    ctx.lineWidth = Math.max(1.5, layout.tile * 0.06);
    roundRect(ctx, -r, -r * 0.82, r * 2, r * 1.68, r * 0.32);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.14, r * 0.13, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.14, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f231e";
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.14, r * 0.06, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.14, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    drawHpBar(-r, r * 1.05, r * 2, r * 0.16, enemy.hp / enemy.maxHp);
    ctx.restore();
  }
}

function drawHero(layout, now) {
  const center = cellCenter(hero.x, hero.y, layout);
  const hurt = now < hero.hurtUntil;
  const r = layout.tile * 0.36;
  ctx.save();
  ctx.translate(center.x, center.y);
  if (hurt) ctx.translate(Math.sin(now / 20) * 3, 0);
  ctx.fillStyle = "rgba(31,35,30,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.88, r * 0.88, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hurt ? "#e5d7bd" : "#8f3a32";
  ctx.strokeStyle = "rgba(31,35,30,0.30)";
  ctx.lineWidth = Math.max(1.6, r * 0.11);
  drawCatEar(-r * 0.46, -r * 0.48, r, -0.2);
  drawCatEar(r * 0.46, -r * 0.48, r, 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.1, r * 0.17, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.1, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f231e";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2a39b";
  ctx.beginPath();
  ctx.moveTo(0, r * 0.08);
  ctx.lineTo(-r * 0.12, r * 0.22);
  ctx.lineTo(r * 0.12, r * 0.22);
  ctx.closePath();
  ctx.fill();
  drawHpBar(-r, r * 1.08, r * 2, r * 0.17, hero.hp / hero.maxHp);
  ctx.restore();
}

function drawCatEar(x, y, r, tilt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.55);
  ctx.lineTo(-r * 0.32, r * 0.12);
  ctx.lineTo(r * 0.32, r * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4b6a9";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.28);
  ctx.lineTo(-r * 0.15, r * 0.06);
  ctx.lineTo(r * 0.15, r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHpBar(x, y, w, h, ratio) {
  ctx.fillStyle = "rgba(31,35,30,0.18)";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = ratio > 0.45 ? "#348f68" : ratio > 0.22 ? "#e8b746" : "#e96356";
  roundRect(ctx, x, y, w * clamp(ratio, 0, 1), h, h / 2);
  ctx.fill();
}

function drawParticles(layout) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.life -= 0.028;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(layout.x + p.x * layout.tile, layout.y + p.y * layout.tile, p.size * layout.tile, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHover(layout) {
  if (!selectedCell || phase !== "playing") return;
  const { x, y } = selectedCell;
  if (!inside(x, y)) return;
  ctx.save();
  ctx.strokeStyle = "rgba(31,35,30,0.58)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    layout.x + x * layout.tile + 2,
    layout.y + y * layout.tile + 2,
    layout.tile - 4,
    layout.tile - 4,
  );
  ctx.restore();
}

function drawFish(x, y, r) {
  ctx.save();
  ctx.fillStyle = "#e8b746";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.84, y);
  ctx.lineTo(x - r * 1.32, y - r * 0.44);
  ctx.lineTo(x - r * 1.32, y + r * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1f231e";
  ctx.beginPath();
  ctx.arc(x + r * 0.48, y - r * 0.09, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeart(x, y, r) {
  ctx.save();
  ctx.fillStyle = "#e96356";
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.5, y, x - r, y - r * 1.2, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r, y - r * 1.2, x + r * 1.5, y, x, y + r);
  ctx.fill();
  ctx.restore();
}

function drawBell(x, y, r) {
  ctx.save();
  ctx.fillStyle = "#805fc6";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.18, r * 0.86, Math.PI, 0);
  ctx.lineTo(x + r * 0.72, y + r * 0.58);
  ctx.lineTo(x - r * 0.72, y + r * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8b746";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.65, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.035 + Math.random() * 0.08;
    particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.06 + Math.random() * 0.08,
      life: 1,
      color,
    });
  }
}

function bump(x, y, color) {
  burst(Math.round(x), Math.round(y), color, 8);
}

function cellCenter(x, y, layout) {
  return {
    x: layout.x + x * layout.tile + layout.tile / 2,
    y: layout.y + y * layout.tile + layout.tile / 2,
  };
}

function cellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const layout = getLayout();
  const x = Math.floor((event.clientX - rect.left - layout.x) / layout.tile);
  const y = Math.floor((event.clientY - rect.top - layout.y) / layout.tile);
  if (!inside(x, y)) return null;
  return { x, y };
}

function enemyAt(x, y) {
  return enemies.find((enemy) => enemy.x === x && enemy.y === y);
}

function itemAt(x, y) {
  return items.find((item) => item.x === x && item.y === y);
}

function occupied(x, y) {
  return (hero && hero.x === x && hero.y === y) || enemyAt(x, y) || itemAt(x, y);
}

function isWalkable(x, y) {
  return inside(x, y) && grid[y][x] !== WALL;
}

function inside(x, y) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
}

function distance(a, b) {
  return manhattan(a.x, a.y, b.x, b.y);
}

function manhattan(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function keyOf(x, y) {
  return `${x},${y}`;
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
