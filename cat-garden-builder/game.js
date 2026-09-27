const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gardenWrap = document.getElementById("gardenWrap");
const statusText = document.getElementById("statusText");
const rotateBtn = document.getElementById("rotateBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const coinText = document.getElementById("coinText");
const dayText = document.getElementById("dayText");
const toolRow = document.getElementById("toolRow");
const seedTab = document.getElementById("seedTab");
const buildTab = document.getElementById("buildTab");
const catalogList = document.getElementById("catalogList");
const selectedName = document.getElementById("selectedName");
const selectedDetail = document.getElementById("selectedDetail");
const logList = document.getElementById("logList");

const GRID_W = 18;
const GRID_H = 14;
const SAVE_KEY = "cat-garden-builder-save";
const START_COINS = 120;
const DAY_MINUTES = 16 * 60;

const PLANTS = [
  { id: "daisy", name: "小雏菊", icon: "D", cost: 8, value: 18, grow: 34, color: "#b7893f", petal: "#e5d7bd" },
  { id: "tulip", name: "郁金香", icon: "T", cost: 14, value: 35, grow: 48, color: "#8f3a32", petal: "#b46f62" },
  { id: "lavender", name: "薰衣草", icon: "L", cost: 22, value: 58, grow: 66, color: "#61506b", petal: "#8c7c93" },
  { id: "sunflower", name: "向日葵", icon: "S", cost: 36, value: 96, grow: 86, color: "#a5772f", petal: "#c5a15d" },
];

const BUILD_ITEMS = [
  { id: "grass", kind: "ground", name: "草地", icon: "G", cost: 1, ground: "grass", detail: "1x1" },
  { id: "soil", kind: "ground", name: "花圃", icon: "S", cost: 3, ground: "soil", detail: "1x1" },
  { id: "path", kind: "ground", name: "石路", icon: "P", cost: 4, ground: "path", detail: "1x1" },
  { id: "pond", kind: "ground", name: "水池", icon: "W", cost: 10, ground: "water", detail: "1x1" },
  { id: "fence", kind: "object", name: "木围栏", icon: "F", cost: 12, w: 1, h: 1, color: "#7a523b" },
  { id: "lamp", kind: "object", name: "小路灯", icon: "L", cost: 28, w: 1, h: 1, color: "#b7893f" },
  { id: "chair", kind: "object", name: "花园椅", icon: "C", cost: 34, w: 1, h: 1, color: "#516276" },
  { id: "table", kind: "object", name: "茶桌", icon: "T", cost: 48, w: 2, h: 1, color: "#8a6342" },
  { id: "bed", kind: "object", name: "猫窝", icon: "B", cost: 62, w: 2, h: 2, color: "#8f3a32" },
  { id: "house", kind: "object", name: "小木屋", icon: "H", cost: 130, w: 3, h: 2, color: "#9a633f" },
];

const TOOLS = [
  { id: "plant", label: "Plant" },
  { id: "water", label: "Water" },
  { id: "harvest", label: "Pick" },
  { id: "shovel", label: "Clear" },
];

const CAT_PROFILES = [
  { name: "豆包", color: "#8f3a32", x: 2.1, y: GRID_H - 1.4, trait: "爱闻花" },
  { name: "墨墨", color: "#24231f", x: 3.2, y: GRID_H - 1.7, trait: "爱躲屋" },
];

const CAT_ACTIONS = {
  wander: "闲逛",
  sniff: "闻花",
  nap: "睡觉",
  sit: "发呆",
  hide: "躲猫猫",
  watch: "看水",
  inspect: "巡视",
};

let width = 0;
let height = 0;
let dpr = 1;
let cells = [];
let objects = [];
let cats = [];
let coins = START_COINS;
let day = 1;
let minute = 6 * 60;
let selectedTool = "plant";
let selectedTab = "seeds";
let selectedPlant = PLANTS[0].id;
let selectedBuild = BUILD_ITEMS[1].id;
let rotation = 0;
let hoverCell = null;
let logs = [];
let particles = [];
let lastFrame = performance.now();
let nextObjectId = 1;
let autosaveAt = 0;

function init() {
  bindEvents();
  resize();
  loadOrCreate();
  renderTools();
  renderCatalog();
  updateUI();
  requestAnimationFrame(loop);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  rotateBtn.addEventListener("click", rotateSelection);
  saveBtn.addEventListener("click", () => {
    saveGame();
    addLog("花园已保存。");
  });
  resetBtn.addEventListener("click", resetGame);
  seedTab.addEventListener("click", () => switchTab("seeds"));
  buildTab.addEventListener("click", () => switchTab("build"));

  canvas.addEventListener("pointermove", (event) => {
    hoverCell = cellFromPointer(event);
  });

  canvas.addEventListener("pointerleave", () => {
    hoverCell = null;
  });

  canvas.addEventListener("pointerdown", (event) => {
    const cell = cellFromPointer(event);
    if (!cell) return;
    applyTool(cell.x, cell.y);
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "r") {
      rotateSelection();
    } else if (key === "1") {
      setTool("plant");
    } else if (key === "2") {
      setTool("water");
    } else if (key === "3") {
      setTool("harvest");
    } else if (key === "4") {
      setTool("shovel");
    }
  });
}

function resize() {
  const rect = gardenWrap.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadOrCreate() {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const state = JSON.parse(saved);
      cells = state.cells;
      objects = state.objects || [];
      cats = state.cats || createDefaultCats();
      coins = state.coins ?? START_COINS;
      day = state.day ?? 1;
      minute = state.minute ?? 6 * 60;
      selectedPlant = state.selectedPlant || selectedPlant;
      selectedBuild = state.selectedBuild || selectedBuild;
      nextObjectId = state.nextObjectId || 1;
      logs = state.logs || [];
      normalizeLoadedCells();
      normalizeCats();
      addLog("欢迎回到猫猫花园。");
      return;
    } catch (error) {
      localStorage.removeItem(SAVE_KEY);
    }
  }
  createNewGarden();
}

function createNewGarden() {
  cells = Array.from({ length: GRID_H }, (_, y) =>
    Array.from({ length: GRID_W }, (_, x) => ({
      ground: starterGround(x, y),
      plant: null,
      objectId: null,
    })),
  );
  objects = [];
  cats = createDefaultCats();
  coins = START_COINS;
  day = 1;
  minute = 6 * 60;
  selectedTool = "plant";
  selectedTab = "seeds";
  selectedPlant = PLANTS[0].id;
  selectedBuild = BUILD_ITEMS[1].id;
  rotation = 0;
  nextObjectId = 1;
  logs = [];
  addStarterObjects();
  addLog("新的小院子开张了。");
  saveGame();
}

function starterGround(x, y) {
  if (x >= 2 && x <= 5 && y >= 3 && y <= 6) return "soil";
  if (x >= 8 && x <= 13 && y === 9) return "path";
  if ((x === 15 || x === 16) && (y === 2 || y === 3)) return "water";
  return "grass";
}

function addStarterObjects() {
  placeObjectFromDef(getBuild("fence"), 1, 1, 0, true);
  placeObjectFromDef(getBuild("chair"), 12, 10, 0, true);
  placeObjectFromDef(getBuild("lamp"), 14, 8, 0, true);
}

function createDefaultCats() {
  return CAT_PROFILES.map((cat, index) => ({
    ...cat,
    id: index + 1,
    target: null,
    action: "wander",
    actionTime: 0,
    thought: "",
    thoughtTime: 0,
    logAt: 0,
  }));
}

function normalizeLoadedCells() {
  if (!Array.isArray(cells) || cells.length !== GRID_H) {
    createNewGarden();
    return;
  }
  for (let y = 0; y < GRID_H; y += 1) {
    if (!Array.isArray(cells[y]) || cells[y].length !== GRID_W) {
      createNewGarden();
      return;
    }
    for (let x = 0; x < GRID_W; x += 1) {
      cells[y][x].ground ||= "grass";
      cells[y][x].plant ||= null;
      cells[y][x].objectId ||= null;
    }
  }
}

function normalizeCats() {
  if (!Array.isArray(cats) || !cats.length) {
    cats = createDefaultCats();
    return;
  }
  cats = cats.map((cat, index) => ({
    ...CAT_PROFILES[index % CAT_PROFILES.length],
    ...cat,
    id: cat.id || index + 1,
    target: cat.target || null,
    action: cat.action || "wander",
    actionTime: cat.actionTime || 0,
    thought: cat.thought || "",
    thoughtTime: cat.thoughtTime || 0,
    logAt: cat.logAt || 0,
  }));
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  createNewGarden();
  renderCatalog();
  updateUI();
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    cells,
    objects,
    cats,
    coins,
    day,
    minute,
    selectedPlant,
    selectedBuild,
    nextObjectId,
    logs: logs.slice(0, 18),
  }));
}

function loop(now) {
  const dt = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;
  advanceTime(dt);
  updatePlants(dt);
  updateCats(dt);
  updateParticles(dt);
  draw(now);
  if (now > autosaveAt) {
    autosaveAt = now + 5000;
    saveGame();
  }
  requestAnimationFrame(loop);
}

function advanceTime(dt) {
  minute += dt * 24;
  while (minute >= 22 * 60) {
    minute -= DAY_MINUTES;
    day += 1;
    addLog(`Day ${day}。`);
  }
}

function updatePlants(dt) {
  forEachCell((cell) => {
    if (!cell.plant) return;
    const plantDef = getPlant(cell.plant.type);
    const speed = cell.plant.water > 0 ? 2.4 : 1;
    cell.plant.growth = Math.min(plantDef.grow, cell.plant.growth + dt * speed);
    cell.plant.water = Math.max(0, cell.plant.water - dt);
  });
}

function updateCats(dt) {
  for (const cat of cats) {
    cat.thoughtTime = Math.max(0, cat.thoughtTime - dt);
    if (cat.actionTime > 0) {
      cat.actionTime -= dt;
      if (cat.action === "sniff" && Math.random() < dt * 0.018) {
        coins += 1;
        cat.thought = "+1";
        cat.thoughtTime = 1.4;
      }
      if (cat.actionTime > 0) continue;
      cat.target = null;
      cat.action = "wander";
    }

    if (!cat.target) {
      cat.target = chooseCatTarget(cat);
      cat.action = cat.target.action;
    }

    const dx = cat.target.x - cat.x;
    const dy = cat.target.y - cat.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      startCatAction(cat, cat.target);
      continue;
    }
    const speed = cat.action === "hide" ? 0.55 : 0.86;
    const step = Math.min(dist, dt * speed);
    cat.x += (dx / dist) * step;
    cat.y += (dy / dist) * step;
  }
}

function chooseCatTarget(cat) {
  const choices = [];
  for (const object of objects) {
    const def = getBuild(object.type);
    if (!def) continue;
    const center = objectCenter(object);
    if (def.id === "bed") choices.push({ ...center, action: "nap", weight: 5 });
    if (def.id === "house") choices.push({ ...center, action: "hide", weight: cat.trait === "爱躲屋" ? 7 : 4 });
    if (def.id === "chair") choices.push({ ...center, action: "sit", weight: 4 });
    if (def.id === "table") choices.push({ ...center, action: "inspect", weight: 3 });
    if (def.id === "lamp" && dayPhase(minute) !== "NOON") choices.push({ ...center, action: "sit", weight: 5 });
  }

  forEachCell((cell, x, y) => {
    if (cell.ground === "water") choices.push({ x: x + 0.5, y: y + 0.5, action: "watch", weight: 3 });
    if (!cell.plant) return;
    const plant = getPlant(cell.plant.type);
    if (cell.plant.growth >= plant.grow) {
      choices.push({ x: x + 0.5, y: y + 0.5, action: "sniff", weight: cat.trait === "爱闻花" ? 7 : 4, plant: plant.name });
    }
  });

  if (!choices.length || Math.random() < 0.28) {
    return randomWalkTarget();
  }
  return weightedPick(choices);
}

function startCatAction(cat, target) {
  cat.x = target.x;
  cat.y = target.y;
  cat.action = target.action;
  cat.actionTime = randomRange(2.8, 7.2);
  cat.thought = actionThought(target);
  cat.thoughtTime = 1.8;
  const now = performance.now();
  if (now > cat.logAt) {
    cat.logAt = now + randomRange(9000, 16000);
    addLog(`${cat.name}${catActionLine(target)}。`);
  }
}

function catActionLine(target) {
  if (target.action === "sniff") return `闻了闻${target.plant || "花"}`;
  if (target.action === "nap") return "在猫窝里睡成一团";
  if (target.action === "hide") return "钻进小木屋里";
  if (target.action === "sit") return "在家具旁边发呆";
  if (target.action === "watch") return "盯着水面看了很久";
  if (target.action === "inspect") return "巡视了茶桌";
  return "在院子里绕圈";
}

function actionThought(target) {
  if (target.action === "sniff") return "花";
  if (target.action === "nap") return "Z";
  if (target.action === "hide") return "...";
  if (target.action === "sit") return "坐";
  if (target.action === "watch") return "水";
  if (target.action === "inspect") return "?";
  return "";
}

function randomWalkTarget() {
  for (let tries = 0; tries < 30; tries += 1) {
    const x = randomInt(0, GRID_W - 1);
    const y = randomInt(0, GRID_H - 1);
    const cell = cells[y][x];
    if (cell.ground !== "water" && !cell.objectId) {
      return { x: x + 0.5, y: y + 0.5, action: "wander", weight: 1 };
    }
  }
  return { x: 2.5, y: GRID_H - 1.5, action: "wander", weight: 1 };
}

function objectCenter(object) {
  return { x: object.x + object.w / 2, y: object.y + object.h / 2 };
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function applyTool(x, y) {
  if (!inside(x, y)) return;
  if (selectedTool === "plant") {
    plantSeed(x, y);
  } else if (selectedTool === "water") {
    waterCell(x, y);
  } else if (selectedTool === "harvest") {
    harvestCell(x, y);
  } else if (selectedTool === "shovel") {
    clearCell(x, y);
  } else if (selectedTool === "build") {
    placeSelectedBuild(x, y);
  }
  updateUI();
}

function plantSeed(x, y) {
  const cell = cells[y][x];
  const plantDef = getPlant(selectedPlant);
  if (cell.ground !== "soil") {
    addLog("种子要种在花圃里。");
    return;
  }
  if (cell.plant || cell.objectId) {
    addLog("这格已经被占用了。");
    return;
  }
  if (!spend(plantDef.cost)) return;
  cell.plant = { type: plantDef.id, growth: 0, water: 0, shine: 0 };
  burst(x, y, plantDef.color, 14);
  addLog(`种下 ${plantDef.name}。`);
}

function waterCell(x, y) {
  const cell = cells[y][x];
  if (!cell.plant) {
    addLog("这里没有植物。");
    return;
  }
  cell.plant.water = 14;
  cell.plant.shine = 1;
  burst(x, y, "#64a8d8", 12);
  addLog("浇水完成。");
}

function harvestCell(x, y) {
  const cell = cells[y][x];
  if (!cell.plant) {
    addLog("这里没有可收获的植物。");
    return;
  }
  const plantDef = getPlant(cell.plant.type);
  if (cell.plant.growth < plantDef.grow) {
    addLog(`${plantDef.name} 还没开好。`);
    return;
  }
  coins += plantDef.value;
  cell.plant = null;
  burst(x, y, "#e7b84b", 24);
  addLog(`收获 ${plantDef.name}，获得 ${plantDef.value}。`);
}

function clearCell(x, y) {
  const cell = cells[y][x];
  if (cell.plant) {
    cell.plant = null;
    burst(x, y, "#9d7351", 10);
    addLog("清掉了一株植物。");
    return;
  }
  if (cell.objectId) {
    removeObject(cell.objectId);
    burst(x, y, "#9d7351", 12);
    addLog("拆掉了一件摆设。");
    return;
  }
  if (cell.ground !== "grass") {
    cell.ground = "grass";
    addLog("恢复成草地。");
  }
}

function placeSelectedBuild(x, y) {
  const def = getBuild(selectedBuild);
  if (!def) return;
  if (def.kind === "ground") {
    placeGround(def, x, y);
    return;
  }
  if (!canPlaceObject(def, x, y, rotation).ok) {
    addLog("这里放不下。");
    return;
  }
  if (!spend(def.cost)) return;
  placeObjectFromDef(def, x, y, rotation, false);
  burst(x, y, def.color || "#3f9a67", 18);
  addLog(`摆放 ${def.name}。`);
}

function placeGround(def, x, y) {
  const cell = cells[y][x];
  if (cell.objectId || cell.plant) {
    addLog("先清空这一格。");
    return;
  }
  if (cell.ground === def.ground) return;
  if (!spend(def.cost)) return;
  cell.ground = def.ground;
  burst(x, y, groundColor(def.ground), 8);
  addLog(`铺设 ${def.name}。`);
}

function placeObjectFromDef(def, x, y, rot, free) {
  const size = objectSize(def, rot);
  const id = nextObjectId;
  nextObjectId += 1;
  const object = { id, type: def.id, x, y, rot, w: size.w, h: size.h };
  objects.push(object);
  for (let yy = y; yy < y + size.h; yy += 1) {
    for (let xx = x; xx < x + size.w; xx += 1) {
      cells[yy][xx].objectId = id;
    }
  }
  if (!free && def.id === "house") {
    coins += 12;
    addLog("小木屋吸引来新的猫脚印。");
  }
}

function removeObject(id) {
  objects = objects.filter((object) => object.id !== id);
  forEachCell((cell) => {
    if (cell.objectId === id) cell.objectId = null;
  });
}

function canPlaceObject(def, x, y, rot) {
  const size = objectSize(def, rot);
  if (x < 0 || y < 0 || x + size.w > GRID_W || y + size.h > GRID_H) return { ok: false };
  for (let yy = y; yy < y + size.h; yy += 1) {
    for (let xx = x; xx < x + size.w; xx += 1) {
      const cell = cells[yy][xx];
      if (cell.objectId || cell.plant || cell.ground === "water") return { ok: false };
    }
  }
  return { ok: true };
}

function spend(amount) {
  if (coins < amount) {
    addLog("金币不够。");
    return false;
  }
  coins -= amount;
  return true;
}

function rotateSelection() {
  rotation = (rotation + 1) % 4;
}

function switchTab(tab) {
  selectedTab = tab;
  if (tab === "seeds") {
    selectedTool = "plant";
  } else {
    selectedTool = "build";
  }
  renderTools();
  renderCatalog();
  updateUI();
}

function setTool(tool) {
  selectedTool = tool;
  renderTools();
  updateUI();
}

function renderTools() {
  toolRow.innerHTML = "";
  for (const tool of TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tool.label;
    button.classList.toggle("active", selectedTool === tool.id);
    button.addEventListener("click", () => setTool(tool.id));
    toolRow.appendChild(button);
  }
}

function renderCatalog() {
  seedTab.classList.toggle("active", selectedTab === "seeds");
  buildTab.classList.toggle("active", selectedTab === "build");
  catalogList.innerHTML = "";
  const list = selectedTab === "seeds" ? PLANTS : BUILD_ITEMS;
  for (const item of list) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "catalog-item";
    const active = selectedTab === "seeds" ? item.id === selectedPlant : item.id === selectedBuild;
    row.classList.toggle("active", active);
    const icon = document.createElement("div");
    icon.className = "item-icon";
    icon.textContent = item.icon;
    icon.style.color = item.color || groundColor(item.ground) || "#20231d";
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const detail = document.createElement("span");
    detail.textContent = item.value ? `sell ${item.value}` : (item.detail || `${item.w}x${item.h}`);
    info.append(name, detail);
    const price = document.createElement("em");
    price.textContent = String(item.cost);
    row.append(icon, info, price);
    row.addEventListener("click", () => {
      if (selectedTab === "seeds") {
        selectedPlant = item.id;
        selectedTool = "plant";
      } else {
        selectedBuild = item.id;
        selectedTool = "build";
      }
      renderTools();
      renderCatalog();
      updateUI();
    });
    catalogList.appendChild(row);
  }
}

function updateUI() {
  coinText.textContent = String(coins);
  dayText.textContent = `Day ${day} · ${formatClock(minute)}`;
  statusText.textContent = dayPhase(minute);
  const item = selectedTool === "plant" ? getPlant(selectedPlant) : getBuild(selectedBuild);
  const catLine = cats.map((cat) => `${cat.name}:${CAT_ACTIONS[cat.action] || "闲逛"}`).join(" · ");
  selectedName.textContent = item ? item.name : selectedTool;
  selectedDetail.textContent = item ? `${item.cost} coins${item.value ? ` · sell ${item.value}` : ""} · ${catLine}` : catLine;
  renderLogs();
}

function renderLogs() {
  logList.innerHTML = "";
  for (const line of logs.slice(0, 14)) {
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = line;
    logList.appendChild(div);
  }
}

function addLog(message) {
  logs.unshift(message);
  if (logs.length > 80) logs.length = 80;
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  const layout = getLayout();
  drawGardenBase(layout);
  drawGrid(layout);
  drawPlants(layout, now);
  drawObjects(layout, now);
  drawCats(layout, now);
  drawParticles(layout);
  drawPreview(layout);
}

function getLayout() {
  const tile = Math.floor(Math.min(width / GRID_W, height / GRID_H, 42));
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

function drawGardenBase(layout) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.48)";
  roundRect(ctx, layout.x - 12, layout.y - 12, layout.mapW + 24, layout.mapH + 24, 8);
  ctx.fill();
  ctx.restore();
}

function drawGrid(layout) {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const cell = cells[y][x];
      const px = layout.x + x * layout.tile;
      const py = layout.y + y * layout.tile;
      drawGround(cell.ground, px, py, layout.tile, x, y);
      ctx.strokeStyle = "rgba(32,35,29,0.08)";
      ctx.strokeRect(px + 0.5, py + 0.5, layout.tile - 1, layout.tile - 1);
    }
  }
}

function drawGround(ground, x, y, s, gx, gy) {
  ctx.fillStyle = groundColor(ground);
  ctx.fillRect(x, y, s, s);
  if (ground === "grass") {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + (gx % 3) * 4 + 5, y + (gy % 2) * 6 + 6, s * 0.18, 2);
  } else if (ground === "soil") {
    ctx.fillStyle = "rgba(71,48,31,0.14)";
    ctx.fillRect(x + 4, y + s * 0.32, s - 8, 2);
    ctx.fillRect(x + 5, y + s * 0.62, s - 10, 2);
  } else if (ground === "path") {
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    roundRect(ctx, x + 5, y + 5, s - 10, s - 10, 5);
    ctx.fill();
  } else if (ground === "water") {
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.ellipse(x + s * 0.52, y + s * 0.48, s * 0.32, s * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlants(layout, now) {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const plant = cells[y][x].plant;
      if (!plant) continue;
      const def = getPlant(plant.type);
      const progress = plant.growth / def.grow;
      const cx = layout.x + x * layout.tile + layout.tile / 2;
      const cy = layout.y + y * layout.tile + layout.tile / 2;
      drawPlant(def, progress, cx, cy, layout.tile, now, plant.water > 0);
    }
  }
}

function drawPlant(def, progress, x, y, s, now, watered) {
  const stage = progress >= 1 ? 3 : progress > 0.66 ? 2 : progress > 0.28 ? 1 : 0;
  const bob = Math.sin(now / 360 + x * 0.04) * s * 0.025;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = "#3f9a67";
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.lineCap = "round";
  if (watered) {
    ctx.fillStyle = "rgba(100,168,216,0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, s * 0.22);
  ctx.lineTo(0, -s * (0.03 + stage * 0.08));
  ctx.stroke();
  ctx.fillStyle = "#55a873";
  ctx.beginPath();
  ctx.ellipse(-s * 0.12, s * 0.05, s * 0.12, s * 0.06, -0.55, 0, Math.PI * 2);
  ctx.ellipse(s * 0.12, -s * 0.02, s * 0.12, s * 0.06, 0.55, 0, Math.PI * 2);
  ctx.fill();
  if (stage === 0) {
    ctx.fillStyle = "#6b4b34";
    ctx.beginPath();
    ctx.arc(0, s * 0.18, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (stage === 1) {
    drawLeafCluster(s * 0.16);
  } else {
    drawFlower(def, s * (stage === 3 ? 0.19 : 0.13));
  }
  ctx.restore();
}

function drawLeafCluster(size) {
  ctx.fillStyle = "#3f9a67";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * size * 0.75, -size * 0.28, size, size * 0.52, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlower(def, radius) {
  ctx.fillStyle = def.petal;
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * radius, -radius + Math.sin(angle) * radius, radius * 0.55, radius * 0.88, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(0, -radius, radius * 0.56, 0, Math.PI * 2);
  ctx.fill();
}

function drawObjects(layout, now) {
  const sorted = objects.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const object of sorted) {
    const def = getBuild(object.type);
    const px = layout.x + object.x * layout.tile;
    const py = layout.y + object.y * layout.tile;
    const w = object.w * layout.tile;
    const h = object.h * layout.tile;
    drawObject(def, px, py, w, h, layout.tile, now);
  }
}

function drawObject(def, x, y, w, h, tile, now) {
  ctx.save();
  ctx.fillStyle = "rgba(32,35,29,0.13)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - tile * 0.12, w * 0.42, tile * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === "fence") {
    ctx.strokeStyle = "#805a39";
    ctx.lineWidth = Math.max(3, tile * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + tile * 0.2, y + tile * 0.32);
    ctx.lineTo(x + tile * 0.8, y + tile * 0.32);
    ctx.moveTo(x + tile * 0.2, y + tile * 0.62);
    ctx.lineTo(x + tile * 0.8, y + tile * 0.62);
    ctx.moveTo(x + tile * 0.26, y + tile * 0.2);
    ctx.lineTo(x + tile * 0.26, y + tile * 0.78);
    ctx.moveTo(x + tile * 0.74, y + tile * 0.2);
    ctx.lineTo(x + tile * 0.74, y + tile * 0.78);
    ctx.stroke();
  } else if (def.id === "lamp") {
    ctx.strokeStyle = "#4b4b3f";
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.beginPath();
    ctx.moveTo(x + tile * 0.5, y + tile * 0.78);
    ctx.lineTo(x + tile * 0.5, y + tile * 0.28);
    ctx.stroke();
    ctx.fillStyle = "#ffd96c";
    ctx.beginPath();
    ctx.arc(x + tile * 0.5, y + tile * 0.23, tile * (0.13 + Math.sin(now / 420) * 0.01), 0, Math.PI * 2);
    ctx.fill();
  } else if (def.id === "chair") {
    ctx.fillStyle = def.color;
    roundRect(ctx, x + tile * 0.22, y + tile * 0.28, tile * 0.56, tile * 0.24, 5);
    ctx.fill();
    ctx.fillRect(x + tile * 0.25, y + tile * 0.52, tile * 0.5, tile * 0.12);
    ctx.fillStyle = "#3d5c72";
    ctx.fillRect(x + tile * 0.28, y + tile * 0.62, tile * 0.08, tile * 0.2);
    ctx.fillRect(x + tile * 0.64, y + tile * 0.62, tile * 0.08, tile * 0.2);
  } else if (def.id === "table") {
    ctx.fillStyle = "#b7825c";
    roundRect(ctx, x + tile * 0.14, y + tile * 0.2, w - tile * 0.28, h * 0.44, 8);
    ctx.fill();
    ctx.fillStyle = "#805a39";
    ctx.fillRect(x + tile * 0.28, y + h * 0.62, tile * 0.12, tile * 0.28);
    ctx.fillRect(x + w - tile * 0.4, y + h * 0.62, tile * 0.12, tile * 0.28);
  } else if (def.id === "bed") {
    ctx.fillStyle = "#fff3dc";
    roundRect(ctx, x + tile * 0.22, y + tile * 0.44, w - tile * 0.44, h * 0.32, 8);
    ctx.fill();
    ctx.fillStyle = def.color;
    roundRect(ctx, x + tile * 0.25, y + tile * 0.22, w - tile * 0.5, h * 0.36, 10);
    ctx.fill();
    drawTinyCat(x + w * 0.5, y + h * 0.48, tile * 0.25, "#f0a64d");
  } else if (def.id === "house") {
    ctx.fillStyle = "#9d7351";
    roundRect(ctx, x + tile * 0.24, y + tile * 0.55, w - tile * 0.48, h * 0.34, 8);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + tile * 0.12);
    ctx.lineTo(x + w - tile * 0.18, y + tile * 0.58);
    ctx.lineTo(x + tile * 0.18, y + tile * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff5cf";
    ctx.fillRect(x + w * 0.44, y + h * 0.65, tile * 0.36, tile * 0.45);
  }
  ctx.restore();
}

function drawCats(layout, now) {
  const sorted = cats.slice().sort((a, b) => a.y - b.y);
  for (const cat of sorted) {
    const x = layout.x + cat.x * layout.tile;
    const y = layout.y + cat.y * layout.tile + Math.sin(now / 320 + cat.id) * layout.tile * 0.03;
    drawLivingCat(x, y, layout.tile * 0.33, cat, now);
  }
}

function drawLivingCat(x, y, r, cat, now) {
  drawTinyCat(x, y, r, cat.color);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (cat.thought && cat.thoughtTime > 0) {
    ctx.fillStyle = "rgba(229,215,189,0.92)";
    ctx.strokeStyle = "rgba(32,35,29,0.34)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - r * 0.75, y - r * 2.1, r * 1.5, r * 0.62, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#20231d";
    ctx.font = `900 ${Math.max(9, r * 0.48)}px ui-rounded, system-ui`;
    ctx.fillText(cat.thought, x, y - r * 1.78);
  }
  ctx.fillStyle = "rgba(32,35,29,0.70)";
  ctx.font = `900 ${Math.max(8, r * 0.38)}px ui-rounded, system-ui`;
  ctx.fillText(CAT_ACTIONS[cat.action] || "", x, y + r * 1.52);
  ctx.restore();
}

function drawTinyCat(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(32,35,29,0.14)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.82, r * 0.82, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(32,35,29,0.28)";
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.45);
  ctx.lineTo(-r * 0.78, -r * 0.92);
  ctx.lineTo(-r * 0.15, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.42, -r * 0.45);
  ctx.lineTo(r * 0.78, -r * 0.92);
  ctx.lineTo(r * 0.15, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.06, r * 0.14, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.06, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#20231d";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.06, r * 0.055, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.06, r * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPreview(layout) {
  if (!hoverCell) return;
  const { x, y } = hoverCell;
  const px = layout.x + x * layout.tile;
  const py = layout.y + y * layout.tile;
  ctx.save();
  if (selectedTool === "build") {
    const def = getBuild(selectedBuild);
    if (def && def.kind === "object") {
      const size = objectSize(def, rotation);
      const check = canPlaceObject(def, x, y, rotation);
      ctx.fillStyle = check.ok ? "rgba(63,154,103,0.25)" : "rgba(231,103,106,0.25)";
      ctx.fillRect(px, py, size.w * layout.tile, size.h * layout.tile);
      ctx.strokeStyle = check.ok ? "#3f9a67" : "#e7676a";
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, size.w * layout.tile - 3, size.h * layout.tile - 3);
      ctx.restore();
      return;
    }
  }
  ctx.strokeStyle = selectedTool === "shovel" ? "#e7676a" : "#20231d";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, layout.tile - 4, layout.tile - 4);
  ctx.restore();
}

function drawParticles(layout) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(layout.x + p.x * layout.tile, layout.y + p.y * layout.tile, p.size * layout.tile, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.002 * dt * 60;
    p.life -= dt * 1.6;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.025 + Math.random() * 0.055;
    particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.045 + Math.random() * 0.055,
      life: 1,
      color,
    });
  }
}

function objectSize(def, rot) {
  if (rot % 2 === 1) return { w: def.h, h: def.w };
  return { w: def.w, h: def.h };
}

function cellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const layout = getLayout();
  const x = Math.floor((event.clientX - rect.left - layout.x) / layout.tile);
  const y = Math.floor((event.clientY - rect.top - layout.y) / layout.tile);
  if (!inside(x, y)) return null;
  return { x, y };
}

function getPlant(id) {
  return PLANTS.find((plant) => plant.id === id);
}

function getBuild(id) {
  return BUILD_ITEMS.find((item) => item.id === id);
}

function groundColor(ground) {
  if (ground === "soil") return "#8d6748";
  if (ground === "path") return "#aaa08a";
  if (ground === "water") return "#627b83";
  return "#7c936e";
}

function dayPhase(value) {
  if (value < 10 * 60) return "MORNING";
  if (value < 15 * 60) return "NOON";
  if (value < 19 * 60) return "EVENING";
  return "NIGHT";
}

function formatClock(value) {
  const total = Math.floor(value);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function forEachCell(callback) {
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      callback(cells[y][x], x, y);
    }
  }
}

function inside(x, y) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
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

init();
