const canvas = document.getElementById("sceneCanvas");
const ctx = canvas.getContext("2d");
const portraitCanvas = document.getElementById("portraitCanvas");
const portraitCtx = portraitCanvas.getContext("2d");
const chapterLabel = document.getElementById("chapterLabel");
const sceneTitle = document.getElementById("sceneTitle");
const locationLabel = document.getElementById("locationLabel");
const nodeTitle = document.getElementById("nodeTitle");
const speakerLabel = document.getElementById("speakerLabel");
const storyText = document.getElementById("storyText");
const choicesEl = document.getElementById("choices");
const changeLog = document.getElementById("changeLog");
const trustBar = document.getElementById("trustBar");
const clueBar = document.getElementById("clueBar");
const omenBar = document.getElementById("omenBar");
const trustValue = document.getElementById("trustValue");
const clueValue = document.getElementById("clueValue");
const omenValue = document.getElementById("omenValue");
const journalButton = document.getElementById("journalButton");
const endingsButton = document.getElementById("endingsButton");
const restartButton = document.getElementById("restartButton");
const panelBackdrop = document.getElementById("panelBackdrop");
const panelCloseButton = document.getElementById("panelCloseButton");
const panelKicker = document.getElementById("panelKicker");
const panelTitle = document.getElementById("panelTitle");
const panelContent = document.getElementById("panelContent");

const SAVE_KEY = "rainLaneLetters.save.v1";
const META_KEY = "rainLaneLetters.meta.v1";
const MAX_STAT = 6;

const ACHIEVEMENTS = [
  ["first", "第一封信", "做出第一个选择。"],
  ["fed", "窗台鱼干", "在第一夜喂了黑猫。"],
  ["investigator", "旧报纸气味", "线索达到 4。"],
  ["trusted", "允许摸头", "信任达到 4。"],
  ["omen", "雨声太近", "异兆达到 5。"],
  ["station", "末班车站", "调查旧车站。"],
  ["key", "黄铜钥匙", "拿到或归还那把钥匙。"],
  ["allEndings", "雨巷全图", "解锁全部结局。"],
];

const ENDINGS = {
  trueRain: {
    title: "雨停之后",
    text: "你跟着黑猫走进雨巷尽头，看见失踪的门牌一块块亮起。它不是来求救的，是来找最后一个愿意开门的人。天亮前，你把所有名字送回了楼里。雨停了，猫睡在你的行李箱上。",
    tone: "true",
  },
  archivist: {
    title: "旧楼档案",
    text: "你没有跟猫走进巷子，而是把车票、钥匙和照片交给档案馆。三号楼的旧事故被重新打开。一个月后，窗台出现一张干燥的猫爪印，像一句不太情愿的谢谢。",
    tone: "good",
  },
  messenger: {
    title: "新信差",
    text: "你听懂了所有雨声，也再也分不清白天和夜里。黑猫把铃铛留给你，从此每到雨夜，你会替它把没人敢看的信送到门缝里。",
    tone: "strange",
  },
  emptyRoom: {
    title: "空房间",
    text: "你把钥匙插进三楼那扇不存在的门。门后没有房间，只有一直落下来的雨。第二天，管理员说三号楼从来没有你这个住户。",
    tone: "bad",
  },
  windowCat: {
    title: "窗台住客",
    text: "你没有找到完整真相，但黑猫留下来了。它占据窗台、沙发和你的旧围巾。每个雨夜，它会短暂醒来，看向某条你看不见的小巷。",
    tone: "soft",
  },
  movedAway: {
    title: "搬离",
    text: "你在第二天退了租。管理员没有挽留，只递给你一把并不属于你的旧钥匙。很久以后，你偶尔会梦见窗外有猫轻轻敲玻璃。",
    tone: "normal",
  },
};

const SPEAKERS = {
  apartment: { name: "黑猫", avatar: "cat" },
  window: { name: "黑猫", avatar: "cat" },
  roof: { name: "黑猫", avatar: "cat" },
  mailroom: { name: "黑猫", avatar: "cat" },
  alley: { name: "黑猫", avatar: "cat" },
  lobby: { name: "管理员", avatar: "manager" },
  room: { name: "你", avatar: "player" },
  station: { name: "旧车站", avatar: "station" },
  door: { name: "门后的人", avatar: "door" },
  ending: { name: "结局", avatar: "ending" },
};

const SCENES = {
  start: {
    chapter: "第一夜",
    location: "三号楼 · 旧走廊",
    title: "黑猫在窗外",
    art: "apartment",
    text: [
      "你搬进三号楼的第一晚，雨把窗玻璃敲得很低。",
      "午夜十二点，一只黑猫蹲在窗台外，嘴里叼着一封没有邮票的湿信。信封上写着你的房号，但笔迹像很多年前的人。",
    ],
    choices: [
      {
        label: "把鱼干放到窗台上",
        note: "先相信它一点。",
        effects: { trust: 2, omen: 1 },
        flags: ["fedCat"],
        achievements: ["first", "fed"],
        next: "letter",
      },
      {
        label: "去楼下问管理员",
        note: "旧楼总有人知道规矩。",
        effects: { clues: 2 },
        flags: ["askedManager"],
        achievements: ["first"],
        next: "manager",
      },
      {
        label: "关窗，假装没看见",
        note: "雨夜最好少管闲事。",
        effects: { trust: -1, omen: 2 },
        flags: ["ignoredCat"],
        achievements: ["first"],
        next: "dream",
      },
    ],
  },
  manager: {
    chapter: "第一夜",
    location: "一楼 · 值班室",
    title: "管理员的旧钥匙串",
    art: "lobby",
    text: [
      "管理员听见“黑猫”两个字，手里的钥匙串轻轻一抖。",
      "他说三号楼以前有个邮差，每逢雨夜送信。后来邮差失踪，猫却一直回来。你问房号，他只说：不要打开三楼尽头那扇门。",
    ],
    choices: [
      {
        label: "记下三楼尽头",
        note: "禁忌通常就是地图。",
        effects: { clues: 1, omen: 1 },
        flags: ["knowsThirdFloor"],
        next: "letter",
      },
      {
        label: "把管理员的话告诉黑猫",
        note: "猫也许听得懂。",
        effects: { trust: 1 },
        flags: ["toldCat"],
        next: "letter",
      },
    ],
  },
  dream: {
    chapter: "第一夜",
    location: "卧室 · 雨声里",
    title: "门缝下的影子",
    art: "room",
    text: [
      "你刚闭眼，门缝下就渗进一条细长的水迹。",
      "水迹绕过鞋尖，拼出一个很小的猫爪印。窗外那封信已经不见了，床头却多了一枚湿掉的车票角。",
    ],
    choices: [
      {
        label: "把车票角收进书里",
        note: "至少它是真实的。",
        effects: { clues: 1, omen: 1 },
        flags: ["ticketCorner"],
        next: "letter",
      },
      {
        label: "擦掉水迹",
        note: "不让雨进屋。",
        effects: { omen: 1 },
        flags: ["wipedWater"],
        next: "letter",
      },
    ],
  },
  letter: {
    chapter: "第二夜",
    location: "窗台 · 湿信",
    title: "没有邮票的信",
    art: "window",
    text: [
      "黑猫第二次出现时，信已经被雨泡开。里面没有文字，只有一张旧车票：终点站叫“雨巷”。",
      "车票背面有三道爪痕，像是在催你决定从哪里查起。",
    ],
    choices: [
      {
        label: "拿车票去旧车站查",
        note: "从现实里找入口。",
        effects: { clues: 2 },
        flags: ["wentStation"],
        achievements: ["station"],
        next: "station",
      },
      {
        label: "留在房间等黑猫回来",
        note: "让它决定下一步。",
        effects: { trust: 2 },
        flags: ["waitedForCat"],
        next: "waiting",
      },
      {
        label: "跟踪黑猫上天台",
        note: "看看它到底去哪。",
        effects: { trust: 1, clues: 1, omen: 1 },
        flags: ["rooftopTrail"],
        next: "rooftop",
      },
    ],
  },
  station: {
    chapter: "第二夜",
    location: "城西 · 废弃站台",
    title: "末班车站",
    art: "station",
    text: [
      "旧车站已经停运十七年。售票窗口后贴着一张泛黄寻人启事：雨夜失踪的邮差，最后一次被看见是在三号楼。",
      "你在候车椅下捡到半张照片，照片边缘有猫咬过的齿痕。",
    ],
    choices: [
      {
        label: "带走照片",
        note: "照片里有三楼尽头的门。",
        effects: { clues: 2 },
        flags: ["photoHalf"],
        next: "keyNight",
      },
      {
        label: "把照片留给黑猫闻",
        note: "它也许在找这个人。",
        effects: { trust: 1, clues: 1 },
        flags: ["catSmelledPhoto"],
        next: "keyNight",
      },
    ],
  },
  waiting: {
    chapter: "第二夜",
    location: "卧室 · 熄灯以后",
    title: "猫睡在行李箱上",
    art: "room",
    text: [
      "你没有出门。凌晨一点，黑猫从窗缝挤进来，浑身湿透，却把爪子仔细擦在地垫上。",
      "它睡在行李箱上，尾巴圈着一把黄铜钥匙。钥匙牌写着：三楼尽头。",
    ],
    choices: [
      {
        label: "轻轻摸它的头",
        note: "它没有躲。",
        effects: { trust: 2 },
        flags: ["pettedCat"],
        next: "keyNight",
      },
      {
        label: "趁它睡着拿走钥匙",
        note: "真相比较急。",
        effects: { clues: 1, trust: -1, omen: 1 },
        flags: ["tookKey"],
        achievements: ["key"],
        next: "keyNight",
      },
    ],
  },
  rooftop: {
    chapter: "第二夜",
    location: "天台 · 水箱旁",
    title: "所有天线都指向雨巷",
    art: "roof",
    text: [
      "黑猫穿过晾衣绳，停在水箱旁。天台上的旧天线全都弯向同一个方向：楼与楼之间一条不该存在的小巷。",
      "水箱铁皮上刻着一行字：信送到，门才会回来。",
    ],
    choices: [
      {
        label: "把这句话拍下来",
        note: "证据越多，雨越像地图。",
        effects: { clues: 2, omen: 1 },
        flags: ["roofWords"],
        next: "keyNight",
      },
      {
        label: "跟黑猫一起等到天亮",
        note: "它靠着你的鞋睡了一会儿。",
        effects: { trust: 2 },
        flags: ["roofDawn"],
        next: "keyNight",
      },
    ],
  },
  keyNight: {
    chapter: "第三夜",
    location: "三楼 · 尽头",
    title: "黄铜钥匙",
    art: "door",
    text: [
      "第三夜，整栋楼的灯同时熄灭。黑猫把黄铜钥匙推到你脚边。",
      "三楼尽头原本是一堵墙，现在多出一扇湿漉漉的门。门后有人很轻地问：信到了吗？",
    ],
    choices: [
      {
        label: "用钥匙打开门",
        note: "直接面对门后的东西。",
        effects: { clues: 1, omen: 2 },
        flags: ["openedDoor"],
        achievements: ["key"],
        next: "inside",
      },
      {
        label: "把钥匙挂回猫脖子上",
        note: "让它决定是否开门。",
        effects: { trust: 2, omen: 1 },
        flags: ["returnedKey"],
        achievements: ["key"],
        next: "inside",
      },
      {
        label: "带着钥匙去找管理员",
        note: "再确认一次现实。",
        effects: { clues: 2, trust: -1 },
        flags: ["managerKey"],
        achievements: ["key"],
        next: "inside",
      },
    ],
  },
  inside: {
    chapter: "第三夜",
    location: "门内 · 旧邮袋",
    title: "没有寄出的名字",
    art: "mailroom",
    text: [
      "门后不是房间，而是一间小小的分拣室。墙上挂满没有寄出的信，每一封都写着三号楼住户的名字。",
      "黑猫站在邮袋上看你。你终于明白，它不是来送信，是来找一个能替它把最后几封信送完的人。",
    ],
    choices: [
      {
        label: "拼合车票、照片和钥匙牌",
        note: "用线索还原当年的路线。",
        effects: { clues: 1 },
        flags: ["rebuiltRoute"],
        next: "final",
      },
      {
        label: "抱起黑猫，跟它进雨巷",
        note: "相信它知道出口。",
        effects: { trust: 1, omen: 1 },
        flags: ["followedCat"],
        next: "final",
      },
      {
        label: "放下钥匙，退出那扇门",
        note: "不是每封信都该打开。",
        effects: { omen: -1 },
        flags: ["steppedBack"],
        next: "final",
      },
    ],
  },
  final: {
    chapter: "终章",
    location: "雨巷 · 门牌下",
    title: "最后一封信",
    art: "alley",
    text: [
      "雨巷在楼后展开，比任何地图都窄。门牌在黑暗里一块一块亮起。",
      "黑猫停在最后一扇门前，把额头贴在你的手背上。你听见许多年前的脚步声，也听见天快亮了。",
    ],
    ending: true,
  },
};

const state = {
  sceneId: "start",
  trust: 0,
  clues: 0,
  omen: 0,
  flags: {},
  achievements: {},
  endings: {},
  lastDelta: "",
  dpr: 1,
  width: 1,
  height: 1,
  time: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function has(flag) {
  return Boolean(state.flags[flag]);
}

function unlockAchievement(id) {
  if (!id || state.achievements[id]) return false;
  state.achievements[id] = true;
  return true;
}

function checkAutoAchievements() {
  if (state.clues >= 4) unlockAchievement("investigator");
  if (state.trust >= 4) unlockAchievement("trusted");
  if (state.omen >= 5) unlockAchievement("omen");
  const allEndings = Object.keys(ENDINGS).every((id) => state.endings[id]);
  if (allEndings) unlockAchievement("allEndings");
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const meta = JSON.parse(raw);
    if (meta.achievements) state.achievements = { ...meta.achievements };
    if (meta.endings) state.endings = { ...meta.endings };
  } catch (error) {
    console.warn("Meta ignored", error);
  }
}

function saveMeta() {
  localStorage.setItem(
    META_KEY,
    JSON.stringify({
      achievements: state.achievements,
      endings: state.endings,
    }),
  );
}

function loadGame() {
  loadMeta();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    state.sceneId = SCENES[save.sceneId] ? save.sceneId : "start";
    state.trust = clamp(Number(save.trust) || 0, 0, MAX_STAT);
    state.clues = clamp(Number(save.clues) || 0, 0, MAX_STAT);
    state.omen = clamp(Number(save.omen) || 0, 0, MAX_STAT);
    state.flags = save.flags && typeof save.flags === "object" ? { ...save.flags } : {};
  } catch (error) {
    console.warn("Save ignored", error);
  }
}

function saveGame() {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      sceneId: state.sceneId,
      trust: state.trust,
      clues: state.clues,
      omen: state.omen,
      flags: state.flags,
    }),
  );
  saveMeta();
}

function restartGame() {
  state.sceneId = "start";
  state.trust = 0;
  state.clues = 0;
  state.omen = 0;
  state.flags = {};
  state.lastDelta = "";
  localStorage.removeItem(SAVE_KEY);
  render();
}

function describeDelta(before, after) {
  const parts = [];
  const names = [
    ["trust", "信任"],
    ["clues", "线索"],
    ["omen", "异兆"],
  ];
  names.forEach(([key, label]) => {
    const diff = after[key] - before[key];
    if (diff > 0) parts.push(`${label}+${diff}`);
    if (diff < 0) parts.push(`${label}${diff}`);
  });
  return parts.join(" · ");
}

function applyChoice(choice) {
  const before = {
    trust: state.trust,
    clues: state.clues,
    omen: state.omen,
  };
  const effects = choice.effects || {};
  state.trust = clamp(state.trust + (effects.trust || 0), 0, MAX_STAT);
  state.clues = clamp(state.clues + (effects.clues || 0), 0, MAX_STAT);
  state.omen = clamp(state.omen + (effects.omen || 0), 0, MAX_STAT);

  (choice.flags || []).forEach((flag) => {
    state.flags[flag] = true;
  });
  (choice.achievements || []).forEach(unlockAchievement);
  checkAutoAchievements();

  const after = {
    trust: state.trust,
    clues: state.clues,
    omen: state.omen,
  };
  state.lastDelta = describeDelta(before, after);
  state.sceneId = choice.next;
  render();
  saveGame();
}

function resolveEnding() {
  if (has("followedCat") && state.trust >= 4 && state.clues >= 3) return "trueRain";
  if (has("rebuiltRoute") && state.clues >= 5) return "archivist";
  if (state.omen >= 5 && state.trust >= 3) return "messenger";
  if (state.omen >= 5 || (has("openedDoor") && state.clues < 3)) return "emptyRoom";
  if (state.trust >= 4) return "windowCat";
  return "movedAway";
}

function finishStory() {
  const endingId = resolveEnding();
  state.endings[endingId] = true;
  checkAutoAchievements();
  saveMeta();
  localStorage.removeItem(SAVE_KEY);
  return ENDINGS[endingId];
}

function renderMeters() {
  trustValue.textContent = state.trust;
  clueValue.textContent = state.clues;
  omenValue.textContent = state.omen;
  trustBar.style.width = `${(state.trust / MAX_STAT) * 100}%`;
  clueBar.style.width = `${(state.clues / MAX_STAT) * 100}%`;
  omenBar.style.width = `${(state.omen / MAX_STAT) * 100}%`;
}

function renderText(lines) {
  storyText.innerHTML = "";
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    storyText.appendChild(p);
  });
}

function renderSpeaker(scene, ending = null) {
  const speaker = ending ? SPEAKERS.ending : SPEAKERS[scene.art] || SPEAKERS.apartment;
  speakerLabel.textContent = speaker.name;
  drawPortrait(speaker.avatar, ending?.tone || scene.art);
}

function renderChoices(scene) {
  choicesEl.innerHTML = "";
  if (scene.ending) {
    const ending = finishStory();
    renderSpeaker(scene, ending);
    renderText([ending.text]);
    choicesEl.appendChild(
      makeChoiceButton("再来一次", "保留成就和结局收集，重新开始这场雨。", restartGame),
    );
    choicesEl.appendChild(
      makeChoiceButton("查看结局册", "看看还剩哪些路线没有走到。", () => openPanel("endings")),
    );
    nodeTitle.textContent = ending.title;
    sceneTitle.textContent = ending.title;
    changeLog.textContent = "结局已记录";
    return;
  }

  scene.choices.forEach((choice) => {
    choicesEl.appendChild(makeChoiceButton(choice.label, choice.note, () => applyChoice(choice)));
  });
}

function makeChoiceButton(label, note, onClick) {
  const button = document.createElement("button");
  button.className = "choice";
  button.type = "button";
  const token = document.createElement("span");
  token.className = "choice-token";
  token.textContent = "▶";
  const copy = document.createElement("span");
  copy.className = "choice-copy";
  const strong = document.createElement("strong");
  strong.textContent = label;
  const small = document.createElement("small");
  small.textContent = note;
  copy.append(strong, small);
  button.append(token, copy);
  button.addEventListener("click", onClick);
  return button;
}

function render() {
  const scene = SCENES[state.sceneId] || SCENES.start;
  chapterLabel.textContent = scene.chapter;
  sceneTitle.textContent = scene.title;
  locationLabel.textContent = scene.location;
  nodeTitle.textContent = scene.title;
  renderSpeaker(scene);
  renderMeters();
  renderText(scene.text);
  renderChoices(scene);
  changeLog.textContent = state.lastDelta || "雨声还在窗外";
  drawScene(performance.now());
}

function itemState(unlocked) {
  return unlocked ? "" : " locked";
}

function openPanel(kind) {
  panelBackdrop.hidden = false;
  panelContent.innerHTML = "";
  if (kind === "achievements") {
    panelKicker.textContent = "ACHIEVEMENTS";
    panelTitle.textContent = "成就册";
    ACHIEVEMENTS.forEach(([id, title, desc]) => {
      const item = document.createElement("div");
      item.className = `collect-item${itemState(state.achievements[id])}`;
      item.innerHTML = `<strong>${state.achievements[id] ? title : "未解锁"}</strong><span>${desc}</span>`;
      panelContent.appendChild(item);
    });
  } else {
    panelKicker.textContent = "ENDINGS";
    panelTitle.textContent = "结局册";
    Object.entries(ENDINGS).forEach(([id, ending]) => {
      const item = document.createElement("div");
      item.className = `collect-item${itemState(state.endings[id])}`;
      item.innerHTML = `<strong>${state.endings[id] ? ending.title : "？？？"}</strong><span>${state.endings[id] ? ending.text : "还没有走到这条路线。"}</span>`;
      panelContent.appendChild(item);
    });
  }
}

function closePanel() {
  panelBackdrop.hidden = true;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  state.width = Math.max(1, Math.floor(rect.width * state.dpr));
  state.height = Math.max(1, Math.floor(rect.height * state.dpr));
  canvas.width = state.width;
  canvas.height = state.height;
  drawScene(performance.now());
}

function drawBackground(base, accent) {
  const g = ctx.createLinearGradient(0, 0, state.width, state.height);
  g.addColorStop(0, base);
  g.addColorStop(0.58, "#0a0907");
  g.addColorStop(1, accent);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#e3d8bd";
  for (let x = -state.height; x < state.width + state.height; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + state.height * 0.42, state.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRain(time) {
  ctx.save();
  ctx.strokeStyle = "rgba(227,216,189,0.18)";
  ctx.lineWidth = 1;
  const drift = (time * 0.24) % 60;
  for (let x = -40; x < state.width + 60; x += 24) {
    const y = (x * 7 + drift * 9) % (state.height + 120);
    ctx.beginPath();
    ctx.moveTo(x, y - 70);
    ctx.lineTo(x + 16, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCat(x, y, scale = 1, alert = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#070605";
  ctx.beginPath();
  ctx.ellipse(0, 18, 58, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, -8, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, -31);
  ctx.lineTo(31, -67);
  ctx.lineTo(48, -35);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(57, -36);
  ctx.lineTo(85, -60);
  ctx.lineTo(76, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#070605";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-53, 11);
  ctx.bezierCurveTo(-96, -4, -89, -54, -36, -42);
  ctx.stroke();
  ctx.fillStyle = alert ? "#d8c58d" : "#8fa36c";
  ctx.beginPath();
  ctx.ellipse(30, -12, 5, 8, -0.1, 0, Math.PI * 2);
  ctx.ellipse(54, -12, 5, 8, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindowScene(time) {
  drawBackground("#1a1b14", "#29181a");
  ctx.fillStyle = "rgba(227,216,189,0.08)";
  ctx.fillRect(state.width * 0.2, state.height * 0.16, state.width * 0.48, state.height * 0.58);
  ctx.strokeStyle = "rgba(227,216,189,0.24)";
  ctx.lineWidth = 3;
  ctx.strokeRect(state.width * 0.2, state.height * 0.16, state.width * 0.48, state.height * 0.58);
  ctx.beginPath();
  ctx.moveTo(state.width * 0.44, state.height * 0.16);
  ctx.lineTo(state.width * 0.44, state.height * 0.74);
  ctx.moveTo(state.width * 0.2, state.height * 0.45);
  ctx.lineTo(state.width * 0.68, state.height * 0.45);
  ctx.stroke();
  drawCat(state.width * 0.62, state.height * 0.46, 1.18, true);
  drawRain(time);
}

function drawDoorScene(time) {
  drawBackground("#15120f", "#321b20");
  ctx.fillStyle = "#11100d";
  ctx.fillRect(state.width * 0.32, state.height * 0.14, state.width * 0.36, state.height * 0.78);
  ctx.strokeStyle = "rgba(201,167,90,0.44)";
  ctx.lineWidth = 3;
  ctx.strokeRect(state.width * 0.32, state.height * 0.14, state.width * 0.36, state.height * 0.78);
  ctx.fillStyle = "#c9a75a";
  ctx.beginPath();
  ctx.arc(state.width * 0.62, state.height * 0.52, 5, 0, Math.PI * 2);
  ctx.fill();
  drawCat(state.width * 0.23, state.height * 0.5, 0.98, state.omen >= 4);
  drawRain(time);
}

function drawStationScene(time) {
  drawBackground("#11191d", "#17110f");
  ctx.fillStyle = "rgba(227,216,189,0.12)";
  ctx.fillRect(0, state.height * 0.66, state.width, state.height * 0.12);
  ctx.strokeStyle = "rgba(227,216,189,0.2)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, state.height * 0.78);
  ctx.lineTo(state.width, state.height * 0.66);
  ctx.moveTo(0, state.height * 0.88);
  ctx.lineTo(state.width, state.height * 0.76);
  ctx.stroke();
  ctx.fillStyle = "rgba(201,167,90,0.18)";
  ctx.fillRect(state.width * 0.12, state.height * 0.2, state.width * 0.22, state.height * 0.18);
  ctx.strokeStyle = "rgba(227,216,189,0.16)";
  ctx.strokeRect(state.width * 0.12, state.height * 0.2, state.width * 0.22, state.height * 0.18);
  drawRain(time);
}

function drawRoofScene(time) {
  drawBackground("#101719", "#24301f");
  ctx.fillStyle = "rgba(227,216,189,0.1)";
  ctx.fillRect(0, state.height * 0.6, state.width, state.height * 0.4);
  ctx.strokeStyle = "rgba(227,216,189,0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const x = state.width * (0.18 + i * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, state.height * 0.6);
    ctx.lineTo(x + state.width * 0.16, state.height * 0.33);
    ctx.stroke();
  }
  drawCat(state.width * 0.54, state.height * 0.49, 0.9, true);
  drawRain(time);
}

function drawMailScene(time) {
  drawBackground("#17130f", "#2e2215");
  for (let i = 0; i < 20; i += 1) {
    const x = state.width * (0.13 + (i % 5) * 0.16);
    const y = state.height * (0.18 + Math.floor(i / 5) * 0.13);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((i % 3) - 1) * 0.04);
    ctx.fillStyle = "rgba(227,216,189,0.16)";
    ctx.fillRect(-34, -18, 68, 36);
    ctx.strokeStyle = "rgba(227,216,189,0.18)";
    ctx.strokeRect(-34, -18, 68, 36);
    ctx.restore();
  }
  drawCat(state.width * 0.5, state.height * 0.48, 1.02, state.trust >= 4);
  drawRain(time);
}

function drawAlleyScene(time) {
  drawBackground("#10100c", "#301820");
  ctx.fillStyle = "rgba(227,216,189,0.08)";
  for (let i = 0; i < 7; i += 1) {
    const w = state.width * (0.1 + i * 0.015);
    const h = state.height * 0.62;
    const x = state.width * (0.18 + i * 0.09);
    ctx.fillRect(x, state.height * 0.24, w, h);
    ctx.fillStyle = i % 2 ? "rgba(201,167,90,0.22)" : "rgba(227,216,189,0.1)";
  }
  drawCat(state.width * 0.5, state.height * 0.48, 1.04, true);
  ctx.fillStyle = "rgba(201,167,90,0.72)";
  ctx.font = `${Math.max(28, state.width * 0.052)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("雨巷", state.width * 0.5, state.height * 0.28);
  drawRain(time);
}

function drawScene(time) {
  state.time = time;
  const scene = SCENES[state.sceneId] || SCENES.start;
  ctx.clearRect(0, 0, state.width, state.height);
  if (scene.art === "station") drawStationScene(time);
  else if (scene.art === "roof") drawRoofScene(time);
  else if (scene.art === "door") drawDoorScene(time);
  else if (scene.art === "mailroom") drawMailScene(time);
  else if (scene.art === "alley") drawAlleyScene(time);
  else if (scene.art === "lobby") drawDoorScene(time);
  else drawWindowScene(time);
}

function px(x, y, w, h, color, scale = 6) {
  portraitCtx.fillStyle = color;
  portraitCtx.fillRect(x * scale, y * scale, w * scale, h * scale);
}

function clearPortrait(bg = "#14120e") {
  portraitCtx.imageSmoothingEnabled = false;
  portraitCtx.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);
}

function drawPixelCat() {
  clearPortrait("#15130f");
  px(4, 12, 8, 2, "#050504");
  px(5, 9, 7, 4, "#050504");
  px(6, 6, 5, 4, "#050504");
  px(5, 4, 2, 3, "#050504");
  px(10, 4, 2, 3, "#050504");
  px(2, 11, 3, 1, "#050504");
  px(1, 10, 2, 1, "#050504");
  px(7, 8, 1, 1, "#d8c58d");
  px(10, 8, 1, 1, "#d8c58d");
  px(8, 10, 1, 1, "#a0957d");
}

function drawPixelManager() {
  clearPortrait("#18140f");
  px(5, 4, 6, 2, "#4f3828");
  px(4, 6, 8, 6, "#b8895d");
  px(6, 8, 1, 1, "#17140f");
  px(10, 8, 1, 1, "#17140f");
  px(7, 11, 3, 1, "#5b332f");
  px(3, 12, 10, 3, "#415d68");
  px(6, 13, 4, 2, "#c9a75a");
}

function drawPixelPlayer() {
  clearPortrait("#121715");
  px(5, 4, 6, 3, "#2a2119");
  px(4, 7, 8, 5, "#c69569");
  px(6, 8, 1, 1, "#17140f");
  px(10, 8, 1, 1, "#17140f");
  px(7, 11, 3, 1, "#7a463e");
  px(3, 12, 10, 3, "#61714f");
  px(5, 13, 6, 1, "#e3d8bd");
}

function drawPixelStation() {
  clearPortrait("#10171a");
  px(3, 4, 10, 2, "#415d68");
  px(4, 6, 8, 5, "#1d2526");
  px(5, 7, 2, 2, "#c9a75a");
  px(9, 7, 2, 2, "#c9a75a");
  px(2, 12, 12, 2, "#4f4a39");
  px(4, 14, 2, 1, "#e3d8bd");
  px(10, 14, 2, 1, "#e3d8bd");
}

function drawPixelDoor() {
  clearPortrait("#170e11");
  px(5, 2, 7, 13, "#1c1612");
  px(6, 3, 5, 11, "#2a1f18");
  px(10, 8, 1, 1, "#c9a75a");
  px(3, 13, 11, 2, "#0a0907");
  px(6, 6, 1, 1, "#71333a");
  px(9, 6, 1, 1, "#71333a");
}

function drawPixelEnding(tone) {
  clearPortrait(tone === "bad" ? "#180c10" : "#11150f");
  px(4, 4, 8, 8, "#c9a75a");
  px(5, 5, 6, 6, tone === "bad" ? "#71333a" : "#61714f");
  px(7, 7, 2, 2, "#e3d8bd");
  px(3, 12, 10, 2, "#050504");
  px(6, 13, 4, 2, "#050504");
}

function drawPortrait(kind, tone) {
  if (kind === "manager") drawPixelManager();
  else if (kind === "player") drawPixelPlayer();
  else if (kind === "station") drawPixelStation();
  else if (kind === "door") drawPixelDoor();
  else if (kind === "ending") drawPixelEnding(tone);
  else drawPixelCat();
}

function tick(time) {
  drawScene(time);
  requestAnimationFrame(tick);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  journalButton.addEventListener("click", () => openPanel("achievements"));
  endingsButton.addEventListener("click", () => openPanel("endings"));
  restartButton.addEventListener("click", restartGame);
  panelCloseButton.addEventListener("click", closePanel);
  panelBackdrop.addEventListener("click", (event) => {
    if (event.target === panelBackdrop) closePanel();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panelBackdrop.hidden) closePanel();
  });
}

function init() {
  loadGame();
  bindEvents();
  resize();
  render();
  requestAnimationFrame(tick);
}

init();
