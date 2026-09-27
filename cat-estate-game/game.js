const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const boardWrap = document.getElementById("boardWrap");
const statusText = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");
const rollBtn = document.getElementById("rollBtn");
const buyBtn = document.getElementById("buyBtn");
const upgradeBtn = document.getElementById("upgradeBtn");
const endBtn = document.getElementById("endBtn");
const turnText = document.getElementById("turnText");
const diceText = document.getElementById("diceText");
const playersPanel = document.getElementById("playersPanel");
const tileName = document.getElementById("tileName");
const tileDetail = document.getElementById("tileDetail");
const logList = document.getElementById("logList");

const BOARD_SIDE = 8;
const TILE_COUNT = 28;
const START_BONUS = 180;
const LAND_START_BONUS = 80;
const MAX_LEVEL = 3;
const MAX_TURNS = 80;
const SAVE_KEY = "cat-estate-best-worth";

const TILE_DEFS = [
  { type: "start", name: "猫猫银行", detail: "经过领取 180" },
  { type: "property", name: "鱼干街", group: "market", price: 120, rent: 22, color: "#53614b" },
  { type: "property", name: "午睡角", group: "cozy", price: 130, rent: 24, color: "#b7893f" },
  { type: "chance", name: "事件", detail: "抽一张猫猫事件" },
  { type: "property", name: "毛线铺", group: "play", price: 150, rent: 30, color: "#61506b" },
  { type: "property", name: "奶茶窗", group: "market", price: 160, rent: 32, color: "#53614b" },
  { type: "tax", name: "罐头税", amount: 120, detail: "缴纳 120" },
  { type: "property", name: "晒太阳台", group: "cozy", price: 180, rent: 38, color: "#b7893f" },
  { type: "property", name: "纸箱巷", group: "play", price: 190, rent: 42, color: "#61506b" },
  { type: "property", name: "玩具架", group: "play", price: 210, rent: 48, color: "#61506b" },
  { type: "chance", name: "事件", detail: "抽一张猫猫事件" },
  { type: "property", name: "窗边湾", group: "view", price: 230, rent: 54, color: "#4d5c70" },
  { type: "property", name: "金枪鱼塔", group: "market", price: 250, rent: 60, color: "#53614b" },
  { type: "property", name: "屋顶花园", group: "view", price: 270, rent: 68, color: "#4d5c70" },
  { type: "bonus", name: "罐头补给", amount: 150, detail: "获得 150" },
  { type: "property", name: "铃铛街", group: "luxury", price: 290, rent: 76, color: "#8f3a32" },
  { type: "property", name: "毛毯旅馆", group: "cozy", price: 310, rent: 84, color: "#b7893f" },
  { type: "tax", name: "家具维修", amount: 160, detail: "缴纳 160" },
  { type: "property", name: "猫抓柱", group: "play", price: 330, rent: 92, color: "#61506b" },
  { type: "property", name: "月亮集市", group: "view", price: 350, rent: 104, color: "#4d5c70" },
  { type: "chance", name: "事件", detail: "抽一张猫猫事件" },
  { type: "festival", name: "猫薄荷节", amount: 120, detail: "所有猫获得 120" },
  { type: "property", name: "云朵公寓", group: "luxury", price: 380, rent: 116, color: "#8f3a32" },
  { type: "property", name: "毛线港", group: "view", price: 400, rent: 128, color: "#4d5c70" },
  { type: "chance", name: "事件", detail: "抽一张猫猫事件" },
  { type: "property", name: "金碗庄园", group: "luxury", price: 430, rent: 146, color: "#8f3a32" },
  { type: "property", name: "沙发宫殿", group: "luxury", price: 460, rent: 164, color: "#8f3a32" },
  { type: "tax", name: "深夜加餐", amount: 190, detail: "缴纳 190" },
];

const PLAYER_DEFS = [
  { name: "你", color: "#8f3a32", ai: false },
  { name: "奶盖", color: "#4d5c70", ai: true },
  { name: "团子", color: "#53614b", ai: true },
  { name: "乌梅", color: "#61506b", ai: true },
];

const CHANCE_CARDS = [
  { title: "抢到限定罐头", kind: "money", amount: 180 },
  { title: "打翻花瓶赔偿", kind: "money", amount: -140 },
  { title: "直播踩键盘爆红", kind: "money", amount: 220 },
  { title: "猫砂采购", kind: "perProperty", amount: -35 },
  { title: "房东协会分红", kind: "perProperty", amount: 45 },
  { title: "睡过头", kind: "skip", turns: 1 },
  { title: "免费装修券", kind: "freeUpgrade" },
  { title: "偷吃夜宵", kind: "money", amount: -90 },
  { title: "捡到闪亮铃铛", kind: "money", amount: 120 },
  { title: "全城猫薄荷", kind: "everyone", amount: 60 },
];

let width = 0;
let height = 0;
let dpr = 1;
let tiles = [];
let players = [];
let currentIndex = 0;
let phase = "idle";
let pendingAction = null;
let dice = [1, 1];
let turnCount = 0;
let selectedTile = 0;
let logs = [];
let chanceIndex = 0;
let gameToken = 0;
let animationPulseUntil = 0;
let bestWorth = Number(localStorage.getItem(SAVE_KEY) || 0);

function init() {
  bindEvents();
  resize();
  newGame();
  requestAnimationFrame(draw);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  restartBtn.addEventListener("click", newGame);
  rollBtn.addEventListener("click", rollDice);
  buyBtn.addEventListener("click", buyCurrentTile);
  upgradeBtn.addEventListener("click", upgradeCurrentTile);
  endBtn.addEventListener("click", endTurn);

  canvas.addEventListener("pointermove", (event) => {
    const tileIndex = tileFromPointer(event);
    if (tileIndex !== null) {
      selectedTile = tileIndex;
      updateTilePanel();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    selectedTile = currentPlayer().position;
    updateTilePanel();
  });
}

function resize() {
  const rect = boardWrap.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function newGame() {
  gameToken += 1;
  tiles = TILE_DEFS.map((tile) => ({ ...tile, owner: null, level: 0 }));
  players = PLAYER_DEFS.map((player, index) => ({
    ...player,
    id: index,
    money: 1500,
    position: 0,
    bankrupt: false,
    skipTurns: 0,
  }));
  currentIndex = 0;
  phase = "idle";
  pendingAction = null;
  dice = [1, 1];
  turnCount = 0;
  selectedTile = 0;
  chanceIndex = Math.floor(Math.random() * CHANCE_CARDS.length);
  logs = [];
  addLog(`猫猫银行开张，历史最高净资产 ${formatMoney(bestWorth)}。`);
  prepareTurn();
}

function prepareTurn() {
  const token = gameToken;
  if (checkFinished()) return;
  const player = currentPlayer();
  selectedTile = player.position;
  pendingAction = null;
  if (player.skipTurns > 0) {
    player.skipTurns -= 1;
    phase = "skip";
    addLog(`${player.name} 睡过头，跳过这一回合。`);
    updateUI();
    window.setTimeout(() => {
      if (token === gameToken) endTurn(true);
    }, player.ai ? 760 : 1000);
    return;
  }

  phase = player.ai ? "aiReady" : "ready";
  statusText.textContent = player.ai ? "AI TURN" : "YOUR TURN";
  updateUI();
  if (player.ai) {
    window.setTimeout(() => {
      if (token === gameToken) rollDice();
    }, 850);
  }
}

function rollDice() {
  const player = currentPlayer();
  if (!["ready", "aiReady"].includes(phase) || player.bankrupt) return;
  const token = gameToken;
  phase = "rolling";
  statusText.textContent = "ROLLING";
  dice = [randomInt(1, 6), randomInt(1, 6)];
  addLog(`${player.name} 掷出 ${dice[0]} + ${dice[1]}。`);
  updateUI();
  window.setTimeout(() => {
    if (token === gameToken) beginMove(dice[0] + dice[1]);
  }, 520);
}

function beginMove(steps) {
  const player = currentPlayer();
  phase = "moving";
  statusText.textContent = "MOVING";
  moveOneStep(player, steps, gameToken);
}

function moveOneStep(player, stepsLeft, token) {
  if (token !== gameToken || phase !== "moving") return;
  if (stepsLeft <= 0) {
    resolveLanding(player);
    return;
  }

  player.position = (player.position + 1) % TILE_COUNT;
  selectedTile = player.position;
  animationPulseUntil = performance.now() + 230;
  if (player.position === 0) {
    player.money += START_BONUS;
    addLog(`${player.name} 经过猫猫银行，领取 ${formatMoney(START_BONUS)}。`);
  }
  updateUI();
  window.setTimeout(() => moveOneStep(player, stepsLeft - 1, token), 185);
}

function resolveLanding(player) {
  const tile = tiles[player.position];
  selectedTile = player.position;
  addLog(`${player.name} 到达 ${tile.name}。`);

  if (tile.type === "start") {
    player.money += LAND_START_BONUS;
    addLog(`${player.name} 停在猫猫银行，额外领取 ${formatMoney(LAND_START_BONUS)}。`);
    completeAction();
    return;
  }

  if (tile.type === "bonus") {
    player.money += tile.amount;
    addLog(`${player.name} 获得补给 ${formatMoney(tile.amount)}。`);
    completeAction();
    return;
  }

  if (tile.type === "festival") {
    for (const cat of activePlayers()) {
      cat.money += tile.amount;
    }
    addLog(`猫薄荷节开场，所有猫获得 ${formatMoney(tile.amount)}。`);
    completeAction();
    return;
  }

  if (tile.type === "tax") {
    payBank(player, tile.amount, tile.name);
    completeAction();
    return;
  }

  if (tile.type === "chance") {
    drawChanceCard(player);
    completeAction();
    return;
  }

  resolveProperty(player, tile);
}

function resolveProperty(player, tile) {
  if (tile.owner === null) {
    pendingAction = { type: "buy", tileIndex: player.position };
    addLog(`${tile.name} 待售，价格 ${formatMoney(tile.price)}。`);
    if (player.ai) {
      phase = "aiAction";
      updateUI();
      window.setTimeout(() => aiBuyDecision(player, tile), 650);
    } else {
      phase = "action";
      updateUI();
    }
    return;
  }

  if (tile.owner === player.id) {
    if (tile.level < MAX_LEVEL) {
      pendingAction = { type: "upgrade", tileIndex: player.position };
      addLog(`${player.name} 来到自己的 ${tile.name}，可以升级。`);
      if (player.ai) {
        phase = "aiAction";
        updateUI();
        window.setTimeout(() => aiUpgradeDecision(player, tile), 650);
      } else {
        phase = "action";
        updateUI();
      }
      return;
    }
    addLog(`${tile.name} 已满级，租金气势很足。`);
    completeAction();
    return;
  }

  const owner = players[tile.owner];
  const rent = computeRent(tile);
  payPlayer(player, owner, rent, tile.name);
  completeAction();
}

function buyCurrentTile() {
  const player = currentPlayer();
  if (!pendingAction || pendingAction.type !== "buy" || player.ai) return;
  buyTile(player, tiles[pendingAction.tileIndex]);
  pendingAction = null;
  phase = "action";
  updateUI();
}

function upgradeCurrentTile() {
  const player = currentPlayer();
  if (!pendingAction || pendingAction.type !== "upgrade" || player.ai) return;
  upgradeTile(player, tiles[pendingAction.tileIndex]);
  pendingAction = null;
  phase = "action";
  updateUI();
}

function aiBuyDecision(player, tile) {
  if (phase !== "aiAction" || currentPlayer() !== player || player.bankrupt) return;
  const sameGroup = tiles.filter((item) => item.owner === player.id && item.group === tile.group).length;
  const reserve = 260 - sameGroup * 45;
  if (player.money - tile.price > reserve) {
    buyTile(player, tile);
  } else {
    addLog(`${player.name} 选择保留现金。`);
  }
  pendingAction = null;
  completeAction();
}

function aiUpgradeDecision(player, tile) {
  if (phase !== "aiAction" || currentPlayer() !== player || player.bankrupt) return;
  const cost = computeUpgradeCost(tile);
  const ownedCount = tiles.filter((item) => item.owner === player.id).length;
  const reserve = 320 - ownedCount * 18;
  if (player.money - cost > reserve) {
    upgradeTile(player, tile);
  } else {
    addLog(`${player.name} 暂时不升级 ${tile.name}。`);
  }
  pendingAction = null;
  completeAction();
}

function buyTile(player, tile) {
  if (tile.owner !== null) return false;
  if (player.money < tile.price) {
    addLog(`${player.name} 现金不够，买不起 ${tile.name}。`);
    return false;
  }
  player.money -= tile.price;
  tile.owner = player.id;
  tile.level = 0;
  addLog(`${player.name} 买下 ${tile.name}。`);
  return true;
}

function upgradeTile(player, tile) {
  if (tile.owner !== player.id || tile.level >= MAX_LEVEL) return false;
  const cost = computeUpgradeCost(tile);
  if (player.money < cost) {
    addLog(`${player.name} 现金不够，不能升级 ${tile.name}。`);
    return false;
  }
  player.money -= cost;
  tile.level += 1;
  addLog(`${player.name} 将 ${tile.name} 升到 ${tile.level} 级。`);
  return true;
}

function completeAction() {
  pendingAction = null;
  if (checkFinished()) return;
  const player = currentPlayer();
  if (player.bankrupt) {
    phase = "bankrupt";
    updateUI();
    const token = gameToken;
    window.setTimeout(() => {
      if (token === gameToken) endTurn(true);
    }, 780);
    return;
  }
  phase = player.ai ? "aiDone" : "action";
  updateUI();
  if (player.ai) {
    const token = gameToken;
    window.setTimeout(() => {
      if (token === gameToken) endTurn(true);
    }, 760);
  }
}

function endTurn(force = false) {
  if (!force && !["action", "ready"].includes(phase)) return;
  if (phase === "ended") return;
  turnCount += 1;
  if (turnCount >= MAX_TURNS) {
    finishByWorth();
    return;
  }

  const next = nextActiveIndex(currentIndex);
  if (next === null) {
    finishByWorth();
    return;
  }
  currentIndex = next;
  prepareTurn();
}

function drawChanceCard(player) {
  const card = CHANCE_CARDS[chanceIndex % CHANCE_CARDS.length];
  chanceIndex += 1;
  addLog(`事件：${card.title}。`);

  if (card.kind === "money") {
    if (card.amount >= 0) {
      player.money += card.amount;
      addLog(`${player.name} 获得 ${formatMoney(card.amount)}。`);
    } else {
      payBank(player, Math.abs(card.amount), card.title);
    }
    return;
  }

  if (card.kind === "perProperty") {
    const count = tiles.filter((tile) => tile.owner === player.id).length;
    const total = Math.abs(card.amount) * count;
    if (card.amount >= 0) {
      player.money += total;
      addLog(`${player.name} 因 ${count} 处地产获得 ${formatMoney(total)}。`);
    } else {
      payBank(player, total, card.title);
    }
    return;
  }

  if (card.kind === "skip") {
    player.skipTurns += card.turns;
    addLog(`${player.name} 下回合休息。`);
    return;
  }

  if (card.kind === "freeUpgrade") {
    const owned = tiles
      .filter((tile) => tile.owner === player.id && tile.level < MAX_LEVEL)
      .sort((a, b) => b.price - a.price);
    if (owned.length) {
      owned[0].level += 1;
      addLog(`${player.name} 免费升级 ${owned[0].name}。`);
    } else {
      player.money += 100;
      addLog(`${player.name} 没有可升级地产，改领 ${formatMoney(100)}。`);
    }
    return;
  }

  if (card.kind === "everyone") {
    for (const cat of activePlayers()) {
      cat.money += card.amount;
    }
    addLog(`所有猫获得 ${formatMoney(card.amount)}。`);
  }
}

function payBank(player, amount, reason) {
  if (amount <= 0) return;
  if (player.money >= amount) {
    player.money -= amount;
    addLog(`${player.name} 为 ${reason} 支付 ${formatMoney(amount)}。`);
    return;
  }
  addLog(`${player.name} 无法支付 ${formatMoney(amount)}，现金见底。`);
  declareBankrupt(player);
}

function payPlayer(from, to, amount, reason) {
  if (from.bankrupt || to.bankrupt || amount <= 0) return;
  if (from.money >= amount) {
    from.money -= amount;
    to.money += amount;
    addLog(`${from.name} 向 ${to.name} 支付 ${reason} 租金 ${formatMoney(amount)}。`);
    return;
  }
  const paid = from.money;
  to.money += paid;
  addLog(`${from.name} 只付得起 ${formatMoney(paid)}，向 ${to.name} 交出最后现金。`);
  declareBankrupt(from);
}

function declareBankrupt(player) {
  if (player.bankrupt) return;
  player.bankrupt = true;
  player.money = 0;
  for (const tile of tiles) {
    if (tile.owner === player.id) {
      tile.owner = null;
      tile.level = 0;
    }
  }
  addLog(`${player.name} 破产，名下地产回到银行。`);
  checkFinished();
}

function checkFinished() {
  const alive = activePlayers();
  if (alive.length <= 1 && players.length) {
    const winner = alive[0] || players.slice().sort((a, b) => netWorth(b) - netWorth(a))[0];
    finishGame(winner, "LAST CAT");
    return true;
  }
  return false;
}

function finishByWorth() {
  const winner = players.slice().sort((a, b) => netWorth(b) - netWorth(a))[0];
  finishGame(winner, "NET WORTH");
}

function finishGame(winner, label) {
  if (phase === "ended") return;
  phase = "ended";
  pendingAction = null;
  const worth = netWorth(winner);
  bestWorth = Math.max(bestWorth, worth);
  localStorage.setItem(SAVE_KEY, String(bestWorth));
  statusText.textContent = label;
  addLog(`${winner.name} 获胜，净资产 ${formatMoney(worth)}。`);
  selectedTile = winner.position;
  updateUI();
}

function computeRent(tile) {
  const base = tile.rent || 0;
  const monopoly = hasGroupMonopoly(tile.owner, tile.group);
  const multiplier = [1, 1.8, 3.1, 5.2][tile.level] || 1;
  return Math.round(base * multiplier * (monopoly ? 1.35 : 1));
}

function computeUpgradeCost(tile) {
  return Math.round(tile.price * (0.52 + tile.level * 0.22));
}

function hasGroupMonopoly(ownerId, group) {
  if (ownerId === null || !group) return false;
  const groupTiles = tiles.filter((tile) => tile.type === "property" && tile.group === group);
  return groupTiles.length > 0 && groupTiles.every((tile) => tile.owner === ownerId);
}

function activePlayers() {
  return players.filter((player) => !player.bankrupt);
}

function nextActiveIndex(fromIndex) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (fromIndex + offset) % players.length;
    if (!players[index].bankrupt) return index;
  }
  return null;
}

function currentPlayer() {
  return players[currentIndex] || players[0];
}

function netWorth(player) {
  let worth = player.money;
  for (const tile of tiles) {
    if (tile.owner === player.id) {
      worth += tile.price;
      worth += Math.round(computeUpgradeCost(tile) * tile.level * 0.72);
    }
  }
  return worth;
}

function updateUI() {
  const player = currentPlayer();
  turnText.textContent = phase === "ended" ? "结算" : player.name;
  diceText.textContent = phase === "rolling" ? "..." : `${dice[0]} + ${dice[1]}`;

  rollBtn.disabled = !(phase === "ready");
  buyBtn.disabled = !canHumanBuy();
  upgradeBtn.disabled = !canHumanUpgrade();
  endBtn.disabled = phase !== "action" || player.ai || phase === "ended";

  renderPlayers();
  updateTilePanel();
  renderLogs();
}

function canHumanBuy() {
  const player = currentPlayer();
  if (player.ai || !pendingAction || pendingAction.type !== "buy") return false;
  const tile = tiles[pendingAction.tileIndex];
  return tile.owner === null && player.money >= tile.price;
}

function canHumanUpgrade() {
  const player = currentPlayer();
  if (player.ai || !pendingAction || pendingAction.type !== "upgrade") return false;
  const tile = tiles[pendingAction.tileIndex];
  return tile.owner === player.id && tile.level < MAX_LEVEL && player.money >= computeUpgradeCost(tile);
}

function renderPlayers() {
  playersPanel.innerHTML = "";
  for (const player of players) {
    const row = document.createElement("div");
    row.className = "player-row";
    if (player.id === currentIndex && phase !== "ended") row.classList.add("current");
    if (player.bankrupt) row.classList.add("bankrupt");

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.style.background = player.color;

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = player.name;
    const meta = document.createElement("span");
    meta.textContent = `${formatMoney(player.money)} · ${ownedCount(player)} 处 · 净值 ${formatMoney(netWorth(player))}`;
    info.append(name, meta);

    const state = document.createElement("em");
    state.textContent = player.bankrupt ? "OUT" : player.ai ? "AI" : "YOU";

    row.append(dot, info, state);
    playersPanel.appendChild(row);
  }
}

function updateTilePanel() {
  const tile = tiles[selectedTile] || tiles[0];
  tileName.textContent = tile.name;
  tileDetail.textContent = describeTile(tile);
}

function renderLogs() {
  logList.innerHTML = "";
  for (const line of logs.slice(0, 12)) {
    const item = document.createElement("div");
    item.className = "log-line";
    item.textContent = line;
    logList.appendChild(item);
  }
}

function describeTile(tile) {
  if (tile.type === "property") {
    const owner = tile.owner === null ? "银行" : players[tile.owner].name;
    const rent = computeRent(tile);
    const upgrade = tile.level < MAX_LEVEL ? `升级 ${formatMoney(computeUpgradeCost(tile))}` : "满级";
    return `${owner} · 价格 ${formatMoney(tile.price)} · 租金 ${formatMoney(rent)} · ${tile.level} 级 · ${upgrade}`;
  }
  if (tile.type === "tax") return `${tile.detail}`;
  if (tile.type === "bonus" || tile.type === "festival") return tile.detail;
  if (tile.type === "chance") return tile.detail;
  return `${tile.detail}，停留领取 ${formatMoney(LAND_START_BONUS)}`;
}

function ownedCount(player) {
  return tiles.filter((tile) => tile.owner === player.id).length;
}

function addLog(message) {
  logs.unshift(message);
  if (logs.length > 80) logs.length = 80;
  renderLogs();
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  const layout = getLayout();
  drawBoardBase(layout);
  drawTiles(layout);
  drawCenter(layout, now);
  drawPlayers(layout, now);
  requestAnimationFrame(draw);
}

function drawBoardBase(layout) {
  const { x, y, size, tile } = layout;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 8);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  roundRect(ctx, x, y, size, size, 8);
  ctx.fill();

  const innerX = x + tile;
  const innerY = y + tile;
  const innerSize = tile * 6;
  ctx.fillStyle = "#e7f5e9";
  roundRect(ctx, innerX + 8, innerY + 8, innerSize - 16, innerSize - 16, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(32,32,28,0.10)";
  ctx.lineWidth = 2;
  roundRect(ctx, innerX + 8, innerY + 8, innerSize - 16, innerSize - 16, 8);
  ctx.stroke();
  ctx.restore();
}

function drawTiles(layout) {
  for (let index = 0; index < tiles.length; index += 1) {
    drawTile(tiles[index], index, tileRect(index, layout));
  }
}

function drawTile(tile, index, rect) {
  const isSelected = index === selectedTile;
  const isCurrentPosition = activePlayers().some((player) => player.position === index);
  const base = tileBaseColor(tile);

  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = isSelected ? "#20201c" : "rgba(32,32,28,0.16)";
  ctx.lineWidth = isSelected ? 3 : 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  if (tile.type === "property") {
    ctx.fillStyle = tile.color;
    ctx.fillRect(rect.x + 5, rect.y + 5, rect.w - 10, 7);
    if (tile.owner !== null) {
      ctx.fillStyle = players[tile.owner].color;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 12, rect.y + 17, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    drawLevelMarks(tile, rect);
  }

  if (isCurrentPosition) {
    ctx.fillStyle = "rgba(239,184,68,0.20)";
    ctx.fillRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  }

  ctx.fillStyle = "#20201c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.max(10, Math.floor(rect.w * 0.13))}px ui-rounded, system-ui`;
  drawWrappedText(tile.name, rect.x + rect.w / 2, rect.y + rect.h * 0.48, rect.w - 12, 2, 13);

  ctx.fillStyle = "rgba(32,32,28,0.56)";
  ctx.font = `800 ${Math.max(9, Math.floor(rect.w * 0.105))}px ui-rounded, system-ui`;
  const note = tileShortNote(tile);
  if (note) ctx.fillText(note, rect.x + rect.w / 2, rect.y + rect.h - 13);

  ctx.restore();
}

function drawLevelMarks(tile, rect) {
  if (!tile.level) return;
  const markW = 8;
  const gap = 3;
  const total = tile.level * markW + (tile.level - 1) * gap;
  const startX = rect.x + rect.w / 2 - total / 2;
  ctx.fillStyle = "#20201c";
  for (let i = 0; i < tile.level; i += 1) {
    roundRect(ctx, startX + i * (markW + gap), rect.y + rect.h - 28, markW, 7, 2);
    ctx.fill();
  }
}

function drawCenter(layout, now) {
  const { x, y, tile } = layout;
  const innerX = x + tile;
  const innerY = y + tile;
  const innerSize = tile * 6;
  const cx = innerX + innerSize / 2;
  const cy = innerY + innerSize / 2;
  const player = currentPlayer();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#20201c";
  ctx.font = `900 ${Math.max(28, tile * 0.46)}px ui-rounded, system-ui`;
  ctx.fillText("猫猫地产棋", cx, cy - tile * 1.42);

  ctx.fillStyle = "rgba(32,32,28,0.58)";
  ctx.font = `850 ${Math.max(12, tile * 0.17)}px ui-rounded, system-ui`;
  const prompt = phase === "ended"
    ? "结算完成"
    : `${player.name} · 第 ${turnCount + 1}/${MAX_TURNS} 回合`;
  ctx.fillText(prompt, cx, cy - tile * 1.05);

  drawDice(cx - tile * 0.48, cy - tile * 0.16, tile * 0.62, dice[0], now);
  drawDice(cx + tile * 0.48, cy - tile * 0.16, tile * 0.62, dice[1], now);

  const selected = tiles[selectedTile];
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  roundRect(ctx, cx - innerSize * 0.33, cy + tile * 0.58, innerSize * 0.66, tile * 0.74, 8);
  ctx.fill();
  ctx.fillStyle = "#20201c";
  ctx.font = `900 ${Math.max(15, tile * 0.21)}px ui-rounded, system-ui`;
  ctx.fillText(selected.name, cx, cy + tile * 0.78);
  ctx.fillStyle = "rgba(32,32,28,0.62)";
  ctx.font = `800 ${Math.max(11, tile * 0.14)}px ui-rounded, system-ui`;
  drawWrappedText(describeTile(selected), cx, cy + tile * 1.08, innerSize * 0.58, 2, tile * 0.19);
  ctx.restore();
}

function drawDice(x, y, size, value, now) {
  const rolling = phase === "rolling";
  const lift = rolling ? Math.sin(now / 70 + value) * 4 : 0;
  const left = x - size / 2;
  const top = y - size / 2 + lift;
  ctx.save();
  ctx.fillStyle = "#fffdf6";
  ctx.shadowColor = "rgba(32,32,28,0.18)";
  ctx.shadowBlur = 18;
  roundRect(ctx, left, top, size, size, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(32,32,28,0.16)";
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, size, size, 8);
  ctx.stroke();

  const pips = dicePips(value);
  ctx.fillStyle = "#20201c";
  for (const [px, py] of pips) {
    ctx.beginPath();
    ctx.arc(left + size * px, top + size * py, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayers(layout, now) {
  const occupants = new Map();
  for (const player of players) {
    if (player.bankrupt) continue;
    if (!occupants.has(player.position)) occupants.set(player.position, []);
    occupants.get(player.position).push(player);
  }

  for (const [position, cats] of occupants) {
    const rect = tileRect(position, layout);
    const offsets = tokenOffsets(cats.length, layout.tile);
    cats.forEach((player, index) => {
      const current = player.id === currentIndex && phase !== "ended";
      const pulse = current ? Math.sin(now / 160) * 1.4 : 0;
      const movePulse = now < animationPulseUntil && current ? 4 : 0;
      drawCatToken(
        rect.x + rect.w / 2 + offsets[index].x,
        rect.y + rect.h / 2 + offsets[index].y - movePulse,
        layout.tile * 0.17 + pulse,
        player.color,
        player.name.slice(0, 1),
      );
    });
  }
}

function drawCatToken(x, y, r, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(32,32,28,0.15)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.82, r * 0.78, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(32,32,28,0.28)";
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.48, -r * 0.5);
  ctx.lineTo(-r * 0.84, -r * 1.06);
  ctx.lineTo(-r * 0.2, -r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.48, -r * 0.5);
  ctx.lineTo(r * 0.84, -r * 1.06);
  ctx.lineTo(r * 0.2, -r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(-r * 0.33, -r * 0.08, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.33, -r * 0.08, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#20201c";
  ctx.beginPath();
  ctx.arc(-r * 0.33, -r * 0.08, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.33, -r * 0.08, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3a59a";
  ctx.beginPath();
  ctx.moveTo(0, r * 0.08);
  ctx.lineTo(-r * 0.11, r * 0.2);
  ctx.lineTo(r * 0.11, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = `900 ${Math.max(8, r * 0.72)}px ui-rounded, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, r * 1.42);
  ctx.restore();
}

function tileRect(index, layout) {
  const { x, y, tile } = layout;
  const pos = tileGridPosition(index);
  return {
    x: x + pos.col * tile,
    y: y + pos.row * tile,
    w: tile,
    h: tile,
  };
}

function tileGridPosition(index) {
  const max = BOARD_SIDE - 1;
  if (index < BOARD_SIDE) return { col: max - index, row: max };
  if (index < BOARD_SIDE + max) return { col: 0, row: max - (index - BOARD_SIDE + 1) };
  if (index < BOARD_SIDE + max * 2) return { col: index - (BOARD_SIDE + max) + 1, row: 0 };
  return { col: max, row: index - (BOARD_SIDE + max * 2) + 1 };
}

function getLayout() {
  const size = Math.min(width, height) - 34;
  const boardSize = Math.max(304, size);
  const tile = boardSize / BOARD_SIDE;
  return {
    x: (width - boardSize) / 2,
    y: (height - boardSize) / 2,
    size: boardSize,
    tile,
  };
}

function tileFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = getLayout();
  for (let index = 0; index < tiles.length; index += 1) {
    const tileBox = tileRect(index, layout);
    if (x >= tileBox.x && x <= tileBox.x + tileBox.w && y >= tileBox.y && y <= tileBox.y + tileBox.h) {
      return index;
    }
  }
  return null;
}

function tileBaseColor(tile) {
  if (tile.type === "start") return "#fff3bd";
  if (tile.type === "chance") return "#e9e3ff";
  if (tile.type === "tax") return "#ffe0da";
  if (tile.type === "bonus") return "#dcf6e8";
  if (tile.type === "festival") return "#f7e6ff";
  return "#fffdf6";
}

function tileShortNote(tile) {
  if (tile.type === "property") return tile.owner === null ? formatMoney(tile.price) : `租 ${formatMoney(computeRent(tile))}`;
  if (tile.type === "tax") return `-${formatMoney(tile.amount)}`;
  if (tile.type === "bonus" || tile.type === "festival") return `+${formatMoney(tile.amount)}`;
  if (tile.type === "chance") return "CARD";
  return "START";
}

function tokenOffsets(count, tile) {
  const gap = tile * 0.14;
  if (count === 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -gap, y: 0 }, { x: gap, y: 0 }];
  if (count === 3) return [{ x: -gap, y: -gap }, { x: gap, y: -gap }, { x: 0, y: gap }];
  return [{ x: -gap, y: -gap }, { x: gap, y: -gap }, { x: -gap, y: gap }, { x: gap, y: gap }];
}

function dicePips(value) {
  const map = {
    1: [[0.5, 0.5]],
    2: [[0.32, 0.32], [0.68, 0.68]],
    3: [[0.32, 0.32], [0.5, 0.5], [0.68, 0.68]],
    4: [[0.32, 0.32], [0.68, 0.32], [0.32, 0.68], [0.68, 0.68]],
    5: [[0.32, 0.32], [0.68, 0.32], [0.5, 0.5], [0.32, 0.68], [0.68, 0.68]],
    6: [[0.32, 0.28], [0.68, 0.28], [0.32, 0.5], [0.68, 0.5], [0.32, 0.72], [0.68, 0.72]],
  };
  return map[value] || map[1];
}

function drawWrappedText(text, x, y, maxWidth, maxLines, lineHeight) {
  const chars = String(text).split("");
  const lines = [];
  let line = "";
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const firstY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, maxLines).forEach((item, index) => {
    ctx.fillText(item, x, firstY + index * lineHeight);
  });
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

function formatMoney(value) {
  return `${Math.round(value)} 鱼`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

init();
