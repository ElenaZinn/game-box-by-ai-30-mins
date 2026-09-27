const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const stageWrap = document.getElementById("stageWrap");
const statusText = document.getElementById("statusText");
const backBtn = document.getElementById("backBtn");
const restartBtn = document.getElementById("restartBtn");
const againBtn = document.getElementById("againBtn");
const endingOverlay = document.getElementById("endingOverlay");
const endingText = document.getElementById("endingText");
const inventoryBar = document.getElementById("inventoryBar");
const hintTitle = document.getElementById("hintTitle");
const hintText = document.getElementById("hintText");
const inputPanel = document.getElementById("inputPanel");
const inputLabel = document.getElementById("inputLabel");
const inputValue = document.getElementById("inputValue");
const directionPanel = document.getElementById("directionPanel");
const directionValue = document.getElementById("directionValue");
const progressList = document.getElementById("progressList");
const logList = document.getElementById("logList");

const BASE_W = 1000;
const BASE_H = 640;

const ITEMS = {
  bell: { id: "bell", name: "猫铃铛", icon: "BL", detail: "能吸引猫。" },
  paperA: { id: "paperA", name: "纸条A", icon: "A", detail: "半张纸条。" },
  paperB: { id: "paperB", name: "纸条B", icon: "B", detail: "半张纸条。" },
  paperFull: { id: "paperFull", name: "完整纸条", icon: "P", detail: "灯下看不见的数字。" },
  smallKey: { id: "smallKey", name: "小钥匙", icon: "K", detail: "能开柜子。" },
  battery: { id: "battery", name: "电池", icon: "BT", detail: "还有电。" },
  screwdriver: { id: "screwdriver", name: "螺丝刀", icon: "SD", detail: "能拆螺丝。" },
  uvShell: { id: "uvShell", name: "紫外灯外壳", icon: "UV", detail: "缺少电池。" },
  uvLamp: { id: "uvLamp", name: "紫外灯", icon: "UV+", detail: "能照出隐藏文字。" },
  doorCard: { id: "doorCard", name: "门卡", icon: "DC", detail: "最终出口需要它。" },
};

const COLOR_LOCK = ["Y", "B", "R", "G"];
const SAFE_CODE = "2741";
const DOOR_DIR = "LRRL";

let width = 0;
let height = 0;
let dpr = 1;
let hoverHotspot = null;
let keypadBuffer = "";
let directionBuffer = "";
let colorBuffer = [];
let particles = [];
let lastFrame = performance.now();

let state = createState();

function createState() {
  return {
    scene: "room",
    previousScene: "room",
    inventory: [],
    selectedItem: null,
    logs: [],
    flags: {
      drawerOpen: false,
      cabinetOpen: false,
      catMoved: false,
      paperCombined: false,
      lampOpened: false,
      uvReady: false,
      paintingMoved: false,
      safeCodeRevealed: false,
      safeOpen: false,
      carpetLifted: false,
      doorCardInserted: false,
      escaped: false,
    },
  };
}

function init() {
  bindEvents();
  resize();
  restart();
  requestAnimationFrame(loop);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  backBtn.addEventListener("click", goBack);
  restartBtn.addEventListener("click", restart);
  againBtn.addEventListener("click", restart);

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    hoverHotspot = findHotspot(point.x, point.y);
    canvas.style.cursor = hoverHotspot ? "pointer" : "default";
  });

  canvas.addEventListener("pointerleave", () => {
    hoverHotspot = null;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(event);
    const hotspot = findHotspot(point.x, point.y);
    if (hotspot) {
      handleHotspot(hotspot);
    }
  });

  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => handleKeypad(button.dataset.key));
  });

  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => handleDirection(button.dataset.dir));
  });
}

function resize() {
  const rect = stageWrap.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function restart() {
  state = createState();
  keypadBuffer = "";
  directionBuffer = "";
  colorBuffer = [];
  particles = [];
  endingOverlay.hidden = true;
  addLog("你醒在第七号书房，门从外面锁住了。");
  setHint("夜晚书房", "点击房间里的物体查看细节。");
  updateUI();
}

function loop(now) {
  const dt = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;
  updateParticles(dt);
  draw(now);
  requestAnimationFrame(loop);
}

function goBack() {
  if (state.scene === "room") {
    setHint("夜晚书房", "房间很安静，只有猫偶尔碰响铃铛。");
    return;
  }
  setScene("room");
}

function setScene(scene) {
  state.previousScene = state.scene;
  state.scene = scene;
  hoverHotspot = null;
  keypadBuffer = "";
  directionBuffer = "";
  colorBuffer = [];
  updateUI();
}

function addItem(itemId) {
  if (!ITEMS[itemId] || state.inventory.includes(itemId)) return;
  state.inventory.push(itemId);
  state.selectedItem = itemId;
  addLog(`获得：${ITEMS[itemId].name}。`);
  maybeCombineItems();
  updateUI();
}

function removeItem(itemId) {
  state.inventory = state.inventory.filter((id) => id !== itemId);
  if (state.selectedItem === itemId) state.selectedItem = null;
}

function hasItem(itemId) {
  return state.inventory.includes(itemId);
}

function selectedIs(itemId) {
  return state.selectedItem === itemId;
}

function maybeCombineItems() {
  if (hasItem("paperA") && hasItem("paperB") && !hasItem("paperFull")) {
    removeItem("paperA");
    removeItem("paperB");
    state.flags.paperCombined = true;
    state.inventory.push("paperFull");
    state.selectedItem = "paperFull";
    addLog("两张纸条拼在一起，写着：灯下看不见的数字。");
  }

  if (hasItem("battery") && hasItem("uvShell") && !hasItem("uvLamp")) {
    removeItem("battery");
    removeItem("uvShell");
    state.flags.uvReady = true;
    state.inventory.push("uvLamp");
    state.selectedItem = "uvLamp";
    addLog("电池装进外壳，紫外灯可以用了。");
  }
}

function handleHotspot(hotspot) {
  if (state.flags.escaped) return;
  const id = hotspot.id;

  if (id === "room_bookshelf") return setScene("bookshelf");
  if (id === "room_desk") return setScene("desk");
  if (id === "room_cabinet") return setScene("cabinet");
  if (id === "room_window") return setScene("window");
  if (id === "room_catbed") return setScene("catbed");
  if (id === "room_painting") return setScene("painting");
  if (id === "room_carpet") return setScene("carpet");
  if (id === "room_door") return setScene("door");
  if (id === "room_cat") return talkToCat();

  if (id === "desk_drawer") return handleDrawer();
  if (id === "desk_lamp") return setScene("lamp");
  if (id === "desk_screwdriver") return takeScrewdriver();

  if (id.startsWith("color_")) return pressColor(id.replace("color_", ""));

  if (id === "cabinet_lock") return openCabinet();
  if (id === "cabinet_items") return takeCabinetItems();

  if (id === "catbed_bell") return takeBell();

  if (id === "window_cat") return moveCatWithBell();
  if (id === "window_paper") return takeWindowPaper();

  if (id === "lamp_base") return openLampBase();

  if (id === "painting_frame") return movePainting();
  if (id === "painting_back") return revealSafeCode();
  if (id === "painting_safe") return setScene("safe");

  if (id === "safe_handle") return trySafe();

  if (id === "carpet_lift") return liftCarpet();

  if (id === "door_slot") return insertDoorCard();
  if (id === "door_lock") return inspectDoorLock();
}

function talkToCat() {
  if (!state.flags.catMoved) {
    setHint("猫", "它坐在窗台上，像是故意压着什么东西。");
  } else {
    setHint("猫", "猫绕着地毯走了一圈，然后坐在门边看你。");
  }
}

function handleDrawer() {
  if (state.flags.drawerOpen) {
    setHint("抽屉", "抽屉已经空了。");
    return;
  }
  setScene("colorLock");
  setHint("四色锁", "抽屉锁上有四个颜色按钮，书架也许有提示。");
}

function pressColor(color) {
  if (state.flags.drawerOpen) {
    setHint("四色锁", "锁已经打开了。");
    return;
  }
  colorBuffer.push(color);
  setHint("四色锁", `已输入：${colorBuffer.map(colorName).join(" ")}`);
  if (colorBuffer.length < 4) return;
  const ok = colorBuffer.join("") === COLOR_LOCK.join("");
  colorBuffer = [];
  if (!ok) {
    setHint("四色锁", "锁没有反应，颜色顺序不对。");
    addLog("四色锁输入错误。");
    return;
  }
  state.flags.drawerOpen = true;
  addItem("smallKey");
  addLog("抽屉打开了，里面有一把小钥匙。");
  setScene("desk");
}

function takeScrewdriver() {
  if (hasItem("screwdriver")) {
    setHint("螺丝刀", "桌面只剩下一圈灰。");
    return;
  }
  addItem("screwdriver");
  setHint("螺丝刀", "一把小螺丝刀，适合拆开小面板。");
}

function openCabinet() {
  if (state.flags.cabinetOpen) {
    setHint("柜子", "柜门已经打开。");
    return;
  }
  if (!selectedIs("smallKey")) {
    setHint("柜子", "柜门锁着，需要一把小钥匙。");
    return;
  }
  state.flags.cabinetOpen = true;
  state.selectedItem = null;
  burst(500, 360, "#e5b84d", 18);
  addLog("小钥匙打开了柜子。");
  setHint("柜子", "柜子里有一节电池和半张纸条。");
  updateUI();
}

function takeCabinetItems() {
  if (!state.flags.cabinetOpen) {
    setHint("柜子", "柜门还锁着。");
    return;
  }
  let found = false;
  if (!hasItem("battery") && !state.flags.uvReady) {
    addItem("battery");
    found = true;
  }
  if (!hasItem("paperA") && !hasItem("paperFull") && !state.flags.paperCombined) {
    addItem("paperA");
    found = true;
  }
  if (!found) setHint("柜子", "柜子已经空了。");
}

function takeBell() {
  if (hasItem("bell")) {
    setHint("猫窝", "猫窝软软的，铃铛已经拿走。");
    return;
  }
  addItem("bell");
  setHint("猫窝", "猫铃铛拿在手里，轻轻一碰就会响。");
}

function moveCatWithBell() {
  if (state.flags.catMoved) {
    setHint("窗台", "猫已经离开窗台，纸条露出来了。");
    return;
  }
  if (!selectedIs("bell")) {
    setHint("窗台上的猫", "它压着半张纸条，不肯动。也许有什么能吸引它。");
    return;
  }
  state.flags.catMoved = true;
  state.selectedItem = null;
  burst(640, 310, "#e7676a", 22);
  addLog("铃铛一响，猫跳下窗台，跑到地毯旁边。");
  setHint("窗台", "猫走开了，半张纸条露了出来。");
  updateUI();
}

function takeWindowPaper() {
  if (!state.flags.catMoved) {
    setHint("窗台", "猫正坐在纸条上。");
    return;
  }
  if (hasItem("paperB") || hasItem("paperFull")) {
    setHint("窗台", "纸条已经拿走。");
    return;
  }
  addItem("paperB");
}

function openLampBase() {
  if (state.flags.lampOpened) {
    setHint("台灯底座", "底座已经拆开。");
    return;
  }
  if (!selectedIs("screwdriver")) {
    setHint("台灯底座", "底座有两颗小螺丝，需要工具。");
    return;
  }
  state.flags.lampOpened = true;
  state.selectedItem = null;
  addItem("uvShell");
  addLog("台灯底座里藏着一个紫外灯外壳。");
  setHint("台灯底座", "你拆下底座，找到一个缺电池的紫外灯外壳。");
}

function movePainting() {
  if (!state.flags.paintingMoved) {
    state.flags.paintingMoved = true;
    burst(500, 255, "#9d6746", 16);
    addLog("画框被推开，后面藏着保险箱。");
    setHint("画框", "画框背面有一片奇怪的空白痕迹。");
    updateUI();
    return;
  }
  setHint("画框", "画框已经移开，背面好像能被某种光照出来。");
}

function revealSafeCode() {
  if (!state.flags.paintingMoved) {
    setHint("画框", "先把画框移开看看。");
    return;
  }
  if (!selectedIs("uvLamp")) {
    setHint("画框背面", "空白痕迹很奇怪，普通光线看不出内容。");
    return;
  }
  state.flags.safeCodeRevealed = true;
  burst(500, 250, "#7963bd", 28);
  addLog("紫外灯照出数字：2741。");
  setHint("隐藏数字", "紫外光下出现了 2741。");
  updateUI();
}

function trySafe() {
  if (state.flags.safeOpen) {
    setHint("保险箱", "保险箱已经空了。");
    return;
  }
  if (!state.flags.safeCodeRevealed) {
    setHint("保险箱", "四位密码锁。密码应该藏在书房里。");
    return;
  }
  setHint("保险箱", "输入四位密码。");
}

function liftCarpet() {
  if (!state.flags.carpetLifted) {
    state.flags.carpetLifted = true;
    burst(530, 410, "#9d6746", 18);
    addLog("地毯下出现一排猫脚印：左、右、右、左。");
    setHint("猫脚印", "脚印方向像是某种最终提示：左、右、右、左。");
    updateUI();
    return;
  }
  setHint("猫脚印", "左、右、右、左。");
}

function insertDoorCard() {
  if (state.flags.doorCardInserted) {
    setHint("门卡槽", "门卡已经插入，方向锁亮了。");
    return;
  }
  if (!selectedIs("doorCard")) {
    setHint("门卡槽", "这里需要一张门卡。");
    return;
  }
  state.flags.doorCardInserted = true;
  state.selectedItem = null;
  addLog("门卡识别成功，方向锁亮起。");
  setHint("门锁", "门卡通过了。方向锁等待输入。");
  updateUI();
}

function inspectDoorLock() {
  if (!state.flags.doorCardInserted) {
    setHint("门锁", "方向锁没有亮，先处理门卡槽。");
    return;
  }
  setHint("方向锁", "输入地毯下的脚印方向。");
}

function handleKeypad(key) {
  if (state.scene !== "safe" || state.flags.safeOpen) return;
  if (key === "clear") {
    keypadBuffer = "";
  } else if (key === "ok") {
    if (keypadBuffer === SAFE_CODE) {
      state.flags.safeOpen = true;
      keypadBuffer = "";
      addItem("doorCard");
      addLog("保险箱打开，里面是一张门卡。");
      setHint("保险箱", "保险箱打开了。");
      burst(500, 350, "#e5b84d", 28);
    } else {
      addLog("保险箱密码错误。");
      setHint("保险箱", "密码锁发出短促的拒绝声。");
      keypadBuffer = "";
    }
  } else if (keypadBuffer.length < 4) {
    keypadBuffer += key;
  }
  updateUI();
}

function handleDirection(key) {
  if (state.scene !== "door" || !state.flags.doorCardInserted || state.flags.escaped) return;
  if (key === "clear") {
    directionBuffer = "";
  } else if (key === "ok") {
    if (directionBuffer === DOOR_DIR) {
      finishGame();
      return;
    }
    addLog("方向锁输入错误。");
    setHint("方向锁", "锁芯没有转动。");
    directionBuffer = "";
  } else if (directionBuffer.length < 4) {
    directionBuffer += key;
  }
  updateUI();
}

function finishGame() {
  state.flags.escaped = true;
  endingText.textContent = "门打开了，猫先一步走出去，又回头等你。";
  endingOverlay.hidden = false;
  addLog("门锁打开，你和猫离开了第七号书房。");
  updateUI();
}

function setHint(title, text) {
  hintTitle.textContent = title;
  hintText.textContent = text;
}

function addLog(message) {
  state.logs.unshift(message);
  if (state.logs.length > 80) state.logs.length = 80;
}

function updateUI() {
  statusText.textContent = sceneTitle(state.scene).toUpperCase();
  backBtn.disabled = state.scene === "room";
  renderInventory();
  renderProgress();
  renderLogs();
  updatePanels();
  if (state.scene !== "colorLock") colorBuffer = [];
}

function updatePanels() {
  inputPanel.hidden = state.scene !== "safe" || state.flags.safeOpen;
  inputLabel.textContent = "SAFE";
  inputValue.textContent = keypadBuffer.padEnd(4, "_");

  directionPanel.hidden = state.scene !== "door" || !state.flags.doorCardInserted || state.flags.escaped;
  directionValue.textContent = directionBuffer.padEnd(4, "-");
}

function renderInventory() {
  inventoryBar.innerHTML = "";
  for (const itemId of state.inventory) {
    const item = ITEMS[itemId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inv-item";
    button.classList.toggle("active", state.selectedItem === itemId);
    const icon = document.createElement("div");
    icon.className = "inv-icon";
    icon.textContent = item.icon;
    const label = document.createElement("div");
    label.className = "inv-name";
    label.textContent = item.name;
    button.append(icon, label);
    button.addEventListener("click", () => {
      state.selectedItem = state.selectedItem === itemId ? null : itemId;
      setHint(item.name, item.detail);
      updateUI();
    });
    inventoryBar.appendChild(button);
  }
}

function renderProgress() {
  progressList.innerHTML = "";
  const progress = [
    state.flags.drawerOpen && "抽屉",
    state.flags.cabinetOpen && "柜子",
    state.flags.catMoved && "猫让开",
    state.flags.paperCombined && "纸条",
    state.flags.uvReady && "紫外灯",
    state.flags.safeCodeRevealed && "2741",
    state.flags.safeOpen && "门卡",
    state.flags.carpetLifted && "脚印",
    state.flags.doorCardInserted && "门卡槽",
  ].filter(Boolean);

  if (!progress.length) progress.push("探索中");
  for (const label of progress) {
    const item = document.createElement("div");
    item.className = "progress-pill";
    item.textContent = label;
    progressList.appendChild(item);
  }
}

function renderLogs() {
  logList.innerHTML = "";
  for (const line of state.logs.slice(0, 14)) {
    const item = document.createElement("div");
    item.className = "log-line";
    item.textContent = line;
    logList.appendChild(item);
  }
}

function findHotspot(x, y) {
  return hotspotsForScene().find((hotspot) => pointInRect(x, y, hotspot));
}

function hotspotsForScene() {
  const scene = state.scene;
  if (scene === "room") {
    return [
      { id: "room_bookshelf", label: "书架", x: 54, y: 118, w: 206, h: 330 },
      { id: "room_desk", label: "书桌", x: 320, y: 316, w: 282, h: 160 },
      { id: "room_painting", label: "画框", x: 440, y: 92, w: 160, h: 116 },
      { id: "room_cabinet", label: "柜子", x: 720, y: 288, w: 160, h: 194 },
      { id: "room_window", label: "窗台", x: 690, y: 88, w: 206, h: 144 },
      { id: "room_catbed", label: "猫窝", x: 110, y: 485, w: 148, h: 70 },
      { id: "room_carpet", label: "地毯", x: 386, y: 495, w: 260, h: 82 },
      { id: "room_door", label: "门", x: 880, y: 174, w: 94, h: 332 },
      { id: "room_cat", label: "猫", x: state.flags.catMoved ? 445 : 742, y: state.flags.catMoved ? 472 : 184, w: 86, h: 70 },
    ];
  }
  if (scene === "desk") {
    return [
      { id: "desk_drawer", label: state.flags.drawerOpen ? "空抽屉" : "四色抽屉锁", x: 262, y: 340, w: 220, h: 90 },
      { id: "desk_lamp", label: "台灯", x: 558, y: 174, w: 154, h: 256 },
      { id: "desk_screwdriver", label: "螺丝刀", x: 470, y: 300, w: 130, h: 42 },
    ];
  }
  if (scene === "colorLock") {
    return [
      { id: "color_Y", label: "黄", x: 290, y: 310, w: 84, h: 84 },
      { id: "color_B", label: "蓝", x: 410, y: 310, w: 84, h: 84 },
      { id: "color_R", label: "红", x: 530, y: 310, w: 84, h: 84 },
      { id: "color_G", label: "绿", x: 650, y: 310, w: 84, h: 84 },
    ];
  }
  if (scene === "cabinet") {
    return [
      { id: "cabinet_lock", label: state.flags.cabinetOpen ? "柜门" : "柜锁", x: 445, y: 250, w: 116, h: 134 },
      { id: "cabinet_items", label: "柜内物品", x: 360, y: 236, w: 280, h: 194 },
    ];
  }
  if (scene === "catbed") {
    return [
      { id: "catbed_bell", label: hasItem("bell") ? "空猫窝" : "猫铃铛", x: 440, y: 330, w: 126, h: 84 },
    ];
  }
  if (scene === "window") {
    return [
      { id: "window_cat", label: "窗台上的猫", x: 424, y: 230, w: 162, h: 124 },
      { id: "window_paper", label: "半张纸条", x: 578, y: 372, w: 110, h: 54 },
    ];
  }
  if (scene === "lamp") {
    return [
      { id: "lamp_base", label: state.flags.lampOpened ? "空底座" : "台灯底座", x: 402, y: 398, w: 200, h: 90 },
    ];
  }
  if (scene === "painting") {
    if (!state.flags.paintingMoved) {
      return [
        { id: "painting_frame", label: "移动画框", x: 286, y: 124, w: 428, h: 256 },
      ];
    }
    return [
      { id: "painting_back", label: "画框背面", x: 308, y: 154, w: 206, h: 164 },
      { id: "painting_safe", label: "保险箱", x: 552, y: 196, w: 162, h: 136 },
      { id: "painting_frame", label: "画框", x: 286, y: 124, w: 428, h: 256 },
    ];
  }
  if (scene === "safe") {
    return [
      { id: "safe_handle", label: "保险箱", x: 330, y: 168, w: 340, h: 278 },
    ];
  }
  if (scene === "carpet") {
    return [
      { id: "carpet_lift", label: state.flags.carpetLifted ? "猫脚印" : "掀开地毯", x: 250, y: 314, w: 500, h: 154 },
    ];
  }
  if (scene === "door") {
    return [
      { id: "door_slot", label: "门卡槽", x: 594, y: 270, w: 90, h: 126 },
      { id: "door_lock", label: "方向锁", x: 412, y: 268, w: 120, h: 126 },
    ];
  }
  return [];
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const layout = getSceneLayout();
  return {
    x: (event.clientX - rect.left - layout.x) / layout.scale,
    y: (event.clientY - rect.top - layout.y) / layout.scale,
  };
}

function getSceneLayout() {
  const scale = Math.min(width / BASE_W, height / BASE_H);
  return {
    scale,
    x: (width - BASE_W * scale) / 2,
    y: (height - BASE_H * scale) / 2,
  };
}

function pointInRect(x, y, rect) {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function draw(now) {
  ctx.clearRect(0, 0, width, height);
  const layout = getSceneLayout();
  ctx.save();
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  drawScene(now);
  drawHotspotLabel();
  drawParticles();
  ctx.restore();
}

function drawScene(now) {
  drawBackdrop();
  if (state.scene === "room") drawRoom(now);
  if (state.scene === "bookshelf") drawBookshelf();
  if (state.scene === "desk") drawDesk();
  if (state.scene === "colorLock") drawColorLock();
  if (state.scene === "cabinet") drawCabinet();
  if (state.scene === "catbed") drawCatbed();
  if (state.scene === "window") drawWindow(now);
  if (state.scene === "lamp") drawLamp();
  if (state.scene === "painting") drawPainting();
  if (state.scene === "safe") drawSafe();
  if (state.scene === "carpet") drawCarpet();
  if (state.scene === "door") drawDoor();
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, BASE_H);
  gradient.addColorStop(0, "#cfd9ea");
  gradient.addColorStop(0.52, "#f0ddbd");
  gradient.addColorStop(1, "#b98563");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, 18, 18, BASE_W - 36, BASE_H - 36, 10);
  ctx.fill();
}

function drawRoom(now) {
  drawFloor();
  drawBookshelfObject(54, 118, 206, 330);
  drawDeskObject(320, 316, 282, 160);
  drawPaintingObject(440, 92, 160, 116, state.flags.paintingMoved);
  drawWindowObject(690, 88, 206, 144, now);
  drawCabinetObject(720, 288, 160, 194, state.flags.cabinetOpen);
  drawDoorObject(880, 174, 94, 332, state.flags.doorCardInserted);
  drawCatbedObject(110, 485, 148, 70);
  drawCarpetObject(386, 495, 260, 82, state.flags.carpetLifted);

  if (!state.flags.catMoved) {
    drawCat(782, 218, 46, "#e7676a", now);
  } else {
    drawCat(488, 505, 42, "#e7676a", now);
  }
}

function drawFloor() {
  ctx.fillStyle = "#a77756";
  ctx.fillRect(20, 476, 960, 132);
  ctx.strokeStyle = "rgba(70,45,28,0.16)";
  for (let y = 492; y < 608; y += 24) {
    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(974, y + 12);
    ctx.stroke();
  }
}

function drawBookshelfObject(x, y, w, h) {
  ctx.fillStyle = "#8b5b3f";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#6e442f";
  ctx.fillRect(x + 14, y + 16, w - 28, h - 32);
  const colors = ["#e5b84d", "#465879", "#dd6b64", "#3f9468", "#7963bd", "#d9974e"];
  for (let row = 0; row < 4; row += 1) {
    const shelfY = y + 34 + row * 72;
    ctx.fillStyle = "#8b5b3f";
    ctx.fillRect(x + 18, shelfY + 42, w - 36, 8);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = colors[(row * 2 + i) % colors.length];
      ctx.fillRect(x + 28 + i * 19, shelfY + 4, 12 + (i % 3) * 3, 38);
    }
  }
}

function drawDeskObject(x, y, w, h) {
  ctx.fillStyle = "#9d6746";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#6f452f";
  ctx.fillRect(x + 30, y + 76, 88, 54);
  ctx.fillRect(x + 160, y + 76, 88, 54);
  ctx.fillStyle = "#e9d8bd";
  ctx.fillRect(x + 44, y + 92, 60, 8);
  ctx.fillRect(x + 174, y + 92, 60, 8);
  ctx.strokeStyle = "#5a3828";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 42, y + h);
  ctx.lineTo(x + 28, y + h + 58);
  ctx.moveTo(x + w - 42, y + h);
  ctx.lineTo(x + w - 28, y + h + 58);
  ctx.stroke();
  drawLampSmall(x + 208, y - 62);
  drawScrewdriver(x + 155, y + 20, 62);
}

function drawPaintingObject(x, y, w, h, moved) {
  ctx.fillStyle = "#9d6746";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = moved ? "#e9d8bd" : "#d8c8a8";
  ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
  ctx.fillStyle = moved ? "#465879" : "#8fb0d0";
  ctx.beginPath();
  ctx.arc(x + w * 0.48, y + h * 0.44, 22, 0, Math.PI * 2);
  ctx.fill();
  if (moved) {
    ctx.fillStyle = "#4c4b43";
    roundRect(ctx, x + 96, y + 44, 54, 44, 5);
    ctx.fill();
  }
}

function drawWindowObject(x, y, w, h, now) {
  ctx.fillStyle = "#f7f0de";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#465879";
  ctx.fillRect(x + 14, y + 14, w - 28, h - 44);
  ctx.fillStyle = "#f6d982";
  ctx.beginPath();
  ctx.arc(x + w - 48, y + 46, 15 + Math.sin(now / 520) * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7f0de";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 14);
  ctx.lineTo(x + w / 2, y + h - 30);
  ctx.moveTo(x + 14, y + h / 2);
  ctx.lineTo(x + w - 14, y + h / 2);
  ctx.stroke();
  ctx.fillStyle = "#9d6746";
  ctx.fillRect(x - 8, y + h - 34, w + 16, 30);
}

function drawCabinetObject(x, y, w, h, open) {
  ctx.fillStyle = "#8a6146";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = open ? "#5a3a2b" : "#a87550";
  ctx.fillRect(x + 18, y + 22, w - 36, h - 44);
  ctx.strokeStyle = "#5a3a2b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 24);
  ctx.lineTo(x + w / 2, y + h - 24);
  ctx.stroke();
  ctx.fillStyle = "#e5b84d";
  ctx.beginPath();
  ctx.arc(x + w / 2 - 12, y + h / 2, 6, 0, Math.PI * 2);
  ctx.arc(x + w / 2 + 12, y + h / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  if (open) {
    drawBattery(x + 42, y + 82);
    drawPaper(x + 92, y + 76, "A");
  }
}

function drawDoorObject(x, y, w, h, cardInserted) {
  ctx.fillStyle = "#7d533c";
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = "#9d6746";
  ctx.fillRect(x + 12, y + 16, w - 24, h - 32);
  ctx.strokeStyle = "#623b2b";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 22, y + 44, w - 44, 96);
  ctx.strokeRect(x + 22, y + 178, w - 44, 108);
  ctx.fillStyle = cardInserted ? "#3f9468" : "#2b2b28";
  roundRect(ctx, x - 34, y + 108, 24, 68, 4);
  ctx.fill();
  ctx.fillStyle = "#e5b84d";
  ctx.beginPath();
  ctx.arc(x + 22, y + 170, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCatbedObject(x, y, w, h) {
  ctx.fillStyle = "#dd6b64";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff0df";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2 + 3, w * 0.36, h * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!hasItem("bell")) drawBellIcon(x + w / 2 + 38, y + h / 2 - 4, 14);
}

function drawCarpetObject(x, y, w, h, lifted) {
  ctx.fillStyle = lifted ? "#c9a681" : "#7963bd";
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.fillStyle = lifted ? "rgba(33,31,26,0.22)" : "rgba(255,255,255,0.18)";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(x + 24 + i * 46, y + 28, 24, 4);
  }
}

function drawBookshelf() {
  drawDetailPanel("书架", "黄色、蓝色、红色、绿色的书被刻意放在同一排。");
  drawBookshelfObject(238, 84, 520, 430);
  ctx.fillStyle = "#211f1a";
  ctx.font = "900 28px ui-rounded, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("YELLOW  BLUE  RED  GREEN", 500, 562);
}

function drawDesk() {
  drawDetailPanel("书桌", state.flags.drawerOpen ? "抽屉已经打开。" : "抽屉上有四色锁。台灯底座似乎能拆。");
  drawDeskObject(210, 276, 580, 170);
  if (state.flags.drawerOpen) {
    ctx.fillStyle = "#5a3a2b";
    roundRect(ctx, 286, 360, 190, 72, 8);
    ctx.fill();
  }
}

function drawColorLock() {
  drawDetailPanel("四色锁", "按下书架提示的颜色顺序。");
  const buttons = [
    { color: "#e5b84d", label: "Y", x: 290 },
    { color: "#465879", label: "B", x: 410 },
    { color: "#dd6b64", label: "R", x: 530 },
    { color: "#3f9468", label: "G", x: 650 },
  ];
  for (const button of buttons) {
    ctx.fillStyle = button.color;
    roundRect(ctx, button.x, 310, 84, 84, 12);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.font = "900 28px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, button.x + 42, 352);
  }
  ctx.fillStyle = "#211f1a";
  ctx.font = "900 24px ui-rounded, system-ui";
  ctx.fillText(colorBuffer.map(colorName).join("  ") || "____", 500, 455);
}

function drawCabinet() {
  drawDetailPanel("柜子", state.flags.cabinetOpen ? "里面有被翻过的痕迹。" : "柜门被小锁锁住。");
  drawCabinetObject(352, 170, 296, 312, state.flags.cabinetOpen);
}

function drawCatbed() {
  drawDetailPanel("猫窝", hasItem("bell") ? "猫窝里只剩柔软的垫子。" : "猫窝边放着一个铃铛。");
  drawCatbedObject(332, 320, 340, 150);
  drawCat(505, 292, 54, "#e7676a", performance.now());
}

function drawWindow(now) {
  drawDetailPanel("窗台", state.flags.catMoved ? "窗台上露出纸条。" : "猫坐在窗台上，压住半张纸条。");
  drawWindowObject(278, 92, 444, 244, now);
  if (!state.flags.catMoved) {
    drawCat(500, 296, 64, "#e7676a", now);
    drawPaper(590, 378, "B");
  } else {
    drawPaper(590, 378, hasItem("paperB") || hasItem("paperFull") ? "" : "B");
  }
}

function drawLamp() {
  drawDetailPanel("台灯", state.flags.lampOpened ? "底座已经拆开。" : "底座有两颗小螺丝。");
  ctx.fillStyle = "#9d6746";
  roundRect(ctx, 330, 170, 340, 330, 12);
  ctx.fill();
  drawLampLarge(500, 330);
  if (state.flags.lampOpened) {
    ctx.fillStyle = "#5a3a2b";
    roundRect(ctx, 402, 398, 200, 90, 8);
    ctx.fill();
  }
}

function drawPainting() {
  drawDetailPanel("画框", state.flags.paintingMoved ? "画框后面是保险箱，背面有隐藏痕迹。" : "画框挂得有点歪。");
  drawPaintingObject(286, 124, 428, 256, state.flags.paintingMoved);
  if (state.flags.safeCodeRevealed) {
    ctx.fillStyle = "#7963bd";
    ctx.font = "900 42px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("2741", 410, 245);
  }
}

function drawSafe() {
  drawDetailPanel("保险箱", state.flags.safeOpen ? "保险箱已经打开。" : "保险箱需要四位密码。");
  ctx.fillStyle = "#454742";
  roundRect(ctx, 330, 168, 340, 278, 12);
  ctx.fill();
  ctx.fillStyle = "#2a2b28";
  roundRect(ctx, 366, 206, 268, 196, 8);
  ctx.fill();
  ctx.fillStyle = state.flags.safeOpen ? "#3f9468" : "#e5b84d";
  roundRect(ctx, 444, 254, 116, 64, 8);
  ctx.fill();
  ctx.fillStyle = "#211f1a";
  ctx.font = "900 24px ui-rounded, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(state.flags.safeOpen ? "OPEN" : keypadBuffer.padEnd(4, "_"), 502, 294);
  if (state.flags.safeOpen) drawDoorCard(508, 360);
}

function drawCarpet() {
  drawDetailPanel("地毯", state.flags.carpetLifted ? "地毯下有猫脚印。" : "猫离开窗台后一直看这里。");
  drawCarpetObject(250, 314, 500, 154, state.flags.carpetLifted);
  if (state.flags.carpetLifted) {
    const arrows = ["←", "→", "→", "←"];
    ctx.fillStyle = "#211f1a";
    ctx.font = "900 48px ui-rounded, system-ui";
    ctx.textAlign = "center";
    arrows.forEach((arrow, index) => {
      drawPaw(354 + index * 98, 390, index % 2 ? 1 : -1);
      ctx.fillText(arrow, 354 + index * 98, 462);
    });
  }
}

function drawDoor() {
  drawDetailPanel("门", state.flags.doorCardInserted ? "方向锁已经亮起。" : "门有卡槽和方向锁。");
  drawDoorObject(420, 96, 220, 430, state.flags.doorCardInserted);
  ctx.fillStyle = "#2b2b28";
  roundRect(ctx, 594, 270, 90, 126, 8);
  ctx.fill();
  ctx.fillStyle = state.flags.doorCardInserted ? "#3f9468" : "#10100f";
  roundRect(ctx, 608, 300, 62, 34, 4);
  ctx.fill();
  ctx.fillStyle = "#465879";
  roundRect(ctx, 412, 268, 120, 126, 8);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = "900 26px ui-rounded, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(directionBuffer.padEnd(4, "-"), 472, 338);
}

function drawDetailPanel(title, subtitle) {
  ctx.fillStyle = "rgba(255,250,240,0.72)";
  roundRect(ctx, 74, 58, 852, 526, 12);
  ctx.fill();
  ctx.fillStyle = "#211f1a";
  ctx.font = "900 34px ui-rounded, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(title, 500, 100);
  ctx.fillStyle = "rgba(33,31,26,0.62)";
  ctx.font = "800 16px ui-rounded, system-ui";
  ctx.fillText(subtitle, 500, 130);
}

function drawLampSmall(x, y) {
  ctx.fillStyle = "#5e5b52";
  ctx.fillRect(x + 25, y + 58, 8, 58);
  ctx.fillStyle = "#e5b84d";
  ctx.beginPath();
  ctx.moveTo(x, y + 56);
  ctx.lineTo(x + 58, y + 56);
  ctx.lineTo(x + 45, y + 20);
  ctx.lineTo(x + 14, y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5e5b52";
  roundRect(ctx, x + 6, y + 112, 48, 12, 6);
  ctx.fill();
}

function drawLampLarge(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#5e5b52";
  ctx.fillRect(-8, -10, 16, 150);
  ctx.fillStyle = "#e5b84d";
  ctx.beginPath();
  ctx.moveTo(-92, -14);
  ctx.lineTo(92, -14);
  ctx.lineTo(58, -110);
  ctx.lineTo(-58, -110);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5e5b52";
  roundRect(ctx, -92, 126, 184, 34, 14);
  ctx.fill();
  ctx.restore();
}

function drawScrewdriver(x, y, length) {
  if (hasItem("screwdriver")) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.16);
  ctx.fillStyle = "#465879";
  roundRect(ctx, 0, 0, length * 0.42, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#b8bec8";
  ctx.fillRect(length * 0.36, 4, length * 0.6, 4);
  ctx.restore();
}

function drawBattery(x, y) {
  if (hasItem("battery") || state.flags.uvReady) return;
  ctx.fillStyle = "#465879";
  roundRect(ctx, x, y, 44, 22, 5);
  ctx.fill();
  ctx.fillStyle = "#e5b84d";
  ctx.fillRect(x + 44, y + 7, 8, 8);
}

function drawPaper(x, y, label) {
  if (!label) return;
  ctx.fillStyle = "#fff7d7";
  roundRect(ctx, x, y, 74, 48, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(33,31,26,0.18)";
  ctx.strokeRect(x + 4, y + 4, 66, 40);
  ctx.fillStyle = "#211f1a";
  ctx.font = "900 18px ui-rounded, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x + 37, y + 30);
}

function drawBellIcon(x, y, r) {
  ctx.fillStyle = "#e5b84d";
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.lineTo(x + r * 0.82, y + r * 0.72);
  ctx.lineTo(x - r * 0.82, y + r * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7b5a1e";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.82, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoorCard(x, y) {
  ctx.fillStyle = "#e8f2f2";
  roundRect(ctx, x - 48, y - 28, 96, 56, 8);
  ctx.fill();
  ctx.fillStyle = "#465879";
  ctx.fillRect(x - 36, y - 12, 72, 10);
  ctx.fillStyle = "#3f9468";
  ctx.fillRect(x - 36, y + 8, 34, 8);
}

function drawPaw(x, y, side) {
  ctx.fillStyle = "rgba(33,31,26,0.42)";
  ctx.beginPath();
  ctx.ellipse(x, y, 14, 19, side * 0.18, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.arc(x + i * 13, y - 23, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCat(x, y, r, color, now) {
  const bob = Math.sin(now / 360) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = "rgba(33,31,26,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.88, r * 0.88, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(33,31,26,0.28)";
  ctx.lineWidth = Math.max(2, r * 0.08);
  drawEar(-r * 0.46, -r * 0.46, r, -0.2);
  drawEar(r * 0.46, -r * 0.46, r, 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.08, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.08, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#211f1a";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.08, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.08, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0a0a0";
  ctx.beginPath();
  ctx.moveTo(0, r * 0.08);
  ctx.lineTo(-r * 0.1, r * 0.2);
  ctx.lineTo(r * 0.1, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEar(x, y, r, tilt) {
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
  ctx.fillStyle = "#f4b2a7";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.28);
  ctx.lineTo(-r * 0.14, r * 0.06);
  ctx.lineTo(r * 0.14, r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHotspotLabel() {
  if (!hoverHotspot) return;
  ctx.save();
  ctx.strokeStyle = "rgba(33,31,26,0.48)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  roundRect(ctx, hoverHotspot.x, hoverHotspot.y, hoverHotspot.w, hoverHotspot.h, 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(33,31,26,0.84)";
  roundRect(ctx, hoverHotspot.x, hoverHotspot.y - 30, Math.max(72, hoverHotspot.label.length * 18), 25, 6);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = "900 14px ui-rounded, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(hoverHotspot.label, hoverHotspot.x + 10, hoverHotspot.y - 17);
  ctx.restore();
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 3.4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 3,
      color,
      life: 1,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.06 * dt * 60;
    p.life -= dt * 2.2;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function sceneTitle(scene) {
  const names = {
    room: "Room",
    bookshelf: "Bookshelf",
    desk: "Desk",
    colorLock: "Lock",
    cabinet: "Cabinet",
    catbed: "Cat Bed",
    window: "Window",
    lamp: "Lamp",
    painting: "Painting",
    safe: "Safe",
    carpet: "Carpet",
    door: "Door",
  };
  return names[scene] || scene;
}

function colorName(color) {
  const map = { Y: "黄", B: "蓝", R: "红", G: "绿" };
  return map[color] || color;
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
