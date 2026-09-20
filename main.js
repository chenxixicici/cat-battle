(function(){
'use strict';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const TAU = Math.PI * 2;
const WORLD = { w: 720, h: 1280 };

// 防御性包裹 arc：半径非正时修正，避免负数/NaN 崩溃
const _origArc = ctx.arc.bind(ctx);
ctx.arc = function(x, y, r, a0, a1, ccw){
  if(typeof r !== 'number' || !isFinite(r) || r <= 0) r = 0.01;
  return _origArc(x, y, r, a0, a1, ccw);
};

const rand  = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp  = (a,b,t) => a + (b-a)*t;
const randLine = arr => arr[Math.floor(Math.random()*arr.length)];

function resize(){
  const aspect = W / H;
  let cw = window.innerWidth, ch = window.innerHeight;
  if(cw / ch > aspect){ cw = ch * aspect; } else { ch = cw / aspect; }
  cv.style.width  = Math.floor(cw) + 'px';
  cv.style.height = Math.floor(ch) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

const MOVE_BASE  = { x: 130, y: H - 150 };
const PAUSE_BTN  = { x: W - 60, y: 60, r: 50 };
const MISSILE_BTN = { x: W - 90, y: H - 110, r: 54 };
const LASER_BTN   = { x: W - 90, y: H - 300, r: 54 };
const AUTO_BTN    = { x: W - 90, y: H - 430, w: 76, h: 36 };
const RESUME_BTN       = { x: W/2, y: 690, w: 280, h: 68 };
const PAUSE_LB_BTN     = { x: W/2 - 110, y: 790, w: 200, h: 58 };
const PAUSE_HELP_BTN   = { x: W/2 + 110, y: 790, w: 200, h: 58 };
const RESTART_BTN      = { x: W/2, y: 880, w: 280, h: 58 };

const DEAD_LB_BTN      = { x: W/2 - 95, y: H - 150, w: 170, h: 64 };
const DEAD_RESTART_BTN = { x: W/2 + 95, y: H - 150, w: 170, h: 64 };
const LB_CLOSE_BTN     = { x: W/2, y: H - 80, w: 240, h: 62 };
const CONFIRM_YES_BTN = { x: W/2 - 80, y: H/2 + 70, w: 140, h: 60 };
const CONFIRM_NO_BTN  = { x: W/2 + 80, y: H/2 + 70, w: 140, h: 60 };
const AVATAR      = { x: 50, y: 50, r: 36 };
const HELP_QUICK_BTN = { x: 50, y: 152, r: 32 };

// 主菜单按钮
const MENU_START_BTN = { x: W/2, y: 880, w: 400, h: 96 };
const MENU_LB_BTN    = { x: W/2, y: 1000, w: 400, h: 96 };
const MENU_HELP_BTN  = { x: W/2, y: 1120, w: 400, h: 96 };
// 游戏说明返回
const HELP_BACK_BTN  = { x: W/2, y: H - 80, w: 260, h: 72 };
// 胜利界面按钮
const VICTORY_CONTINUE_BTN = { x: W/2, y: 820, w: 400, h: 88 };
const VICTORY_END_BTN      = { x: W/2, y: 940, w: 400, h: 88 };
// 关卡过关弹窗按钮
const STAGE_CLEAR_BTN = { x: W/2, y: H * 0.78, w: 400, h: 88 };
// 关卡上限
const MAX_WAVE = 20;
// 是否已解锁全部武器
function isAllWeaponsUnlocked(){
  return !!(unlockedWeapons.can &&
            unlockedWeapons.orb &&
            unlockedWeapons.laser &&
            unlockedWeapons.missile &&
            unlockedWeapons.airstrike);
}

// 武器解锁中文名
const WEAPON_UNLOCK_NAMES = {
  can:       '罐头',
  orb:       '毛球',
  laser:     '激光',
  missile:   '追踪导弹',
  airstrike: '全屏轰炸'
};

// 主菜单动效状态
let menuTime = 0;
let menuEnterT = 0;
let menuTapCount = 0;      // 隐藏操作：连点计数
let menuTapLast = 0;       // 上次点击时间
let menuToast = { text: '', life: 0 };  // 隐藏操作反馈文字
function menuInit(){ menuTime = 0; menuEnterT = 0; menuToast.life = 0; menuTapCount = 0; }

// ================= 猫选择 =================
const CAT_OPTIONS = [
  { key: 'mimi', spriteKey: 'cat_mimi', defaultName: '米米' },
  { key: 'hart', spriteKey: 'cat_hart', defaultName: '哈特咩' }
];
const CAT_PREF_KEY = 'cat_battle_cat_pref_v1';
let catType = 'mimi';
let catNames = { mimi: '米米', hart: '哈特咩' };
let editingCatKey = null;
let nameInput = null;

// 猫选择界面按钮
const CATCHOOSE_START_BTN  = { x: W/2, y: 830, w: 400, h: 88 };
const CATCHOOSE_BACK_BTN   = { x: W/2, y: 940, w: 260, h: 64 };
// 两张猫卡片的矩形（用于点击检测）
const CAT_CARD_RECTS = [
  { x: 60,  y: 220, w: 280, h: 500, key: 'mimi' },
  { x: 380, y: 220, w: 280, h: 500, key: 'hart' }
];

function loadCatPref(){
  try{
    const raw = localStorage.getItem(CAT_PREF_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d.type === 'mimi' || d.type === 'hart') catType = d.type;
    if(d.names && typeof d.names === 'object'){
      if(typeof d.names.mimi === 'string' && d.names.mimi.trim()) catNames.mimi = d.names.mimi.slice(0, 12);
      if(typeof d.names.hart === 'string' && d.names.hart.trim()) catNames.hart = d.names.hart.slice(0, 12);
    }
  }catch(e){}
}
function saveCatPref(){
  try{
    localStorage.setItem(CAT_PREF_KEY, JSON.stringify({
      type: catType,
      names: catNames
    }));
  }catch(e){}
}

// 返回当前使用的猫精灵（带兜底）
function getCurrentCatSprite(){
  const opt = CAT_OPTIONS.find(o => o.key === catType) || CAT_OPTIONS[0];
  const s = SPRITES[opt.spriteKey];
  if(s && s.loaded && s.img) return s;
  return SPRITES.cat;   // 兜底
}
function getCurrentCatName(){
  return catNames[catType] || CAT_OPTIONS.find(o => o.key === catType).defaultName;
}

// 通用：在 (cx,cy) 绘制一张指定 key 的猫图
function drawCatSpriteAt(spriteKey, cx, cy, size){
  const s = SPRITES[spriteKey];
  if(s && s.loaded && s.img){
    ctx.drawImage(s.img, cx - size/2, cy - size/2, size, size);
    return;
  }
  if(SPRITES.cat.loaded && SPRITES.cat.img){
    ctx.drawImage(SPRITES.cat.img, cx - size/2, cy - size/2, size, size);
    return;
  }
  ctx.fillStyle = '#faf6ee';
  ctx.beginPath();
  ctx.arc(cx, cy, size/2 - 10, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#c85880';
  ctx.lineWidth = 4;
  ctx.stroke();
}

const LINES = {
  hurt:   ['喵呜——好痛！', 'sing精兵别咬我喵！', '嗷呜！再打我就咬死你！'],
  can:    ['接招！罐头炸弹！', '尝尝这个喵！', '开饭时间到！', '喵！快递来咯！'],
  laser:  ['你们才是真正的英雄~', '我想做什么就做什么！！！'],
  missile:['追踪导弹！发射！', '锁定目标！', '不陪我玩就炸飞你们！！', '点杀最高血量！', '看我炸扁你们！'],
  heal:   ['回血啦喵~', '呼——舒服多了', '血包真香！'],
  gold:   ['我miaolander来啦！！！', '激光充能！看我扫平一切！'],
  orb:    ['毛球起飞！', '毛球开启！', '看我的毛球！'],
  airstrike: ['空袭来了！', '炸弹雨来咯！', '天上掉罐头啦！', '快躲开喵！'],
  avatar: ['新头像好看吗喵？', '这个头像我喜欢！', '本喵上镜吗？'],
  double: ['双重强化！', '双份快乐喵！', '运气爆棚！'],
  goldswitch: ['金色激光！', '看我变身！', '金色模式启动！']
};

let zhVoice = null;
let speechWarmed = false;
function pickVoice(){
  try{
    if(!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    if(!vs || !vs.length) return;
    const zh = vs.filter(v => v.lang && v.lang.toLowerCase().indexOf('zh') === 0);
    zhVoice = zh.length
      ? (zh.find(v => /女|female|Ting|Xiao|Hui|Mei|Ya|Liang|Yan/i.test(v.name)) || zh[0])
      : null;
  }catch(e){}
}
if('speechSynthesis' in window){
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
// 语音占用时间戳：在这之前不接新语音，保证一句话说完
let voiceBusyUntil = 0;

function speak(text){
  return;   // 语音已禁用，只保留气泡文字
  try{
    if(!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate  = 1.05;
    u.pitch = 1.45;
    u.volume = 1.0;
    if(zhVoice) u.voice = zhVoice;
    // 估算时长：中文每字约 0.22 秒 + 起播开销 0.4 秒
    voiceBusyUntil = performance.now() + text.length * 220 + 400;
    speechSynthesis.speak(u);
  }catch(e){}
}

let bubble  = { text:'', life:0, maxLife:2.2 };
let voiceCd = 0;

function say(text, priority){
  const now = performance.now();
  // ★ 上一句还没说完 → 直接丢弃新语音（不打断）
  if(now < voiceBusyUntil) return;
  if(!priority && voiceCd > 0) return;
  bubble.text = text;
  bubble.life = 2.2; bubble.maxLife = 2.2;
  speak(text);
  voiceCd = priority ? 0.8 : 1.6;
}

// ================= 图片素材加载 =================
const CAT_DATA_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <ellipse cx="64" cy="118" rx="42" ry="7" fill="#000" opacity="0.35"/>
  <path d="M22 82 Q6 60 16 38" stroke="#1e1e22" stroke-width="10" fill="none" stroke-linecap="round"/>
  <ellipse cx="64" cy="78" rx="38" ry="34" fill="#faf6ee" stroke="#1e1e22" stroke-width="3"/>
  <ellipse cx="50" cy="72" rx="20" ry="26" fill="#1e1e22"/>
  <ellipse cx="46" cy="108" rx="10" ry="8" fill="#faf6ee" stroke="#1e1e22" stroke-width="2"/>
  <ellipse cx="82" cy="108" rx="10" ry="8" fill="#faf6ee" stroke="#1e1e22" stroke-width="2"/>
  <circle cx="64" cy="42" r="30" fill="#faf6ee" stroke="#1e1e22" stroke-width="3"/>
  <path d="M34 40 Q34 12 64 12 Q94 12 94 40 Q80 32 64 32 Q48 32 34 40 Z" fill="#1e1e22"/>
  <path d="M36 30 L34 4 L52 20 Z" fill="#1e1e22"/>
  <path d="M92 30 L94 4 L76 20 Z" fill="#1e1e22"/>
  <path d="M38 28 L37 10 L48 20 Z" fill="#ffb8c8"/>
  <path d="M90 28 L91 10 L80 20 Z" fill="#ffb8c8"/>
  <ellipse cx="54" cy="44" rx="5" ry="7" fill="#1a1610"/>
  <ellipse cx="74" cy="44" rx="5" ry="7" fill="#1a1610"/>
  <circle cx="55" cy="43" r="3" fill="#ffcc44"/>
  <circle cx="75" cy="43" r="3" fill="#ffcc44"/>
  <circle cx="55.5" cy="42.5" r="1" fill="#ffffff"/>
  <circle cx="75.5" cy="42.5" r="1" fill="#ffffff"/>
  <ellipse cx="46" cy="52" rx="5" ry="3" fill="#ff96aa" opacity="0.55"/>
  <ellipse cx="82" cy="52" rx="5" ry="3" fill="#ff96aa" opacity="0.55"/>
  <path d="M62 54 L66 54 L64 57 Z" fill="#ff8ca6"/>
</svg>
`);

const SPRITES = {
  cat:      { img: null, loaded: false },
  cat_mimi: { img: null, loaded: false },
  cat_hart: { img: null, loaded: false },
  catbro:   { img: null, loaded: false },
  catbro2:  { img: null, loaded: false },
  grass:    { img: null, loaded: false },
  // 屋顶 / 水泥地 / 夜晚草地效果一般，先注释保留
  // bg_roof:        { img: null, loaded: false },
  // bg_concrete:    { img: null, loaded: false },
  // bg_grass_night: { img: null, loaded: false },
  bg_beach:       { img: null, loaded: false }
};

// ===== 背景配置 =====
// 逻辑名 → SPRITES 里的 key
const BACKGROUND_KEYS = {
  grass:       'grass',
  roof:        'bg_roof',
  concrete:    'bg_concrete',
  grass_night: 'bg_grass_night',
  beach:       'bg_beach'
};

// 教学 6 关依次使用（想改哪关背景就改这里）
const STAGE_BACKGROUNDS = [
  'grass',  // 第 1 关
  'grass',  // 第 2 关
  'beach',  // 第 3 关
  'beach',  // 第 4 关
  'grass',  // 第 5 关
  'grass'   // 第 6 关
];

// 无尽模式每 5 波循环一次
const ENDLESS_BACKGROUNDS = ['grass', 'beach'];

// 当前背景逻辑名
let currentBgKey = 'grass';

// 切换背景
function setBackground(key){
  if(!BACKGROUND_KEYS[key]) key = 'grass';
  currentBgKey = key;
}
const ENEMY_SPRITE_KEYS = ['zombie','runner','brute','spitter','skeleton','armored','elite'];
for(const k of ENEMY_SPRITE_KEYS){
  SPRITES['enemy_' + k] = { img: null, loaded: false };
}

const CAT_LOCAL_PATH = 'images/cat.png';
const GRASS_LOCAL_PATH = 'images/grass.png';
let grassPattern = null;

// ================= 每种敌人图片的显示参数 =================
//
// scale ：图片显示大小，最终宽高 = 敌人半径 r × scale
// yOff  ：图片中心相对敌人中心的垂直偏移（负数向上）
//
// 比例参考：
//   玩家猫     ≈ 屏幕宽度的 1/9
//   小老鼠     ≈ 玩家的 0.55 倍
//   大老鼠     ≈ 玩家的 0.9 倍
//   骷髅/骑士  ≈ 玩家的 0.8 倍
//   恶魔精英   ≈ 玩家的 1.05 倍
//
const ENEMY_VISUAL = {
  zombie:   { scale: 10.2, yOff: -0.55 },  // 小老鼠
  runner:   { scale: 11.4, yOff: -0.55 },  // 小鼠
  brute:    { scale: 7.2,  yOff: -0.50 },  // 大老鼠
  spitter:  { scale: 10.2, yOff: -0.62 },  // 小恶魔
  skeleton: { scale: 10.8, yOff: -0.80 },  // 骷髅
  armored:  { scale: 10.2, yOff: -0.80 },  // 骑士
  elite:    { scale: 8.4,  yOff: -0.80 }   // 大恶魔
};

function loadImage(src, onDone){
  const img = new Image();
  img.onload = () => onDone(img, true);
  img.onerror = () => onDone(null, false);
  img.src = src;
}

function initSprites(){
  loadImage(CAT_LOCAL_PATH, (img, ok) => {
    if(ok){ SPRITES.cat.img = img; SPRITES.cat.loaded = true; }
    else {
      loadImage(CAT_DATA_URL, (svgImg) => {
        if(svgImg){ SPRITES.cat.img = svgImg; SPRITES.cat.loaded = true; }
      });
    }
  });

  // 两只可选猫
  loadImage('images/cat_mimi.png', (img, ok) => {
    if(ok){ SPRITES.cat_mimi.img = img; SPRITES.cat_mimi.loaded = true; }
  });
  loadImage('images/cat_hart.png', (img, ok) => {
    if(ok){ SPRITES.cat_hart.img = img; SPRITES.cat_hart.loaded = true; }
  });
  loadImage('images/catbro.png', (img, ok) => {
    if(ok){ SPRITES.catbro.img = img; SPRITES.catbro.loaded = true; }
  });
  loadImage('images/catbro2.png', (img, ok) => {
    if(ok){ SPRITES.catbro2.img = img; SPRITES.catbro2.loaded = true; }
  });

  loadImage(GRASS_LOCAL_PATH, (img, ok) => {
    if(ok){
      SPRITES.grass.img = img;
      SPRITES.grass.loaded = true;
      grassPattern = ctx.createPattern(img, 'repeat');
    }
  });
  
  // ===== 沙滩背景（屋顶 / 水泥地 / 夜晚草地暂不使用）=====
  loadImage('images/bg_beach.png', (img, ok) => {
    if(ok){ SPRITES.bg_beach.img = img; SPRITES.bg_beach.loaded = true; }
  });

  // loadImage('images/bg_roof.png', (img, ok) => {
  //   if(ok){ SPRITES.bg_roof.img = img; SPRITES.bg_roof.loaded = true; }
  // });
  // loadImage('images/bg_concrete.png', (img, ok) => {
  //   if(ok){ SPRITES.bg_concrete.img = img; SPRITES.bg_concrete.loaded = true; }
  // });
  // loadImage('images/bg_grass_night.png', (img, ok) => {
  //   if(ok){ SPRITES.bg_grass_night.img = img; SPRITES.bg_grass_night.loaded = true; }
  // });

  for(const k of ENEMY_SPRITE_KEYS){
    loadImage('images/enemy_' + k + '.png', (img, ok) => {
      if(ok){
        SPRITES['enemy_' + k].img = img;
        SPRITES['enemy_' + k].loaded = true;
      }
    });
  }
}
initSprites();
UI.loadAll();   // ★ 新加这一行

// ================= 音频 =================
let actx = null;
let masterGain = null;
let analyser = null;
let audioLevel = 0;
let audioDebugPanel = false;

function audioInit(){
  try{
    if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === 'suspended') actx.resume();

    // 建立主输出链：所有音源 → masterGain → analyser → destination
    if(!masterGain && actx){
      masterGain = actx.createGain();
      masterGain.gain.value = 1.0;
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      masterGain.connect(analyser);
      analyser.connect(actx.destination);
    }

    // ★ 关键：在用户手势里播一个静音 buffer，强制解锁音频
    // iOS Safari / 部分安卓浏览器只认这个动作
    if(masterGain){
      try{
        const buf = actx.createBuffer(1, 1, 22050);
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(masterGain);
        if(src.start) src.start(0);
        else if(src.noteOn) src.noteOn(0);
      }catch(e){}
    }

    // 附加：再播一个几乎无声的瞬间音（双保险）
    if(actx.state === 'running' && masterGain){
      const o = actx.createOscillator();
      const g = actx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(masterGain);
      o.start();
      o.stop(actx.currentTime + 0.01);
    }

    // 音频解锁 + 尝试同步 BGM
    if(actx.state === 'suspended'){
      actx.resume().catch(() => {});
    }
    try{ syncBGM(); }catch(e){}
  }catch(e){}

  try{
    if('speechSynthesis' in window && !speechWarmed){
      speechWarmed = true;
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0; speechSynthesis.speak(u);
    }
  }catch(e){}
}

function sfx(kind){
  if(!actx || !masterGain) return;
  try{
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(masterGain);
    if(kind === 'shoot'){
      o.type='square'; o.frequency.setValueAtTime(560,t);
      o.frequency.exponentialRampToValueAtTime(190,t+0.06);
      g.gain.setValueAtTime(0.018,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
      o.start(t); o.stop(t+0.08);
    } else if(kind === 'hit'){
      o.type='triangle'; o.frequency.setValueAtTime(330,t);
      o.frequency.exponentialRampToValueAtTime(95,t+0.06);
      g.gain.setValueAtTime(0.018,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
      o.start(t); o.stop(t+0.08);
    } else if(kind === 'boom'){
      o.type='sawtooth'; o.frequency.setValueAtTime(160,t);
      o.frequency.exponentialRampToValueAtTime(36,t+0.36);
      g.gain.setValueAtTime(0.12,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
      o.start(t); o.stop(t+0.45);
    } else if(kind === 'laser'){
      o.type='sawtooth'; o.frequency.setValueAtTime(1400,t);
      o.frequency.exponentialRampToValueAtTime(280,t+0.3);
      g.gain.setValueAtTime(0.07,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
      o.start(t); o.stop(t+0.36);
    } else if(kind === 'missile'){
      o.type='sawtooth'; o.frequency.setValueAtTime(280,t);
      o.frequency.exponentialRampToValueAtTime(900,t+0.18);
      o.frequency.exponentialRampToValueAtTime(300,t+0.3);
      g.gain.setValueAtTime(0.05,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
      o.start(t); o.stop(t+0.34);
    } else if(kind === 'hurt'){
      o.type='sawtooth'; o.frequency.setValueAtTime(230,t);
      o.frequency.exponentialRampToValueAtTime(52,t+0.2);
      g.gain.setValueAtTime(0.055,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
      o.start(t); o.stop(t+0.24);
    } else if(kind === 'buff'){
      o.type='sine'; o.frequency.setValueAtTime(500,t);
      o.frequency.setValueAtTime(750,t+0.09);
      o.frequency.setValueAtTime(1100,t+0.18);
      g.gain.setValueAtTime(0.055,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
      o.start(t); o.stop(t+0.34);
    } else if(kind === 'pickup'){
      o.type='sine'; o.frequency.setValueAtTime(700,t);
      o.frequency.exponentialRampToValueAtTime(1500,t+0.14);
      g.gain.setValueAtTime(0.055,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
      o.start(t); o.stop(t+0.2);
    } else if(kind === 'orb'){
      o.type='triangle'; o.frequency.setValueAtTime(880,t);
      o.frequency.exponentialRampToValueAtTime(1320,t+0.1);
      g.gain.setValueAtTime(0.04,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
      o.start(t); o.stop(t+0.16);
    }
  }catch(e){}
}

// 根据当前 state 同步 BGM（启动/停止），不看 actx.state
// 内部定时器自己会检查 running 状态，resume 完成后会自动出声
function syncBGM(){
  if(!actx) return;
  const isMenuLike =
    state === 'boot' || state === 'menu' || state === 'catselect' ||
    state === 'help' || (state === 'leaderboard' && lbFrom === 'menu');
  const isGameLike =
    state === 'playing' || state === 'paused' ||
    state === 'confirm' || state === 'buff' || state === 'victory' ||
    state === 'catbro';

  if(isMenuLike){
    if(!menuBgm.intervalId) startMenuBGM();
    if(bgm.intervalId) stopBGM();
  } else if(isGameLike){
    if(!bgm.intervalId) startBGM();
    if(menuBgm.intervalId) stopMenuBGM();
  } else {
    if(bgm.intervalId) stopBGM();
    if(menuBgm.intervalId) stopMenuBGM();
  }
}

// ================= 伤害统计 & 排行榜 =================
const LB_KEY = 'cat_battle_leaderboard_v1';
const WEAPON_NAMES = {
  bullet:    { name: '猫粮',    color: '#ffe080' },
  orb:       { name: '毛球',    color: '#ffb0d0' },
  can:       { name: '罐头',    color: '#ff9f6b' },
  airstrike: { name: '空袭',    color: '#ff6b4a' },
  laser:     { name: '激光',    color: '#88eeff' },
  laserGold: { name: '金色激光', color: '#ffd24a' },
  missile:   { name: '导弹',    color: '#ff8a3c' }
};

function loadLeaderboard(){
  try{
    const raw = localStorage.getItem(LB_KEY);
    if(raw) leaderboard = JSON.parse(raw) || [];
  }catch(e){ leaderboard = []; }
}

function saveLeaderboard(){
  try{ localStorage.setItem(LB_KEY, JSON.stringify(leaderboard)); }catch(e){}
}

function recordRun(){
  if(!player || wave <= 0) return;
  let totalDmg = 0;
  for(const k in runDamageStats) totalDmg += runDamageStats[k];
  if(totalDmg <= 0) return;
  let buffCount = 0;
  for(const k in player.buffLevels) buffCount += player.buffLevels[k];
  const weapons = Object.keys(runDamageStats)
    .filter(k => runDamageStats[k] > 0)
    .sort((a, b) => runDamageStats[b] - runDamageStats[a])
    .slice(0, 6);
  leaderboard.push({
    wave: wave,
    damage: Math.round(totalDmg),
    buffs: buffCount,
    weapons: weapons,
    buffLevels: Object.assign({}, player.buffLevels),
    damageStats: Object.assign({}, runDamageStats),
    date: Date.now()
  });
  leaderboard.sort((a, b) => b.wave - a.wave || b.damage - a.damage);
  leaderboard = leaderboard.slice(0, 10);
  saveLeaderboard();
}

function drawDamageStats(x, y, compact){
  // 计算总伤害
  let total = 0;
  for(const k in runDamageStats) total += runDamageStats[k];

  const tSize  = compact ? 17 : 26;
  const sSize  = compact ? 12 : 16;
  const nSize  = compact ? 13 : 19;
  const dSize  = compact ? 12 : 17;
  const fSize  = compact ? 13 : 19;
  const rowH   = compact ? 26 : 40;
  const barW   = compact ? 260 : 380;
  const barH   = compact ? 8  : 13;
  const nameW  = compact ? 64 : 100;

  ctx.textAlign = 'center';
  ctx.font = 'bold ' + tSize + 'px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#8ef0a8';
  ctx.fillText('本局累计伤害', x, y);

  ctx.font = sSize + 'px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(160,200,180,0.75)';
  ctx.fillText(
    '（从第 1 波累计到当前，共 ' + Math.max(1, wave) + ' 波）',
    x, y + (compact ? 18 : 24)
  );

  const entries = Object.keys(runDamageStats)
    .filter(k => runDamageStats[k] > 0)
    .sort((a, b) => runDamageStats[b] - runDamageStats[a]);

  if(entries.length === 0){
    ctx.font = (compact ? 14 : 17) + 'px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#8fa79a';
    ctx.fillText('暂无伤害记录', x, y + (compact ? 48 : 60));
    return y + (compact ? 68 : 90);
  }

  if(total <= 0) total = 1;

  // 动态计算右侧数字区域宽度（避免伤害上万后溢出）
  ctx.font = 'bold ' + dSize + 'px "Microsoft YaHei",sans-serif';
  let maxNumW = 0;
  for(const k of entries){
    const txt = Math.round(runDamageStats[k]) + ' (100%)';
    const tw = ctx.measureText(txt).width;
    if(tw > maxNumW) maxNumW = tw;
  }
  // 合计行的宽度也要算
  const totalTxt = Math.round(total).toString();
  const totalW = ctx.measureText(totalTxt).width;
  if(totalW > maxNumW) maxNumW = totalW;
  const numW = maxNumW + 10;

  const barX = x - barW / 2;
  let cy = y + (compact ? 46 : 60);

  for(const k of entries){
    const w = WEAPON_NAMES[k] || { name: k, color: '#ffffff' };
    const dmg = runDamageStats[k];
    const ratio = dmg / total;
    const pct = Math.round(ratio * 100);

    // 武器名
    ctx.textAlign = 'left';
    ctx.font = 'bold ' + nSize + 'px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = w.color;
    ctx.fillText(w.name, barX, cy + barH - 1);

    // 进度条底板
    const trackX = barX + nameW;
    const trackW = barW - nameW - numW;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(trackX - 2, cy - 2, trackW + 4, barH + 4);
    ctx.fillStyle = 'rgba(60,80,70,0.7)';
    ctx.fillRect(trackX, cy, trackW, barH);

    // 进度条填充
    const fillW = Math.max(3, trackW * ratio);
    ctx.fillStyle = w.color;
    ctx.fillRect(trackX, cy, fillW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(trackX, cy, fillW, compact ? 2 : 3);

    // 数字 + 百分比
    ctx.textAlign = 'right';
    ctx.font = 'bold ' + dSize + 'px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#dfe9e3';
    ctx.fillText(Math.round(dmg) + ' (' + pct + '%)', barX + barW, cy + barH - 1);

    cy += rowH;
  }

  // 合计
  ctx.textAlign = 'left';
  ctx.font = 'bold ' + fSize + 'px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#8fa79a';
  ctx.fillText('合计', barX, cy + barH - 1);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8ef0a8';
  ctx.fillText(Math.round(total).toString(), barX + barW, cy + barH - 1);

  return cy + rowH;
}

function drawLeaderboardScreen(){
  if(lbFrom === 'menu'){
    drawAppBackground();
  } else {
    drawAppOverlay(0.88);
  }

  drawAppTitle('历史排行榜', W/2, 110, 42);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('前 10 次最佳战绩', W/2, 142);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('前 10 次最佳战绩', W/2, 142);

  lbTagRects = [];

  if(leaderboard.length === 0){
    ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeText('暂无记录，快去战斗吧！', W/2, H/2);
    ctx.fillStyle = '#7a5040';
    ctx.fillText('暂无记录，快去战斗吧！', W/2, H/2);
  } else {
    const cardX = 24;
    const cardW = W - 48;
    const cardH = 92;
    const gap = 5;
    let cy = 176;

    for(let i = 0; i < leaderboard.length; i++){
      const e = leaderboard[i];
      const x = cardX;
      const y = cy;

      rr(x, y, cardW, cardH, 16);
      const grd = ctx.createLinearGradient(x, y, x, y + cardH);
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      grd.addColorStop(1, 'rgba(255, 235, 245, 0.96)');
      ctx.fillStyle = grd;
      ctx.fill();

      const rankColors = ['#ffb84a', '#c0c0c0', '#d09060'];
      const rankColor = rankColors[i] || '#ffb8d0';
      ctx.fillStyle = rankColor;
      ctx.fillRect(x, y, 6, cardH);

      ctx.strokeStyle = i < 3 ? rankColor : 'rgba(255, 160, 200, 0.5)';
      ctx.lineWidth = i < 3 ? 2.5 : 1.8;
      rr(x, y, cardW, cardH, 16);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 28px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = rankColor;
      ctx.fillText('#' + (i + 1), x + 22, y + 42);

      ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#d878a0';
      ctx.fillText('第 ' + e.wave + ' 波', x + 96, y + 34);

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#7a90b8';
      ctx.fillText('强化 ' + e.buffs, x + cardW - 18, y + 30);
      ctx.textAlign = 'left';

      ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#d87820';
      ctx.fillText('伤害 ' + e.damage, x + 96, y + 58);

      if(e.weapons && e.weapons.length > 0){
        let tagX = x + 96;
        const tagY = y + 74;
        for(const wid of e.weapons){
          const w = WEAPON_NAMES[wid];
          if(!w) continue;
          ctx.font = 'bold 11px "Microsoft YaHei",sans-serif';
          const tw = ctx.measureText(w.name).width + 12;
          if(tagX + tw > x + cardW - 14) break;
          rr(tagX, tagY - 9, tw, 16, 5);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = w.color;
          ctx.textAlign = 'center';
          ctx.fillText(w.name, tagX + tw/2, tagY + 3);
          ctx.textAlign = 'left';


          tagX += tw + 4;
        }
      }

      // 整张卡片作为点击热区
      lbTagRects.push({ x, y, w: cardW, h: cardH, entryIndex: i });

      cy += cardH + gap;
    }
  }

  drawAppButton(LB_CLOSE_BTN, '关 闭', '#ff8fb0', '#c84870', { fontSize: 24 });

  if(lbBuffPopup >= 0){
    drawLbBuffPopup();
  }
}

function drawLbBuffPopup(){
  const entry = leaderboard[lbBuffPopup];
  if(!entry){ lbBuffPopup = -1; return; }

  // 遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, W, H);

  const buffLevels = entry.buffLevels || {};
  const buffIds = Object.keys(buffLevels).filter(k => buffLevels[k] > 0);

  // 伤害分析数据
  const stats = entry.damageStats || {};
  const statEntries = Object.keys(stats)
    .filter(k => stats[k] > 0)
    .sort((a, b) => stats[b] - stats[a]);
  let statTotal = 0;
  for(const k of statEntries) statTotal += stats[k];
  if(statTotal <= 0) statTotal = 1;

  const panelW = W - 60;
  const cols = 2;
  const buffRows = Math.max(1, Math.ceil(buffIds.length / cols));
  const buffRowH = 54;
  const headerH = 118;
  const sectionGap = 18;
  const dmgTitleH = 42;
  const dmgRowH = 42;
  const dmgRows = Math.max(1, statEntries.length);
  const footerH = 90;

  const panelH = headerH
    + buffRows * buffRowH
    + sectionGap + dmgTitleH + dmgRows * dmgRowH
    + footerH;

  const panelX = (W - panelW) / 2;
  const panelY = Math.max(18, (H - panelH) / 2);

  // 面板底
  rr(panelX, panelY, panelW, panelH, 16);
  const grd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  grd.addColorStop(0, 'rgba(255, 250, 246, 0.98)');
  grd.addColorStop(1, 'rgba(255, 230, 240, 0.98)');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = '#ff8fb0';
  ctx.lineWidth = 3;
  rr(panelX, panelY, panelW, panelH, 16);
  ctx.stroke();

  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c84870';
  ctx.font = 'bold 26px "Microsoft YaHei",sans-serif';
  ctx.fillText('第 ' + entry.wave + ' 波 · 本局详情', W/2, panelY + 44);

  ctx.font = '15px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(200, 100, 130, 0.85)';
  ctx.fillText(
    '共 ' + buffIds.length + ' 种强化 · 总伤害 ' + Math.round(statTotal),
    W/2, panelY + 72
  );

  // 分隔线
  ctx.strokeStyle = 'rgba(255, 160, 200, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + 20, panelY + 94);
  ctx.lineTo(panelX + panelW - 20, panelY + 94);
  ctx.stroke();

  // ===== 强化列表 =====
  let cursorY = panelY + headerH;

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#c84870';
  ctx.fillText('强化选择', panelX + 22, cursorY - 8);

  if(buffIds.length === 0){
    ctx.font = '15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#a88090';
    ctx.fillText('暂无强化记录', panelX + 22, cursorY + 24);
  } else {
    const colW = (panelW - 40) / cols;
    for(let i = 0; i < buffIds.length; i++){
      const id = buffIds[i];
      const def = BUFFS.find(b => b.id === id);
      if(!def) continue;
      const lv = buffLevels[id];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = panelX + 20 + col * colW;
      const cy = cursorY + row * buffRowH;

      drawBuffIcon(def.id, cx + 20, cy + buffRowH / 2 - 6, 28, def.color);

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = def.color;
      ctx.fillText(def.name, cx + 42, cy + 18);

      ctx.font = '12px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(120, 90, 100, 0.8)';
      ctx.fillText('Lv.' + lv, cx + 42, cy + 36);
    }
  }

  cursorY += buffRows * buffRowH + sectionGap;

  // 分隔线
  ctx.strokeStyle = 'rgba(255, 160, 200, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + 20, cursorY - sectionGap / 2);
  ctx.lineTo(panelX + panelW - 20, cursorY - sectionGap / 2);
  ctx.stroke();

  // ===== 伤害分析 =====
  ctx.textAlign = 'left';
  ctx.font = 'bold 17px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#c84870';
  ctx.fillText('伤害分析', panelX + 22, cursorY + 16);

  cursorY += dmgTitleH - 4;

  if(statEntries.length === 0){
    ctx.font = '15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#a88090';
    ctx.fillText('暂无伤害数据', panelX + 22, cursorY + 22);
  } else {
    const nameW = 78;
    const numW = 128;
    const barX = panelX + 22 + nameW;
    const barMaxW = panelW - 22 - nameW - numW - 24;
    const numRightX = panelX + panelW - 22;
    const barH = 14;

    for(let i = 0; i < statEntries.length; i++){
      const k = statEntries[i];
      const w = WEAPON_NAMES[k] || { name: k, color: '#888888' };
      const dmg = stats[k];
      const ratio = dmg / statTotal;
      const pct = Math.round(ratio * 100);
      const cy = cursorY + i * dmgRowH;

      // 武器名
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = w.color;
      ctx.fillText(w.name, panelX + 22, cy + 24);

      // 进度条
      const barY = cy + 14;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(barX, barY, barMaxW, barH);
      const fillW = Math.max(3, barMaxW * ratio);
      ctx.fillStyle = w.color;
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(barX, barY, fillW, 3);

      // 数字 (百分比)
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#6a4a50';
      ctx.fillText(Math.round(dmg) + ' (' + pct + '%)', numRightX, cy + 24);
    }
  }

  // ===== 关闭按钮 =====
  const btnW = 200, btnH = 54;
  const btnX = W / 2 - btnW / 2;
  const btnY = panelY + panelH - footerH + 22;
  rr(btnX, btnY, btnW, btnH, 26);
  const btnGrd = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  btnGrd.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  btnGrd.addColorStop(1, 'rgba(255, 230, 240, 0.98)');
  ctx.fillStyle = btnGrd;
  ctx.fill();
  ctx.strokeStyle = '#ff8fb0';
  ctx.lineWidth = 3;
  rr(btnX, btnY, btnW, btnH, 26);
  ctx.stroke();
  ctx.fillStyle = '#c84870';
  ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('关 闭', W / 2, btnY + 35);

  lbPopupCloseRect = { x: btnX, y: btnY, w: btnW, h: btnH };
}
// ================= 存档系统 =================
const SAVE_KEY = 'cat_battle_save_v2';
const TUTORIAL_DONE_KEY = 'cat_battle_tutorial_done_v1';

function hasDoneTutorial(){
  try{ return localStorage.getItem(TUTORIAL_DONE_KEY) === '1'; }
  catch(e){ return false; }
}
function markTutorialDone(){
  try{ localStorage.setItem(TUTORIAL_DONE_KEY, '1'); }catch(e){}
}

function saveProgress(){
  if(!player) return;
  try{
    const data = {
      wave: wave,
      score: score,
      hp: player.hp,
      maxHp: player.maxHp,
      energy: player.energy,
      buffLevels: player.buffLevels,
      canStock: player.canStock,
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){}
}

function loadProgress(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}

function clearProgress(){
  try{
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('cat_battle_save_v1');   // 顺手清掉旧版本存档
  }catch(e){}
}
// ================= 背景音乐 =================
let bgm = { intervalId: null, step: 0 };

function playNoteAt(t, freq, dur, vol, type){
  try{
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }catch(e){}
}

function playKickAt(t){
  try{
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.18);
  }catch(e){}
}

function playHatAt(t){
  try{
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(7000, t);
    g.gain.setValueAtTime(0.013, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.05);
  }catch(e){}
}

function bgmTick(){
  if(!actx) return;
  if(actx.state === 'suspended'){
    actx.resume().catch(() => {});
    return;
  }
  if(actx.state !== 'running') return;
  const t = actx.currentTime;
  const s = bgm.step % 16;

  // 底鼓 & 军鼓
  if(s % 4 === 0) playKickAt(t);
  if(s % 4 === 2) playHatAt(t);

  // 低音线（紧张反复）
  const bassSeq = [82.41, 82.41, 110.00, 82.41, 98.00, 82.41, 110.00, 123.47];
  if(s % 2 === 0){
    const bn = bassSeq[Math.floor(s / 2) % bassSeq.length];
    playNoteAt(t, bn, 0.18, 0.045, 'triangle');
  }

  // 高音琶音（快节奏紧张感）
  const arpSeq = [329.63, 392.00, 493.88, 587.33, 659.25, 587.33, 493.88, 392.00];
  const an = arpSeq[s % arpSeq.length];
  playNoteAt(t, an, 0.09, 0.015, 'square');

  bgm.step++;
}

function startBGM(){
  if(!actx) return;
  if(bgm.intervalId) return;
  bgm.step = 0;
  bgm.intervalId = setInterval(bgmTick, 200);   // 约 150 BPM
}

function stopBGM(){
  if(bgm.intervalId){
    clearInterval(bgm.intervalId);
    bgm.intervalId = null;
  }
}
// ================= 主菜单 BGM（温馨八音盒） =================
let menuBgm = { intervalId: null, step: 0 };

function menuBgmTick(){
  if(!actx) return;
  if(actx.state === 'suspended'){
    actx.resume().catch(() => {});
    return;
  }
  if(actx.state !== 'running') return;
  const t = actx.currentTime;
  const s = menuBgm.step % 16;

  // 主旋律：C 大调五声音阶，八音盒感
  const melody = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 783.99, 880.00, 783.99,
    698.46, 587.33, 523.25, 587.33,
    659.25, 523.25, 587.33, 493.88
  ];

  // 主音（sine，柔和）
  playNoteAt(t, melody[s], 0.75, 0.055, 'sine');
  // 高八度泛音（更弱，增加晶莹感）
  playNoteAt(t, melody[s] * 2, 0.5, 0.014, 'sine');

  // 低音垫（每 4 步一个）
  if(s % 4 === 0){
    const bass = [130.81, 130.81, 174.61, 196.00];
    playNoteAt(t, bass[Math.floor(s / 4)], 1.2, 0.045, 'triangle');
  }

  // 风铃点缀（每 8 步一次）
  if(s % 8 === 4){
    playNoteAt(t, melody[s] * 4, 0.9, 0.008, 'sine');
  }

  menuBgm.step++;
}

function startMenuBGM(){
  if(!actx) return;
  if(menuBgm.intervalId) return;
  menuBgm.step = 0;
  menuBgm.intervalId = setInterval(menuBgmTick, 380);   // 一个循环约 6 秒
}

function stopMenuBGM(){
  if(menuBgm.intervalId){
    clearInterval(menuBgm.intervalId);
    menuBgm.intervalId = null;
  }
}
// ================= 键盘 =================
const keys = {};
function setKey(e, down){
  if(e.key)  keys[e.key.toLowerCase()] = down;
  if(e.code) keys[e.code.toLowerCase()] = down;
}
window.addEventListener('keydown', e => {
  setKey(e, true);
  audioInit();
  const k = (e.key || '').toLowerCase();
  if(k === ' '){ e.preventDefault(); if(state === 'playing' && unlockedWeapons.missile) fireMissile(); }
  if(k === 'e'){ e.preventDefault(); if(state === 'playing' && unlockedWeapons.laser) fireLaser(); }
  if(k === 'r' && state === 'dead') reset();
  if(k === 'f2' || k === '`'){
    e.preventDefault();
    audioDebugPanel = !audioDebugPanel;
    return;
  }
  if(k === 'p' || k === 'escape'){
    if(state === 'playing') state = 'paused';
    else if(state === 'paused'){ state = 'playing'; last = performance.now(); }
  }
}, { passive:false });
window.addEventListener('keyup', e => setKey(e, false));
document.addEventListener('keydown', e => setKey(e, true), { passive:true });
document.addEventListener('keyup', e => setKey(e, false), { passive:true });
function isDown(...names){ for(const n of names) if(keys[n]) return true; return false; }

// ================= 头像上传 =================
let avatarInput = null;
let globalAvatarImg = null;
function initAvatarInput(){
  avatarInput = document.createElement('input');
  avatarInput.type = 'file';
  avatarInput.accept = 'image/*';
  // 移动端兼容：不用 display:none，改为移出屏幕的透明元素
  avatarInput.style.position = 'fixed';
  avatarInput.style.left = '-9999px';
  avatarInput.style.top = '0';
  avatarInput.style.width = '1px';
  avatarInput.style.height = '1px';
  avatarInput.style.opacity = '0';
  avatarInput.style.pointerEvents = 'none';
  document.body.appendChild(avatarInput);
  avatarInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        globalAvatarImg = img;
        if(player) player.avatarImg = img;
        say(randLine(LINES.avatar), true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
    avatarInput.value = '';
  });
}
initAvatarInput();
// ================= 猫名字输入框 =================
function initNameInput(){
  nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 12;
  nameInput.autocomplete = 'off';
  nameInput.style.cssText = [
    'position:fixed',
    'display:none',
    'z-index:9999',
    'padding:8px 14px',
    'font-size:22px',
    'font-family:"Microsoft YaHei",sans-serif',
    'border:2.5px solid #ffb8d0',
    'border-radius:12px',
    'outline:none',
    'text-align:center',
    'background:#ffffff',
    'color:#c84870',
    'box-shadow:0 4px 16px rgba(255,150,190,0.35)',
    'transform:translateY(-50%)'
  ].join(';');
  document.body.appendChild(nameInput);

  nameInput.addEventListener('blur', commitNameInput);
  nameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); commitNameInput(); }
    if(e.key === 'Escape'){ e.preventDefault(); cancelNameInput(); }
  });
}
function startEditCatName(key){
  if(!nameInput) return;
  editingCatKey = key;
  nameInput.value = catNames[key] || '';

  const vw = Math.min(320, window.innerWidth * 0.7);
  const vh = 46;
  nameInput.style.display = 'block';
  nameInput.style.left = (window.innerWidth / 2 - vw / 2) + 'px';
  nameInput.style.top = (window.innerHeight / 2) + 'px';
  nameInput.style.width = vw + 'px';
  nameInput.style.height = vh + 'px';

  setTimeout(() => {
    try{ nameInput.focus(); nameInput.select(); }catch(e){}
  }, 30);
}
function commitNameInput(){
  if(!editingCatKey){ return; }
  const v = (nameInput.value || '').trim().slice(0, 12);
  if(v) catNames[editingCatKey] = v;
  nameInput.style.display = 'none';
  editingCatKey = null;
  saveCatPref();
}
function cancelNameInput(){
  if(nameInput) nameInput.style.display = 'none';
  editingCatKey = null;
}
initNameInput();

// ================= 指针 =================
const JOY_R = 74;
const moveJoy = { id:-1, bx:MOVE_BASE.x, by:MOVE_BASE.y, dx:0, dy:0, active:false };
let deadDelay = 0;

function toCanvasXY(cx, cy){
  const r = cv.getBoundingClientRect();
  if(r.width <= 0 || r.height <= 0) return { x:cx, y:cy };
  return { x:(cx-r.left)*(W/r.width), y:(cy-r.top)*(H/r.height) };
}
function updateJoy(j, p){
  let dx = p.x - j.bx, dy = p.y - j.by;
  const d = Math.hypot(dx, dy);
  if(d > JOY_R){
    j.bx = p.x - dx/d*JOY_R;
    j.by = p.y - dy/d*JOY_R;
    j.bx = clamp(j.bx, JOY_R, W - JOY_R);
    j.by = clamp(j.by, JOY_R, H - JOY_R);
    dx = p.x - j.bx; dy = p.y - j.by;
  }
  j.dx = dx / JOY_R;
  j.dy = dy / JOY_R;
  const m = Math.hypot(j.dx, j.dy);
  if(m > 1){ j.dx /= m; j.dy /= m; }
}
function resetJoy(j, base){
  j.id = -1; j.active = false; j.dx = 0; j.dy = 0;
  j.bx = base.x; j.by = base.y;
}

function onPointerDown(e){
  if(e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  e.preventDefault();
  audioInit();
  if(actx && actx.state === 'suspended'){
    actx.resume().catch(() => {});
  }
  cv.focus();

  const p = toCanvasXY(e.clientX, e.clientY);
  const isMouse = e.pointerType === 'mouse';

  // ============ 首屏启动页 ============
  if(state === 'boot'){
    state = 'menu';
    menuInit();
    return;
  }

  // ============ 教程界面 ============
  if(state === 'tutorial'){
    tutorialStep++;

    if(tutorialStep >= tutorialQueue.length){
      // 教程结束 → 根据 tutorialOnFinish 决定后续动作
      const action = tutorialOnFinish;
      tutorialStep = 0;
      tutorialQueue = [];
      tutorialOnFinish = null;

      if(action === 'start-game'){
        // 新手教程结束：开始第 1 关第 1 波
        state = 'playing';
        wave = 1;
        waveInStage = 1;
        startWave(wave);
        last = performance.now();
      } else if(action === 'return-help'){
        // 从玩法说明进来的教程：回到列表
        state = 'help';
        last = performance.now();
      } else {
        // 技能解锁教程结束
        // ★ 教学关最后一波：选完强化卡，看完技能教程后，才进过关弹窗
        if(pendingStageClearAfterBuff && stageClearInfo){
          pendingStageClearAfterBuff = false;
          state = 'stageclear';
          last = performance.now();
          return;
        }
        // 普通情况：回到战斗
        state = 'playing';
        waveBreakTimer = 1.5;
        last = performance.now();
      }
    } else {
      last = performance.now();
    }
    return;
  }

  // ============ 关卡过关弹窗 ============
  if(state === 'stageclear'){
    const info = stageClearInfo;
    if(!info){
      state = 'playing';
      stageClearInfo = null;
      return;
    }

    // 解锁不再在这里做（改成关卡内 buff 卡解锁）

    // 重置本关击杀计数
    stageKillCount = 0;

    if(info.isLastStage){
      markTutorialDone();
      currentStage = 0;
      waveInStage = 0;
      setBackground(ENDLESS_BACKGROUNDS[0]);   // ★ 先切背景
      banner = { text: '教学完成！进入无尽模式', life: 2.5 };
      waveBreakTimer = 2.5;
      stageClearInfo = null;

      tutorialQueue = END_TUTORIAL_STEPS.slice();
      tutorialStep = 0;
      tutorialOnFinish = 'continue-wave';
      state = 'tutorial';
      last = performance.now();
      return;
    }

    // 进入下一关
    currentStage++;
    waveInStage = 0;
    setBackground(STAGE_BACKGROUNDS[currentStage - 1] || 'grass');  // ★ 先切背景
    banner = { text: '第 ' + currentStage + ' 关  ·  第 1 / ' + STAGE_WAVES + ' 波', life: 2.0 };
    waveBreakTimer = 2.0;
    stageClearInfo = null;
    state = 'playing';
    last = performance.now();
    return;
  }

  // 点击任意位置先关闭已有 tips；若点到左侧技能图标本身，则不关闭
  if(skillTip.type){
    const TMP_CX = 46;
    const TMP_HIT = 28 + 16;
    const hitCan = Math.hypot(p.x - TMP_CX, p.y - H * 0.50) < TMP_HIT;
    const hitAir = player && player.airstrikeLevel > 0 &&
                   Math.hypot(p.x - TMP_CX, p.y - H * 0.50 - 104) < TMP_HIT;
    if(!hitCan && !hitAir){
      skillTip = { type: null, fade: 0 };
    }
  }
  // ============ 主菜单 ============
  if(state === 'menu'){
    // ★ 隐藏：右上角 80×80 连点 3 次，重置教学完成标记
    if(p.x > W - 80 && p.y < 80){
      const nowT = performance.now();
      if(nowT - menuTapLast < 1500){
        menuTapCount++;
      } else {
        menuTapCount = 1;
      }
      menuTapLast = nowT;
      if(menuTapCount >= 3){
        menuTapCount = 0;
        try{ localStorage.removeItem(TUTORIAL_DONE_KEY); }catch(e){}
        menuToast = { text: '教学进度已重置，点击开始将重新走教学', life: 3.0 };
        return;
      }
      return;
    }

    const sb = MENU_START_BTN;
    if(p.x >= sb.x - sb.w/2 && p.x <= sb.x + sb.w/2 &&
       p.y >= sb.y - sb.h/2 && p.y <= sb.y + sb.h/2){
      state = 'catselect';
      menuInit();
      return;
    }
    const mbl = MENU_LB_BTN;
    if(p.x >= mbl.x - mbl.w/2 && p.x <= mbl.x + mbl.w/2 &&
       p.y >= mbl.y - mbl.h/2 && p.y <= mbl.y + mbl.h/2){
      lbFrom = 'menu';
      state = 'leaderboard';
      lbBuffPopup = -1;
      lbPopupCloseRect = null;
      return;
    }
    const hb = MENU_HELP_BTN;
    if(p.x >= hb.x - hb.w/2 && p.x <= hb.x + hb.w/2 &&
       p.y >= hb.y - hb.h/2 && p.y <= hb.y + hb.h/2){
      helpFrom = 'menu';
      state = 'help';
      return;
    }
    return;
  }

  // ============ 选猫界面 ============
  if(state === 'catselect'){
    // 正在编辑名字：先提交
    if(editingCatKey){
      commitNameInput();
      return;
    }

    // 点击猫卡片：选中 + 点名字区域进入改名
    for(const card of CAT_CARD_RECTS){
      if(p.x >= card.x && p.x <= card.x + card.w &&
         p.y >= card.y && p.y <= card.y + card.h){
        // 名字区域（卡片底部上方 100px 内）→ 改名
        const nameZoneY = card.y + card.h - 130;
        if(p.y >= nameZoneY){
          startEditCatName(card.key);
          return;
        }
        // 其他区域 → 选中
        catType = card.key;
        saveCatPref();
        return;
      }
    }

    // 开始按钮
    const sb = CATCHOOSE_START_BTN;
    if(p.x >= sb.x - sb.w/2 && p.x <= sb.x + sb.w/2 &&
       p.y >= sb.y - sb.h/2 && p.y <= sb.y + sb.h/2){
      saveCatPref();
      reset();
      return;
    }

    // 返回按钮
    const bb = CATCHOOSE_BACK_BTN;
    if(p.x >= bb.x - bb.w/2 && p.x <= bb.x + bb.w/2 &&
       p.y >= bb.y - bb.h/2 && p.y <= bb.y + bb.h/2){
      state = 'menu';
      menuInit();
      return;
    }
    return;
  }

  // ============ 游戏说明（列表） ============
  if(state === 'help'){
    // 列表项点击 → 启动对应教程
    for(const t of helpListRects){
      if(p.x >= t.x && p.x <= t.x + t.w &&
         p.y >= t.y && p.y <= t.y + t.h){
        startHelpTutorial(t.key);
        return;
      }
    }
    // 返回按钮
    const bb = HELP_BACK_BTN;
    if(p.x >= bb.x - bb.w/2 && p.x <= bb.x + bb.w/2 &&
       p.y >= bb.y - bb.h/2 && p.y <= bb.y + bb.h/2){
      state = helpFrom;
      return;
    }
    return;
  }

  // ============ 胜利界面 ============
  if(state === 'victory'){
    const cb = VICTORY_CONTINUE_BTN;
    if(p.x >= cb.x - cb.w/2 && p.x <= cb.x + cb.w/2 &&
       p.y >= cb.y - cb.h/2 && p.y <= cb.y + cb.h/2){
      // 继续战斗：解除上限，回到游戏
      waveCapDisabled = true;
      waveBreakTimer = 1.6;
      state = 'playing';
      last = performance.now();
      return;
    }
    const eb = VICTORY_END_BTN;
    if(p.x >= eb.x - eb.w/2 && p.x <= eb.x + eb.w/2 &&
       p.y >= eb.y - eb.h/2 && p.y <= eb.y + eb.h/2){
      returnToMenu();
      return;
    }
    return;
  }

  if(state === 'dead'){
    // 排行榜按钮
    const lb = DEAD_LB_BTN;
    if(p.x >= lb.x - lb.w/2 && p.x <= lb.x + lb.w/2 &&
       p.y >= lb.y - lb.h/2 && p.y <= lb.y + lb.h/2){
      lbFrom = 'dead';
      state = 'leaderboard';
      lbBuffPopup = -1;
      lbPopupCloseRect = null;
      return;
    }
    // 重新开始按钮
    const rb = DEAD_RESTART_BTN;
    if(p.x >= rb.x - rb.w/2 && p.x <= rb.x + rb.w/2 &&
       p.y >= rb.y - rb.h/2 && p.y <= rb.y + rb.h/2){
      reset();
      return;
    }
    return;
  }
  if(state === 'leaderboard'){
    // buff 弹窗打开时，优先处理弹窗
    if(lbBuffPopup >= 0){
      const r = lbPopupCloseRect;
      if(r && p.x >= r.x && p.x <= r.x + r.w &&
         p.y >= r.y && p.y <= r.y + r.h){
        lbBuffPopup = -1;
        lbPopupCloseRect = null;
        return;
      }
      // 点击弹窗外任意位置也关闭
      lbBuffPopup = -1;
      lbPopupCloseRect = null;
      return;
    }
    // 检测武器标签点击
    for(const t of lbTagRects){
      if(p.x >= t.x && p.x <= t.x + t.w &&
         p.y >= t.y && p.y <= t.y + t.h){
        lbBuffPopup = t.entryIndex;
        lbPopupCloseRect = null;
        return;
      }
    }
    // 关闭按钮
    const cb = LB_CLOSE_BTN;
    if(p.x >= cb.x - cb.w/2 && p.x <= cb.x + cb.w/2 &&
       p.y >= cb.y - cb.h/2 && p.y <= cb.y + cb.h/2){
      state = lbFrom;
      lbBuffPopup = -1;
      lbPopupCloseRect = null;
      return;
    }
    return;
  }
  if(state === 'paused'){
    // 继续
    const rs = RESUME_BTN;
    if(p.x >= rs.x - rs.w/2 && p.x <= rs.x + rs.w/2 &&
       p.y >= rs.y - rs.h/2 && p.y <= rs.y + rs.h/2){
      state = 'playing';
      last = performance.now();
      return;
    }
    // 排行榜
    const lb = PAUSE_LB_BTN;
    if(p.x >= lb.x - lb.w/2 && p.x <= lb.x + lb.w/2 &&
       p.y >= lb.y - lb.h/2 && p.y <= lb.y + lb.h/2){
      lbFrom = 'paused';
      state = 'leaderboard';
      lbBuffPopup = -1;
      lbPopupCloseRect = null;
      return;
    }
    // 玩法说明
    const hb2 = PAUSE_HELP_BTN;
    if(p.x >= hb2.x - hb2.w/2 && p.x <= hb2.x + hb2.w/2 &&
       p.y >= hb2.y - hb2.h/2 && p.y <= hb2.y + hb2.h/2){
      helpFrom = 'paused';
      state = 'help';
      return;
    }
    // 退出游戏
    const r2 = RESTART_BTN;
    if(p.x >= r2.x - r2.w/2 && p.x <= r2.x + r2.w/2 &&
       p.y >= r2.y - r2.h/2 && p.y <= r2.y + r2.h/2){
      state = 'confirm';
      return;
    }
    return;
  }
  if(state === 'confirm'){
    const yes = CONFIRM_YES_BTN;
    const no  = CONFIRM_NO_BTN;
    if(p.x >= yes.x - yes.w/2 && p.x <= yes.x + yes.w/2 &&
       p.y >= yes.y - yes.h/2 && p.y <= yes.y + yes.h/2){
      // 确认退出：结算本局战绩、清档、返回主菜单
      returnToMenu();
      return;
    }
    if(p.x >= no.x - no.w/2 && p.x <= no.x + no.w/2 &&
       p.y >= no.y - no.h/2 && p.y <= no.y + no.h/2){
      // 取消，回到暂停
      state = 'paused';
      return;
    }
    return;
  }
  if(state === 'buff'){
    for(const c of buffCards){
      if(p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h){
        chooseBuff(c.buff.id);
        break;
      }
    }
    return;
  }
  if(state === 'catbro'){
    for(const c of catBroCards){
      if(p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h){
        const idx = catBroSelectedSkills.indexOf(c.skill);
        if(idx >= 0){
          catBroSelectedSkills.splice(idx, 1);
        } else if(catBroSelectedSkills.length < 2){
          catBroSelectedSkills.push(c.skill);
        }
        return;
      }
    }
    const cb = CATBRO_CONFIRM_BTN;
    if(p.x >= cb.x - cb.w/2 && p.x <= cb.x + cb.w/2 &&
       p.y >= cb.y - cb.h/2 && p.y <= cb.y + cb.h/2){
      if(catBroSelectedSkills.length >= 1){
        // 把选中的技能从主角身上移除（主角不能再使用）
        for(const sk of catBroSelectedSkills){
          catBroTakenSkills.push(sk);
        }
        recalcPlayerStats();
        initCatBro(catBroSelectedSkills.slice());
        state = 'playing';
        startWave(wave);
        last = performance.now();
      }
      return;
    }
    return;
  }
  if(state !== 'playing') return;

  if(Math.hypot(p.x - AVATAR.x, p.y - AVATAR.y) < AVATAR.r + 14){
    if(avatarInput){
      // 脱离 pointerdown 事件栈，避免被 preventDefault 影响
      setTimeout(() => avatarInput.click(), 0);
    }
    return;
  }
  // 快捷玩法说明按钮（圆形）
  {
    const hq = HELP_QUICK_BTN;
    if(Math.hypot(p.x - hq.x, p.y - hq.y) < hq.r + 6){
      helpFrom = 'playing';
      state = 'help';
      return;
    }
  }
  if(Math.hypot(p.x - PAUSE_BTN.x, p.y - PAUSE_BTN.y) < PAUSE_BTN.r + 20){
    state = 'paused'; return;
  }
  // 自动释放开关（解锁全武器后才响应）
  if(isAllWeaponsUnlocked() &&
     p.x >= AUTO_BTN.x - AUTO_BTN.w/2 - 10 && p.x <= AUTO_BTN.x + AUTO_BTN.w/2 + 10 &&
     p.y >= AUTO_BTN.y - AUTO_BTN.h/2 - 26 && p.y <= AUTO_BTN.y + AUTO_BTN.h/2 + 8){
    autoCast = !autoCast;
    try{ localStorage.setItem('cat_auto_cast', autoCast ? '1' : '0'); }catch(e){}
    return;
  }
  // 点击左侧技能图标：显示 tips
  const SKILL_ICON_CX = 46;
  const SKILL_ICON_HIT = 28 + 16;
  if(unlockedWeapons.can &&
     Math.hypot(p.x - SKILL_ICON_CX, p.y - H * 0.50) < SKILL_ICON_HIT){
    skillTip = { type: 'can', fade: 0 };
    return;
  }
  if(unlockedWeapons.airstrike && player.airstrikeLevel > 0 &&
     Math.hypot(p.x - SKILL_ICON_CX, p.y - H * 0.50 - 104) < SKILL_ICON_HIT){
    skillTip = { type: 'airstrike', fade: 0 };
    return;
  }
  // 激光按钮：点击释放，按住 0.35s 显示 tips
  if(unlockedWeapons.laser &&
     Math.hypot(p.x - LASER_BTN.x, p.y - LASER_BTN.y) < LASER_BTN.r + 22){
    fireLaser();
    pressState.laserHold = true;
    pressState.laserTimer = 0;
    return;
  }
  // 导弹按钮：同上
  if(unlockedWeapons.missile &&
     Math.hypot(p.x - MISSILE_BTN.x, p.y - MISSILE_BTN.y) < MISSILE_BTN.r + 22){
    fireMissile();
    pressState.missileHold = true;
    pressState.missileTimer = 0;
    return;
  }

  if(isMouse){
    if(e.button === 0) fireMissile();
    else if(e.button === 2) fireLaser();
    return;
  }

  if(p.x < W / 2 && p.y > H * 0.35){
    if(moveJoy.id === -1){
      moveJoy.id = e.pointerId;
      moveJoy.active = true;
      moveJoy.bx = clamp(p.x, JOY_R, W - JOY_R);
      moveJoy.by = clamp(p.y, JOY_R, H - JOY_R);
      moveJoy.dx = 0; moveJoy.dy = 0;
    }
  }
}

function onPointerMove(e){
  if(e.pointerId !== moveJoy.id) return;
  e.preventDefault();
  const p = toCanvasXY(e.clientX, e.clientY);
  updateJoy(moveJoy, p);
}
function onPointerUp(e){
  if(e.pointerId === moveJoy.id) resetJoy(moveJoy, MOVE_BASE);

  // 长按释放：tips 保持；短按则关掉对应的 tips
  if(pressState.laserHold){
    pressState.laserHold = false;
    if(pressState.laserTimer >= SKILL_TIP_LONGPRESS){
      if(skillTip.type !== 'laser') skillTip = { type: 'laser', fade: 0 };
    } else if(skillTip.type === 'laser'){
      skillTip = { type: null, fade: 0 };
    }
    pressState.laserTimer = 0;
  }
  if(pressState.missileHold){
    pressState.missileHold = false;
    if(pressState.missileTimer >= SKILL_TIP_LONGPRESS){
      if(skillTip.type !== 'missile') skillTip = { type: 'missile', fade: 0 };
    } else if(skillTip.type === 'missile'){
      skillTip = { type: null, fade: 0 };
    }
    pressState.missileTimer = 0;
  }
}
cv.addEventListener('pointerdown', onPointerDown, { passive: false });
cv.addEventListener('pointermove', onPointerMove, { passive: false });
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
cv.addEventListener('contextmenu', e => e.preventDefault());

// click 事件做音频解锁（click 一定被浏览器识别为用户手势）
function audioUnlockByClick(){
  audioInit();
  if(actx && actx.state === 'suspended'){
    actx.resume().catch(() => {});
  }
  try{ syncBGM(); }catch(e){}
  setTimeout(() => { try{ syncBGM(); }catch(e){} }, 300);
  setTimeout(() => { try{ syncBGM(); }catch(e){} }, 800);
}
cv.addEventListener('click', audioUnlockByClick);

// ================= 敌人类型 =================
//
// 敌人分级：
//   普通怪（第 1 波起）：zombie, runner, spitter
//   进阶怪（第 2 波起）：skeleton
//   重型怪（第 3 波起）：brute
//   精英怪（第 3 波起）：armored（护甲精英）
//   精英怪（第 5 波起）：elite（恶魔精英）
//
// 通用字段说明：
//   hp          基础血量
//   speed       基础移动速度
//   r           碰撞半径（影响命中判定和站位间距）
//   dmg         接触伤害
//   color       兜底绘制时的颜色（图片加载成功后主要用图片）
//   ranged      true 表示远程怪，会保持中距离并发射酸液子弹
//
// 伤害倍率（克制关系）：
//   bulletMult  猫粮伤害倍率，越高越怕猫粮
//   meleeMult   毛球/近战伤害倍率，越高越怕毛球
//   canMult     罐头爆炸伤害倍率，越高越怕罐头
//
// 特殊标记：
//   skeleton   骷髅，对猫粮有抗性，对毛球略敏感
//   elite      true 表示精英怪，击杀后掉落道具
//   armored    护甲精英，猫粮几乎无效，必须靠毛球或罐头
//   demon      恶魔精英，远程 + 高血 + 高攻，最强精英
//
// ================= 敌人类型 =================
// 形象对照：
//   zombie   = 小老鼠（基础杂兵，快、弱）
//   runner   = 小鼠（速度极快，无图时可回退小老鼠）
//   brute    = 大老鼠（重型，血厚、慢）
//   skeleton = 光头骷髅（进阶，中血中速）
//   spitter  = 小恶魔（远程，投掷火球）
//   armored  = 骑士（护甲精英，怕毛球/罐头）
//   elite    = 大恶魔（恶魔精英，最强）
const ENEMY_TYPES = {
  // 小老鼠：基础杂兵
  zombie:  { hp: 200, speed: 55,  r: 13, dmg: 1,  color: '#7a7a7a',
             bulletMult: 1.0, meleeMult: 1.0, canMult: 1.0,
             laserMult: 1.0, missileMult: 1.0, airstrikeMult: 1.0 },

  // 小鼠：高速，靠速度躲子弹，不减伤
  runner:  { hp: 180, speed: 152, r: 11, dmg: 1,  color: '#9aa0a4',
             bulletMult: 1.0, meleeMult: 1.5, canMult: 1.0,
             laserMult: 1.0, missileMult: 1.0, airstrikeMult: 1.0 },

  // 小恶魔：远程，怕激光/导弹
  spitter: { hp: 300, speed: 60,  r: 15, dmg: 0,  color: '#a83232', ranged: true,
             bulletMult: 1.2, meleeMult: 0.5, canMult: 1.0,
             laserMult: 1.5, missileMult: 1.5, airstrikeMult: 1.0 },

  // 骷髅：中坚，怕毛球/激光
  skeleton:{ hp: 450, speed: 35,  r: 16, dmg: 1, color: '#d8e0e4',
             bulletMult: 0.5, meleeMult: 1.5, canMult: 1.0,
             laserMult: 1.5, missileMult: 1.2, airstrikeMult: 1.0, skeleton: true },

  // 大老鼠：血厚，怕导弹
  brute:   { hp: 900, speed: 40,  r: 26, dmg: 2, color: '#4a4a4a',
             bulletMult: 0.8, meleeMult: 0.7, canMult: 1.5,
             laserMult: 1.2, missileMult: 1.8, airstrikeMult: 1.2 },

  // 骑士：带护盾的精英
  armored: { hp: 1400, speed: 48,  r: 22, dmg: 3, color: '#7a8570',
             bulletMult: 0.15, meleeMult: 1.0, canMult: 1.8,
             laserMult: 1.5, missileMult: 1.8, airstrikeMult: 1.5,
             elite: true, armored: true,
             shieldBaseHP: 400,
             shieldMult: { bullet: 0.1, orb: 0.5, laser: 1.0, missile: 1.5, can: 4.0, airstrike: 3.0 } },

  // 大恶魔：最强精英，远程
  elite:   { hp: 2200, speed: 58,  r: 28, dmg: 4, color: '#a83232', ranged: true,
             bulletMult: 0.10, meleeMult: 0.8, canMult: 1.6,
             laserMult: 1.6, missileMult: 1.8, airstrikeMult: 1.5, elite: true, demon: true }
};

// ================= 掉落物 =================
const DROP_TYPES = {
  // value = 单位数（1 单位 = 1/4 颗心）
  heal_small:   { kind:'heal',  value:2, color:'#ff9a9a', icon:'✚' },  // 0.5 颗心
  heal_medium:  { kind:'heal',  value:4, color:'#ff6b6b', icon:'✚' },  // 1 颗心
  heal_large:   { kind:'heal',  value:8, color:'#ff4a4a', icon:'✚' },  // 2 颗心
  laser_charge: { kind:'laser', color:'#ffd24a', icon:'⚡' }
};
const HEAL_POOL = ['heal_small','heal_small','heal_medium','heal_medium','heal_large'];
const DROP_DURATION = 22;

// ================= BUFF =================
const BUFFS = [
  { id:'orb_count',     name:'毛球增生', desc:'毛球数量 +1',         max:4, icon:'🧶', color:'#ffb0d0' },
  { id:'orb_damage',    name:'毛球加重', desc:'毛球伤害 +50%',       max:5, icon:'💢', color:'#ff90a8' },
  { id:'orb_size',      name:'毛球膨胀', desc:'毛球尺寸 +35%',       max:4, icon:'⚪', color:'#ffc0d8' },
  { id:'orb_radius',    name:'毛球扩散', desc:'毛球环绕半径 +20%',   max:3, icon:'🎯', color:'#ffd0e0' },
  { id:'missile_count', name:'导弹齐射', desc:'导弹数量 +1',         max:4, icon:'🚀', color:'#ff8a3c' },
  { id:'missile_damage',name:'导弹弹头', desc:'导弹伤害 +45%',       max:5, icon:'💥', color:'#ff6b4a' },
  { id:'missile_charge',name:'快速装填', desc:'导弹充能 -28%',       max:4, icon:'⚡', color:'#ffa060' },
  { id:'multishot',     name:'多重弹道', desc:'每次射击 +1 发猫粮',   max:4, icon:'🎯', color:'#6fd0ff' },
  { id:'firerate',      name:'极速射击', desc:'猫粮射速 +28%',        max:5, icon:'⚡', color:'#ffd24a' },
  { id:'speed',         name:'疾风猫步', desc:'移动速度 +18%',        max:5, icon:'💨', color:'#7fe0a0' },
  { id:'damage',        name:'重型猫粮', desc:'猫粮伤害 +40%',        max:5, icon:'💥', color:'#ff8a3c' },
  { id:'canpower',      name:'罐头强化', desc:'罐头伤害 +50%',        max:5, icon:'🍖', color:'#ff9f6b' },
  { id:'blast',         name:'罐头爆炸', desc:'罐头爆炸范围 +35%',    max:4, icon:'💣', color:'#ffcf5c' },
  { id:'laserup',       name:'激光充能', desc:'能量获取 +60%',        max:4, icon:'✨', color:'#a0d0ff' },
  { id:'laserpower',    name:'激光强化', desc:'激光伤害 +45%',        max:5, icon:'🔫', color:'#88eeff' },
  { id:'laser_count',   name:'激光分裂', desc:'激光同时锁定 +1 个敌人', max:3, icon:'✨', color:'#88eeff' },
  { id:'frozen_bullet', name:'冰冻弹',   desc:'猫粮附加冰冻几率 +8%', max:5, icon:'❄', color:'#a0e8ff' },
  { id:'airstrike',     name:'全屏轰炸', desc:'自动空投炸弹，每级 +1 颗', max:5, icon:'💣', color:'#ff8a3c' },
  { id:'vitality',      name:'生命强化', desc:'生命上限 +30 并回满',  max:5, icon:'❤', color:'#ff6b8a' }
];

// ================= 推荐 Buff 配置 =================
// 加入这里的 buff，在强化选择界面会显示"推荐"标签
// 想取消推荐就删掉对应字符串；想加新的就把 id 填进来
const RECOMMENDED_BUFFS = [
  'frozen_bullet',   // 冰冻弹
  'airstrike',       // 全屏轰炸
  'multishot',       // 多重弹道
  'laser_count'      // 激光分裂
];

function isRecommended(id){
  if(!id) return false;
  // 双重增益卡的 id 是 'dbl_xxx_yyy'，用 realId 判断
  return RECOMMENDED_BUFFS.indexOf(id) >= 0;
}

// 强化卡数值预览
function getBuffPreviewText(id, lv){
  const next = lv + 1;
  switch(id){
    case 'orb_count':     return '毛球数量：' + (3+lv) + ' → ' + (3+next);
    case 'orb_damage':    return '毛球伤害：' + Math.round(26*(1+0.5*lv)) + ' → ' + Math.round(26*(1+0.5*next));
    case 'orb_size':      return '毛球尺寸：' + Math.round(100+35*lv) + '% → ' + Math.round(100+35*next) + '%';
    case 'orb_radius':    return '环绕半径：' + Math.round(100+20*lv) + '% → ' + Math.round(100+20*next) + '%';
    case 'missile_count': return '导弹数量：' + (4+lv) + ' → ' + (4+next);
    case 'missile_damage':return '导弹伤害：' + Math.round(100*(1+0.45*lv)) + ' → ' + Math.round(100*(1+0.45*next));
    case 'missile_charge':return '充能时间：' + (4/(1+0.28*lv)).toFixed(2) + 's → ' + (4/(1+0.28*next)).toFixed(2) + 's';
    case 'multishot':     return '猫粮发数：' + (1+lv) + ' → ' + (1+next);
    case 'pierce':        return '穿透数量：' + (1+lv) + ' → ' + (1+next);
    case 'firerate':      return '射击间隔：' + (0.5/(1+0.28*lv)).toFixed(3) + 's → ' + (0.5/(1+0.28*next)).toFixed(3) + 's';
    case 'speed':         return '移动速度：' + Math.round(240*(1+0.18*lv)) + ' → ' + Math.round(240*(1+0.18*next));
    case 'damage':        return '猫粮伤害：' + Math.round(10*(1+0.4*lv)) + ' → ' + Math.round(10*(1+0.4*next));
    case 'bulletrange':   return '射程加成：' + Math.round(100+40*lv) + '% → ' + Math.round(100+40*next) + '%';
    case 'canpower':      return '罐头伤害：' + Math.round(115*(1+0.5*lv)) + ' → ' + Math.round(115*(1+0.5*next));
    case 'blast':         return '爆炸范围：' + Math.round(140*(1+0.35*lv)) + ' → ' + Math.round(140*(1+0.35*next));
    case 'laserup':       return '能量加成：' + Math.round(100+60*lv) + '% → ' + Math.round(100+60*next) + '%';
    case 'laserpower':    return '激光伤害：' + Math.round(140*(1+0.45*lv)) + ' → ' + Math.round(140*(1+0.45*next));
    case 'laser_count':   return '激光锁定：' + (1+lv) + ' → ' + (1+next) + ' 个';
    case 'frozen_bullet': return '冰冻几率：' + Math.round((0.06+0.08*lv)*100) + '% → ' + Math.round((0.06+0.08*next)*100) + '%';
    case 'airstrike':     return '炸弹数量：' + (3+lv) + ' → ' + (3+next) + ' 颗，伤害 +30';
    case 'vitality':      return '生命上限：' + (100+30*lv) + ' → ' + (100+30*next);
    default: return '';
  }
}
const BUFF_CATEGORY = {
  orb_count: 'orb', orb_damage: 'orb', orb_size: 'orb', orb_radius: 'orb',
  missile_count: 'missile', missile_damage: 'missile', missile_charge: 'missile',
  multishot: 'bullet', pierce: 'bullet', firerate: 'bullet', damage: 'bullet', bulletrange: 'bullet',
  canpower: 'can', blast: 'can',
  laserup: 'laser', laserpower: 'laser', laser_count: 'laser',
  frozen_bullet: 'bullet',
  airstrike: 'can',
  speed: 'move', vitality: 'life'
};

// ============ 稀有度 & 武器类型 ============
// 稀有度：blue 小提升 / purple 中提升 / red 大提升（质变）/ gold 解锁武器
const BUFF_RARITY = {
  // 蓝（小提升）
  orb_size: 'blue', orb_radius: 'blue', speed: 'blue',
  // 紫（中提升）
  orb_count: 'purple', orb_damage: 'purple',
  missile_count: 'purple', missile_damage: 'purple', missile_charge: 'purple',
  firerate: 'purple', damage: 'purple', frozen_bullet: 'purple',
  canpower: 'purple', blast: 'purple',
  laserup: 'purple', laserpower: 'purple',
  vitality: 'purple',
  // 红（质变）
  multishot: 'red', laser_count: 'red', airstrike: 'red'
};

// 稀有度配色
const RARITY_COLORS = {
  blue: {
    border: '#4a9ae8',
    glow:   'rgba(74, 154, 232, 0.9)',
    bgTop:  'rgba(220, 240, 255, 0.99)',
    bgBot:  'rgba(170, 210, 245, 0.99)',
    title:  '#2a5a98',
    tagBg:  '#4a9ae8',
    tagBorder: '#a0d0ff'
  },
  purple: {
    border: '#a050e8',
    glow:   'rgba(160, 80, 232, 0.9)',
    bgTop:  'rgba(242, 228, 255, 0.99)',
    bgBot:  'rgba(212, 180, 245, 0.99)',
    title:  '#6a28a8',
    tagBg:  '#a050e8',
    tagBorder: '#d0a0ff'
  },
  red: {
    border: '#e83030',
    glow:   'rgba(232, 48, 48, 0.9)',
    bgTop:  'rgba(255, 228, 228, 0.99)',
    bgBot:  'rgba(255, 180, 180, 0.99)',
    title:  '#a01818',
    tagBg:  '#e83030',
    tagBorder: '#ffb0b0'
  },
  gold: {
    border: '#e8b020',
    glow:   'rgba(255, 210, 74, 0.95)',
    bgTop:  'rgba(255, 250, 220, 0.99)',
    bgBot:  'rgba(250, 220, 150, 0.99)',
    title:  '#8a6010',
    tagBg:  '#e8b020',
    tagBorder: '#ffd0a0'
  }
};

// buff 属于哪种武器
const BUFF_WEAPON_TYPE = {
  orb_count: 'orb', orb_damage: 'orb', orb_size: 'orb', orb_radius: 'orb',
  missile_count: 'missile', missile_damage: 'missile', missile_charge: 'missile',
  multishot: 'bullet', firerate: 'bullet', damage: 'bullet', frozen_bullet: 'bullet',
  canpower: 'can', blast: 'can',
  laserup: 'laser', laserpower: 'laser', laser_count: 'laser',
  airstrike: 'airstrike',
  speed: 'move', vitality: 'life'
};

// 武器类型中文名
const WEAPON_TYPE_NAMES = {
  orb: '毛球',
  missile: '导弹',
  bullet: '猫粮',
  can: '罐头',
  laser: '激光',
  airstrike: '轰炸',
  move: '通用',
  life: '通用'
};

// 获取 buff 的稀有度（默认蓝色）
function getBuffRarity(buff){
  if(buff && buff.isUnlock) return 'gold';
  if(!buff) return 'blue';
  return BUFF_RARITY[buff.id] || 'blue';
}

const DAMAGE_COLORS = {
  bullet:    '#ffe080',
  orb:       '#ffb0d0',
  can:       '#ff9f6b',
  laser:     '#88eeff',
  laserGold: '#ffd24a',
  missile:   '#ff8a3c'
};
const CRIT_CHANCE = 0.12;
const CRIT_MULT   = 2.0;

let floatTexts = [];
function addFloatText(x, y, text, color, crit){
  floatTexts.push({
    x: x + rand(-6, 6),
    y: y,
    vx: rand(-24, 24),
    vy: -70,
    text: String(text),
    color,
    crit: !!crit,
    life: 0.95,
    maxLife: 0.95
  });
}
function updateFloatTexts(dt){
  for(let i = floatTexts.length - 1; i >= 0; i--){
    const f = floatTexts[i];
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy *= 0.94;
    f.life -= dt;
    if(f.life <= 0) floatTexts.splice(i, 1);
  }
}
// ================= Canvas 图标绘制（替代 Emoji） =================
function drawBuffIcon(id, cx, cy, size, color){
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if(id === 'orb_count' || id === 'orb_size' || id === 'orb_radius' || id === 'orb_damage'){
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill();
    if(id === 'orb_damage'){
      for(let i = 0; i < 8; i++){
        const a = i * TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7);
        ctx.lineTo(Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05);
        ctx.stroke();
      }
    } else if(id === 'orb_radius'){
      ctx.beginPath(); ctx.arc(0, 0, s * 1.05, 0, TAU); ctx.stroke();
    } else if(id === 'orb_size'){
      ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, TAU); ctx.stroke();
    }
  } else if(id === 'missile_count' || id === 'missile_damage' || id === 'missile_charge'){
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.4);
    ctx.lineTo(s * 0.8, 0);
    ctx.lineTo(-s * 0.6, s * 0.4);
    ctx.closePath();
    ctx.fill();
    if(id === 'missile_charge'){
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.7);
      ctx.lineTo(0, -s * 0.1);
      ctx.lineTo(-s * 0.2, -s * 0.1);
      ctx.lineTo(s * 0.3, s * 0.7);
      ctx.stroke();
    }
    if(id === 'missile_count'){
      ctx.beginPath();
      ctx.moveTo(s * 0.8, 0); ctx.lineTo(s * 1.15, 0);
      ctx.moveTo(s * 0.5, -s * 0.3); ctx.lineTo(s * 0.75, -s * 0.55);
      ctx.stroke();
    }
  } else if(id === 'multishot'){
    for(let i = -1; i <= 1; i++){
      ctx.beginPath(); ctx.arc(i * s * 0.5, 0, s * 0.22, 0, TAU); ctx.fill();
    }
  } else if(id === 'pierce'){
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, 0); ctx.lineTo(s * 0.55, 0);
    ctx.moveTo(s * 0.3, -s * 0.4); ctx.lineTo(s * 0.85, 0); ctx.lineTo(s * 0.3, s * 0.4);
    ctx.stroke();
  } else if(id === 'firerate'){
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 0.9);
    ctx.lineTo(-s * 0.3, 0);
    ctx.lineTo(s * 0.1, 0);
    ctx.lineTo(-s * 0.2, s * 0.9);
    ctx.stroke();
  } else if(id === 'damage'){
    for(let i = 0; i < 8; i++){
      const a = i * TAU / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
      ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
  } else if(id === 'bulletrange'){
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, 0); ctx.lineTo(s * 0.9, 0);
    ctx.moveTo(s * 0.5, -s * 0.4); ctx.lineTo(s * 0.9, 0); ctx.lineTo(s * 0.5, s * 0.4);
    ctx.stroke();
  } else if(id === 'canpower'){
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s * 0.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.55, s * 0.28, 0, 0, TAU); ctx.fill();
  } else if(id === 'blast'){
    ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.75, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.5); ctx.lineTo(s * 0.7, -s * 0.95);
    ctx.stroke();
  } else if(id === 'airstrike'){
    // 炸弹
    ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.6, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.4);
    ctx.lineTo(s * 0.4, -s * 0.85);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.9, s * 0.15, 0, TAU); ctx.fill();
  } else if(id === 'frozen_bullet'){
    // 雪花：六道线
    for(let i = 0; i < 6; i++){
      const a = i * TAU / 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
      ctx.lineTo(Math.cos(a + 0.5) * s * 0.85, Math.sin(a + 0.5) * s * 0.85);
      ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
      ctx.lineTo(Math.cos(a - 0.5) * s * 0.85, Math.sin(a - 0.5) * s * 0.85);
      ctx.stroke();
    }
  } else if(id === 'laser_count'){
    // 三道平行光线
    for(let i = -1; i <= 1; i++){
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, i * s * 0.5);
      ctx.lineTo(s * 0.8, i * s * 0.5);
      ctx.stroke();
    }
    // 箭头
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.9); ctx.lineTo(s * 0.9, -s * 0.5); ctx.lineTo(s * 0.4, -s * 0.1);
    ctx.stroke();
  } else if(id === 'laserup' || id === 'laserpower'){
    ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, TAU); ctx.fill();
    for(let i = 0; i < 4; i++){
      const a = i * TAU / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
      ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
      ctx.stroke();
    }
    if(id === 'laserpower'){
      ctx.beginPath(); ctx.arc(0, 0, s * 0.65, 0, TAU); ctx.stroke();
    }
  } else if(id === 'speed'){
    for(let i = -1; i <= 1; i++){
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, i * s * 0.35);
      ctx.lineTo(s * 0.55 + i * s * 0.1, i * s * 0.35);
      ctx.stroke();
    }
  } else if(id === 'vitality'){
    ctx.beginPath();
    ctx.moveTo(0, s * 0.7);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.4, -s * 0.9, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.4, -s * 0.9, s * 1.2, -s * 0.1, 0, s * 0.7);
    ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawFloatTexts(){
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for(const f of floatTexts){
    const a = Math.min(1, f.life / f.maxLife);
    ctx.globalAlpha = a;
    const size = f.crit ? 30 : 20;
    ctx.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';
    ctx.lineWidth = f.crit ? 5 : 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

function dealDamage(e, baseDmg, type, opts){
  opts = opts || {};
  const silent = !!opts.silent;
  const noCrit = !!opts.noCrit;

  let dmg = baseDmg;
  let crit = false;
  if(!noCrit && Math.random() < CRIT_CHANCE){
    dmg *= CRIT_MULT;
    crit = true;
  }

  // 护盾吸收
  if(e.shield > 0 && e.shieldMult){
    const sMult = e.shieldMult[type] !== undefined ? e.shieldMult[type] : 1.0;
    const shieldDmg = dmg * sMult;
    e.shield -= shieldDmg;
    e.hitFlash = 1;
    if(runDamageStats && type){
      runDamageStats[type] = (runDamageStats[type] || 0) + shieldDmg;
    }
    if(!silent){
      addFloatText(e.x, e.y - e.r - 6, Math.round(shieldDmg), '#a0d8ff', crit);
    }
    if(e.shield <= 0){
      e.shield = 0;
      e.shieldBroken = true;
      burst(e.x, e.y, 26, '#a0d8ff', 340);
      burst(e.x, e.y, 14, '#ffffff', 260);
      rings.push({ x:e.x, y:e.y, maxR: 64, life:0.5, t:0.5, color:'#a0d8ff' });
      cam.shake = Math.max(cam.shake, 8);
    }
    return;
  }

  // 正常伤害：套用克制倍率
  let mult = 1.0;
  if(type === 'bullet')        mult = e.bulletMult     !== undefined ? e.bulletMult     : 1.0;
  else if(type === 'orb')      mult = e.meleeMult      !== undefined ? e.meleeMult      : 1.0;
  else if(type === 'can')      mult = e.canMult        !== undefined ? e.canMult        : 1.0;
  else if(type === 'laser')    mult = e.laserMult      !== undefined ? e.laserMult      : 1.0;
  else if(type === 'missile')  mult = e.missileMult    !== undefined ? e.missileMult    : 1.0;
  else if(type === 'airstrike')mult = e.airstrikeMult  !== undefined ? e.airstrikeMult  : 1.0;

  dmg *= mult;
  e.hp -= dmg;
  e.hitFlash = 1;

  if(runDamageStats && type){
    runDamageStats[type] = (runDamageStats[type] || 0) + dmg;
  }

  if(!silent){
    const color = crit ? '#ff2b2b' : (DAMAGE_COLORS[type] || '#ffffff');
    addFloatText(e.x, e.y - e.r - 6, Math.round(dmg), color, crit);
  }
}
// ================= 全局状态 =================
let state, player, enemies, bullets, eBullets, cans, particles, rings, burnMarks, drops;
let missileList = [];
let cam, wave, waveActive, spawnQueue, waveTimer, waveBreakTimer, score, gameTime, banner;
let nextEnemyId = 1;
let autoCast = false;
let autoCastAnim = 0;
let lbFrom = 'dead';
let last = performance.now();

let waveTotal = 0;

// ============ 教学关卡状态 ============
let currentStage = 1;         // 当前关卡 1~6，0 表示无尽模式
let waveInStage = 0;          // 本关打到第几波（1~4）
let unlockedWeapons = {};     // 已解锁的武器集合
let stageClearInfo = null;      // 过关弹窗信息
let stageKillCount = 0;         // 本关击杀数
let pendingStageClearAfterBuff = false;  // 教学关最后一波：选完强化后再进过关弹窗
let tutorialStep = 0;           // 教程当前步骤
let tutorialQueue = [];         // 当前播放的教程步骤列表
let tutorialOnFinish = null;    // 教程结束动作：'start-game' | 'continue-wave' | 'return-help'
let helpListRects = [];         // 玩法说明列表项的点击区域

// ============ 教学关卡配置 ============
// unlockThisStage：进入这一关后，第一次清波时弹出"解锁卡"
const STAGES = [
  { unlockThisStage: 'frozen_bullet' },  // 波 1 → 冰冻弹
  { unlockThisStage: 'can' },            // 波 2 → 罐头
  { unlockThisStage: 'orb' },            // 波 3 → 毛球
  { unlockThisStage: 'laser' },          // 波 4 → 激光
  { unlockThisStage: 'missile' },        // 波 5 → 导弹
  { unlockThisStage: 'airstrike' },      // 波 6 → 轰炸
  { unlockThisStage: null }              // 波 7 → 终极混战，无解锁
];

// 技能引导文案
const SKILL_INTROS = {
  can: {
    name: '罐头',
    color: '#ff9f6b',
    intro: '自动投掷罐头，范围爆炸清怪',
    trigger: '自动触发（每 4 秒）',
    when: '敌人靠近时效果最好，范围爆炸能一次清几只',
    detail: '自动向最近敌人投掷，落点范围爆炸，对护甲怪伤害更高',
    highlight: () => ({ shape: 'circle', x: 46, y: H * 0.50, r: 46 }),
    panelAnchor: 'right'
  },
  orb: {
    name: '毛球',
    color: '#ffb0d0',
    intro: '毛球环绕猫咪，触碰敌人造成伤害并击退',
    trigger: '自动（绕着猫旋转）',
    when: '敌人贴脸时效果最好，能击退并持续伤害',
    detail: '毛球围绕猫咪旋转，碰到敌人造成伤害并击退，还能击落敌弹',
    highlight: () => ({
      shape: 'circle',
      x: player.x - cam.x,
      y: player.y - cam.y,
      r: 240
    }),
    panelAnchor: 'below'
  },
  laser: {
    name: '激光',
    color: '#88eeff',
    intro: '锁定敌人持续输出，还带减速',
    trigger: '能量满 100 后按 E 或点右侧按钮',
    when: '面对血厚大怪时效果最好，能持续锁定输出',
    detail: '锁定最近敌人持续输出，并附带减速效果',
    highlight: () => ({ shape: 'circle', x: LASER_BTN.x, y: LASER_BTN.y, r: LASER_BTN.r + 12 }),
    panelAnchor: 'left'
  },
  missile: {
    name: '追踪导弹',
    color: '#ff8a3c',
    intro: '自动追踪高血量敌人，充能制发射',
    trigger: '按空格或点右侧按钮',
    when: '面对远程怪或高血量怪时效果最好',
    detail: '自动追踪最高血量敌人，充能制，最多 3 层',
    highlight: () => ({ shape: 'circle', x: MISSILE_BTN.x, y: MISSILE_BTN.y, r: MISSILE_BTN.r + 12 }),
    panelAnchor: 'left'
  },
  airstrike: {
    name: '全屏轰炸',
    color: '#ff6b4a',
    intro: '自动向敌人群投掷炸弹，范围爆炸',
    trigger: '自动触发（每 6 秒）',
    when: '敌人密集时效果最好，一次空投多颗炸弹',
    detail: '向最近的几个敌人空投炸弹，范围爆炸',
    highlight: () => ({ shape: 'circle', x: 46, y: H * 0.50 + 104, r: 46 }),
    panelAnchor: 'right'
  },
  frozen_bullet: {
    name: '冰冻弹',
    color: '#a0e8ff',
    intro: '猫粮命中时有几率冰冻敌人',
    trigger: '自动（猫粮命中时概率触发）',
    when: '面对快速敌人时效果最好，冻住它再打',
    detail: '猫粮命中敌人时，有几率将其冰冻数秒，冰冻期间敌人不能移动和攻击',
    highlight: () => ({
      shape: 'circle',
      x: player.x - cam.x,
      y: player.y - cam.y,
      r: 200
    }),
    panelAnchor: 'below'
  }
};
const STAGE_WAVES = 7;        // ★ 教学关共 7 波
const TUTORIAL_MAX_STAGE = 1; // ★ 只有 1 个教学关

// 每个武器系列对应的 buff id
const BUFF_POOLS = {
  bullet:    ['multishot', 'firerate', 'damage', 'frozen_bullet'],
  can:       ['canpower', 'blast'],
  orb:       ['orb_count', 'orb_damage', 'orb_size', 'orb_radius'],
  laser:     ['laserup', 'laserpower', 'laser_count'],
  missile:   ['missile_count', 'missile_damage', 'missile_charge'],
  airstrike: ['airstrike']
};

// ============ 教程系统（统一队列） ============
// 队列里每个元素形如：
//   { shape, getPos, panelAnchor, title, lines, hint }
// 通过 tutorialQueue + tutorialStep 控制当前播放到哪一步。

// 初始新手教程（进入游戏时播放）
const INITIAL_TUTORIAL_STEPS = [
  {
    shape: 'circle',
    getPos: () => ({ x: MOVE_BASE.x, y: MOVE_BASE.y, r: 110 }),
    panelAnchor: 'above',
    title: '移动猫咪',
    lines: ['拖动左下角摇杆', '或使用 WASD / 方向键'],
    hint: '点击屏幕继续'
  },
  {
    shape: 'circle',
    getPos: () => ({
      x: player ? player.x - cam.x : W/2,
      y: player ? player.y - cam.y : WORLD.h * 0.72,
      r: 140
    }),
    panelAnchor: 'above',
    title: '自动开火',
    lines: ['猫粮枪会自动瞄准最近的敌人', '你只需要专注移动和走位'],
    hint: '点击屏幕继续'
  },
  {
    shape: 'rect',
    getPos: () => ({ x: W - 162, y: 130, w: 150, h: 104 }),
    panelAnchor: 'below',
    title: '波次信息',
    lines: ['右上角显示当前波数', '本关共 ' + STAGE_WAVES + ' 波敌人', '每波清完后选择一项强化'],
    hint: '点击屏幕开始战斗'
  }
];

// 通关全部教学关后、进入无尽模式前，指引玩家「玩法说明」和「自动释放」
const END_TUTORIAL_STEPS = [
  {
    shape: 'circle',
    getPos: () => ({ x: HELP_QUICK_BTN.x, y: HELP_QUICK_BTN.y, r: HELP_QUICK_BTN.r + 20 }),
    panelAnchor: 'below',
    title: '随时查看玩法说明',
    lines: [
      '点这里能看所有技能的介绍',
      '游玩途中有不清楚的随时打开'
    ],
    hint: '点击屏幕继续'
  },
  {
    shape: 'rect',
    getPos: () => ({
      x: AUTO_BTN.x - AUTO_BTN.w/2 - 8,
      y: AUTO_BTN.y - AUTO_BTN.h/2 - 8,
      w: AUTO_BTN.w + 16,
      h: AUTO_BTN.h + 16
    }),
    panelAnchor: 'below',
    title: '自动释放技能',
    lines: [
      '打开后激光和导弹会自动放',
      '手忙不过来时特别有用'
    ],
    hint: '点击屏幕开始无尽模式'
  }
];

// 技能解锁引导：根据技能 key 生成 3 步
function buildSkillIntroSteps(key){
  const intro = SKILL_INTROS[key];
  if(!intro) return [];

  const getPos = intro.highlight;   // 复用 SKILL_INTROS 里的 highlight

  return [
    {
      shape: 'circle',
      getPos: getPos,
      panelAnchor: intro.panelAnchor,
      demo: key,                                  // ★ 第 1 步播放演示动画
      title: '解锁新技能：' + intro.name,
      lines: [intro.detail],
      hint: '点击屏幕继续'
    },
    {
      shape: 'circle',
      getPos: getPos,
      panelAnchor: intro.panelAnchor,
      title: intro.name + ' · 怎么触发',
      lines: [intro.trigger],
      hint: '点击屏幕继续'
    },
    {
      shape: 'circle',
      getPos: getPos,
      panelAnchor: intro.panelAnchor,
      title: intro.name + ' · 何时使用',
      lines: [intro.when],
      hint: '点击屏幕继续'
    }
  ];
}

let runDamageStats = {};
let leaderboard = [];
let lbTagRects = [];
let lbBuffPopup = -1;
let lbPopupCloseRect = null;

// 技能 tips 系统
let skillTip = { type: null, fade: 0 };
const SKILL_TIP_LONGPRESS = 0.35;
let pressState = { laserHold: false, laserTimer: 0, missileHold: false, missileTimer: 0 };
let waveCapDisabled = false;   // 胜利后选择继续，则解除 10 波上限
let helpFrom = 'menu';         // 游戏说明的返回目标
let buffChoices = [], buffCards = [];
let canAutoTimer = 0;
let orbBuffGiven = false;
let forcedBuffQueue = [];   // 前 3 波强制出现的 buff 队列
let airstrikeTimer = 0;      // 全屏轰炸冷却计时
let waveClearTimer = 0;      // 波次清完后的缓冲计时
let buffFadeIn = 0;          // 强化卡淡入进度 0→1
let pendingCritReward = false;  // 暴击：待触发的额外选择
let isSecondPick = false;       // 当前是否处于第二次选择
let airstrikeBombs = [];     // 正在下落的炸弹
let groundDecorations = [];

// ============ 猫小弟 ============
let catBros = [];             // 所有猫小弟
let catBroSpawnCount = 0;     // 已经触发过几次
let catBroSelectedSkills = [];
let catBroCards = [];
let catBroTakenSkills = [];   // 已被转给猫小弟的技能，主角不能再使用
const CATBRO_CONFIRM_BTN = { x: W/2, y: H - 120, w: 300, h: 72 };
const CATBRO_SKILL_INFO = {
  can:       { name:'罐头',  color:'#ff9f6b', icon:'canpower',       desc:'每 6 秒自动投掷罐头' },
  orb:       { name:'毛球',  color:'#ffb0d0', icon:'orb_count',      desc:'毛球环绕猫小弟旋转' },
  laser:     { name:'激光',  color:'#88eeff', icon:'laserpower',     desc:'每 14 秒爆发一道激光' },
  missile:   { name:'导弹',  color:'#ff8a3c', icon:'missile_damage', desc:'每 8 秒发射两枚导弹' },
  airstrike: { name:'轰炸',  color:'#ff6b4a', icon:'airstrike',      desc:'每 9 秒空投两颗炸弹' }
};
const CATBRO_SKILL_CD = {
  can: 6, orb: 0, laser: 14, missile: 8, airstrike: 9
};

// 猫小弟专属台词库
const CATBRO_LINES = {
  join:      ['喵！我来帮你！', '小弟来也！', '大哥我来了喵~', '一起打怪喵！'],
  can:       ['接招！罐头炸弹！', '砸死你们喵！', '喵！看我的罐头！'],
  orb:       ['毛球起飞！', '看我的毛球！', '转圈圈喵！'],
  laser:     ['激光锁定！', '咻——！', '烧你们喵！'],
  missile:   ['导弹发射！', '追踪导弹喵！', '锁定目标！'],
  airstrike: ['空袭来咯！', '炸弹雨！', '天上掉罐头喵！']
};

// ============ 无尽模式曲线 ============
function getEndlessHpScale(n){
  if(n <= 10)  return 1.0 + (n - 1) * 0.10;
  if(n <= 50)  return 1.9 + (n - 10) * 0.075;
  if(n <= 100) return 4.9 + (n - 50) * 0.12;
  return 10.9 + (n - 100) * 0.05;
}
function getEndlessSpScale(n){
  if(n <= 25) return 1.0 + (n - 1) * 0.025;
  return Math.min(2.5, 1.6 + (n - 25) * 0.012);
}
function getEndlessDmgScale(n){
  if(n <= 25) return 1.0;
  return Math.min(2.5, 1.0 + (n - 25) * 0.03);
}
function getEndlessCount(n){
  if(n <= 10) return 20;
  return Math.min(80, 20 + Math.floor((n - 10) * 0.8));
}
function getEndlessDuration(n){
  if(n <= 10)  return 21;
  if(n <= 30)  return 28;
  if(n <= 60)  return 32;
  if(n <= 100) return 40;
  return 45;
}

const TUTORIAL_WAVES = [
  // 波 1：3 杂兵 + 3 高速兵（教冰冻弹）
  { list: ['zombie','zombie','zombie','runner','runner','runner'],
    interval: 1.5, shuffle: false },

  // 波 2：8 只高速，巩固冰冻弹
  { list: new Array(8).fill('runner'),
    interval: 1.2, shuffle: true },

  // 波 3：20 只杂兵密集出怪（教罐头群伤）
  { list: new Array(20).fill('zombie'),
    interval: 0.5, shuffle: true },

  // 波 4：20 只高速兵（教毛球近身防御）
  { list: new Array(20).fill('runner'),
    interval: 0.5, shuffle: true },

  // 波 5：混合（教激光持续锁定）
  { list: ['zombie','zombie','zombie','zombie','zombie','zombie',
           'skeleton','skeleton','skeleton','skeleton'],
    interval: 1.0, shuffle: true },

  // 波 6：4 只护盾怪（教导弹破盾）
  { list: ['armored','armored','armored','armored'],
    interval: 2.5, shuffle: true },

  // 波 7：大混战（教轰炸清场）
  { list: [
      'zombie','zombie','zombie','zombie','zombie',
      'runner','runner','runner','runner','runner',
      'spitter','spitter','spitter',
      'skeleton','skeleton','skeleton',
      'brute','brute','brute',
      'armored','armored'
    ], interval: 0.8, shuffle: true }
];

// ============ 无尽模式刷怪状态 ============
let waveSpawn = {
  active: false,
  currentStage: 0,
  stageTimer: 0,
  stageDuration: 0,
  stagePools: [],
  totalSpawned: 0,
  totalTarget: 0,
  wave: 0,
  spawnTimer: 0
};
const MAX_ENEMIES_ON_FIELD = 30;

const CAN_AUTO_INTERVAL = 5;
const LASER_COST        = 100;
const LASER_DURATION    = 0.30;
const LASER_BASE_RADIUS = 900;
const LASER_BASE_DAMAGE = 140;
const ENERGY_REGEN      = 0;   // 已改为命中/击杀获取
const CAN_BASE_DAMAGE   = 115;
const FIRE_BASE_RANGE   = 1300;
const BULLET_HOMING     = true;

const ORB_BASE_DAMAGE   = 26;
const ORB_BASE_RADIUS   = 180;
const ORB_BASE_SIZE     = 26;
const ORB_BASE_SPEED    = 0.8;
const ORB_HIT_CD        = 0.38;
const ORB_KNOCKBACK     = 55;
const BUFF_CRIT_CHANCE  = 0.25;

const MISSILE_BASE_COUNT   = 4;
const MISSILE_BASE_DAMAGE  = 100;
const MISSILE_MAX_CHARGES  = 3;
const MISSILE_CHARGE_TIME  = 4;
const MISSILE_SPEED        = 640;

let laser = {
  active: false,
  targets: [],         // [{ id, dmgAccum, floatTimer }]
  timer: 0,
  duration: 8.0,
  dps: 0,
  flash: 0,
  isGold: false
};

function reset(){
  // v2 教学关不继承任何旧存档（含 v1 的残留）
  clearProgress();
  state = 'playing';
  waveCapDisabled = false;
  const savedAvatar = globalAvatarImg || (player && player.avatarImg) || null;
  globalAvatarImg = savedAvatar;

  player = {
    x: WORLD.w/2, y: WORLD.h * 0.72, r: 16,
    speed: 240, hp: 16, maxHp: 16,
    facing: -Math.PI/2, fireCd: 0, fireRate: 0.5, recoil: 0,
    bulletDamage: 10, pierce: 1, multishot: 0,
    bulletRangeMult: 1,
    blastRadius: 140,
    canDamage: CAN_BASE_DAMAGE,
    laserDamage: LASER_BASE_DAMAGE,
    laserRadius: LASER_BASE_RADIUS,
    invuln: 0,
    avatarImg: savedAvatar,
    laserChargeTimer: 0,
    buffLevels: {},
    orbCount: 0,
    orbDamage: ORB_BASE_DAMAGE,
    orbRadius: ORB_BASE_RADIUS,
    orbSize: ORB_BASE_SIZE,
    orbSpeedMult: 1,
    orbAngle: 0,
    orbHitCd: new Map(),
    missileCount: MISSILE_BASE_COUNT,
    missileDamage: MISSILE_BASE_DAMAGE,
    missileCharges: MISSILE_MAX_CHARGES,
    missileChargeMax: MISSILE_MAX_CHARGES,
    missileChargeTime: MISSILE_CHARGE_TIME,
    missileChargeTimer: 0
  };

  recalcPlayerStats();

  enemies = []; bullets = []; eBullets = []; cans = [];
  particles = []; rings = []; burnMarks = []; drops = [];
  floatTexts = [];
  missileList = [];
  cam = { x: 0, y: 0, shake: 0 };

  // 每次开局都从教学第 1 关开始（第 1 小块先不做存档）
  currentStage = 1;
  waveInStage = 0;
  wave = 0;
  unlockedWeapons = {};
  unlockedWeapons.catfood = true;
  // 猫粮默认解锁（普攻本来就有）
  unlockedWeapons.catfood = true;
  stageClearInfo = null;
  stageKillCount = 0;
  pendingStageClearAfterBuff = false;

  // 初始化教程队列
  tutorialStep = 0;
  tutorialQueue = INITIAL_TUTORIAL_STEPS.slice();
  tutorialOnFinish = 'start-game';
  helpListRects = [];

  waveActive = false; spawnQueue = [];
  waveTimer = 0; waveBreakTimer = 1.6;
  score = 0;
  gameTime = 0; banner = null;
  deadDelay = 0;   canAutoTimer = 1.5;
  airstrikeTimer = 0;
  airstrikeBombs = []; voiceCd = 0;
  nextEnemyId = 1;
  catBros = [];
  catBroSpawnCount = 0;
  catBroSelectedSkills = [];
  catBroCards = [];
  catBroTakenSkills = [];
  waveTotal = 0;
  buffChoices = []; buffCards = [];
  orbBuffGiven = false;
  forcedBuffQueue = [];
  waveClearTimer = 0;
  buffFadeIn = 0;
  pendingCritReward = false;
  isSecondPick = false;
  bubble.life = 0; bubble.text = '';
  // 读取自动释放设置
  try{ autoCast = localStorage.getItem('cat_auto_cast') === '1'; }
  catch(e){ autoCast = false; }
  autoCastAnim = autoCast ? 1 : 0;
  laser.active = false;
  laser.targets = [];
  laser.timer = 0;
  laser.dps = 0;
  laser.flash = 0;
  laser.isGold = false;
  laserCooldown = 0;
  stopBGM();
  runDamageStats = {};
  resetJoy(moveJoy, MOVE_BASE);

  generateGroundDecorations();
  updateCameraInstant();
  setBackground('grass');   // ★ 每次新开局先回到草地

  if(hasDoneTutorial()){
    // ===== 老玩家：跳过教程，直接进无尽模式 =====
    // 武器全解锁（玩家已经学过），buff 从零开始
    unlockedWeapons.can       = true;
    unlockedWeapons.orb       = true;
    unlockedWeapons.laser     = true;
    unlockedWeapons.missile   = true;
    unlockedWeapons.airstrike = true;
    recalcPlayerStats();

    currentStage = 0;        // 0 = 无尽模式
    waveInStage = 0;
    wave = 0;
    state = 'playing';
    waveBreakTimer = 1.6;
    banner = { text: '无尽模式', life: 2.0 };
    last = performance.now();
  } else {
    // ===== 新手：先走教程 =====
    state = 'tutorial';
  }
}

function generateGroundDecorations(){
  groundDecorations = [];
  const count = 320;
  for(let i = 0; i < count; i++){
    const roll = Math.random();
    let type;
    if(roll < 0.58) type = 'patch';
    else if(roll < 0.82) type = 'tuft';
    else type = 'flower';   // ★ 去掉 rock，剩余都归花朵
    groundDecorations.push({
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      type,
      scale: 0.6 + Math.random() * 0.9,
      rot: Math.random() * TAU,
      hue: Math.random()
    });
  }
}

function updateCameraInstant(){
  cam.x = clamp(player.x - W/2, 0, Math.max(0, WORLD.w - W));
  cam.y = clamp(player.y - H/2, 0, Math.max(0, WORLD.h - H));
}

function recalcPlayerStats(){
  const b = player.buffLevels;
  player.fireRate          = 0.5  / (1 + 0.28 * (b.firerate || 0));
  player.speed             = 240  * (1 + 0.18 * (b.speed || 0));
  player.bulletDamage      = 10   * (1 + 0.40 * (b.damage || 0));
  player.bulletRangeMult   = 1 + 0.40 * (b.bulletrange || 0);
  player.canDamage         = CAN_BASE_DAMAGE * (1 + 0.50 * (b.canpower || 0));
  player.laserDamage       = LASER_BASE_DAMAGE * (1 + 0.45 * (b.laserpower || 0));
  player.blastRadius       = 140  * (1 + 0.35 * (b.blast || 0));
  player.pierce            = 1 + (b.pierce || 0);
  player.multishot         = (b.multishot || 0);

  // 毛球：未解锁或被传给猫小弟则数量为 0
  if(unlockedWeapons.orb && catBroTakenSkills.indexOf('orb') < 0){
    player.orbCount = 3 + (b.orb_count || 0);
  } else {
    player.orbCount = 0;
  }
  player.orbDamage    = ORB_BASE_DAMAGE * (1 + 0.50 * (b.orb_damage || 0));
  player.orbSize      = ORB_BASE_SIZE * (1 + 0.35 * (b.orb_size || 0));
  player.orbRadius    = ORB_BASE_RADIUS * (1 + 0.20 * (b.orb_radius || 0));
  player.orbSpeedMult = 1;

  player.missileCount     = MISSILE_BASE_COUNT + (b.missile_count || 0);
  player.missileDamage    = MISSILE_BASE_DAMAGE * (1 + 0.45 * (b.missile_damage || 0));
  player.missileChargeTime= MISSILE_CHARGE_TIME / (1 + 0.28 * (b.missile_charge || 0));
  // 全屏轰炸属性
  const al = b.airstrike || 0;
  player.airstrikeLevel = al;
  player.airstrikeCount = 3 + al;                                    // 炸弹数：4~8 颗
  player.airstrikeDamage = 80 + al * 30;                             // 单发伤害：110~230
  player.airstrikeCD = 6.0 / (1 + 0.12 * (al > 0 ? al - 1 : 0));     // 冷却：6s 起步，逐级缩短

  // 生命强化：每级 +1 颗心（+4 单位）
  const newMax = 16 + 4 * (b.vitality || 0);
  player.maxHp = newMax;
  player.hp = Math.min(player.hp, player.maxHp);
}

function applyBuff(id){
  if(!id) return;
  player.buffLevels[id] = (player.buffLevels[id] || 0) + 1;
  recalcPlayerStats();
  if(id === 'vitality') player.hp = player.maxHp;
  if(id === 'orb_count' && player.buffLevels[id] === 1){
    say(randLine(LINES.orb), true);
  }
}

function rollBuffChoices(){
  const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);

  // ============ 教学关：只从对应武器池抽取 ============
  if(isTutorial){
    const cfg = STAGES[waveInStage - 1];

    // ★ 本关需要解锁武器且还没解锁 → 解锁卡 + 2 张普通卡（解锁卡放中间）
    if(cfg && cfg.unlockThisStage && !unlockedWeapons[cfg.unlockThisStage]){
      const intro = SKILL_INTROS[cfg.unlockThisStage];
      const unlockCard = {
        id: '__unlock__' + cfg.unlockThisStage,
        isUnlock: true,
        unlockKey: cfg.unlockThisStage,
        name: '解锁：' + (intro ? intro.name : cfg.unlockThisStage),
        desc: intro ? intro.detail : '',
        color: intro ? intro.color : '#ffd24a',
        max: 1
      };

      // 先抽本关 buffPool 里的普通卡（排除解锁目标）
      const poolIds = (cfg && BUFF_POOLS[cfg.buffPool]) || [];
      const stagePool = BUFFS.filter(b =>
        b.id !== cfg.unlockThisStage &&
        poolIds.indexOf(b.id) >= 0 &&
        (player.buffLevels[b.id] || 0) < b.max
      );

      // 不够 2 张就从全池补（排除已被别的池选中的）
      const fullPool = BUFFS.filter(b =>
        (player.buffLevels[b.id] || 0) < b.max
      );

      const combined = stagePool.slice();
      for(const b of fullPool){
        if(combined.length >= 2) break;
        if(combined.indexOf(b) >= 0) continue;
        combined.push(b);
      }

      // 洗牌
      for(let i = combined.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }

      const others = combined.slice(0, 2);

      // 组成：[普通, 解锁, 普通]
      if(others.length >= 2){
        return [others[0], unlockCard, others[1]];
      } else if(others.length === 1){
        return [others[0], unlockCard];
      } else {
        return [unlockCard];
      }
    }

    const poolIds = (cfg && BUFF_POOLS[cfg.buffPool]) || [];

    // 只保留"还没满级"的 buff
    const pool = BUFFS.filter(b =>
      poolIds.indexOf(b.id) >= 0 &&
      (player.buffLevels[b.id] || 0) < b.max
    );

    // 洗牌
    const copy = pool.slice();
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    // 最多取 3 张，不够就少给
    return copy.slice(0, Math.min(3, copy.length));
  }

  // ============ 无尽模式：原有逻辑 ============
  const pool = BUFFS.filter(b => (player.buffLevels[b.id] || 0) < b.max);

  // 首次进入 buff 界面：规划前 3 波的强制保底顺序
  if(!orbBuffGiven){
    orbBuffGiven = true;
    const hasOrb     = pool.find(b => b.id === 'orb_count');
    const hasFrozen  = pool.find(b => b.id === 'frozen_bullet');
    const hasAirstrike = pool.find(b => b.id === 'airstrike');

    const queue = [];
    if(hasOrb) queue.push('orb_count');

    // 冰冻弹和轰炸随机顺序
    if(hasFrozen && hasAirstrike){
      if(Math.random() < 0.5){
        queue.push('frozen_bullet');
        queue.push('airstrike');
      } else {
        queue.push('airstrike');
        queue.push('frozen_bullet');
      }
    } else if(hasFrozen){
      queue.push('frozen_bullet');
    } else if(hasAirstrike){
      queue.push('airstrike');
    }

    forcedBuffQueue = queue;
  }

  // 队列里还有保底 buff，优先出
  if(forcedBuffQueue.length > 0){
    const forcedId = forcedBuffQueue.shift();
    const forcedBuff = pool.find(b => b.id === forcedId);
    if(forcedBuff){
      const others = pool.filter(b => b.id !== forcedId);
      for(let i = others.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const result = [forcedBuff];
      for(let i = 0; i < Math.min(2, others.length); i++) result.push(others[i]);
      // 保底队列：也可以触发暴击
      if(!isSecondPick && Math.random() < BUFF_CRIT_CHANCE){
        pendingCritReward = true;
      }
      return result;
    }
  }

  // 常规随机
  const copy = pool.slice();
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const picks = copy.slice(0, 3);

  // 25% 概率触发暴击（额外再选一次），第二次抽卡不再触发
  if(!isSecondPick && Math.random() < BUFF_CRIT_CHANCE){
    pendingCritReward = true;
  }

  return picks;
}

function tryMakeDoubleBuff(pool, exclude){
  const byCategory = {};
  for(const b of pool){
    if(exclude.includes(b)) continue;
    const cat = BUFF_CATEGORY[b.id];
    if(!cat) continue;
    (byCategory[cat] = byCategory[cat] || []).push(b);
  }
  const validCats = Object.keys(byCategory).filter(c => byCategory[c].length >= 2);
  if(validCats.length === 0) return null;

  const cat = validCats[Math.floor(Math.random() * validCats.length)];
  const list = byCategory[cat].slice();
  for(let i = list.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const a = list[0], b = list[1];

  return {
    id: 'dbl_' + a.id + '_' + b.id,
    realId: a.id,
    name: a.name + ' × ' + b.name,
    desc: a.desc + ' + ' + b.desc,
    max: a.max,
    icon: a.icon,
    color: '#ffd24a',
    second: b,
    isCrit: true
  };
}

function chooseBuff(id){
  // 检查选项里是否有解锁卡
  const hasUnlockCard = buffChoices.some(c => c && c.isUnlock);

  if(hasUnlockCard){
    const choice = buffChoices.find(c => c.id === id);

    // 只有点解锁卡才响应
    if(choice && choice.isUnlock){
      unlockedWeapons[choice.unlockKey] = true;
      // ★ 冰冻弹特殊：解锁即给 Lv1
      if(choice.unlockKey === 'frozen_bullet'){
        player.buffLevels.frozen_bullet = (player.buffLevels.frozen_bullet || 0) + 1;
      }
      // ★ 罐头 / 空袭：解锁时从"刚放过"状态开始，等满一个冷却才触发
      if(choice.unlockKey === 'can')       canAutoTimer    = 0;
      if(choice.unlockKey === 'airstrike') airstrikeTimer  = 0;
      recalcPlayerStats();
      sfx('buff');
      buffFadeIn = 0;

      tutorialQueue = buildSkillIntroSteps(choice.unlockKey);
      tutorialStep = 0;
      tutorialOnFinish = 'continue-wave';
      state = 'tutorial';
      last = performance.now();
      return;
    }

    // 点了非解锁卡：不响应
    return;
  }

  try {
    const choice = buffChoices.find(c => c.id === id);
    if(choice && choice.id){
      applyBuff(choice.id);
    }
  } catch(err){
    console.warn('chooseBuff error:', err);
  }
  sfx('buff');

  // 暴击：再抽一次，界面保持 buff 状态
  if(pendingCritReward){
    pendingCritReward = false;
    isSecondPick = true;
    buffChoices = rollBuffChoices();
    if(buffChoices.length > 0){
      buffFadeIn = 0;   // 重置卡片入场动画
      last = performance.now();
      return;
    }
  }

  // 正常结束
  isSecondPick = false;

  // 教学关最后一波：选完强化后进过关弹窗
  if(pendingStageClearAfterBuff && stageClearInfo){
    pendingStageClearAfterBuff = false;
    state = 'stageclear';
    last = performance.now();
    return;
  }

  state = 'playing';
  waveBreakTimer = 1.5;
  last = performance.now();
}

// ================= 掉落物 =================
function addDrop(x, y, type){
  drops.push({
    x: clamp(x, 30, WORLD.w - 30),
    y: clamp(y, 30, WORLD.h - 30),
    vx: rand(-80, 80), vy: rand(-80, 80),
    type,
    life: DROP_DURATION, maxLife: DROP_DURATION,
    bob: Math.random() * TAU,
    r: 14
  });
}
function spawnEliteDrops(x, y){
  addDrop(x + rand(-14,14), y + rand(-14,14), randLine(HEAL_POOL));
  if(Math.random() < 0.20){
    addDrop(x + rand(-24,24), y + rand(-24,24), 'laser_charge');
  }
}
function pickupDrop(d){
  const t = DROP_TYPES[d.type];
  sfx('pickup');
  if(t.kind === 'heal'){
    const amount = t.value;   // 已经是单位数
    player.hp = Math.min(player.maxHp, player.hp + amount);
    burst(player.x, player.y, 12, t.color, 200);
    rings.push({ x:player.x, y:player.y, maxR: 42, life:0.4, t:0.4, color: t.color });
    addFloatText(player.x, player.y - 30, '+' + (amount / 4).toFixed(2), '#7ef07e', false);
    say(randLine(LINES.heal), true);
  } else if(t.kind === 'laser'){
    player.laserChargeTimer = 15;
    burst(player.x, player.y, 16, '#ffd24a', 280);
    rings.push({ x:player.x, y:player.y, maxR: 56, life:0.45, t:0.45, color: '#ffd24a' });
    say(randLine(LINES.gold), true);
  }
}
function updateDrops(dt){
  for(let i = drops.length - 1; i >= 0; i--){
    const d = drops[i];
    d.life -= dt;
    d.bob += dt * 3.5;
    if(d.life <= 0){ drops.splice(i, 1); continue; }

    const dx = player.x - d.x, dy = player.y - d.y;
    const dist = Math.hypot(dx, dy) || 0.001;

    if(dist < 130){
      const pull = 420 * dt / dist;
      d.x += dx * pull; d.y += dy * pull;
    } else {
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 0.93; d.vy *= 0.93;
    }
    d.x = clamp(d.x, 20, WORLD.w - 20);
    d.y = clamp(d.y, 20, WORLD.h - 20);

    if(dist < player.r + d.r){
      pickupDrop(d);
      drops.splice(i, 1);
    }
  }
}

// ================= 波次 =================
function pickType(n){
  const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);

  if(isTutorial){
    // 教学关按波次逐步解锁怪（前 2 波只有 zombie）
    const pool = [['zombie', 100]];
    if(waveInStage >= 3) pool[0] = ['zombie', 70];
    if(waveInStage >= 3) pool.push(['runner', 40]);   // 第 3 波起才有高速怪
    if(waveInStage >= 4) pool.push(['spitter', 15]);
    if(waveInStage >= 5) pool.push(['skeleton', 20]);
    if(waveInStage >= 6) pool.push(['brute', 12]);
    if(waveInStage >= 7) pool.push(['armored', 8]);
    if(waveInStage >= 7) pool.push(['elite', 5]);
    let total = 0;
    for(const p of pool) total += p[1];
    let r = Math.random() * total;
    for(const p of pool){ r -= p[1]; if(r <= 0) return p[0]; }
    return 'zombie';
  }

  // 无尽模式
  const pool = [['zombie', 60]];
  if(n >= 5) pool.push(['runner', 32]);
  if(n >= 7) pool.push(['skeleton', 22]);
  if(n >= 10) pool.push(['spitter', 16]);
  if(n >= 15) pool.push(['brute', 14]);
  if(n >= 15) pool.push(['armored', 10]);
  if(n >= 5) pool.push(['elite', 6]);
  let total = 0;
  for(const p of pool) total += p[1];
  let r = Math.random() * total;
  for(const p of pool){ r -= p[1]; if(r <= 0) return p[0]; }
  return 'zombie';
}
function startWave(n){
  waveActive = true;

  const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);
  let bannerText;

  if(isTutorial){
    const wcfg = TUTORIAL_WAVES[waveInStage - 1];
    spawnQueue = [];
    if(wcfg && wcfg.list){
      let types = wcfg.list.slice();
      if(wcfg.shuffle){
        for(let i = types.length - 1; i > 0; i--){
          const j = Math.floor(Math.random() * (i + 1));
          [types[i], types[j]] = [types[j], types[i]];
        }
      }
      for(let i = 0; i < types.length; i++){
        spawnQueue.push({ type: types[i], t: i * wcfg.interval });
      }
      waveTotal = types.length;
    } else {
      waveTotal = 0;
    }
    waveSpawn.active = false;
    bannerText = '教学 · 第 ' + waveInStage + ' / ' + STAGE_WAVES + ' 波';
  } else {
    // 无尽模式：3 阶段生成
    const totalCount = getEndlessCount(n);
    const targetDuration = getEndlessDuration(n);
    const perStage = Math.ceil(totalCount / 3);
    const lastStageCount = totalCount - perStage * 2;
    const stageDuration = targetDuration / 3;

    waveSpawn.active = true;
    waveSpawn.currentStage = 0;
    waveSpawn.stageTimer = 0;
    waveSpawn.stageDuration = stageDuration;
    waveSpawn.stagePools = [
      { remaining: perStage },
      { remaining: perStage },
      { remaining: Math.max(0, lastStageCount) }
    ];
    waveSpawn.totalSpawned = 0;
    waveSpawn.totalTarget = totalCount;
    waveSpawn.wave = n;
    waveSpawn.spawnTimer = 0;

    waveTotal = totalCount;
    bannerText = '第 ' + n + ' 波  ·  ' + totalCount + ' 只';

    const idx = Math.floor((Math.max(1, n) - 1) / 5) % ENDLESS_BACKGROUNDS.length;
    setBackground(ENDLESS_BACKGROUNDS[idx]);
  }

  waveTimer = 0;
  banner = { text: bannerText, life: 2.0 };
  saveProgress();
}

// ============ 无尽模式刷怪推进 ============
function updateSpawning(dt){
  if(!waveSpawn.active) return;

  const pool = waveSpawn.stagePools[waveSpawn.currentStage];
  if(!pool) return;

  waveSpawn.stageTimer += dt;

  const stageTimeUp = waveSpawn.stageTimer >= waveSpawn.stageDuration;
  const stageClear  = pool.remaining === 0 && enemies.length === 0;

  if((stageTimeUp || stageClear) && waveSpawn.currentStage < waveSpawn.stagePools.length - 1){
    const next = waveSpawn.stagePools[waveSpawn.currentStage + 1];
    if(pool.remaining > 0){
      next.remaining += pool.remaining;
      pool.remaining = 0;
    }
    waveSpawn.currentStage++;
    waveSpawn.stageTimer = 0;
    return;
  }

  if(pool.remaining > 0 && enemies.length < MAX_ENEMIES_ON_FIELD){
    waveSpawn.spawnTimer -= dt;
    if(waveSpawn.spawnTimer <= 0){
      spawnEnemy(pickType(waveSpawn.wave));
      pool.remaining--;
      waveSpawn.totalSpawned++;
      waveSpawn.spawnTimer = 0.2;
    }
  }
}

function isWaveClear(){
  if(!waveSpawn.active) return false;
  const lastIdx = waveSpawn.stagePools.length - 1;
  if(waveSpawn.currentStage < lastIdx) return false;
  const lastPool = waveSpawn.stagePools[lastIdx];
  return lastPool.remaining === 0 && enemies.length === 0;
}

function spawnEnemy(type){
  const base = ENEMY_TYPES[type];

  let x = rand(150, WORLD.w - 150);
  let y = -60 - rand(0, 80);

  const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);
  let hpScale, spScale, dmgScale;

  if(isTutorial){
    // 教学关：每只怪 HP 固定，不随波次成长
    const TUT_HP = {
      zombie: 40, runner: 40, spitter: 80,
      skeleton: 120, brute: 250,
      armored: 400, elite: 600
    };
    const thp = TUT_HP[type] !== undefined ? TUT_HP[type] : 40;
    hpScale = thp / base.hp;
    spScale = 1.0;
    dmgScale = 1.0;
  } else {
    const w = Math.max(1, wave);
    hpScale = getEndlessHpScale(w);
    spScale = getEndlessSpScale(w);
    dmgScale = getEndlessDmgScale(w);
  }

  const e = {
    id: nextEnemyId++,
    x, y, r: base.r,
    hp: base.hp * hpScale, maxHp: base.hp * hpScale,
    speed: base.speed * spScale,
    dmg: base.dmg * dmgScale, color: base.color, type,
    bulletMult: base.bulletMult !== undefined ? base.bulletMult : 1.0,
    meleeMult: base.meleeMult !== undefined ? base.meleeMult : 1.0,
    canMult: base.canMult !== undefined ? base.canMult : 1.0,
    laserMult: base.laserMult !== undefined ? base.laserMult : 1.0,
    missileMult: base.missileMult !== undefined ? base.missileMult : 1.0,
    airstrikeMult: base.airstrikeMult !== undefined ? base.airstrikeMult : 1.0,
    elite: !!base.elite, armored: !!base.armored,
    skeleton: !!base.skeleton, demon: !!base.demon,
    angle: 0, atkCd: 0, hitFlash: 0, slowTimer: 0, frozenTimer: 0,
    ranged: !!base.ranged, shootCd: rand(1, 2.5),
    // 护盾
    shieldMax: 0, shield: 0, shieldMult: null, shieldBroken: false
  };

 if(base.armored && base.shieldBaseHP){
    if(isTutorial){
      e.shieldMax = 200;   // 教学关固定：罐头一发破 / 导弹两发破
    } else {
      e.shieldMax = base.shieldBaseHP * hpScale;
    }
    e.shield = e.shieldMax;
    e.shieldMult = base.shieldMult;
  }

  enemies.push(e);
}

// ================= 特效 =================
function burst(x, y, n, color, spd){
  for(let i = 0; i < n; i++){
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.2, 0.5), maxLife: 0.5,
      r: rand(1.5, 3.6), color
    });
  }
}


// ================= 毛球 =================
function updateOrbs(dt){
  if(player.orbCount <= 0) return;

  player.orbAngle += dt * ORB_BASE_SPEED * player.orbSpeedMult * TAU;

  const count = player.orbCount;
  const r = player.orbRadius;
  const size = player.orbSize;

  if(player.orbHitCd.size > 400){
    const cutoff = gameTime - 1.5;
    for(const [k, t] of player.orbHitCd){
      if(t < cutoff) player.orbHitCd.delete(k);
    }
  }

  for(let i = 0; i < count; i++){
    const a = player.orbAngle + i * TAU / count;
    const ox = player.x + Math.cos(a) * r;
    const oy = player.y + Math.sin(a) * r;

    // 命中敌人
    for(const e of enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x - ox, e.y - oy) < e.r + size){
        const last = player.orbHitCd.get(e.id) || 0;
        if(gameTime - last >= ORB_HIT_CD){
          player.orbHitCd.set(e.id, gameTime);
          dealDamage(e, player.orbDamage, 'orb');

          const ka = Math.atan2(e.y - player.y, e.x - player.x);
          e.x += Math.cos(ka) * ORB_KNOCKBACK;
          e.y += Math.sin(ka) * ORB_KNOCKBACK;

          burst(ox, oy, 5, '#ffb0d0', 160);
          burst(e.x, e.y, 4, '#ffd0e0', 120);
          sfx('orb');
          if(e.hp <= 0) killEnemy(e);
        }
      }
    }

    // 击落敌方子弹
    for(let k = eBullets.length - 1; k >= 0; k--){
      const b = eBullets[k];
      if(Math.hypot(b.x - ox, b.y - oy) < b.r + size){
        burst(b.x, b.y, 8, '#ffb0d0', 220);
        burst(b.x, b.y, 4, '#ffffff', 160);
        rings.push({ x:b.x, y:b.y, maxR: 24, life:0.25, t:0.25, color:'#ffb0d0' });
        eBullets.splice(k, 1);
      }
    }
  }
}

function drawOrbs(){
  if(!player || player.orbCount <= 0) return;
  const count = player.orbCount;
  const r = player.orbRadius;
  const size = player.orbSize;

  for(let i = 0; i < count; i++){
    const a = player.orbAngle + i * TAU / count;
    const ox = player.x + Math.cos(a) * r;
    const oy = player.y + Math.sin(a) * r;
    drawSingleOrb(ox, oy, size);
  }
}
function drawSingleOrb(ox, oy, radius){
  const pulse = 0.5 + Math.sin(gameTime * 8 + ox * 0.1) * 0.5;
  ctx.fillStyle = 'rgba(255, 176, 208, ' + (0.22 + pulse * 0.14) + ')';
  ctx.beginPath();
  ctx.arc(ox, oy, radius * 1.9, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#ffa0c8';
  const spikes = 8;
  for(let i = 0; i < spikes; i++){
    const a = i * TAU / spikes + gameTime * 3;
    const px = ox + Math.cos(a) * radius * 0.82;
    const py = oy + Math.sin(a) * radius * 0.82;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.42, 0, TAU);
    ctx.fill();
  }

  const grd = ctx.createRadialGradient(ox - radius * 0.3, oy - radius * 0.3, 0, ox, oy, radius);
  grd.addColorStop(0, '#ffe0ec');
  grd.addColorStop(0.6, '#ffb0d0');
  grd.addColorStop(1, '#e080a8');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(ox, oy, radius, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(ox - radius * 0.32, oy - radius * 0.32, radius * 0.25, 0, TAU);
  ctx.fill();
}

// ================= 导弹 =================
function findHighestHpEnemy(){
  let best = null, bestHp = -1;
  for(const e of enemies){
    if(e.dead) continue;
    if(e.hp > bestHp){ bestHp = e.hp; best = e; }
  }
  return best;
}

function fireMissile(){
  if(state !== 'playing' || !player) return;
  if(!unlockedWeapons.missile) return;
  if(catBroTakenSkills.indexOf('missile') >= 0) return;
  if(player.missileCharges <= 0) return;
  if(enemies.length === 0) return;

  player.missileCharges--;
  const count = player.missileCount;

  for(let i = 0; i < count; i++){
    const a = (i / count) * TAU + Math.random() * 0.4;
    const sx = player.x + Math.cos(a) * 18;
    const sy = player.y + Math.sin(a) * 18;
    const target = findHighestHpEnemy();
    if(!target) break;

    const dirA = Math.atan2(target.y - sy, target.x - sx);
    missileList.push({
      x: sx, y: sy,
      vx: Math.cos(dirA) * MISSILE_SPEED,
      vy: Math.sin(dirA) * MISSILE_SPEED,
      targetId: target.id,
      damage: player.missileDamage,
      life: 3.5,
      trail: []
    });
  }

  say(randLine(LINES.missile), true);
  sfx('missile');
  cam.shake = Math.max(cam.shake, 6);
  rings.push({ x:player.x, y:player.y, maxR: 60, life:0.35, t:0.35, color:'#ff8a3c' });
}

function updateMissiles(dt){
  if(player.missileCharges < player.missileChargeMax){
    player.missileChargeTimer += dt;
    if(player.missileChargeTimer >= player.missileChargeTime){
      player.missileChargeTimer -= player.missileChargeTime;
      player.missileCharges++;
    }
  } else {
    player.missileChargeTimer = 0;
  }

  for(let i = missileList.length - 1; i >= 0; i--){
    const m = missileList[i];
    m.life -= dt;
    if(m.life <= 0){ missileList.splice(i, 1); continue; }

    let target = null;
    for(const e of enemies){
      if(e.id === m.targetId && !e.dead){ target = e; break; }
    }
    if(!target){
      // 目标死：只在附近、前方锥形范围找新目标，否则直飞
      const curA = Math.atan2(m.vy, m.vx);
      let best = null, bestScore = 1e9;
      for(const e of enemies){
        if(e.dead) continue;
        const dx = e.x - m.x, dy = e.y - m.y;
        const d = Math.hypot(dx, dy);
        if(d > 360) continue;
        const ea = Math.atan2(dy, dx);
        let da = ea - curA;
        while(da >  Math.PI) da -= TAU;
        while(da < -Math.PI) da += TAU;
        if(Math.abs(da) > Math.PI * 0.5) continue;
        const score = d + Math.abs(da) * 180;
        if(score < bestScore){ bestScore = score; best = e; }
      }
      if(best){ target = best; m.targetId = best.id; }
      else { m.targetId = null; }
    }

    if(target){
      const dx = target.x - m.x, dy = target.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetA = Math.atan2(dy, dx);
      const curA = Math.atan2(m.vy, m.vx);
      let da = targetA - curA;
      while(da >  Math.PI) da -= TAU;
      while(da < -Math.PI) da += TAU;

      // 距离越近，转向越猛（防止绕圈）
      let turnRate;
      if(d < 120) turnRate = 20;      // 贴脸时几乎瞬间对准
      else if(d < 260) turnRate = 14; // 中距离灵活追击
      else turnRate = 8;              // 远距离正常转向

      const newA = curA + da * Math.min(1, dt * turnRate);
      m.vx = Math.cos(newA) * MISSILE_SPEED;
      m.vy = Math.sin(newA) * MISSILE_SPEED;
    }

    m.x += m.vx * dt;
    m.y += m.vy * dt;

    m.trail.push({ x: m.x, y: m.y, life: 0.25 });
    if(m.trail.length > 12) m.trail.shift();
    for(let k = m.trail.length - 1; k >= 0; k--){
      m.trail[k].life -= dt;
      if(m.trail[k].life <= 0) m.trail.splice(k, 1);
    }

    let hit = false;
    for(const e of enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x - m.x, e.y - m.y) < e.r + 20){
        dealDamage(e, m.damage, 'missile');
        burst(m.x, m.y, 14, '#ff8a3c', 320);
        burst(m.x, m.y, 6, '#ffe0a0', 200);
        rings.push({ x:m.x, y:m.y, maxR: 46, life:0.35, t:0.35, color:'#ff8a3c' });
        cam.shake = Math.max(cam.shake, 7);
        if(e.hp <= 0) killEnemy(e);
        hit = true;
        break;
      }
    }
    if(hit){ missileList.splice(i, 1); continue; }

    if(m.x < -50 || m.y < -50 || m.x > WORLD.w + 50 || m.y > WORLD.h + 50){
      missileList.splice(i, 1);
    }
  }
}

function drawMissiles(){
  for(const m of missileList){
    for(const t of m.trail){
      const a = Math.max(0, t.life / 0.25);
      ctx.fillStyle = 'rgba(255, 140, 60,' + (a * 0.55) + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 7 * a, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(m.x, m.y);
    const ang = Math.atan2(m.vy, m.vx);
    ctx.rotate(ang);

    ctx.fillStyle = 'rgba(255, 180, 60, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.lineTo(-18 - Math.random() * 4, 0);
    ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(8, -3);
    ctx.lineTo(12, 0);
    ctx.lineTo(8, 3);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a2010';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath();
    ctx.arc(9, 0, 2.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}

// ================= 罐头 =================
function tryThrowCan(){
  if(state !== 'playing' || !player) return false;
  if(!unlockedWeapons.can) return false;
  if(catBroTakenSkills.indexOf('can') >= 0) return false;
  let best = null, bd = 1e9;
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if(d < bd){ bd = d; best = e; }
  }
  if(!best || bd > 900) return false;

  // 直接投到敌人当前位置（带一点随机偏移，避免每次都完全重合）
  const tx = best.x + rand(-15, 15);
  const ty = best.y + rand(-15, 15);

  cans.push({
    sx: player.x, sy: player.y, tx, ty,
    x: player.x, y: player.y, z: 0,
    t: 0, dur: 0.44, spin: 0
  });
  if(Math.random() < 0.5) say(randLine(LINES.can), true);
  return true;
}
function explodeCan(c){
  const isFromBro = !!c.fromCatBro;
  const R   = player.blastRadius * (isFromBro ? 0.85 : 1);
  const DMG = player.canDamage   * (isFromBro ? 0.6  : 1);
  rings.push({ x: c.tx, y: c.ty, maxR: R, life: 0.45, t: 0.45, color: '#ffcf5c' });
  cam.shake = Math.max(cam.shake, 14);
  sfx('boom');
  burst(c.tx, c.ty, 36, '#ffcf5c', 390);
  burst(c.tx, c.ty, 20, '#ff8a3c', 270);

  burnMarks.push({ x:c.tx, y:c.ty, r: R*0.9, life:6, maxLife:6, seed: Math.random()*1000 });
  burnMarks.push({ x:c.tx + rand(-6,6), y:c.ty + rand(-6,6),
                   r: R*0.45, life:6, maxLife:6, seed: Math.random()*1000 });

  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - c.tx, e.y - c.ty);
    if(d < R + e.r){
      const k = 1 - d / (R + e.r);
      const dmg = DMG * (0.55 + k * 0.45);
      dealDamage(e, dmg, 'can');
      burst(e.x, e.y, 6, '#ffb84a', 220);
      if(e.hp <= 0) killEnemy(e, false);
    }
  }
}

function killEnemy(e, giveEnergy){
  if(e.dead) return;
  e.dead = true;
  score += 10 + Math.floor(e.maxHp / 8);
  stageKillCount++;
  burst(e.x, e.y, 16, e.color, 220);
  burst(e.x, e.y, 8, '#c94a4a', 180);
  if(e.elite){
    rings.push({ x:e.x, y:e.y, maxR: 70, life:0.5, t:0.5,
                 color: e.demon ? '#ff5a3c' : '#c8d0c8' });
    spawnEliteDrops(e.x, e.y);
  }
}

// ================= 激光 =================
function findNearestEnemies(count, excludeIds){
  const arr = [];
  for(const e of enemies){
    if(e.dead) continue;
    if(excludeIds && excludeIds.has(e.id)) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    arr.push({ e, d });
  }
  arr.sort((a, b) => a.d - b.d);
  return arr.slice(0, count).map(item => item.e);
}

let laserCooldown = 0;          // 当前剩余冷却
const LASER_COOLDOWN_MAX = 10;  // 冷却总时长

function fireLaser(){
  if(state !== 'playing' || !player) return;
  if(!unlockedWeapons.laser) return;
  if(catBroTakenSkills.indexOf('laser') >= 0) return;
  if(laser.active) return;
  if(laserCooldown > 0) return;
  if(enemies.length === 0) return;

  laserCooldown = LASER_COOLDOWN_MAX;
  laser.active = true;
  laser.targets = [];
  laser.timer = 0;
  laser.dps = player.laserDamage * 0.35;
  laser.flash = 1;
  laser.isGold = player.laserChargeTimer > 0;

  say(randLine(LINES.laser), true);
  cam.shake = Math.max(cam.shake, laser.isGold ? 14 : 10);
  sfx('laser');
}

function updateLaser(dt){
  if(laser.flash > 0) laser.flash = Math.max(0, laser.flash - dt * 3);
  if(!laser.active) return;

  // 实时检测激光充能状态，中途拾取立即生效
  const shouldGold = player.laserChargeTimer > 0;
  if(shouldGold !== laser.isGold){
    laser.isGold = shouldGold;
    laser.dps = player.laserDamage * 0.35;   // 金色时伤害翻倍，由下面 isGold 判定
    // 视觉反馈：闪一下，让玩家知道金色激光生效了
    laser.flash = 1;
    rings.push({
      x: player.x, y: player.y,
      maxR: 80, life: 0.4, t: 0.4,
      color: '#ffd24a'
    });
    burst(player.x, player.y, 20, '#ffd24a', 320);
    say(randLine(LINES.goldswitch), true);
  }

  laser.timer += dt;

  // 最多同时锁定的目标数：基础 1 + buff + 金色激光额外 +1
  const bonusCount = player.buffLevels.laser_count || 0;
  const maxTargets = 1 + bonusCount + (laser.isGold ? 1 : 0);

  // 清理已死目标
  for(let i = laser.targets.length - 1; i >= 0; i--){
    const t = laser.targets[i];
    let alive = false;
    for(const e of enemies){
      if(e.id === t.id && !e.dead){ alive = true; break; }
    }
    if(!alive) laser.targets.splice(i, 1);
  }

  // 补足目标
  while(laser.targets.length < maxTargets){
    const usedIds = new Set(laser.targets.map(t => t.id));
    const next = findNearestEnemies(1, usedIds)[0];
    if(!next) break;
    laser.targets.push({ id: next.id, dmgAccum: 0, floatTimer: 0 });
  }

  // 对每个目标造成伤害
  for(const t of laser.targets){
    let target = null;
    for(const e of enemies){
      if(e.id === t.id && !e.dead){ target = e; break; }
    }
    if(!target) continue;

    const rawDmg = laser.dps * dt * (laser.isGold ? 2.0 : 1.0);
    const lType = laser.isGold ? 'laserGold' : 'laser';
    // 静默造成伤害（不触发暴击/飘字，护盾和克制倍率照常）
    dealDamage(target, rawDmg, 'laser', { silent: true, noCrit: true });
    target.slowTimer = 0.25;

    t.dmgAccum += rawDmg;
    t.floatTimer += dt;
    if(t.floatTimer >= 0.2){
      const col = laser.isGold ? '#ffd24a' : '#88eeff';
      addFloatText(target.x, target.y - target.r - 6, Math.round(t.dmgAccum), col, false);
      t.dmgAccum = 0;
      t.floatTimer = 0;
    }

    if(Math.random() < dt * 40){
      burst(target.x + rand(-8,8), target.y + rand(-8,8), 2,
            laser.isGold ? '#ffd24a' : '#88eeff', 160);
    }

    if(target.hp <= 0) killEnemy(target);
  }

  cam.shake = Math.max(cam.shake, 1.5);

  if(laser.timer >= laser.duration){
    laser.active = false;
    laser.targets = [];
  }
}

function damagePlayer(d){
  if(player.invuln > 0 || state !== 'playing') return;
  player.hp -= d;
  player.invuln = 0.3;
  cam.shake = Math.max(cam.shake, 9);
  sfx('hurt');
  say(randLine(LINES.hurt), false);
  addFloatText(player.x, player.y - 30, '-' + (d / 4).toFixed(2), '#ff5b5b', false);
  if(player.hp <= 0){
    player.hp = 0;
    state = 'dead';
    deadDelay = 1.0;
    recordRun();
    clearProgress();
    burst(player.x, player.y, 44, '#ff7b4a', 330);
    cam.shake = 24;
  }
}

// ================= 更新 =================
function updateCamera(dt){
  const tx = clamp(player.x - W/2, 0, Math.max(0, WORLD.w - W));
  const ty = clamp(player.y - H/2, 0, Math.max(0, WORLD.h - H));
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 8));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 8));
  cam.shake = Math.max(0, cam.shake - dt * 46);
}
function updateEffects(dt){
  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
    if(p.life <= 0) particles.splice(i, 1);
  }
  for(let i = rings.length - 1; i >= 0; i--){
    rings[i].life -= dt;
    if(rings[i].life <= 0) rings.splice(i, 1);
  }
  for(let i = burnMarks.length - 1; i >= 0; i--){
    burnMarks[i].life -= dt;
    if(burnMarks[i].life <= 0) burnMarks.splice(i, 1);
  }
  if(banner){
    banner.life -= dt;
    if(banner.age === undefined) banner.age = 0;
    banner.age += dt;
    if(banner.life <= 0) banner = null;
  }
  if(bubble.life > 0) bubble.life -= dt;
  if(voiceCd > 0) voiceCd -= dt;
  updateFloatTexts(dt);
}

function update(dt){
  // 音频电平采样
  if(analyser){
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let max = 0;
    for(let i = 0; i < data.length; i++){
      const v = Math.abs(data[i] - 128);
      if(v > max) max = v;
    }
    const target = max / 128;
    audioLevel = audioLevel * 0.7 + target * 0.3;
  }

  // 技能 tips 淡入进度（不自动消失，点击别处才关）
  if(skillTip.type){
    skillTip.fade = Math.min(1, (skillTip.fade || 0) + dt * 5);
  }

  // BGM 与游戏状态同步
  syncBGM();

  // 强化卡淡入进度
  if(state === 'buff'){
    buffFadeIn = Math.min(1, buffFadeIn + dt * 3);
  }

  if(state !== 'playing'){
    if(cam) cam.shake = Math.max(0, cam.shake - dt * 46);

    if(state === 'boot' || state === 'menu' || state === 'catselect' ||
       state === 'help' || state === 'victory' ||
       state === 'stageclear' || state === 'tutorial' || state === 'catbro'){
      gameTime += dt;
    }

    if(state === 'menu' || state === 'catselect'){
      menuTime += dt;
      menuEnterT = Math.min(1, menuEnterT + dt * 1.5);
    }
    if(menuToast.life > 0) menuToast.life -= dt;

    if(state === 'dead'){
      gameTime += dt;
      updateEffects(dt);
      updateDrops(dt);
      if(deadDelay > 0) deadDelay -= dt;
    }
    return;
  }

  gameTime += dt;
  updateEffects(dt);

  // 长按检测
  if(pressState.laserHold){
    pressState.laserTimer += dt;
    if(pressState.laserTimer >= SKILL_TIP_LONGPRESS){
      if(skillTip.type !== 'laser') skillTip = { type: 'laser', fade: 0 };
    }
  }
  if(pressState.missileHold){
    pressState.missileTimer += dt;
    if(pressState.missileTimer >= SKILL_TIP_LONGPRESS){
      if(skillTip.type !== 'missile') skillTip = { type: 'missile', fade: 0 };
    }
  }

  // 自动释放滑块动画
  const targetAnim = autoCast ? 1 : 0;
  autoCastAnim += (targetAnim - autoCastAnim) * Math.min(1, dt * 12);
  if(Math.abs(targetAnim - autoCastAnim) < 0.005) autoCastAnim = targetAnim;

  if(player.laserChargeTimer > 0) player.laserChargeTimer = Math.max(0, player.laserChargeTimer - dt);
  if(laserCooldown > 0) laserCooldown = Math.max(0, laserCooldown - dt);
  if(player.recoil > 0) player.recoil = Math.max(0, player.recoil - dt);

  updateDrops(dt);

  canAutoTimer += dt;
  if(canAutoTimer >= CAN_AUTO_INTERVAL){
    if(tryThrowCan()) canAutoTimer = 0;
  }

  // ===== 自动释放技能 =====
  if(autoCast && enemies.length > 0){
    // 自动激光
    if(!laser.active && laserCooldown <= 0){
      fireLaser();
    }
    // 自动导弹：附近至少 2 只敌人才放
    if(player.missileCharges > 0 && enemies.length >= 2){
      let nearCount = 0;
      for(const e of enemies){
        if(Math.hypot(e.x - player.x, e.y - player.y) < 500) nearCount++;
      }
      if(nearCount >= 2) fireMissile();
    }
  }


  let mx = 0, my = 0;
  let kx = 0, ky = 0;
  if(isDown('w','arrowup','keyw'))    ky -= 1;
  if(isDown('s','arrowdown','keys'))  ky += 1;
  if(isDown('a','arrowleft','keya'))  kx -= 1;
  if(isDown('d','arrowright','keyd')) kx += 1;

  if(kx || ky){
    const kl = Math.hypot(kx, ky);
    mx = kx / kl; my = ky / kl;
  } else if(moveJoy.id !== -1){
    const mag = Math.hypot(moveJoy.dx, moveJoy.dy);
    if(mag > 0.15){
      const sp = Math.min(1, (mag - 0.15) / 0.55);
      mx = (moveJoy.dx / mag) * sp;
      my = (moveJoy.dy / mag) * sp;
    }
  }

  player.x = clamp(player.x + mx * player.speed * dt, player.r, WORLD.w - player.r);
  player.y = clamp(player.y + my * player.speed * dt, player.r, WORLD.h - player.r);
  player.invuln = Math.max(0, player.invuln - dt);

  updateCamera(dt);

  let nearest = null, nearestD = 1e9;
  let gunTarget = null, gunTargetD = 1e9;
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if(d < nearestD){ nearestD = d; nearest = e; }
    const bm = e.bulletMult !== undefined ? e.bulletMult : 1.0;
    if(bm > 0.5 && d < gunTargetD){ gunTargetD = d; gunTarget = e; }
  }
  if(!gunTarget && nearest){ gunTarget = nearest; gunTargetD = nearestD; }

  if(nearest && nearestD < 1000){
    const targetAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    let da = targetAngle - player.facing;
    while(da >  Math.PI) da -= TAU;
    while(da < -Math.PI) da += TAU;
    player.facing += da * Math.min(1, dt * 24);
  }

  updateOrbs(dt);
  updateCatBro(dt);

  player.fireCd -= dt;
  const FIRE_RANGE = FIRE_BASE_RANGE * player.bulletRangeMult;
  const bulletLife = 2.0 * player.bulletRangeMult;
  if(gunTarget && gunTargetD < FIRE_RANGE && player.fireCd <= 0){
    player.fireCd = player.fireRate;
    player.recoil = 0.08;
    const shots = 1 + player.multishot;

    const targets = [gunTarget];
    if(shots > 1){
      const others = [];
      for(const e of enemies){
        if(e.dead || e.id === gunTarget.id) continue;
        others.push(e);
      }
      others.sort((a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) -
        Math.hypot(b.x - player.x, b.y - player.y)
      );
      for(let i = 0; i < shots - 1; i++){
        targets.push(others[i] || gunTarget);
      }
    }

    const facingLeft = Math.cos(player.facing) < 0;
    const MUZZLE_X = 30;
    const MUZZLE_Y = 4;

    for(let s = 0; s < shots; s++){
      const tgt = targets[s];

      const mzX = player.x + (facingLeft ? -MUZZLE_X : MUZZLE_X);
      const mzY = player.y + MUZZLE_Y;

      // ★ 从枪口位置算角度（而不是从玩家中心算）
      const aimAngle = Math.atan2(tgt.y - mzY, tgt.x - mzX);
      const a = aimAngle + rand(-0.025, 0.025);

      bullets.push({
        x: mzX, y: mzY,
        vx: Math.cos(a) * 740, vy: Math.sin(a) * 740,
        r: 4.5, dmg: player.bulletDamage, life: bulletLife,
        pierce: player.pierce, hitSet: null,
        targetId: BULLET_HOMING ? tgt.id : null,
        homingTimer: 0,
        homingDelay: 0.08
      });
    }

    const muzzleA = Math.atan2(gunTarget.y - player.y, gunTarget.x - player.x);
    for(let i = 0; i < 3; i++){
      const pa = muzzleA + rand(-0.6, 0.6);
      const mzX = player.x + Math.cos(muzzleA) * (player.r + 8);
      const mzY = player.y + Math.sin(muzzleA) * (player.r + 8);
      particles.push({
        x: mzX, y: mzY,
        vx: Math.cos(pa) * rand(60, 170),
        vy: Math.sin(pa) * rand(60, 170),
        life: 0.14, maxLife: 0.14, r: rand(1.5, 3), color: '#d9a441'
      });
    }
    sfx('shoot');
  }

  for(let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if(b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.w || b.y > WORLD.h){
      bullets.splice(i, 1); continue;
    }

    // 追踪：先直飞一小段，然后朝目标转弯
    if(b.targetId !== null && b.targetId !== undefined){
      b.homingTimer += dt;

      // 追踪超时：放宽到 1.8 秒
      if(b.homingTimer > b.homingDelay + 1.8){
        b.targetId = null;
      } else if(b.homingTimer >= b.homingDelay){
        let tgt = null;
        for(const e of enemies){
          if(e.id === b.targetId && !e.dead){ tgt = e; break; }
        }
        if(!tgt){
          b.targetId = null;
        } else {
          const dx = tgt.x - b.x;
          const dy = tgt.y - b.y;
          const distToTgt = Math.hypot(dx, dy);

          // 已经飞过头：距离超过 500 才放弃
          if(distToTgt > 500){
            b.targetId = null;
          } else {
            const targetA = Math.atan2(dy, dx);
            const curA = Math.atan2(b.vy, b.vx);
            let da = targetA - curA;
            while(da >  Math.PI) da -= TAU;
            while(da < -Math.PI) da += TAU;

            // 距离越近，转弯越猛（防止绕圈）
            let turnSpeed;
            if(distToTgt < 80)       turnSpeed = 40;
            else if(distToTgt < 180) turnSpeed = 25;
            else if(distToTgt < 350) turnSpeed = 16;
            else                     turnSpeed = 10;

            const maxTurn = turnSpeed * dt;
            const newA = curA + Math.sign(da) * Math.min(Math.abs(da), maxTurn);
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(newA) * spd;
            b.vy = Math.sin(newA) * spd;
          }
        }
      }
    }

    let remove = false;
    for(const e of enemies){
      if(e.dead) continue;
      if(b.hitSet && b.hitSet.has(e.id)) continue;
      if(Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r + 6){
        const bm = e.bulletMult !== undefined ? e.bulletMult : 1.0;
        dealDamage(e, b.dmg * bm, 'bullet');
        burst(b.x, b.y, 4, '#e8c46a', 150);
        sfx('hit');

        // 冰冻弹判定
        const fl = player.buffLevels.frozen_bullet || 0;
        if(fl > 0 && e.frozenTimer <= 0){
          let chance = 0.15 + 0.10 * fl;
          if(e.demon) chance *= 0.35;
          else if(e.armored) chance *= 0.55;
          else if(e.type === 'runner') chance *= 2.0;
          chance = Math.min(1, chance);
          if(Math.random() < chance){
            e.frozenTimer = 3.0;
            burst(e.x, e.y, 14, '#a0e8ff', 300);
            rings.push({ x:e.x, y:e.y, maxR: 42, life:0.4, t:0.4, color:'#a0e8ff' });
            addFloatText(e.x, e.y - e.r - 22, '冰冻!', '#a0e8ff', false);
          }
        }

        if(e.hp <= 0) killEnemy(e);
        b.pierce--;
        if(b.pierce <= 0){ remove = true; break; }
        if(!b.hitSet) b.hitSet = new Set();
        b.hitSet.add(e.id);
      }
    }
    if(remove) bullets.splice(i, 1);
  }

  for(const e of enemies){
    if(e.dead) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if(e.frozenTimer <= 0){
      e.atkCd -= dt;
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
    }

    // 减速 / 冰冻计时
    if(e.slowTimer > 0) e.slowTimer -= dt;
    if(e.frozenTimer > 0) e.frozenTimer -= dt;
    const frozen = e.frozenTimer > 0;
    const slowMul = frozen ? 0 : (e.slowTimer > 0 ? 0.35 : 1);

    if(frozen){
      // 冰冻：不移动、不攻击，冒寒气粒子
      if(Math.random() < dt * 25){
        burst(e.x + rand(-8,8), e.y + rand(-8,8), 1, '#a0e8ff', 60);
      }
    } else if(e.ranged){
      const KEEP_MIN = 420;
      const KEEP_MAX = 620;
      if(d > KEEP_MAX){
        // 远距离也先直走，接近到 700 才开始朝玩家移动
        const RANGED_TRACK = 700;
        let moveAngle = e.angle;
        if(d > RANGED_TRACK){
          moveAngle = Math.PI / 2;
        }
        e.x += Math.cos(moveAngle) * e.speed * slowMul * dt;
        e.y += Math.sin(moveAngle) * e.speed * slowMul * dt;
      } else if(d < KEEP_MIN){
        const oldY = e.y;
        e.x -= Math.cos(e.angle) * e.speed * 0.7 * slowMul * dt;
        e.y -= Math.sin(e.angle) * e.speed * 0.7 * slowMul * dt;
        if(e.y < 80){
          e.y = Math.max(80, oldY);
        }
      }
      e.shootCd -= dt;
      // 开火距离从 540 拉到 780：怪停下来就能开火，玩家肉眼可见
      if(e.shootCd <= 0 && d < 780){
        e.shootCd = e.demon ? 1.6 : 2.1;
        const a = e.angle + rand(-0.08, 0.08);
        const speed = e.demon ? 320 : 275;
        eBullets.push({
          x: e.x + Math.cos(a) * e.r,
          y: e.y + Math.sin(a) * e.r,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          r: e.demon ? 12 : 10,   // 子弹加大，看得清
          dmg: e.demon ? 4 : 2,   // 恶魔 1 颗心 / 小恶魔 1/2 颗心
          life: 3
        });
      }
    } else if(d > e.r + player.r - 2){
      // 距离远时先朝屏幕下方直走；进入 450 距离才开始追玩家
      const TRACK_DIST = 450;
      let moveAngle = e.angle;
      if(d > TRACK_DIST){
        moveAngle = Math.PI / 2;   // 朝下（屏幕 y 增大）
      }
      e.x += Math.cos(moveAngle) * e.speed * slowMul * dt;
      e.y += Math.sin(moveAngle) * e.speed * slowMul * dt;
    }

    e.x = clamp(e.x, e.r, WORLD.w - e.r);
    e.y = clamp(e.y, e.r, WORLD.h - e.r);

    if(!frozen && d < e.r + player.r && e.atkCd <= 0){
      e.atkCd = 0.8;
      damagePlayer(e.dmg);
    }
  }

  for(let i = enemies.length - 1; i >= 0; i--){
    if(enemies[i].dead) enemies.splice(i, 1);
  }

  for(let i = eBullets.length - 1; i >= 0; i--){
    const b = eBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if(b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.w || b.y > WORLD.h){
      eBullets.splice(i, 1); continue;
    }
    if(Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r){
      damagePlayer(b.dmg);
      burst(b.x, b.y, 8, '#9d4fd6', 180);
      eBullets.splice(i, 1);
    }
  }

  for(let i = cans.length - 1; i >= 0; i--){
    const c = cans[i];
    c.t += dt;
    c.spin += dt * 18;
    const p = Math.min(1, c.t / c.dur);
    c.x = lerp(c.sx, c.tx, p);
    c.y = lerp(c.sy, c.ty, p);
    c.z = Math.sin(p * Math.PI) * 70;
    if(p >= 1){ explodeCan(c); cans.splice(i, 1); }
  }

  updateLaser(dt);
  updateMissiles(dt);
  updateAirstrike(dt);

  // 波次清完后的缓冲：先亮"波次清除"横幅，再切到强化卡
  if(waveClearTimer > 0){
    waveClearTimer -= dt;
    if(waveClearTimer <= 0){
      waveClearTimer = 0;
      buffFadeIn = 0;
      state = 'buff';
    }
  }

  if(waveActive){
    waveTimer += dt;

    if(waveSpawn.active){
      updateSpawning(dt);
    } else {
      for(let i = spawnQueue.length - 1; i >= 0; i--){
        spawnQueue[i].t -= dt;
        if(spawnQueue[i].t <= 0){
          spawnEnemy(spawnQueue[i].type);
          spawnQueue.splice(i, 1);
        }
      }
    }

    const _waveClear = waveSpawn.active
      ? isWaveClear()
      : (spawnQueue.length === 0 && enemies.length === 0);

    if(_waveClear){
      waveActive = false;
      waveSpawn.active = false;
      const bonus = 60 * wave;
      score += bonus;

      const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);

      // ============ 教学关：判断本关是否打完 ============
      if(isTutorial && waveInStage >= STAGE_WAVES){
        // 先准备好过关弹窗信息（不立即弹出）
        stageClearInfo = {
          finishedStage: currentStage,
          isLastStage: currentStage >= TUTORIAL_MAX_STAGE,
          unlockWeapon: null,
          kills: stageKillCount
        };
        saveProgress();

        // 最后一波也照常给一次强化，避免进无尽后太弱
        buffChoices = rollBuffChoices();
        if(buffChoices.length > 0){
          pendingStageClearAfterBuff = true;
          waveClearTimer = 1.5;
          waveBreakTimer = 99;
        } else {
          // 没有可选的 buff（极端情况：全满级），直接进过关弹窗
          waveBreakTimer = 99;
          state = 'stageclear';
        }
        return;
      }

      // ============ 正常清完一波 ============
      if(isTutorial){
        banner = { text: '第 ' + currentStage + ' 关  ·  第 ' + waveInStage + ' 波清除', life: 1.5 };
      } else {
        banner = { text: '第 ' + wave + ' 波清除', life: 1.5 };
      }

      // 无尽模式的通关判定
      if(!isTutorial && wave >= MAX_WAVE && !waveCapDisabled){
        saveProgress();
        waveBreakTimer = 99;
        state = 'victory';
        return;
      }

      buffChoices = rollBuffChoices();
      if(buffChoices.length > 0){
        waveClearTimer = 1.5;
        waveBreakTimer = 99;
      } else {
        waveBreakTimer = 1.6;
      }
    }
  } else {
    waveBreakTimer -= dt;
    if(waveBreakTimer <= 0){
      wave++;
      if(currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE){
        waveInStage++;
      }
      // 无尽模式第 1 波、第 2 波前各触发一次猫小弟选择
      if(currentStage === 0 && wave <= 2 && catBroSpawnCount < wave){
        catBroSpawnCount++;
        catBroSelectedSkills = [];
        state = 'catbro';
        last = performance.now();
        return;
      }
      startWave(wave);
    }
  }
}

// ================= 绘制工具 =================
function pixelPanel(x, y, w, h, fill, stroke, highlight){
  ctx.fillStyle = stroke || '#0a0a0a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  if(highlight){
    ctx.fillStyle = highlight;
    ctx.fillRect(x + 3, y + 3, w - 6, 3);
  }
}

function pixelBar(x, y, w, h, ratio, fill, bg){
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg || '#2a2a2a';
  ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.floor(w * ratio));
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y, fw, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  for(let i = 20; i < w; i += 20){
    ctx.fillRect(x + i, y, 2, h);
  }
}

function drawGroundShadow(x, y, rx, ry, alpha){
  ctx.save();
  ctx.globalAlpha = alpha || 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function rr(x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lighten(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt));
  const b = Math.min(255, (n & 255) + Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ================= 地面 =================
function drawGroundDecoration(d){
  const s = d.scale;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);

  if(d.type === 'patch'){
    ctx.fillStyle = d.hue > 0.5
      ? 'rgba(50,100,45,0.25)'
      : 'rgba(150,200,100,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 * s, 16 * s, 0, 0, TAU);
    ctx.fill();
  } else if(d.type === 'tuft'){
    ctx.strokeStyle = 'rgba(45,95,45,0.8)';
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = 'round';
    for(let i = -1; i <= 1; i++){
      ctx.beginPath();
      ctx.moveTo(i * 3 * s, 0);
      ctx.lineTo(i * 4 * s, -9 * s);
      ctx.stroke();
    }
  } else if(d.type === 'rock'){
    ctx.fillStyle = 'rgba(90,92,96,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * s, 3.5 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,155,160,0.75)';
    ctx.beginPath();
    ctx.ellipse(-1 * s, -1.2 * s, 2.4 * s, 1.5 * s, 0, 0, TAU);
    ctx.fill();
  } else if(d.type === 'flower'){
    const colors = ['#ffe066', '#ffffff', '#ff8ca6'];
    ctx.fillStyle = colors[Math.floor(d.hue * colors.length)];
    for(let i = 0; i < 5; i++){
      const a = i * TAU / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 2.6 * s, Math.sin(a) * 2.6 * s, 1.7 * s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffb400';
    ctx.beginPath();
    ctx.arc(0, 0, 1.4 * s, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawGround(){
  // 根据 currentBgKey 拿对应背景图
  const spriteKey = BACKGROUND_KEYS[currentBgKey] || 'grass';
  const spr = SPRITES[spriteKey];

  let pattern = null;
  if(spr && spr.loaded && spr.img){
    if(!spr.pattern){
      spr.pattern = ctx.createPattern(spr.img, 'repeat');
    }
    pattern = spr.pattern;
  } else {
    // 加载失败 → 回退草地
    pattern = grassPattern;
  }

  if(pattern){
    const gs = 0.6;
    ctx.save();
    ctx.scale(gs, gs);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, WORLD.w / gs, WORLD.h / gs);
    ctx.restore();
  } else {
    ctx.fillStyle = '#141815';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  // ★ 装饰只画在草地上（花朵、草丛、补丁）
  if(currentBgKey === 'grass'){
    for(const d of groundDecorations){
      drawGroundDecoration(d);
    }
  }

  ctx.strokeStyle = 'rgba(120,200,140,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
}

function drawBurnMarks(){
  for(const m of burnMarks){
    const a = Math.min(1, m.life / m.maxLife);
    const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    grd.addColorStop(0,   'rgba(20, 12, 10, ' + (a * 0.78) + ')');
    grd.addColorStop(0.45,'rgba(70, 32, 18, ' + (a * 0.5) + ')');
    grd.addColorStop(0.8, 'rgba(50, 22, 14, ' + (a * 0.28) + ')');
    grd.addColorStop(1,   'rgba(40, 20, 15, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();

    ctx.strokeStyle = 'rgba(90, 40, 20, ' + (a * 0.35) + ')';
    ctx.lineWidth = 1;
    for(let k = 0; k < 4; k++){
      const ang = (m.seed + k * 1.7) % TAU;
      const rr1 = m.r * (0.2 + (k * 0.15));
      ctx.beginPath(); ctx.arc(m.x, m.y, rr1, ang, ang + 1.2); ctx.stroke();
    }
  }
}

function drawDrops(){
  for(const d of drops){
    const t = DROP_TYPES[d.type];
    const bob = Math.sin(d.bob) * 3;
    const a = d.life < 4 ? (Math.sin(d.life * 12) * 0.5 + 0.5) : 1;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(d.x, d.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 14 - bob, 11, 4, 0, 0, TAU); ctx.fill();

    const pulse = 0.5 + Math.sin(d.bob * 2) * 0.5;
    ctx.globalAlpha = a * (0.28 + pulse * 0.2);
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(0, 0, 22 + pulse * 4, 0, TAU); ctx.fill();

    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU);
    ctx.fillStyle = t.color; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.icon, 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

// ================= 猫 =================
function drawCat(){
  const p = player;
  const r = p.r;
  const facingLeft = Math.cos(p.facing) < 0;
  const hurt = p.invuln > 0;
  const breathe = 1 + Math.sin(gameTime * 3) * 0.04;
  const bob = Math.sin(gameTime * 10) * 1.5;
  const recoilK = p.recoil > 0 ? p.recoil / 0.08 : 0;

  drawGroundShadow(p.x, p.y + r * 1.3, r * 1.6, r * 0.5, 0.4);

  if(p.laserChargeTimer > 0){
    const a = 0.35 + Math.sin(gameTime * 6) * 0.15;
    ctx.strokeStyle = 'rgba(255,210,74,' + a + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 22, 0, TAU); ctx.stroke();
  }

  const curSpr = getCurrentCatSprite();
  if(curSpr && curSpr.loaded && curSpr.img){
    const img = curSpr.img;
    const w = r * 10;
    const h = r * 10;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if(facingLeft) ctx.scale(-1, 1);
    ctx.translate(-recoilK * 3, 0);
    ctx.scale(breathe * (1 + recoilK * 0.08), breathe * (1 - recoilK * 0.08));
    if(hurt){
      ctx.globalAlpha = 0.5 + Math.sin(gameTime * 30) * 0.3;
    }
    ctx.drawImage(img, -w/2, -h/2, w, h);
    ctx.restore();
    return;
  }

  // 兜底简易绘制
  ctx.save();
  ctx.translate(p.x, p.y);
  if(facingLeft) ctx.scale(-1, 1);
  const s = r / 16;
  const bColor = hurt ? '#8a8a90' : '#1e1e22';
  const wColor = hurt ? '#e8dcc8' : '#faf6ee';
  ctx.fillStyle = bColor;
  ctx.beginPath(); ctx.ellipse(0, 6 * s, 14 * s, 13 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = wColor;
  ctx.beginPath(); ctx.arc(0, -12 * s, 14 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = bColor; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.arc(0, -12 * s, 14 * s, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ================= 气泡 =================
function drawBubbleAt(b, x, y, r){
  if(b.life <= 0) return;
  const a = Math.min(1, b.life * 1.8);
  const px = x;
  const py = y - r - 32;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  const tw = ctx.measureText(b.text).width;
  const w = tw + 32, h = 36;

  rr(px - w/2, py - h, w, h, 10);
  ctx.fillStyle = 'rgba(16,26,20,.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,240,180,.8)';
  ctx.lineWidth = 2; ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px - 7, py - 1);
  ctx.lineTo(px, py + 8);
  ctx.lineTo(px + 7, py - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(16,26,20,.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,240,180,.8)';
  ctx.stroke();

  ctx.fillStyle = '#c8f5d8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, px, py - h/2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawBubble(){
  if(!player) return;
  drawBubbleAt(bubble, player.x, player.y, player.r);
}

function drawCatBroBubble(){
  if(!player) return;
  for(const bro of catBros){
    drawBubbleAt(bro.bubble, bro.x, bro.y, bro.r || player.r * 0.75);
  }
}

// ================= 敌人 =================
function drawEnemy(e){
  const r = e.r;
  const facingRight = Math.cos(e.angle) >= 0;
  const walkPhase = Math.sin(gameTime * 8 + e.id * 1.7) * 0.5;
  const hurt = e.hitFlash > 0;

  if(e.elite){
    const pulse = 0.5 + Math.sin(gameTime * 4 + e.id) * 0.5;
    ctx.fillStyle = e.demon
      ? 'rgba(255,80,60,' + (0.12 + pulse * 0.08) + ')'
      : 'rgba(200,210,200,' + (0.10 + pulse * 0.06) + ')';
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 16 + pulse * 6, 0, TAU); ctx.fill();
  }

  drawGroundShadow(e.x, e.y + r * 0.95, r * 1.1, r * 0.4, 0.35);

  const sprite = SPRITES['enemy_' + e.type];
  if(sprite && sprite.loaded && sprite.img){
    const vis = ENEMY_VISUAL[e.type] || { scale: 6.0, yOff: -0.3 };
    const w = r * vis.scale;
    const h = r * vis.scale;
    const frozen = e.frozenTimer > 0;
    const bob    = frozen ? 0 : Math.sin(gameTime * 8 + e.id * 1.7) * 2.8;
    const sway   = frozen ? 0 : Math.sin(gameTime * 6 + e.id * 2.3) * 0.07;
    const squash = frozen ? 1 : 1 + Math.sin(gameTime * 10 + e.id) * 0.05;
    ctx.save();
    ctx.translate(e.x, e.y + r * vis.yOff + bob);
    if(facingRight) ctx.scale(-1, 1);
    ctx.rotate(sway);
    ctx.scale(1 / squash, squash);
    if(hurt && !frozen) ctx.globalAlpha = 0.5 + Math.sin(gameTime * 30) * 0.3;
    ctx.drawImage(sprite.img, -w/2, -h/2, w, h);

    // ===== 冰晶包裹效果 =====
    if(frozen){
      const rw = w * 0.52;
      const rh = h * 0.52;

      // 1. 半透明蓝色底
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#7fd0ff';
      ctx.beginPath();
      ctx.moveTo(0, -rh);
      ctx.lineTo(rw * 0.85, -rh * 0.55);
      ctx.lineTo(rw * 0.85, rh * 0.55);
      ctx.lineTo(0, rh);
      ctx.lineTo(-rw * 0.85, rh * 0.55);
      ctx.lineTo(-rw * 0.85, -rh * 0.55);
      ctx.closePath();
      ctx.fill();

      // 2. 冰块轮廓
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(200, 245, 255, 1)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 3. 冰刺（六边形顶点向外的小三角）
      ctx.fillStyle = 'rgba(180, 235, 255, 0.85)';
      const spikes = [
        [0, -rh, 0, -rh * 1.35, rw * 0.18, -rh * 1.15],
        [rw * 0.85, -rh * 0.55, rw * 1.2, -rh * 0.75, rw * 1.05, -rh * 0.35],
        [rw * 0.85, rh * 0.55, rw * 1.2, rh * 0.75, rw * 1.05, rh * 0.35],
        [0, rh, 0, rh * 1.35, -rw * 0.18, rh * 1.15],
        [-rw * 0.85, rh * 0.55, -rw * 1.2, rh * 0.75, -rw * 1.05, rh * 0.35],
        [-rw * 0.85, -rh * 0.55, -rw * 1.2, -rh * 0.75, -rw * 1.05, -rh * 0.35]
      ];
      for(const sp of spikes){
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1]);
        ctx.lineTo(sp[2], sp[3]);
        ctx.lineTo(sp[4], sp[5]);
        ctx.closePath();
        ctx.fill();
      }

      // 4. 高光斜线
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-rw * 0.5, -rh * 0.7);
      ctx.lineTo(rw * 0.15, -rh * 0.85);
      ctx.lineTo(rw * 0.15, -rh * 0.55);
      ctx.lineTo(-rw * 0.5, -rh * 0.4);
      ctx.closePath();
      ctx.fill();

      // 5. 内部裂纹
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-rw * 0.35, -rh * 0.45);
      ctx.lineTo(rw * 0.05, -rh * 0.1);
      ctx.lineTo(-rw * 0.2, rh * 0.35);
      ctx.moveTo(rw * 0.05, -rh * 0.1);
      ctx.lineTo(rw * 0.5, rh * 0.15);
      ctx.moveTo(rw * 0.05, -rh * 0.1);
      ctx.lineTo(rw * 0.4, -rh * 0.35);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ===== 护盾绘制 =====
    if(e.shield > 0 && e.shieldMax > 0){
      const pulse = 0.5 + Math.sin(gameTime * 6 + e.id) * 0.5;
      const shieldRatio = e.shield / e.shieldMax;
      const R = e.r * 1.9;

      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.14;
      const grd = ctx.createRadialGradient(e.x, e.y, R * 0.4, e.x, e.y, R);
      grd.addColorStop(0, 'rgba(160, 216, 255, 0)');
      grd.addColorStop(0.7, 'rgba(160, 216, 255, 0.35)');
      grd.addColorStop(1, 'rgba(160, 216, 255, 0.6)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R, 0, TAU);
      ctx.fill();

      // 六边形护盾轮廓
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = shieldRatio < 0.3
        ? 'rgba(255, 180, 120, ' + (0.75 + pulse * 0.25) + ')'
        : 'rgba(200, 240, 255, ' + (0.7 + pulse * 0.3) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for(let i = 0; i < 6; i++){
        const a = -Math.PI / 2 + i * TAU / 6 + gameTime * 0.5;
        const px = e.x + Math.cos(a) * R;
        const py = e.y + Math.sin(a) * R;
        if(i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // 破盾进度环
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#a0d8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R + 4, -Math.PI/2, -Math.PI/2 + TAU * shieldRatio);
      ctx.stroke();

      ctx.restore();
    }

    if(e.hp < e.maxHp){
      const w2 = e.r * 2.3;
      const bx = e.x - w2 / 2, by = e.y - e.r - 16;
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(bx, by, w2, 5);
      ctx.fillStyle = e.elite ? '#ff6b4a' : '#e05050';
      ctx.fillRect(bx, by, w2 * Math.max(0, e.hp / e.maxHp), 5);
      if(e.elite){
        ctx.strokeStyle = 'rgba(255,210,80,.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1, by - 1, w2 + 2, 7);
      }
    }
    return;
  }

  // 兜底：代码绘制
  ctx.save();
  ctx.translate(e.x, e.y);
  if(facingRight) ctx.scale(-1, 1);

  const s = r / 16;
  const skinColor = hurt ? '#ffffff' : e.color;

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(-5 * s, 16 * s + walkPhase * 2, 4.5 * s, 5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5 * s, 16 * s - walkPhase * 2, 4.5 * s, 5 * s, 0, 0, TAU);
  ctx.fill();

  const bodyGrd = ctx.createRadialGradient(-3 * s, -2 * s, 1, 0, 4 * s, 16 * s);
  bodyGrd.addColorStop(0, hurt ? '#ffffff' : lighten(e.color, 0.25));
  bodyGrd.addColorStop(1, skinColor);
  ctx.fillStyle = bodyGrd;
  ctx.beginPath();
  ctx.ellipse(0, 6 * s, 11 * s, 13 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 1.4 * s;
  ctx.stroke();

  const headY = -11 * s;
  const headGrd = ctx.createRadialGradient(-3 * s, headY - 3 * s, 1, 0, headY, 14 * s);
  headGrd.addColorStop(0, hurt ? '#ffffff' : lighten(e.color, 0.3));
  headGrd.addColorStop(1, skinColor);
  ctx.fillStyle = headGrd;
  ctx.beginPath();
  ctx.arc(0, headY, 11 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.lineWidth = 1.4 * s;
  ctx.stroke();

  ctx.fillStyle = '#ff3030';
  ctx.beginPath(); ctx.arc(-4 * s, headY - 1 * s, 1.7 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(4 * s, headY - 1 * s, 1.7 * s, 0, TAU); ctx.fill();

  ctx.restore();

  if(e.hp < e.maxHp){
    const w = e.r * 2.3;
    const bx = e.x - w / 2, by = e.y - e.r - 16;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(bx, by, w, 5);
    ctx.fillStyle = e.elite ? '#ff6b4a' : '#e05050';
    ctx.fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}

// ================= 猫小弟 =================
function initCatBro(skills){
  const ang0 = player.facing + Math.PI + catBros.length * 0.9;
  const spriteKey = catBros.length === 0 ? 'catbro' : 'catbro2';
  const bro = {
    spriteKey: spriteKey,
    r: player.r * 0.75,
    x: player.x + Math.cos(ang0) * 250,
    y: player.y + Math.sin(ang0) * 250,
    facing: player.facing,
    skills: skills,
    skillCd: {},
    orbAngle: 0,
    orbHitCd: new Map(),
    laserFx: null,
    wanderTimer: 0,
    wanderAngle: ang0,
    wanderDist:  250,
    speakCd: 0,
    bubble: { text:'', life:0, maxLife:2.2 }
  };
  for(const s of skills){
    bro.skillCd[s] = 1.0;
  }
  catBros.push(bro);
  sayCatBro(bro, randLine(CATBRO_LINES.join), true);
  bro.speakCd = 3.0;
}

function sayCatBro(bro, text, priority){
  if(!bro) return;
  if(!priority && bro.speakCd > 0) return;
  bro.bubble.text = text;
  bro.bubble.life = 2.2; bro.bubble.maxLife = 2.2;
  bro.speakCd = priority ? 2.5 : 4.0;
}

function updateCatBro(dt){
  if(!player) return;
  if(state !== 'playing') return;
  for(const bro of catBros){
    updateOneCatBro(bro, dt);
  }
}

function updateOneCatBro(catBro, dt){
  if(catBro.speakCd > 0) catBro.speakCd -= dt;
  if(catBro.bubble.life > 0) catBro.bubble.life -= dt;

  catBro.wanderTimer -= dt;
  if(catBro.wanderTimer <= 0){
    catBro.wanderTimer = rand(1.2, 2.5);
    catBro.wanderAngle = player.facing + Math.PI + rand(-1.2, 1.2);
    catBro.wanderDist  = rand(200, 300);
  }
  const tx = player.x + Math.cos(catBro.wanderAngle) * catBro.wanderDist;
  const ty = player.y + Math.sin(catBro.wanderAngle) * catBro.wanderDist;
  catBro.x += (tx - catBro.x) * Math.min(1, dt * 4);
  catBro.y += (ty - catBro.y) * Math.min(1, dt * 4);
  catBro.facing = player.facing;

  if(catBro.skills.indexOf('orb') >= 0){
    catBro.orbAngle += dt * 0.8 * TAU;
    const count = 2;
    const r = 90;
    const size = 14;
    if(catBro.orbHitCd.size > 200){
      const cutoff = gameTime - 1.5;
      for(const [k, t] of catBro.orbHitCd){
        if(t < cutoff) catBro.orbHitCd.delete(k);
      }
    }
    for(let i = 0; i < count; i++){
      const a = catBro.orbAngle + i * TAU / count;
      const ox = catBro.x + Math.cos(a) * r;
      const oy = catBro.y + Math.sin(a) * r;
      for(const e of enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x - ox, e.y - oy) < e.r + size){
          const last = catBro.orbHitCd.get(e.id) || 0;
          if(gameTime - last >= 0.5){
            catBro.orbHitCd.set(e.id, gameTime);
            dealDamage(e, player.orbDamage * 0.6, 'orb');
            burst(ox, oy, 4, '#ffb0d0', 140);
            if(e.hp <= 0) killEnemy(e);
          }
        }
      }
    }
  }

  for(const s of catBro.skills){
    if(s === 'orb') continue;
    catBro.skillCd[s] = (catBro.skillCd[s] || 0) - dt;
    if(catBro.skillCd[s] <= 0 && enemies.length > 0){
      if(tryCatBroSkill(catBro, s)){
        catBro.skillCd[s] = CATBRO_SKILL_CD[s];
        if(Math.random() < 0.5){
          const lines = CATBRO_LINES[s];
          if(lines) sayCatBro(catBro, randLine(lines), false);
        }
      } else {
        catBro.skillCd[s] = 0.5;
      }
    }
  }

  if(catBro.laserFx){
    catBro.laserFx.timer -= dt;
    if(catBro.laserFx.timer <= 0) catBro.laserFx = null;
  }
}

function tryCatBroSkill(catBro, s){
  if(s === 'can')       return catBroThrowCan(catBro);
  if(s === 'missile')   return catBroFireMissile(catBro);
  if(s === 'laser')     return catBroFireLaser(catBro);
  if(s === 'airstrike') return catBroDoAirstrike(catBro);
  return false;
}

function catBroThrowCan(catBro){
  let best = null, bd = 1e9;
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - catBro.x, e.y - catBro.y);
    if(d < bd){ bd = d; best = e; }
  }
  if(!best || bd > 800) return false;
  const tx = best.x + rand(-15, 15);
  const ty = best.y + rand(-15, 15);
  cans.push({
    sx: catBro.x, sy: catBro.y, tx, ty,
    x: catBro.x, y: catBro.y, z: 0,
    t: 0, dur: 0.44, spin: 0,
    fromCatBro: true
  });
  return true;
}

function catBroFireMissile(catBro){
  const target = findHighestHpEnemy();
  if(!target) return false;
  const count = 2;
  for(let i = 0; i < count; i++){
    const a = (i / count) * TAU + Math.random() * 0.4;
    const sx = catBro.x + Math.cos(a) * 12;
    const sy = catBro.y + Math.sin(a) * 12;
    const dirA = Math.atan2(target.y - sy, target.x - sx);
    missileList.push({
      x: sx, y: sy,
      vx: Math.cos(dirA) * MISSILE_SPEED,
      vy: Math.sin(dirA) * MISSILE_SPEED,
      targetId: target.id,
      damage: player.missileDamage * 0.6,
      life: 3.5,
      trail: []
    });
  }
  return true;
}

function catBroFireLaser(catBro){
  const target = findNearestEnemies(1, new Set())[0];
  if(!target) return false;
  const dmg = player.laserDamage * 0.5;
  dealDamage(target, dmg, 'laser');
  burst(target.x, target.y, 12, '#88eeff', 260);
  rings.push({ x:target.x, y:target.y, maxR: 40, life:0.35, t:0.35, color:'#88eeff' });
  catBro.laserFx = { timer: 0.3, x0: catBro.x, y0: catBro.y - 10, tx: target.x, ty: target.y };
  return true;
}

function catBroDoAirstrike(catBro){
  const targets = [];
  for(const e of enemies){
    if(!e.dead) targets.push(e);
  }
  if(targets.length === 0) return false;
  for(let i = targets.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  const n = Math.min(2, targets.length);
  for(let i = 0; i < n; i++){
    const t = targets[i];
    airstrikeBombs.push({
      x: t.x + rand(-25, 25),
      y: t.y + rand(-25, 25),
      startY: t.y - 700,
      t: 0,
      dur: 0.5 + i * 0.08,
      damage: player.airstrikeDamage * 0.6,
      radius: 90
    });
  }
  return true;
}

function drawCatBro(){
  if(!player) return;
  for(const bro of catBros){
    drawOneCatBro(bro);
  }
}

function drawOneCatBro(catBro){
  const r = catBro.r || player.r * 0.75;
  const facingLeft = Math.cos(catBro.facing) < 0;
  const bob = Math.sin(gameTime * 10 + 1.3) * 1.2;

  drawGroundShadow(catBro.x, catBro.y + r * 1.3, r * 1.3, r * 0.4, 0.35);

  // 毛球
  if(catBro.skills.indexOf('orb') >= 0){
    const count = 2;
    const rOrb = 90;
    const size = 14;
    for(let i = 0; i < count; i++){
      const a = catBro.orbAngle + i * TAU / count;
      const ox = catBro.x + Math.cos(a) * rOrb;
      const oy = catBro.y + Math.sin(a) * rOrb;
      drawSingleOrb(ox, oy, size);
    }
  }

  // 激光特效
  if(catBro.laserFx){
    const f = catBro.laserFx;
    const alpha = Math.min(1, f.timer / 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#88eeff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.x0, f.y0);
    ctx.lineTo(f.tx, f.ty);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x0, f.y0);
    ctx.lineTo(f.tx, f.ty);
    ctx.stroke();
    ctx.restore();
  }

  // 本体：优先用猫小弟自己的素材，没有再回退主角
  const key = catBro.spriteKey || 'catbro';
  const s = SPRITES[key];
  const fallback = getCurrentCatSprite();
  const useSpr = (s && s.loaded && s.img) ? s : fallback;
  if(useSpr && useSpr.loaded && useSpr.img){
    const w = r * 10;
    const h = r * 10;
    ctx.save();
    ctx.translate(catBro.x, catBro.y + bob);
    if(facingLeft) ctx.scale(-1, 1);
    ctx.drawImage(useSpr.img, -w/2, -h/2, w, h);
    ctx.restore();
  }
}

function wrapTextSimple(text, maxWidth){
  ctx.font = '13px "Microsoft YaHei",sans-serif';
  const lines = [];
  let cur = '';
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    const test = cur + ch;
    if(ctx.measureText(test).width > maxWidth && cur.length > 0){
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if(cur) lines.push(cur);
  return lines;
}

function drawCatBroSelect(){
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 40px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  const joinTitle = (catBroSpawnCount >= 2) ? '又一个猫小弟加入了！' : '猫小弟加入了！';
  ctx.strokeText(joinTitle, W/2, 140);
  const tg = ctx.createLinearGradient(0, 110, 0, 170);
  tg.addColorStop(0, '#fff5c0');
  tg.addColorStop(1, '#ffd24a');
  ctx.fillStyle = tg;
  ctx.fillText(joinTitle, W/2, 140);

  ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText('选择 1~2 个技能传授给它', W/2, 190);
  ctx.fillStyle = '#dfe9e3';
  ctx.fillText('选择 1~2 个技能传授给它', W/2, 190);

  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('已选：' + catBroSelectedSkills.length + ' / 2', W/2, 222);

  const skills = ['can','orb','laser','missile','airstrike'].filter(s =>
    unlockedWeapons[s] && catBroTakenSkills.indexOf(s) < 0
  );
  const n = skills.length;
  const CW = 150;
  const CH = 200;
  const GAP = 14;
  const totalW = n * CW + (n - 1) * GAP;
  const sx = (W - totalW) / 2;
  const sy = H / 2 - CH / 2 - 20;

  catBroCards = [];

  for(let i = 0; i < n; i++){
    const s = skills[i];
    const info = CATBRO_SKILL_INFO[s];
    const x = sx + i * (CW + GAP);
    const y = sy;
    const selected = catBroSelectedSkills.indexOf(s) >= 0;

    catBroCards.push({ x, y, w: CW, h: CH, skill: s });

    rr(x, y, CW, CH, 14);
    const grd = ctx.createLinearGradient(x, y, x, y + CH);
    if(selected){
      grd.addColorStop(0, 'rgba(255, 245, 220, 0.98)');
      grd.addColorStop(1, 'rgba(255, 220, 170, 0.98)');
    } else {
      grd.addColorStop(0, 'rgba(240, 240, 240, 0.92)');
      grd.addColorStop(1, 'rgba(210, 210, 215, 0.92)');
    }
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.strokeStyle = selected ? '#ffb84a' : 'rgba(140,160,150,0.7)';
    ctx.lineWidth = selected ? 4 : 2;
    rr(x, y, CW, CH, 14);
    ctx.stroke();

    const icx = x + CW / 2;
    const icy = y + 70;
    drawCircleIconBack(icx, icy, 36, '#f4fbff', 'rgba(120, 180, 220, 0.9)');
    drawBuffIcon(info.icon, icx, icy, 48, info.color);

    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = info.color;
    ctx.fillText(info.name, icx, y + 140);

    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#4a5a52';
    const lines = wrapTextSimple(info.desc, CW - 20);
    let ly = y + 165;
    for(const ln of lines){
      ctx.fillText(ln, icx, ly);
      ly += 18;
    }

    if(selected){
      const bx = x + CW - 18;
      const by = y + 18;
      ctx.fillStyle = '#ffb84a';
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - 6, by + 1);
      ctx.lineTo(bx - 1, by + 6);
      ctx.lineTo(bx + 7, by - 5);
      ctx.stroke();
    }
  }

  const cb = CATBRO_CONFIRM_BTN;
  const canConfirm = catBroSelectedSkills.length >= 1;
  const bc = canConfirm ? '#7fe0a0' : 'rgba(120,140,130,0.7)';
  const tc = canConfirm ? '#289858' : '#5a6a62';
  drawAppButton(cb, '确 认 ▶', bc, tc, { fontSize: 28, pulse: canConfirm });
}

// ================= 全屏轰炸 =================
function doAirstrike(){
  const targets = [];
  for(const e of enemies){
    if(!e.dead) targets.push(e);
  }
  if(targets.length === 0) return;

  // 洗牌，保证炸弹分布随机
  for(let i = targets.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  const n = Math.min(player.airstrikeCount, targets.length);
  for(let i = 0; i < n; i++){
    const t = targets[i];
    airstrikeBombs.push({
      x: t.x + rand(-25, 25),
      y: t.y + rand(-25, 25),
      startY: t.y - 700,
      t: 0,
      dur: 0.5 + i * 0.08,
      damage: player.airstrikeDamage,
      radius: 100
    });
  }

  sfx('boom');
  cam.shake = Math.max(cam.shake, 8);
  say(randLine(LINES.airstrike), true);
}

function explodeAirstrike(b){
  const R = b.radius;
  const DMG = b.damage;
  rings.push({ x: b.x, y: b.y, maxR: R, life: 0.5, t: 0.5, color: '#ff8a3c' });
  cam.shake = Math.max(cam.shake, 10);
  sfx('boom');
  burst(b.x, b.y, 30, '#ff8a3c', 350);
  burst(b.x, b.y, 15, '#ffcf5c', 280);
  burnMarks.push({ x:b.x, y:b.y, r: R*0.85, life:5, maxLife:5, seed: Math.random()*1000 });

  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - b.x, e.y - b.y);
    if(d < R + e.r){
      const k = 1 - d / (R + e.r);
      const dmg = DMG * (0.5 + k * 0.5);
      dealDamage(e, dmg, 'airstrike');
      if(e.hp <= 0) killEnemy(e, false);
    }
  }
}

function updateAirstrike(dt){
  // 计时并自动释放（解锁即触发）
  if(unlockedWeapons.airstrike && catBroTakenSkills.indexOf('airstrike') < 0){
    airstrikeTimer += dt;
    if(airstrikeTimer >= player.airstrikeCD){
      airstrikeTimer = 0;
      doAirstrike();
    }
  }

  // 更新下落炸弹
  for(let i = airstrikeBombs.length - 1; i >= 0; i--){
    const b = airstrikeBombs[i];
    b.t += dt;
    if(b.t >= b.dur){
      explodeAirstrike(b);
      airstrikeBombs.splice(i, 1);
    }
  }
}

function drawAirstrikeBombs(){
  for(const b of airstrikeBombs){
    // 地面预警圈
    const pulse = 0.5 + Math.sin(gameTime * 20) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (0.8 + pulse * 0.15), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,80,60,0.2)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (0.8 + pulse * 0.15), 0, TAU);
    ctx.fill();
    ctx.restore();

    // 下落中的炸弹
    const p = Math.min(1, b.t / b.dur);
    const by = b.startY + (b.y - b.startY) * p;
    ctx.save();
    ctx.translate(b.x, by);
    // 尾焰
    ctx.fillStyle = 'rgba(255,180,60,0.75)';
    ctx.beginPath();
    ctx.moveTo(-7, -14);
    ctx.lineTo(0, -28 - Math.random() * 6);
    ctx.lineTo(7, -14);
    ctx.closePath();
    ctx.fill();
    // 弹体
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ff8a3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(-4, -4, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawSkillIcons(){
  const cx = 46;
  const R = 28;
  const step = 104;

  // ---------- 罐头 ----------
  if(unlockedWeapons.can && catBroTakenSkills.indexOf('can') < 0){
    const cy = H * 0.50;
    const cdTotal = CAN_AUTO_INTERVAL;
    const cdP = Math.min(1, canAutoTimer / cdTotal);
    const remain = Math.max(0, cdTotal - canAutoTimer);
    const justUsed = canAutoTimer < 0.5;

    ctx.save();

    // 使用闪烁光环
    if(justUsed){
      const flash = 1 - canAutoTimer / 0.5;
      ctx.strokeStyle = 'rgba(255,220,80,' + flash + ')';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8 + (1 - flash) * 14, 0, TAU);
      ctx.stroke();
    }

    // 圆底
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    // 罐头图标
    ctx.fillStyle = '#c6ced4';
    ctx.beginPath(); ctx.ellipse(cx, cy - 3, 11, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8543f';
    ctx.fillRect(cx - 11, cy - 6, 22, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(cx - 3, cy - 5, 3, 1.5, 0, 0, TAU); ctx.fill();

    // ===== 扇形阴影（剩余冷却） =====
    if(cdP < 1){
      const startAngle = -Math.PI/2 + TAU * cdP;
      const endAngle = -Math.PI/2 + TAU;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fill();
    }

    // 边框
    ctx.strokeStyle = cdP >= 1 ? '#ffe080' : '#ffcf5c';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // 倒计时数字
    const label = remain.toFixed(1);
    ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.strokeText(label, cx, cy + R + 14);
    ctx.fillStyle = '#ffe080';
    ctx.fillText(label, cx, cy + R + 14);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  // ---------- 全屏轰炸 ----------
  if(unlockedWeapons.airstrike && catBroTakenSkills.indexOf('airstrike') < 0){
    const cy = H * 0.50 + step;
    const cdTotal = player.airstrikeCD;
    const cdP = Math.min(1, airstrikeTimer / cdTotal);
    const remain = Math.max(0, cdTotal - airstrikeTimer);
    const justUsed = airstrikeTimer < 0.5;

    ctx.save();

    if(justUsed){
      const flash = 1 - airstrikeTimer / 0.5;
      ctx.strokeStyle = 'rgba(255,140,60,' + flash + ')';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8 + (1 - flash) * 14, 0, TAU);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    // 炸弹图标
    ctx.fillStyle = '#ffb84a';
    ctx.beginPath(); ctx.arc(cx, cy + 2, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffb84a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 8);
    ctx.lineTo(cx + 9, cy - 15);
    ctx.stroke();
    ctx.fillStyle = '#ff5a3a';
    ctx.beginPath(); ctx.arc(cx + 10, cy - 16, 3, 0, TAU); ctx.fill();

    // ===== 扇形阴影 =====
    if(cdP < 1){
      const startAngle = -Math.PI/2 + TAU * cdP;
      const endAngle = -Math.PI/2 + TAU;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fill();
    }

    // 边框
    ctx.strokeStyle = cdP >= 1 ? '#ffcf8a' : '#ff8a3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // 倒计时数字
    const label2 = remain.toFixed(1);
    ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.strokeText(label2, cx, cy + R + 14);
    ctx.fillStyle = '#ffcf8a';
    ctx.fillText(label2, cx, cy + R + 14);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }
}
// ================= 激光 =================
function drawLaser(){
  if(!laser.active || !player) return;
  if(laser.targets.length === 0) return;

  const facingLeft = Math.cos(player.facing) < 0;
  const eyeX = player.x + (facingLeft ? -6 : 6);
  const eyeY = player.y - player.r * 1.4;

  const c1 = laser.isGold ? '255, 215, 80'  : '120, 240, 255';
  const c2 = laser.isGold ? '255, 240, 160' : '200, 250, 255';
  const c3 = laser.isGold ? '255, 255, 220' : '255, 255, 255';

  const fadeIn  = Math.min(1, laser.timer / 0.12);
  const fadeOut = Math.min(1, (laser.duration - laser.timer) / 0.3);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.save();
  ctx.globalAlpha = alpha;

  for(const t of laser.targets){
    let target = null;
    for(const e of enemies){
      if(e.id === t.id && !e.dead){ target = e; break; }
    }
    if(!target) continue;

    const dx = target.x - eyeX;
    const dy = target.y - eyeY;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(eyeX, eyeY);
    ctx.rotate(ang);

    const grd = ctx.createLinearGradient(0, 0, dist, 0);
    grd.addColorStop(0,   'rgba(' + c1 + ', 0.65)');
    grd.addColorStop(0.7, 'rgba(' + c1 + ', 0.35)');
    grd.addColorStop(1,   'rgba(' + c1 + ', 0.7)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, -14, dist, 28);

    const grd2 = ctx.createLinearGradient(0, 0, dist, 0);
    grd2.addColorStop(0,   'rgba(' + c2 + ', 0.9)');
    grd2.addColorStop(0.5, 'rgba(' + c2 + ', 0.7)');
    grd2.addColorStop(1,   'rgba(' + c2 + ', 0.9)');
    ctx.fillStyle = grd2;
    ctx.fillRect(0, -6, dist, 12);

    ctx.fillStyle = 'rgba(' + c3 + ', 1)';
    ctx.fillRect(0, -2, dist, 4);

    ctx.restore();

    const tGlow = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 34);
    tGlow.addColorStop(0,   'rgba(255,255,255,.75)');
    tGlow.addColorStop(0.5, 'rgba(' + c1 + ',.45)');
    tGlow.addColorStop(1,   'rgba(' + c1 + ',0)');
    ctx.fillStyle = tGlow;
    ctx.beginPath(); ctx.arc(target.x, target.y, 34, 0, TAU); ctx.fill();
  }

  const pulse = 0.6 + Math.sin(gameTime * 25) * 0.4;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 22);
  eyeGlow.addColorStop(0,   'rgba(255,255,255,' + (0.95 * pulse) + ')');
  eyeGlow.addColorStop(0.5, 'rgba(' + c1 + ',' + (0.65 * pulse) + ')');
  eyeGlow.addColorStop(1,   'rgba(' + c1 + ',0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath(); ctx.arc(eyeX, eyeY, 22, 0, TAU); ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ================= 头像 =================
function drawAvatar(){
  const cx = AVATAR.x, cy = AVATAR.y, R = AVATAR.r;
  const S = R * 2 + 8;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(cx - S/2 - 2, cy - S/2 - 2, S + 4, S + 4);
  ctx.fillStyle = '#2a4a3a';
  ctx.fillRect(cx - S/2, cy - S/2, S, S);

  const inner = S - 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - inner/2, cy - inner/2, inner, inner);
  ctx.clip();
  if(player.avatarImg){
    const img = player.avatarImg;
    const scale = Math.max(inner / img.width, inner / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - dw/2, cy - dh/2, dw, dh);
    ctx.imageSmoothingEnabled = true;
  } else {
    const spr = getCurrentCatSprite();
    if(spr && spr.loaded && spr.img){
      const img = spr.img;
      const iw = img.width, ih = img.height;

      // 只取头部区域
      // sx/sy：源图裁剪起点（0~1 比例）
      // sw/sh：裁剪区域大小（0~1 比例）
      const CROP = {
        sx: 0.24,
        sy: 0.16,
        sw: 0.52,
        sh: 0.38
      };
      const sx = iw * CROP.sx;
      const sy = ih * CROP.sy;
      const sw = iw * CROP.sw;
      const sh = ih * CROP.sh;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        sx, sy, sw, sh,
        cx - inner/2, cy - inner/2, inner, inner
      );
      ctx.imageSmoothingEnabled = true;
    }
  }
  ctx.restore();

  ctx.strokeStyle = '#7fe0a0';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - S/2, cy - S/2, S, S);

  const bx = cx + S/2 - 12, by = cy + S/2 - 12;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(bx - 11, by - 11, 22, 22);
  ctx.fillStyle = '#1a2820';
  ctx.fillRect(bx - 9, by - 9, 18, 18);
  ctx.fillStyle = '#7fe0a0';
  ctx.fillRect(bx - 7, by - 2, 14, 4);
  ctx.fillRect(bx - 2, by - 7, 4, 14);
}

function drawHelpQuickBtn(){
  const b = HELP_QUICK_BTN;
  const cx = b.x, cy = b.y, R = b.r;

  const pulse = 0.5 + Math.sin(gameTime * 2.5) * 0.5;

  // ===== 外发光（脉动，吸引注意） =====
  ctx.save();
  ctx.shadowColor = '#7fb8ff';
  ctx.shadowBlur = 16 + pulse * 12;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = 'rgba(60, 120, 200, 0.9)';
  ctx.fill();
  ctx.restore();

  // ===== 圆底：蓝径向渐变 =====
  const grd = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  grd.addColorStop(0, '#5a9ad8');
  grd.addColorStop(0.6, '#2a5a90');
  grd.addColorStop(1, '#163a60');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = grd;
  ctx.fill();

  // ===== 内环高光 =====
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 4, 0, TAU);
  ctx.stroke();

  // ===== 外圈双线边 =====
  ctx.strokeStyle = '#a8d8ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 3, 0, TAU);
  ctx.stroke();

  // ===== 顶部高光弧 =====
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // ===== 中间问号 =====
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20, 40, 70, 0.9)';
  ctx.strokeText('?', cx, cy + 2);
  ctx.fillText('?', cx, cy + 2);
  ctx.textBaseline = 'alphabetic';

  // ===== 下方文字 "玩法说明" =====
  const labelText = '玩法说明';
  const labelY = cy + R + 22;

  ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
  const tw = ctx.measureText(labelText).width;

  // 深色底框（保证可读）
  rr(cx - tw/2 - 10, labelY - 14, tw + 20, 22, 8);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fill();
  ctx.strokeStyle = '#7fb8ff';
  ctx.lineWidth = 1.5;
  rr(cx - tw/2 - 10, labelY - 14, tw + 20, 22, 8);
  ctx.stroke();

  // 文字带描边
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.strokeText(labelText, cx, labelY + 3);
  ctx.fillStyle = '#c8e0ff';
  ctx.fillText(labelText, cx, labelY + 3);
}

function drawAutoCastBtn(){
  const b = AUTO_BTN;
  const W2 = b.w;
  const H2 = b.h;
  const padding = 4;
  const knobR = (H2 - padding * 2) / 2;
  const t = autoCastAnim;   // 0 → 1 插值

  // 滑块位置随动画插值
  const leftX  = b.x - W2/2 + padding + knobR;
  const rightX = b.x + W2/2 - padding - knobR;
  const knobX  = leftX + (rightX - leftX) * t;

  // 颜色插值（关=灰，开=绿）
  function lerpColor(c1, c2, k){
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * k),
      Math.round(c1[1] + (c2[1] - c1[1]) * k),
      Math.round(c1[2] + (c2[2] - c1[2]) * k)
    ];
  }

  const colStart = lerpColor([150, 158, 170], [96, 240, 150], t);
  const colEnd   = lerpColor([100, 108, 120], [34, 180, 90],  t);
  const colStartStr = 'rgb(' + colStart.join(',') + ')';
  const colEndStr   = 'rgb(' + colEnd.join(',') + ')';

  ctx.save();


  // ===== 胶囊底 =====
  const bgGrd = ctx.createLinearGradient(b.x - W2/2, b.y - H2/2, b.x + W2/2, b.y + H2/2);
  bgGrd.addColorStop(0, colStartStr);
  bgGrd.addColorStop(1, colEndStr);
  ctx.fillStyle = bgGrd;
  rr(b.x - W2/2, b.y - H2/2, W2, H2, H2/2);
  ctx.fill();

  // 内阴影（顶部压暗，底部提亮）
  ctx.save();
  rr(b.x - W2/2, b.y - H2/2, W2, H2, H2/2);
  ctx.clip();
  const shadow = ctx.createLinearGradient(b.x, b.y - H2/2, b.x, b.y + H2/2);
  shadow.addColorStop(0, 'rgba(0,0,0,0.32)');
  shadow.addColorStop(0.45, 'rgba(0,0,0,0)');
  shadow.addColorStop(0.85, 'rgba(255,255,255,0.14)');
  shadow.addColorStop(1, 'rgba(255,255,255,0.2)');
  ctx.fillStyle = shadow;
  ctx.fillRect(b.x - W2/2, b.y - H2/2, W2, H2);
  ctx.restore();

  // 边框
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  rr(b.x - W2/2, b.y - H2/2, W2, H2, H2/2);
  ctx.stroke();

  // ===== 滑块底部阴影 =====
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.arc(knobX, b.y + 1.5, knobR, 0, TAU);
  ctx.fill();

  // ===== 滑块（白色圆） =====
  const knobGrd = ctx.createRadialGradient(
    knobX - knobR * 0.4, b.y - knobR * 0.4, knobR * 0.1,
    knobX, b.y, knobR * 1.15
  );
  knobGrd.addColorStop(0, '#ffffff');
  knobGrd.addColorStop(0.65, '#f8f8f8');
  knobGrd.addColorStop(1, '#dadada');
  ctx.fillStyle = knobGrd;
  ctx.beginPath();
  ctx.arc(knobX, b.y, knobR, 0, TAU);
  ctx.fill();

  // 滑块边框
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(knobX, b.y, knobR, 0, TAU);
  ctx.stroke();

  // ===== 滑块上的文字（随动画切换） =====
  const textOn = t > 0.5;
  ctx.fillStyle = textOn ? '#22a85a' : '#808890';
  ctx.font = 'bold ' + Math.floor(knobR * 1.35) + 'px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(textOn ? '开' : '关', knobX, b.y + 1);
  ctx.textBaseline = 'alphabetic';

  // ===== 顶部标签 =====
  const labelText = '自动释放技能';
  ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(labelText).width;
  const labelY = b.y - H2/2 - 12;
  rr(b.x - tw/2 - 9, labelY - 9, tw + 18, 18, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fill();
  ctx.strokeStyle = autoCast ? '#4ade80' : 'rgba(150,160,160,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = autoCast ? '#b8f5d0' : '#d0d8d8';
  ctx.fillText(labelText, b.x, labelY + 4);

  ctx.restore();
}
// ================= 摇杆 =================
function drawJoystick(j, base, color, label){
  const isActive = j.id !== -1;
  const bx = j.bx, by = j.by;
  ctx.save();
  ctx.globalAlpha = isActive ? 0.55 : 0.16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(bx, by, JOY_R, 0, TAU); ctx.stroke();

  ctx.globalAlpha = isActive ? 0.1 : 0.04;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(bx, by, JOY_R, 0, TAU); ctx.fill();

  const hx = bx + j.dx * JOY_R;
  const hy = by + j.dy * JOY_R;
  ctx.globalAlpha = isActive ? 0.85 : 0.35;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(hx, hy, 30, 0, TAU); ctx.fill();
  ctx.globalAlpha = isActive ? 1 : 0.5;
  ctx.fillStyle = '#0b1210';
  ctx.beginPath(); ctx.arc(hx, hy, 24, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU); ctx.stroke();

  if(label){
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx, by + JOY_R + 26);
  }
  ctx.restore();
}

// ================= 按钮 =================
function drawPauseButton(){
  const x = PAUSE_BTN.x, y = PAUSE_BTN.y, r = PAUSE_BTN.r;

  // 外发光
  ctx.save();
  ctx.shadowColor = 'rgba(140, 240, 180, 0.5)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(30, 46, 38, 0.92)';
  ctx.fill();
  ctx.restore();

  // 圆底渐变
  const grd = ctx.createRadialGradient(x - r*0.35, y - r*0.35, r*0.1, x, y, r);
  grd.addColorStop(0, '#3a6a52');
  grd.addColorStop(0.6, '#1e2e26');
  grd.addColorStop(1, '#0e1814');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = grd;
  ctx.fill();

  // 内环高光
  ctx.strokeStyle = 'rgba(180, 240, 210, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, TAU);
  ctx.stroke();

  // 外边框
  ctx.strokeStyle = '#7fe0a0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();

  // 外圈细白边
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, TAU);
  ctx.stroke();

  // 顶部高光弧
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // 双竖线（暂停图标）
  ctx.fillStyle = '#d8f5e0';
  const bw = r * 0.28;
  const bh = r * 0.9;
  const gap = r * 0.16;
  ctx.fillRect(x - gap - bw, y - bh/2, bw, bh);
  ctx.fillRect(x + gap,      y - bh/2, bw, bh);
}

function drawMissileButton(){
  const b = MISSILE_BTN;
  const charges = player.missileCharges;
  const maxCharges = player.missileChargeMax;
  const ready = charges > 0;
  const R = b.r;
  const pulse = 0.5 + Math.sin(gameTime * 7) * 0.5;

  const fillP = charges >= maxCharges ? 1 : Math.min(1, player.missileChargeTimer / player.missileChargeTime);
  const fullReady = fillP >= 1;

  ctx.save();

  // 就绪外发光
  if(fullReady){
    ctx.strokeStyle = 'rgba(255,190,90,' + (0.65 - pulse * 0.35) + ')';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, R + 8 + pulse * 8, 0, TAU); ctx.stroke();
  }

  // 圆底：深棕 → 亮橙
  const bgGrd = ctx.createRadialGradient(b.x - R*0.3, b.y - R*0.3, R*0.15, b.x, b.y, R);
  bgGrd.addColorStop(0, '#b06030');
  bgGrd.addColorStop(0.55, '#6a3018');
  bgGrd.addColorStop(1, '#2a1208');
  ctx.fillStyle = bgGrd;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();

  // 内环高光（模拟金属感）
  ctx.strokeStyle = 'rgba(255,190,120,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(b.x, b.y, R - 4, 0, TAU); ctx.stroke();

  // 灌水填充
  if(fillP > 0){
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.clip();

    const waterGrd = ctx.createLinearGradient(b.x, b.y - R, b.x, b.y + R);
    if(fullReady){
      waterGrd.addColorStop(0, '#ffd870');
      waterGrd.addColorStop(0.5, '#ff9a30');
      waterGrd.addColorStop(1, '#c86018');
    } else {
      waterGrd.addColorStop(0, '#f0a050');
      waterGrd.addColorStop(1, '#a04820');
    }
    ctx.fillStyle = waterGrd;

    const fillHeight = R * 2 * fillP;
    const waterTopBase = b.y + R - fillHeight;
    const waveAmp = fillP < 1 ? 4 : 0;
    const wavePhase = gameTime * 4;

    ctx.beginPath();
    ctx.moveTo(b.x - R - 2, b.y + R + 2);
    ctx.lineTo(b.x - R - 2, waterTopBase);
    const steps = 16;
    for(let i = 0; i <= steps; i++){
      const t = i / steps;
      const wx = b.x - R + R * 2 * t;
      const waveY = waterTopBase + Math.sin(wavePhase + t * TAU * 2) * waveAmp;
      ctx.lineTo(wx, waveY);
    }
    ctx.lineTo(b.x + R + 2, b.y + R + 2);
    ctx.closePath();
    ctx.fill();

    if(fillP < 1){
      ctx.strokeStyle = 'rgba(255,240,200,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for(let i = 0; i <= steps; i++){
        const t = i / steps;
        const wx = b.x - R + R * 2 * t;
        const waveY = waterTopBase + Math.sin(wavePhase + t * TAU * 2) * waveAmp;
        if(i === 0) ctx.moveTo(wx, waveY); else ctx.lineTo(wx, waveY);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 明显边框（双层）
  ctx.strokeStyle = fullReady ? '#ffb860' : 'rgba(200,130,70,0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.stroke();
  // 外圈暗边
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(b.x, b.y, R + 3, 0, TAU); ctx.stroke();

  // 导弹图标
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(-Math.PI / 4);
  // 弹体
  ctx.fillStyle = ready ? '#fff5d8' : '#b0a898';
  ctx.beginPath();
  ctx.moveTo(-22, -9);
  ctx.lineTo(16, -7);
  ctx.lineTo(24, 0);
  ctx.lineTo(16, 7);
  ctx.lineTo(-22, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 弹头红
  ctx.fillStyle = ready ? '#ff4030' : '#8a4838';
  ctx.beginPath(); ctx.arc(18, 0, 6, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 尾翼
  ctx.fillStyle = ready ? '#ffd080' : '#a09080';
  ctx.beginPath();
  ctx.moveTo(-22, -9); ctx.lineTo(-30, -14); ctx.lineTo(-22, 0);
  ctx.lineTo(-30, 14); ctx.lineTo(-22, 9);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 弹头红
  ctx.fillStyle = ready ? '#ff4030' : '#8a4838';
  ctx.beginPath(); ctx.arc(15, 0, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 尾翼
  ctx.fillStyle = ready ? '#ffd080' : '#a09080';
  ctx.beginPath();
  ctx.moveTo(-18, -7); ctx.lineTo(-25, -12); ctx.lineTo(-18, 0);
  ctx.lineTo(-25, 12); ctx.lineTo(-18, 7);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 右上角数量角标
  const nx = b.x + R * 0.7, ny = b.y - R * 0.7;
  ctx.fillStyle = charges > 0 ? '#ff8a3c' : '#4a3828';
  ctx.beginPath(); ctx.arc(nx, ny, 17, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1808';
  ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#ffd080';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(nx, ny, 17, 0, TAU); ctx.stroke();
  ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  ctx.strokeText(String(charges), nx, ny + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(charges), nx, ny + 1);
  ctx.textBaseline = 'alphabetic';

  // 底部文字
  const label = '导弹 ' + charges + '/' + maxCharges;
  ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  rr(b.x - tw/2 - 9, b.y + R + 6, tw + 18, 22, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fill();
  ctx.strokeStyle = fullReady ? '#ffb860' : 'rgba(150,100,60,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  ctx.strokeText(label, b.x, b.y + R + 22);
  ctx.fillStyle = fullReady ? '#ffd070' : '#c8b8a8';
  ctx.fillText(label, b.x, b.y + R + 22);

  ctx.restore();
}

function drawLaserButton(){
  const b = LASER_BTN;
  const cdRatio = laserCooldown / LASER_COOLDOWN_MAX;
  const ready = laserCooldown <= 0 && !laser.active;
  const active = laser.active;
  const gold = player.laserChargeTimer > 0;
  const mainColor = gold ? '#ffd24a' : '#88eeff';
  const R = b.r;
  const pulse = 0.5 + Math.sin(gameTime * 8) * 0.5;

  ctx.save();

  if(active || ready){
    const color = active ? '255,255,255' : (gold ? '255,215,80' : '120,240,255');
    ctx.strokeStyle = 'rgba(' + color + ',' + (0.6 - pulse * 0.35) + ')';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, R + 6 + pulse * 6, 0, TAU); ctx.stroke();
  }

  const bgGrd = ctx.createRadialGradient(b.x - R*0.35, b.y - R*0.35, R*0.1, b.x, b.y, R);
  if(gold){
    bgGrd.addColorStop(0, '#8a6a20');
    bgGrd.addColorStop(0.6, '#5a4414');
    bgGrd.addColorStop(1, '#3a2c0c');
  } else {
    bgGrd.addColorStop(0, '#2a6a8a');
    bgGrd.addColorStop(0.6, '#1a3e5a');
    bgGrd.addColorStop(1, '#0e2438');
  }
  ctx.fillStyle = bgGrd;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();

  // 冷却扇形遮罩
  if(cdRatio > 0){
    const startAngle = -Math.PI/2 + TAU * (1 - cdRatio);
    const endAngle = -Math.PI/2 + TAU;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fill();
  }

  // 持续中：环形倒计时
  if(active){
    const remainP = Math.max(0, 1 - laser.timer / laser.duration);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, R + 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = gold ? '#ffd24a' : '#88eeff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(b.x, b.y, R + 2, -Math.PI/2 + TAU * (1 - remainP), -Math.PI/2 + TAU);
    ctx.stroke();
  }

  ctx.strokeStyle = active ? '#ffffff' : (ready ? mainColor : 'rgba(110,150,180,0.6)');
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.stroke();

  // 激光图标
  const iconColor = ready ? '#ffffff' : '#c8d8e0';
  ctx.save();
  ctx.translate(b.x, b.y);
  if(active) ctx.rotate(gameTime * 4);
  ctx.fillStyle = iconColor;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
  for(let i = 0; i < 4; i++){
    const a = i * TAU / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
    ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
    ctx.lineWidth = 5;
    ctx.strokeStyle = iconColor;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();

  // 文字：冷却剩余 / 就绪
  if(!active){
    const label = ready ? '就绪' : (laserCooldown.toFixed(1) + 's');
    ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.strokeText(label, b.x, b.y + R + 18);
    ctx.fillStyle = ready ? mainColor : '#a0b0b8';
    ctx.fillText(label, b.x, b.y + R + 18);
    ctx.textBaseline = 'alphabetic';
  }

  const label = gold ? '金色激光 (E)' : '激光 (E)';
  ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  rr(b.x - tw/2 - 9, b.y + R + 28, tw + 18, 22, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  ctx.strokeText(label, b.x, b.y + R + 44);
  ctx.fillStyle = ready ? (gold ? '#fff5c0' : '#e8ffff') : '#c0c8c4';
  ctx.fillText(label, b.x, b.y + R + 44);

  ctx.restore();
}

// ================= HUD =================
function drawBuffTags(){
  const ids = Object.keys(player.buffLevels).filter(k => player.buffLevels[k] > 0);
  if(ids.length === 0) return;
  let x = 96, y = 100;
  ctx.textAlign = 'left';
ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
  for(const id of ids){
    const def = BUFFS.find(b => b.id === id);
    if(!def) continue;
    const lv = player.buffLevels[id];
    const label = def.name + ' ×' + lv;
    const tw = ctx.measureText(label).width;
    const w = tw + 46;
    if(x + w > 420){ x = 96; y += 30; }
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    rr(x, y - 15, w, 26, 8); ctx.fill();
    drawBuffIcon(def.id, x + 16, y - 2, 22, def.color);
    ctx.fillStyle = def.color;
    ctx.fillText(label, x + 32, y + 4);
    x += w + 8;
  }
}

function drawActiveItems(){
  const items = [];
  if(player.laserChargeTimer > 0){
    items.push({
      iconId:'laserup', label:'激光充能', desc:'金色激光 · 伤害翻倍',
      color:'#ffd24a', time: player.laserChargeTimer, max: 15
    });
  }
  if(items.length === 0) return;

  const CW = 224, CH = 58, GAP = 8;
  let y = 320;
  ctx.textAlign = 'left';

  for(const it of items){
    const x = W - CW - 12;

    rr(x, y, CW, CH, 10);
    ctx.fillStyle = 'rgba(10, 18, 14, .88)';
    ctx.fill();
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;

 if(it.iconId){
      drawBuffIcon(it.iconId, x + 28, y + CH/2 - 2, 30, it.color);
    }

    ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = it.color;
    ctx.textAlign = 'left';
    ctx.fillText(it.label, x + 52, y + 24);

    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(200,220,210,.75)';
    ctx.fillText(it.desc, x + 52, y + 42);

    if(it.time !== null){
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = it.color;
      ctx.textAlign = 'right';
      ctx.fillText(it.time.toFixed(1) + 's', x + CW - 10, y + 24);

      const barX = x + 10;
      const barW = CW - 20;
      const barY = y + CH - 7;
      const barH = 3;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(barX, barY, barW, barH);
      const p = Math.max(0, Math.min(1, it.time / it.max));
      ctx.fillStyle = it.color;
      ctx.fillRect(barX, barY, barW * p, barH);
    }

    y += CH + GAP;
  }
}

function drawSkillTip(){
  if(!skillTip.type) return;
  if(!player) return;

  const alpha = Math.min(1, (skillTip.fade || 0));
  const lines = [];
  let title = '';
  let color = '#8ef0a8';

  if(skillTip.type === 'can'){
    title = '罐头投掷';
    color = '#ffcf5c';
    const cd = CAN_AUTO_INTERVAL;
    const dmg = Math.round(player.canDamage);
    const blastR = Math.round(player.blastRadius);
    const canLv = player.buffLevels.canpower || 0;
    const blastLv = player.buffLevels.blast || 0;
    lines.push({ k: '冷却', v: cd.toFixed(1) + ' 秒' });
    lines.push({ k: '触发', v: '自动向最近敌人投掷' });
    lines.push({ k: '攻击范围', v: '爆炸半径 ' + blastR + ' 内所有敌人' });
    lines.push({ k: '中心伤害', v: dmg + '' });
    lines.push({ k: '边缘伤害', v: Math.round(dmg * 0.55) + '（外圈 55%）' });
    if(canLv > 0) lines.push({ k: '罐头强化', v: 'Lv.' + canLv + '  伤害 +' + (canLv * 50) + '%', hl: true });
    if(blastLv > 0) lines.push({ k: '巨型爆炸', v: 'Lv.' + blastLv + '  范围 +' + (blastLv * 35) + '%', hl: true });
  } else if(skillTip.type === 'airstrike'){
    title = '全屏轰炸';
    color = '#ff8a3c';
    const lv = player.airstrikeLevel || 0;
    if(lv <= 0){
      lines.push({ k: '状态', v: '未解锁（需选择对应强化）' });
    } else {
      const cd = player.airstrikeCD;
      const count = player.airstrikeCount;
      const dmg = Math.round(player.airstrikeDamage);
      lines.push({ k: '冷却', v: cd.toFixed(1) + ' 秒' });
      lines.push({ k: '触发', v: '自动空投炸弹' });
      lines.push({ k: '攻击数量', v: count + ' 个敌人' });
      lines.push({ k: '单发伤害', v: dmg + '' });
      lines.push({ k: '边缘伤害', v: Math.round(dmg * 0.5) + '（外圈 50%）' });
      lines.push({ k: '爆炸半径', v: '100' });
      lines.push({ k: '当前等级', v: 'Lv.' + lv + '（每级 +1 炸弹 +30 伤害）', hl: true });
    }
  } else if(skillTip.type === 'laser'){
    const isGold = player.laserChargeTimer > 0;
    title = isGold ? '金色激光' : '激光';
    color = isGold ? '#ffd24a' : '#88eeff';
    const dur = laser.duration;
    const countLv = player.buffLevels.laser_count || 0;
    const powerLv = player.buffLevels.laserpower || 0;
    const maxTargets = 1 + countLv + (isGold ? 1 : 0);
    const dps = Math.round(player.laserDamage * 0.35 * (isGold ? 2 : 1));
    const totalDmg = Math.round(dps * dur);
    lines.push({ k: '冷却', v: LASER_COOLDOWN_MAX + ' 秒' });
    lines.push({ k: '持续时间', v: dur.toFixed(1) + ' 秒' });
    lines.push({ k: '触发', v: '自动锁定最近敌人 + 减速' });
    lines.push({ k: '锁定数量', v: maxTargets + ' 个' + (isGold ? '（金色 +1）' : '') });
    lines.push({ k: '每秒伤害', v: dps + '' });
    lines.push({ k: '预计总伤', v: '约 ' + totalDmg + ' / 每个目标' });
    if(powerLv > 0) lines.push({ k: '激光强化', v: 'Lv.' + powerLv + '  伤害 +' + (powerLv * 45) + '%', hl: true });
    if(countLv > 0) lines.push({ k: '激光分裂', v: 'Lv.' + countLv + '  锁定 +' + countLv + ' 个', hl: true });
  } else if(skillTip.type === 'missile'){
    title = '追踪导弹';
    color = '#ff8a3c';
    const count = player.missileCount;
    const dmg = Math.round(player.missileDamage);
    const maxC = player.missileChargeMax;
    const ct = player.missileChargeTime;
    const cCountLv = player.buffLevels.missile_count || 0;
    const cDmgLv = player.buffLevels.missile_damage || 0;
    const cChgLv = player.buffLevels.missile_charge || 0;
    lines.push({ k: '充能', v: maxC + ' 层上限 · 每 ' + ct.toFixed(1) + ' 秒回 1 层' });
    lines.push({ k: '触发', v: '自动追踪最高血量敌人' });
    lines.push({ k: '发射数量', v: count + ' 枚' });
    lines.push({ k: '单发伤害', v: dmg + '' });
    lines.push({ k: '全中合计', v: '约 ' + (dmg * count) + ' 伤害' });
    if(cCountLv > 0) lines.push({ k: '导弹齐射', v: 'Lv.' + cCountLv + '  数量 +' + cCountLv + ' 枚', hl: true });
    if(cDmgLv > 0) lines.push({ k: '导弹弹头', v: 'Lv.' + cDmgLv + '  伤害 +' + (cDmgLv * 45) + '%', hl: true });
    if(cChgLv > 0) lines.push({ k: '快速装填', v: 'Lv.' + cChgLv + '  充能 -' + Math.round(cChgLv * 28) + '%', hl: true });
  }

  const panelW = 380;
  const paddingX = 20;
  const lineH = 27;
  const titleH = 46;
  const panelH = 14 + titleH + lines.length * lineH + 22;
  const px = (W - panelW) / 2;
  const py = H / 2 - panelH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  rr(px, py, panelW, panelH, 14);
  const grd = ctx.createLinearGradient(px, py, px, py + panelH);
  grd.addColorStop(0, 'rgba(20,32,26,0.97)');
  grd.addColorStop(1, 'rgba(10,16,12,0.97)');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  rr(px, py, panelW, panelH, 14);
  ctx.stroke();

  // 标题底
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = color;
  rr(px, py, panelW, titleH, 14);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // 标题
  ctx.textAlign = 'left';
  ctx.font = 'bold 23px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(title, px + paddingX, py + 33);

  // 分隔线
  ctx.strokeStyle = 'rgba(140,220,180,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + paddingX, py + titleH);
  ctx.lineTo(px + panelW - paddingX, py + titleH);
  ctx.stroke();

  // 内容
  let cy = py + titleH + 10;
  const keyW = 104;
  for(const ln of lines){
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = ln.hl ? color : 'rgba(160,190,175,0.85)';
    ctx.fillText(ln.k, px + paddingX, cy + 17);

    ctx.font = '15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = ln.hl ? '#ffe080' : '#dfe9e3';
    ctx.fillText(ln.v, px + paddingX + keyW, cy + 17);

    cy += lineH;
  }

  // 关闭提示
  ctx.textAlign = 'center';
  ctx.font = '12px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(140,160,150,0.6)';
  ctx.fillText('点击任意位置关闭', px + panelW / 2, py + panelH - 8);

  ctx.restore();
}

// ================= 爱心血条 =================
function heartPath(cx, cy, r){
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.75);
  ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.2, cx - r * 0.55, cy - r * 1.05, cx, cy - r * 0.3);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.05, cx + r * 1.4, cy - r * 0.2, cx, cy + r * 0.75);
  ctx.closePath();
}

function drawHeartAt(cx, cy, r, fillRatio){
  // fillRatio: 0~1，按比例从左往右填充
  heartPath(cx, cy, r);
  ctx.fillStyle = '#2a1010';
  ctx.fill();

  if(fillRatio > 0){
    ctx.save();
    heartPath(cx, cy, r);
    ctx.clip();
    ctx.fillStyle = '#ff4060';
    ctx.fillRect(cx - r * 2, cy - r * 2, r * 4 * fillRatio, r * 4);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  heartPath(cx, cy, r);
  ctx.strokeStyle = '#1a0808';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHealthHearts(startX, centerY){
  const R = 20;
  const GAP = 10;
  const slotW = R * 2 + GAP;

  const totalHearts = Math.ceil(player.maxHp / 4);  // 每颗心 4 单位

  for(let i = 0; i < totalHearts; i++){
    const cx = startX + i * slotW + R;
    const cy = centerY;
    // 这颗心还剩多少单位（0~4）
    const unitsInHeart = Math.max(0, Math.min(4, player.hp - i * 4));
    drawHeartAt(cx, cy, R, unitsInHeart / 4);
  }
}

// 关键词高亮表：武器/技能名 → 颜色
const RICH_KEYWORDS = [
  { word: '金色激光', color: '#ffd24a' },
  { word: '全屏轰炸', color: '#ff4a4a' },
  { word: '猫粮',     color: '#f0a020' },
  { word: '毛球',     color: '#ff70b0' },
  { word: '罐头',     color: '#ff8a3c' },
  { word: '激光',     color: '#40c8e8' },
  { word: '导弹',     color: '#ff6b4a' },
  { word: '空袭',     color: '#ff4a4a' },
  { word: '爆炸',     color: '#ff9a40' },
  { word: '能量',     color: '#60e060' },
  { word: '生命',     color: '#ff6080' },
  { word: '移动',     color: '#7fe0a0' }
];

// 带关键词高亮的自动换行文本
function drawRichWrappedTextCenter(text, cx, y, maxWidth, lineHeight, maxLines, baseColor, fontSize){
  fontSize = fontSize || 20;
  const font = 'bold ' + fontSize + 'px "Microsoft YaHei",sans-serif';

  // 拆成字符 + 高亮标记
  const chars = [];
  let i = 0;
  while(i < text.length){
    let matched = false;
    for(const kw of RICH_KEYWORDS){
      if(text.startsWith(kw.word, i)){
        for(let k = 0; k < kw.word.length; k++){
          chars.push({ ch: kw.word[k], color: kw.color });
        }
        i += kw.word.length;
        matched = true;
        break;
      }
    }
    if(!matched){
      chars.push({ ch: text[i], color: baseColor });
      i++;
    }
  }

  // 分行
  ctx.font = font;
  const lines = [];
  let curLine = [];
  let curW = 0;
  for(const c of chars){
    const w = ctx.measureText(c.ch).width;
    if(curW + w > maxWidth && curLine.length > 0){
      lines.push(curLine);
      curLine = [c];
      curW = w;
    } else {
      curLine.push(c);
      curW += w;
    }
  }
  if(curLine.length) lines.push(curLine);

  const showLines = lines.slice(0, maxLines);

  // 逐行绘制：每行先算总宽，再左起逐字绘制
  for(let li = 0; li < showLines.length; li++){
    const line = showLines[li];
    let totalW = 0;
    for(const c of line){
      ctx.font = font;
      totalW += ctx.measureText(c.ch).width;
    }
    let lx = cx - totalW / 2;
    ctx.textAlign = 'left';
    for(const c of line){
      ctx.font = font;
      ctx.fillStyle = c.color;
      ctx.fillText(c.ch, lx, y + li * lineHeight);
      lx += ctx.measureText(c.ch).width;
    }
  }

  return showLines.length;
}

// 推荐标签（放大 + 高亮）
function drawRecommendTag(x, y){
  const tagW = 76;
  const tagH = 28;
  const tagPulse = 0.5 + Math.sin(gameTime * 5) * 0.5;

  // 外发光
  ctx.save();
  ctx.shadowColor = '#ff2b2b';
  ctx.shadowBlur = 18 + tagPulse * 12;
  rr(x, y, tagW, tagH, 8);
  ctx.fillStyle = '#ff3030';
  ctx.fill();
  ctx.restore();

  // 高光条
  ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + tagPulse * 0.35) + ')';
  rr(x, y, tagW, 4, 3);
  ctx.fill();

  // 边框
  ctx.strokeStyle = '#ffd0d0';
  ctx.lineWidth = 1.5;
  rr(x, y, tagW, tagH, 8);
  ctx.stroke();

  // 文字
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('推荐', x + tagW / 2, y + tagH / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

// 圆形图标底框
function drawCircleIconBack(cx, cy, r, fillColor, ringColor){
  // 底部阴影
  ctx.fillStyle = 'rgba(120, 160, 200, 0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy + 3, r, 0, TAU);
  ctx.fill();

  // 圆底：白 → 主题浅色 径向渐变
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  const grd = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(1, fillColor);
  ctx.fillStyle = grd;
  ctx.fill();

  // 边框
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ================= 竖版卡片自动换行文字 =================
function drawWrappedTextCenter(text, cx, y, maxWidth, lineHeight, maxLines){
  ctx.textAlign = 'center';
  maxLines = maxLines || 3;
  const lines = [];
  let cur = '';
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    const test = cur + ch;
    if(ctx.measureText(test).width > maxWidth && cur.length > 0){
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if(cur) lines.push(cur);

  const showLines = lines.slice(0, maxLines);
  for(let i = 0; i < showLines.length; i++){
    ctx.fillText(showLines[i], cx, y + i * lineHeight);
  }
  return showLines.length;
}

function drawHUD(){
  drawAvatar();

  // 血量：5 颗爱心，每颗 2 分（半心），共 10 滴
  drawHealthHearts(104, 54);

  // 波次信息底板（暂停按钮下方）
  const infoW = 150, infoH = 104;
  const infoX = W - infoW - 12;
  const infoY = 130;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(infoX, infoY, infoW, infoH);
  ctx.strokeStyle = 'rgba(140,220,180,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(infoX, infoY, infoW, infoH);

  // 文字居中，避免左侧留空
  ctx.textAlign = 'center';
  const infoCx = infoX + infoW / 2;

  const line1Y = infoY + 34;
  const line2Y = infoY + 64;
  const line3Y = infoY + 92;

  const isTutorial = (currentStage >= 1 && currentStage <= TUTORIAL_MAX_STAGE);

  // 第一行：第 N 关 / 第 N 波
  const titleText = isTutorial
    ? ('教学 · 第 ' + Math.max(1, waveInStage) + ' 波')
    : ('第 ' + Math.max(1, wave) + ' 波');
  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(titleText, infoCx, line1Y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(titleText, infoCx, line1Y);

  // 第二行：波次进度
  let subText;
  if(isTutorial){
    subText = '第 ' + Math.max(1, waveInStage) + ' / ' + STAGE_WAVES + ' 波';
  } else {
    const remainingThisWave = enemies.length + spawnQueue.length;
    const killedThisWave = Math.max(0, waveTotal - remainingThisWave);
    subText = '本波 ' + killedThisWave + ' / ' + waveTotal;
  }
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(subText, infoCx, line2Y);
  ctx.fillStyle = '#8ef0a8';
  ctx.fillText(subText, infoCx, line2Y);

  // 第三行：剩余敌人
  const remainTotal = enemies.length + spawnQueue.length;
  const remainText = '剩余 ' + remainTotal;
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(remainText, infoCx, line3Y);
  ctx.fillStyle = '#ff9a9a';
  ctx.fillText(remainText, infoCx, line3Y);

  drawBuffTags();
  drawActiveItems();
  drawSkillIcons();
  drawJoystick(moveJoy, MOVE_BASE, '#7fe0a0', '移动');
  if(unlockedWeapons.missile && catBroTakenSkills.indexOf('missile') < 0) drawMissileButton();
  if(unlockedWeapons.laser && catBroTakenSkills.indexOf('laser') < 0)   drawLaserButton();
  drawPauseButton();
  if(isAllWeaponsUnlocked()) drawAutoCastBtn();
  drawHelpQuickBtn();

  if(banner){
    // 位置：屏幕中上部（避开右上角信息板）
    const bannerY = H * 0.34;

    const age = banner.age || 0;
    const life = banner.life;

    // 入场（0~0.35s）：从 0.6 弹到 1.0
    const enterP = Math.min(1, age / 0.35);
    const enterEase = 1 - Math.pow(1 - enterP, 3);
    const scale = 0.6 + enterEase * 0.4;

    // 淡出（最后 0.4s）
    const fadeP = Math.min(1, life / 0.4);
    const alpha = Math.min(enterP, fadeP);

    // 轻微上下漂浮
    const floatY = Math.sin(age * 4) * 4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, bannerY + floatY);
    ctx.scale(scale, scale);

    // 文字尺寸
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Microsoft YaHei",sans-serif';

    const tw = ctx.measureText(banner.text).width;
    const boxW = tw + 70;
    const boxH = 84;

    // 底衬：深色圆角 + 绿色描边 + 外发光
    ctx.save();
    ctx.shadowColor = 'rgba(140, 240, 180, 0.85)';
    ctx.shadowBlur = 18;
    rr(-boxW/2, -boxH/2, boxW, boxH, 18);
    const bgGrd = ctx.createLinearGradient(0, -boxH/2, 0, boxH/2);
    bgGrd.addColorStop(0, 'rgba(10, 24, 16, 0.94)');
    bgGrd.addColorStop(1, 'rgba(4, 12, 8, 0.94)');
    ctx.fillStyle = bgGrd;
    ctx.fill();
    ctx.restore();

    rr(-boxW/2, -boxH/2, boxW, boxH, 18);
    ctx.strokeStyle = 'rgba(140, 240, 180, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 顶部高光
    ctx.save();
    rr(-boxW/2, -boxH/2, boxW, boxH, 18);
    ctx.clip();
    const hl = ctx.createLinearGradient(0, -boxH/2, 0, -boxH/2 + 12);
    hl.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = hl;
    ctx.fillRect(-boxW/2, -boxH/2, boxW, 12);
    ctx.restore();

    // 文字：深色描边 + 亮绿填充 + 阴影
    ctx.save();
    ctx.shadowColor = 'rgba(140, 240, 180, 0.9)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeText(banner.text, 0, 0);
    ctx.restore();

    const txtGrd = ctx.createLinearGradient(0, -22, 0, 22);
    txtGrd.addColorStop(0, '#f0fff4');
    txtGrd.addColorStop(0.5, '#a8f0c0');
    txtGrd.addColorStop(1, '#5cd88a');
    ctx.fillStyle = txtGrd;
    ctx.fillText(banner.text, 0, 0);

    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

// ================= 主菜单 =================
function drawMenuButton(b, text, borderColor, textColor, idx){
  drawAppButton(b, text, borderColor, textColor, {
    fontSize: 30,
    animIdx: idx,
    pulse: true
  });
}

// ---------- 可爱云朵 ----------
function drawCuteClouds(){
  const clouds = [
    { x: 120, y: 210, s: 1.0, speed: 6  },
    { x: 520, y: 150, s: 1.3, speed: 4  },
    { x: 320, y: 300, s: 0.8, speed: 8  },
    { x: 660, y: 260, s: 1.1, speed: 5  },
    { x: -80, y: 240, s: 1.2, speed: 7  }
  ];
  for(const c of clouds){
    const ox = ((c.x + menuTime * c.speed) % (W + 260)) - 130;
    drawCloud(ox, c.y, c.s);
  }
}
function drawCloud(cx, cy, s){
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 34 * s, 0, TAU);
  ctx.arc(cx + 40 * s, cy + 6 * s, 28 * s, 0, TAU);
  ctx.arc(cx - 40 * s, cy + 8 * s, 26 * s, 0, TAU);
  ctx.arc(cx + 12 * s, cy - 18 * s, 26 * s, 0, TAU);
  ctx.fill();
  ctx.fillRect(cx - 66 * s, cy, 132 * s, 30 * s);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffb8c8';
  ctx.beginPath();
  ctx.arc(cx - 50 * s, cy + 12 * s, 8 * s, 0, TAU);
  ctx.arc(cx + 50 * s, cy + 12 * s, 8 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- 微笑太阳 ----------
function drawCuteSun(){
  const sx = W - 120, sy = 150;
  const pulse = 1 + Math.sin(menuTime * 1.8) * 0.05;

  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 140);
  glow.addColorStop(0, 'rgba(255, 230, 150, 0.7)');
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 140, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(menuTime * 0.4);
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.75)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for(let i = 0; i < 8; i++){
    const a = i * TAU / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 62, Math.sin(a) * 62);
    ctx.lineTo(Math.cos(a) * 80, Math.sin(a) * 80);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.arc(sx, sy, 50 * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff0b0';
  ctx.beginPath();
  ctx.arc(sx - 15, sy - 15, 16 * pulse, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#8a5820';
  ctx.beginPath();
  ctx.arc(sx - 15, sy - 3, 3.5, 0, TAU);
  ctx.arc(sx + 15, sy - 3, 3.5, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = '#8a5820';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(sx, sy + 6, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// ---------- 圆润山丘 + 草地 ----------
function drawCuteHills(){
  const baseY1 = H * 0.60;
  ctx.fillStyle = '#ffc8dc';
  ctx.beginPath();
  ctx.moveTo(-50, baseY1 + 200);
  ctx.lineTo(-50, baseY1);
  for(let x = -50; x <= W + 50; x += 20){
    const y = baseY1 - 30 - Math.sin(x * 0.006 + 0.5) * 50 - Math.sin(x * 0.017) * 15;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 50, baseY1 + 200);
  ctx.closePath();
  ctx.fill();

  const baseY2 = H * 0.74;
  ctx.fillStyle = '#a8e8c8';
  ctx.beginPath();
  ctx.moveTo(-50, baseY2 + 200);
  ctx.lineTo(-50, baseY2);
  for(let x = -50; x <= W + 50; x += 20){
    const y = baseY2 - 20 - Math.sin(x * 0.012 + 1) * 28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 50, baseY2 + 200);
  ctx.closePath();
  ctx.fill();

  const baseY3 = H * 0.88;
  ctx.fillStyle = '#78d0a0';
  ctx.beginPath();
  ctx.moveTo(-50, H);
  ctx.lineTo(-50, baseY3);
  for(let x = -50; x <= W + 50; x += 15){
    const y = baseY3 - 8 - Math.sin(x * 0.02 + 2) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 50, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(80, 180, 120, 0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for(let i = 0; i < 40; i++){
    const gx = (i * 137.3) % W;
    const gy = H - 10 - (i * 5.7) % 40;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 3, gy - 8);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 3, gy - 8);
    ctx.stroke();
  }
}

// ---------- 飘落花瓣 ----------
function drawCutePetals(){
  for(let i = 0; i < 26; i++){
    const phase = (menuTime * 0.12 + i * 0.04) % 1;
    const px = (i * 137.5 + Math.sin(menuTime * 0.8 + i) * 60) % W;
    const py = -20 + phase * (H + 40);
    const rot = menuTime * 2 + i;
    const a = Math.sin(phase * Math.PI) * 0.75;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.globalAlpha = a;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#ffc8d8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 柔和光晕 ----------
function drawCuteVignette(){
  const vg = ctx.createRadialGradient(W/2, H/2, H * 0.4, W/2, H/2, H * 0.85);
  vg.addColorStop(0, 'rgba(255, 240, 220, 0)');
  vg.addColorStop(1, 'rgba(255, 200, 220, 0.20)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ---------- 可爱标题 ----------
function drawCuteTitle(cx, cy){
  const txt = '猫咪大作战';
  const pulse = 0.5 + 0.5 * Math.sin(menuTime * 1.6);

  ctx.textAlign = 'center';
  ctx.font = 'bold 72px "Microsoft YaHei",sans-serif';

  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = 24 + pulse * 18;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(txt, cx, cy);
  ctx.restore();

  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(txt, cx, cy);

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#c85880';
  ctx.strokeText(txt, cx, cy);

  const fillGrd = ctx.createLinearGradient(cx, cy - 45, cx, cy + 20);
  fillGrd.addColorStop(0,    '#fff0f6');
  fillGrd.addColorStop(0.45, '#ffb8d0');
  fillGrd.addColorStop(1,    '#ff7aa0');
  ctx.fillStyle = fillGrd;
  ctx.fillText(txt, cx, cy);

  const sweepP = (menuTime * 0.5) % 1.6;
  if(sweepP < 1){
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 260 + sweepP * 520, cy - 70, 60, 100);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(txt, cx, cy);
    ctx.restore();
  }
}

// ---------- 小爱心 / 蝴蝶结 ----------
function drawSmallHeart(cx, cy, size){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ff9fc0';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.7);
  ctx.bezierCurveTo(-size * 1.4, -size * 0.2, -size * 0.5, -size * 1.0, 0, -size * 0.3);
  ctx.bezierCurveTo(size * 0.5, -size * 1.0, size * 1.4, -size * 0.2, 0, size * 0.7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(-size * 0.35, -size * 0.35, size * 0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
}
function drawBow(cx, cy){
  const s = 20;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath();
  ctx.ellipse(-s * 0.9, 0, s * 0.9, s * 0.65, -0.3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.9, 0, s * 0.9, s * 0.65, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffb8d0';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.45, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.arc(-s * 0.15, -s * 0.15, s * 0.12, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- 可爱海报 ----------
function drawCutePoster(){
  const px = 40, py = 200, pw = W - 80, ph = 560;

  rr(px, py, pw, ph, 26);
  const pGrd = ctx.createLinearGradient(px, py, px, py + ph);
  pGrd.addColorStop(0, 'rgba(255, 250, 244, 0.98)');
  pGrd.addColorStop(1, 'rgba(255, 232, 242, 0.98)');
  ctx.fillStyle = pGrd;
  ctx.fill();

  ctx.strokeStyle = '#ffb8d0';
  ctx.lineWidth = 4;
  rr(px, py, pw, ph, 26);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  rr(px + 7, py + 7, pw - 14, ph - 14, 20);
  ctx.stroke();

  drawBow(px + pw/2, py - 2);

  const groundY = py + ph - 100;
  const gGrd = ctx.createLinearGradient(px, groundY - 40, px, groundY + 30);
  gGrd.addColorStop(0, 'rgba(255, 220, 230, 0)');
  gGrd.addColorStop(0.5, 'rgba(255, 200, 220, 0.5)');
  gGrd.addColorStop(1, 'rgba(230, 170, 200, 0.65)');
  ctx.fillStyle = gGrd;
  ctx.fillRect(px + 12, groundY - 40, pw - 24, 80);

  ctx.strokeStyle = 'rgba(220, 140, 170, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 20, groundY);
  ctx.lineTo(px + pw - 20, groundY);
  ctx.stroke();

  // ===== 猫 =====
  const catCx = px + 150;
  const breath = 1 + Math.sin(menuTime * 2.2) * 0.035;
  const bob = Math.sin(menuTime * 3) * 3;
  const catCy = groundY - 45 + bob;
  const catSize = 175;

  ctx.fillStyle = 'rgba(200, 140, 170, 0.35)';
  ctx.beginPath();
  ctx.ellipse(catCx, groundY - 5, 70, 10, 0, 0, TAU);
  ctx.fill();

  // 脚下旋转圈 + 环绕小爱心
  ctx.save();
  ctx.translate(catCx, groundY - 5);
  ctx.strokeStyle = 'rgba(255, 160, 200, ' + (0.35 + 0.2 * Math.sin(menuTime * 2)) + ')';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 55 + Math.sin(menuTime * 2) * 4, 0, TAU);
  ctx.stroke();
  for(let i = 0; i < 4; i++){
    const a = menuTime * 1.2 + i * TAU / 4;
    drawSmallHeart(Math.cos(a) * 68, Math.sin(a) * 22, 7);
  }
  ctx.restore();

  const catGlow = ctx.createRadialGradient(catCx, catCy, 0, catCx, catCy, 130);
  catGlow.addColorStop(0, 'rgba(255, 200, 220, 0.4)');
  catGlow.addColorStop(1, 'rgba(255, 200, 220, 0)');
  ctx.fillStyle = catGlow;
  ctx.beginPath();
  ctx.arc(catCx, catCy, 130, 0, TAU);
  ctx.fill();

  if(SPRITES.cat.loaded && SPRITES.cat.img){
    ctx.save();
    ctx.translate(catCx, catCy);
    ctx.scale(breath, breath);
    ctx.drawImage(SPRITES.cat.img, -catSize/2, -catSize/2, catSize, catSize);
    ctx.restore();
  } else {
    ctx.fillStyle = '#faf6ee';
    ctx.beginPath();
    ctx.arc(catCx, catCy, catSize/2 - 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c85880';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#d878a0';
  ctx.textAlign = 'center';
  ctx.fillText('猫咪主角', catCx, groundY + 44);

  // ===== 怪物 =====
  const enemyRight = px + pw - 30;
  const enemySpots = [
    { key: 'enemy_zombie', x: enemyRight - 75,  y: groundY - 40,  size: 100, phase: 0.0 },
    { key: 'enemy_brute',  x: enemyRight - 195, y: groundY - 68,  size: 135, phase: 1.5 },
    { key: 'enemy_elite',  x: enemyRight - 30,  y: groundY - 110, size: 150, phase: 3.0 }
  ];

  for(const es of enemySpots){
    const spr = SPRITES[es.key];
    const sway = Math.sin(menuTime * 2 + es.phase) * 3;
    const bobE = Math.sin(menuTime * 3 + es.phase) * 3;

    ctx.fillStyle = 'rgba(200, 140, 170, 0.35)';
    ctx.beginPath();
    ctx.ellipse(es.x + sway * 0.5, groundY - 3, es.size * 0.32, es.size * 0.075, 0, 0, TAU);
    ctx.fill();

    const eGlow = ctx.createRadialGradient(es.x + sway, es.y + bobE, 0, es.x + sway, es.y + bobE, es.size * 0.9);
    eGlow.addColorStop(0, 'rgba(255, 180, 200, 0.28)');
    eGlow.addColorStop(1, 'rgba(255, 180, 200, 0)');
    ctx.fillStyle = eGlow;
    ctx.beginPath();
    ctx.arc(es.x + sway, es.y + bobE, es.size * 0.9, 0, TAU);
    ctx.fill();

    if(spr && spr.loaded && spr.img){
      ctx.save();
      ctx.translate(es.x + sway, es.y + bobE);
      ctx.rotate(Math.sin(menuTime * 2.5 + es.phase) * 0.04);
      ctx.drawImage(spr.img, -es.size/2, -es.size/2, es.size, es.size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffc8d8';
      ctx.beginPath();
      ctx.arc(es.x + sway, es.y + bobE, es.size/2 - 10, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#d878a0';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#d878a0';
  ctx.textAlign = 'center';
  ctx.fillText('鼠潮怪物', enemyRight - 110, groundY + 44);

  // ===== 中间飘浮爱心 =====
  const startX = catCx + 90;
  const endX = enemyRight - 50;
  for(let i = 0; i < 12; i++){
    const phase = (menuTime * 0.35 + i * 0.13) % 1;
    const dir = (i % 2 === 0) ? phase : 1 - phase;
    const px2 = startX + (endX - startX) * dir;
    const py2 = groundY - 90 + Math.sin(i * 1.7 + menuTime) * 35;
    const a = Math.sin(phase * Math.PI) * 0.65;
    ctx.save();
    ctx.globalAlpha = a;
    drawSmallHeart(px2, py2, 6);
    ctx.restore();
  }
}

// ================= 公共 UI：背景 / 遮罩 / 按钮 / 标题 =================

// 完整可爱背景：天空 + 云 + 太阳 + 山丘 + 花瓣 + 暗角
function drawAppBackground(){
  const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
  skyGrd.addColorStop(0,    '#ffe8f2');
  skyGrd.addColorStop(0.35, '#fff5e0');
  skyGrd.addColorStop(0.65, '#e0f5ff');
  skyGrd.addColorStop(1,    '#d0f5e0');
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, W, H);

  drawCuteClouds();
  drawCuteSun();
  drawCuteHills();
  drawCutePetals();
  drawCuteVignette();
}

// 暖棕半透明遮罩：给需要看穿游戏世界的界面用
function drawAppOverlay(alpha){
  alpha = (alpha === undefined) ? 0.82 : alpha;
  // 深墨绿遮罩
  ctx.fillStyle = 'rgba(18, 34, 26, ' + alpha + ')';
  ctx.fillRect(0, 0, W, H);
  // 四角加深
  const vg = ctx.createRadialGradient(W/2, H/2, H * 0.25, W/2, H/2, H * 0.85);
  vg.addColorStop(0, 'rgba(40, 90, 60, 0)');
  vg.addColorStop(1, 'rgba(8, 26, 18, 0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// 统一可爱按钮
// opts: { fontSize, animIdx, pulse }
function drawAppButton(b, text, borderColor, textColor, opts){
  // 根据边框颜色，映射到对应的按钮素材
  let btnKey = 'btn_yellow';
  if(borderColor === '#7fb8ff') btnKey = 'btn_blue';
  else if(borderColor === '#ff8fb0' || borderColor === '#c84870') btnKey = 'btn_red';
  else if(borderColor === '#7fe0a0') btnKey = 'btn_green';

  UI.drawButton(ctx, b.x - b.w/2, b.y - b.h/2, b.w, b.h, text, btnKey, opts && opts.fontSize || 24);
}

// 统一可爱标题
function drawAppTitle(text, cx, cy, size){
  size = size || 42;
  const pulse = 0.5 + 0.5 * Math.sin(menuTime * 1.6);

  ctx.textAlign = 'center';
  ctx.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';

  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = 20 + pulse * 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);
  ctx.restore();

  ctx.lineWidth = Math.max(6, size * 0.12);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, cx, cy);

  ctx.lineWidth = Math.max(3, size * 0.07);
  ctx.strokeStyle = '#c85880';
  ctx.strokeText(text, cx, cy);

  const fillGrd = ctx.createLinearGradient(cx, cy - size * 0.6, cx, cy + size * 0.3);
  fillGrd.addColorStop(0,    '#fff0f6');
  fillGrd.addColorStop(0.45, '#ffb8d0');
  fillGrd.addColorStop(1,    '#ff7aa0');
  ctx.fillStyle = fillGrd;
  ctx.fillText(text, cx, cy);
}

// ================= 主菜单 =================
function drawMainMenu(){
  drawAppBackground();

  // 标题
  drawCuteTitle(W/2, 118);

  // 副标题
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('末世鼠潮 · 猫咪反击战', W/2, 162);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('末世鼠潮 · 猫咪反击战', W/2, 162);

  // 海报
  drawCutePoster();

  // 按钮（粉 / 黄 / 蓝）
  drawMenuButton(MENU_START_BTN, '开 始 游 戏', '#ff8fb0', '#c84870', 0);
  drawMenuButton(MENU_LB_BTN,    '排 行 榜',     '#ffb84a', '#c87820', 1);
  drawMenuButton(MENU_HELP_BTN,  '游 戏 说 明',  '#7fb8ff', '#3878b8', 2);

  // 隐藏操作反馈 toast
  if(menuToast.life > 0){
    const a = Math.min(1, menuToast.life / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
    const tw = ctx.measureText(menuToast.text).width;
    const bx = W/2, by = 200;
    rr(bx - tw/2 - 24, by - 28, tw + 48, 56, 14);
    ctx.fillStyle = 'rgba(20, 40, 30, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#7fe0a0';
    ctx.lineWidth = 2;
    rr(bx - tw/2 - 24, by - 28, tw + 48, 56, 14);
    ctx.stroke();
    ctx.fillStyle = '#c8f5d8';
    ctx.fillText(menuToast.text, bx, by);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

// ================= 首屏启动页 =================
function drawBootScreen(){
  drawAppBackground();

  // 标题
  drawCuteTitle(W/2, 240);

  // 副标题
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('末世鼠潮 · 猫咪反击战', W/2, 285);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('末世鼠潮 · 猫咪反击战', W/2, 285);

  // ===== 中间猫 =====
  const cx = W/2;
  const cy = H * 0.52;
  const size = 280;
  const breath = 1 + Math.sin(gameTime * 2.5) * 0.04;
  const bob = Math.sin(gameTime * 3) * 4;

  // 光晕
  const glow = ctx.createRadialGradient(cx, cy + bob, 0, cx, cy + bob, 200);
  glow.addColorStop(0, 'rgba(255, 200, 220, 0.55)');
  glow.addColorStop(1, 'rgba(255, 200, 220, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy + bob, 200, 0, TAU);
  ctx.fill();

  // 脚下旋转爱心圈
  ctx.save();
  ctx.translate(cx, cy + 140);
  ctx.strokeStyle = 'rgba(255, 160, 200, ' + (0.4 + 0.25 * Math.sin(gameTime * 2)) + ')';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 72 + Math.sin(gameTime * 2) * 5, 0, TAU);
  ctx.stroke();
  for(let i = 0; i < 4; i++){
    const a = gameTime * 1.2 + i * TAU / 4;
    drawSmallHeart(Math.cos(a) * 88, Math.sin(a) * 26, 8);
  }
  ctx.restore();

  // 猫本体
  const opt = CAT_OPTIONS.find(o => o.key === catType) || CAT_OPTIONS[0];
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(breath, breath);
  drawCatSpriteAt(opt.spriteKey, 0, 0, size);
  ctx.restore();

  // ===== 底部呼吸提示 =====
  const pulse = 0.5 + 0.5 * Math.sin(gameTime * 3);
  const tipY = H - 200;

  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.strokeText('点击屏幕开始', W/2, tipY);
  ctx.fillStyle = 'rgba(200, 72, 112, ' + (0.55 + pulse * 0.45) + ')';
  ctx.fillText('点击屏幕开始', W/2, tipY);

  ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(180, 120, 140, ' + (0.6 + pulse * 0.3) + ')';
  ctx.fillText('开启声音 · 进入游戏', W/2, tipY + 34);

  // 底部小爱心装饰
  for(let i = 0; i < 3; i++){
    const hx = W/2 + (i - 1) * 60;
    const hy = tipY + 90 + Math.sin(gameTime * 2 + i) * 4;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(gameTime * 2 + i * 1.3);
    drawSmallHeart(hx, hy, 8);
    ctx.restore();
  }
}

// ================= 选猫界面 =================
function drawCatSelectScreen(){
  drawAppBackground();

  drawAppTitle('选 择 你 的 猫 咪', W/2, 100, 42);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('两只猫属性完全相同，只有样子不同', W/2, 140);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('两只猫属性完全相同，只有样子不同', W/2, 140);

  // 两张卡片
  for(const card of CAT_CARD_RECTS){
    const opt = CAT_OPTIONS.find(o => o.key === card.key);
    const isSelected = (catType === card.key);
    const cxCard = card.x + card.w / 2;
    const cyCard = card.y + card.h / 2;

    // 卡片底
    rr(card.x, card.y, card.w, card.h, 22);
    const grd = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.h);
    if(isSelected){
      grd.addColorStop(0, 'rgba(255, 245, 252, 0.99)');
      grd.addColorStop(1, 'rgba(255, 220, 235, 0.99)');
    } else {
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      grd.addColorStop(1, 'rgba(255, 240, 248, 0.85)');
    }
    ctx.fillStyle = grd;
    ctx.fill();

    // 边框
    if(isSelected){
      ctx.save();
      ctx.shadowColor = '#ff8fb0';
      ctx.shadowBlur = 16 + Math.sin(menuTime * 4) * 6;
      ctx.strokeStyle = '#ff8fb0';
      ctx.lineWidth = 5;
      rr(card.x, card.y, card.w, card.h, 22);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255, 160, 200, 0.55)';
      ctx.lineWidth = 2.5;
      rr(card.x, card.y, card.w, card.h, 22);
      ctx.stroke();
    }

    // 猫图
    const imgCy = card.y + 190;
    const imgSize = 230;
    // 呼吸
    const breath = 1 + Math.sin(menuTime * 2 + (card.key === 'mimi' ? 0 : 1.5)) * 0.03;
    // 光晕
    const glow = ctx.createRadialGradient(cxCard, imgCy, 0, cxCard, imgCy, 140);
    if(isSelected){
      glow.addColorStop(0, 'rgba(255, 180, 210, 0.55)');
      glow.addColorStop(1, 'rgba(255, 180, 210, 0)');
    } else {
      glow.addColorStop(0, 'rgba(255, 200, 220, 0.28)');
      glow.addColorStop(1, 'rgba(255, 200, 220, 0)');
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cxCard, imgCy, 140, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(cxCard, imgCy);
    ctx.scale(breath, breath);
    drawCatSpriteAt(opt.spriteKey, 0, 0, imgSize);
    ctx.restore();

    // 名字
    const nameY = card.y + card.h - 100;
    const name = catNames[card.key] || opt.defaultName;
    ctx.textAlign = 'center';

    // 名字底
    ctx.font = 'bold 30px "Microsoft YaHei",sans-serif';
    const nameW = Math.max(140, ctx.measureText(name).width + 40);
    rr(cxCard - nameW/2, nameY - 34, nameW, 48, 14);
    ctx.fillStyle = isSelected
      ? 'rgba(255, 200, 220, 0.95)'
      : 'rgba(255, 235, 242, 0.9)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff8fb0' : 'rgba(255, 160, 200, 0.6)';
    ctx.lineWidth = 2;
    rr(cxCard - nameW/2, nameY - 34, nameW, 48, 14);
    ctx.stroke();

    ctx.fillStyle = '#c84870';
    ctx.fillText(name, cxCard, nameY + 1);

    // 改名提示
    ctx.font = 'bold 13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(200, 120, 150, 0.8)';
    ctx.fillText('✎ 点击名字可以改名', cxCard, nameY + 40);

    // 选中标记
    if(isSelected){
      const badgeX = card.x + card.w - 24;
      const badgeY = card.y + 24;
      ctx.fillStyle = '#ff8fb0';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(badgeX - 8, badgeY + 1);
      ctx.lineTo(badgeX - 2, badgeY + 7);
      ctx.lineTo(badgeX + 9, badgeY - 6);
      ctx.stroke();
    }
  }

  // 按钮
  drawAppButton(CATCHOOSE_START_BTN, '开 始 游 戏', '#7fe0a0', '#289858', { fontSize: 30, pulse: true });
  drawAppButton(CATCHOOSE_BACK_BTN,  '返 回',       '#7fb8ff', '#3878b8', { fontSize: 24 });
}

// ================= 游戏说明 =================
function drawHelpIcon(type, cx, cy, size){
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);

  if(type === 'move'){
    ctx.strokeStyle = '#7fe0a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#7fe0a0';
    ctx.beginPath();
    ctx.arc(s * 0.3, -s * 0.3, s * 0.35, 0, TAU);
    ctx.fill();
  } else if(type === 'bullet'){
    ctx.fillStyle = '#ffb84a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff0c0';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.25, s * 0.3, 0, TAU);
    ctx.fill();
  } else if(type === 'orb'){
    const g = ctx.createRadialGradient(-s*0.25, -s*0.25, 0, 0, 0, s);
    g.addColorStop(0, '#ffe0ec');
    g.addColorStop(0.6, '#ffb0d0');
    g.addColorStop(1, '#e080a8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, TAU);
    ctx.fill();
  } else if(type === 'can'){
    ctx.fillStyle = '#c6ced4';
    ctx.beginPath();
    ctx.ellipse(0, -s*0.1, s*0.7, s*0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8543f';
    ctx.fillRect(-s*0.7, -s*0.3, s*1.4, s*0.5);
  } else if(type === 'laser'){
    ctx.fillStyle = '#88eeff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, 0, TAU);
    ctx.fill();
    for(let i = 0; i < 4; i++){
      const a = i * TAU / 4;
      ctx.strokeStyle = '#88eeff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
      ctx.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9);
      ctx.stroke();
    }
  } else if(type === 'missile'){
    ctx.fillStyle = '#ff8a3c';
    ctx.beginPath();
    ctx.moveTo(-s*0.6, -s*0.4);
    ctx.lineTo(s*0.65, 0);
    ctx.lineTo(-s*0.6, s*0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe080';
    ctx.beginPath();
    ctx.arc(s*0.45, 0, s*0.18, 0, TAU);
    ctx.fill();
  } else if(type === 'energy'){
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,200,0.98)');
    g.addColorStop(0.4, 'rgba(140,255,120,0.85)');
    g.addColorStop(1, 'rgba(60,200,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.9, 0, TAU);
    ctx.fill();
  } else if(type === 'buff'){
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    for(let i = 0; i < 5; i++){
      const a = -Math.PI / 2 + i * TAU / 5;
      const x1 = Math.cos(a) * s * 0.9;
      const y1 = Math.sin(a) * s * 0.9;
      const a2 = a + TAU / 10;
      const x2 = Math.cos(a2) * s * 0.4;
      const y2 = Math.sin(a2) * s * 0.4;
      if(i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHelpScreen(){
  drawAppBackground();

  drawAppTitle('玩 法 说 明', W/2, 100, 44);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('点击任意项目查看教学', W/2, 140);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('点击任意项目查看教学', W/2, 140);

  helpListRects = [];

  const cardX = 60;
  const cardW = W - 120;
  const cardH = 82;
  const gap = 12;
  let cy = 180;

  for(let i = 0; i < HELP_LIST_ITEMS.length; i++){
    const it = HELP_LIST_ITEMS[i];
    const x = cardX;
    const y = cy;

    // 卡片底
    rr(x, y, cardW, cardH, 16);
    const grd = ctx.createLinearGradient(x, y, x, y + cardH);
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.97)');
    grd.addColorStop(1, 'rgba(255, 235, 245, 0.97)');
    ctx.fillStyle = grd;
    ctx.fill();

    // 边框
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 2.5;
    rr(x, y, cardW, cardH, 16);
    ctx.stroke();

    // 左侧圆形图标底
    const iconCx = x + 46;
    const iconCy = y + cardH / 2;
    ctx.save();
    ctx.shadowColor = it.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 28, 0, TAU);
    const iconBg = ctx.createRadialGradient(iconCx - 10, iconCy - 10, 4, iconCx, iconCy, 28);
    iconBg.addColorStop(0, '#ffffff');
    iconBg.addColorStop(1, 'rgba(240, 250, 255, 0.95)');
    ctx.fillStyle = iconBg;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 28, 0, TAU);
    ctx.stroke();

    // 图标
    drawBuffIcon(it.icon, iconCx, iconCy, 30, it.color);

    // 标题
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = it.color;
    ctx.fillText(it.title, x + 92, y + 30);

    // 描述
    ctx.font = '15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#7a5040';
    ctx.fillText(it.desc, x + 92, y + 58);

    // 右侧箭头
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = it.color;
    ctx.fillText('▶', x + cardW - 30, y + cardH / 2 + 2);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';

    helpListRects.push({ x, y, w: cardW, h: cardH, key: it.key });

    cy += cardH + gap;
  }

  drawAppButton(HELP_BACK_BTN, '返 回', '#7fb8ff', '#3878b8', { fontSize: 28 });
}

// ================= 胜利 =================
function drawStar(cx, cy, r, color){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  for(let i = 0; i < 5; i++){
    const a = -Math.PI / 2 + i * TAU / 5;
    const x1 = Math.cos(a) * r;
    const y1 = Math.sin(a) * r;
    const a2 = a + TAU / 10;
    const x2 = Math.cos(a2) * r * 0.45;
    const y2 = Math.sin(a2) * r * 0.45;
    if(i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVictoryScreen(){
  drawAppOverlay(0.88);

  const grd = ctx.createRadialGradient(W/2, 300, 0, W/2, 300, 420);
  grd.addColorStop(0, 'rgba(255, 220, 120, 0.25)');
  grd.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  for(let i = 0; i < 8; i++){
    const a = gameTime * 1.5 + i * TAU / 8;
    const sx = W/2 + Math.cos(a) * 250;
    const sy = 150 + Math.sin(a) * 55;
    const sz = 8 + Math.sin(gameTime * 3 + i) * 4;
    drawStar(sx, sy, sz, 'rgba(255, 220, 120, ' + (0.6 + 0.4 * Math.sin(gameTime * 4 + i)) + ')');
  }

  drawAppTitle('胜 利 !', W/2, 165, 72);

  ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
  ctx.strokeText('你已通关全部 ' + MAX_WAVE + ' 波！', W/2, 215);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillText('你已通关全部 ' + MAX_WAVE + ' 波！', W/2, 215);

  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  ctx.strokeText('存活至第 ' + wave + ' 波  ·  得分 ' + score, W/2, 248);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillText('存活至第 ' + wave + ' 波  ·  得分 ' + score, W/2, 248);

  const statsBottom = drawDamageStats(W/2, 290, false);

  const tipY = Math.max(statsBottom + 45, 720);
  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
  ctx.strokeText('要继续挑战无尽模式吗？', W/2, tipY);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillText('要继续挑战无尽模式吗？', W/2, tipY);

  const cb = VICTORY_CONTINUE_BTN;
  cb.y = tipY + 62;
  drawAppButton(cb, '继 续 战 斗', '#7fe0a0', '#289858', { fontSize: 30 });

  const eb = VICTORY_END_BTN;
  eb.y = cb.y + 120;
  drawAppButton(eb, '结算并返回主界面', '#ffb84a', '#c87820', { fontSize: 26 });
}

function returnToMenu(){
  recordRun();
  clearProgress();
  state = 'menu';
  menuInit();
  stopBGM();
  skillTip = { type: null, fade: 0 };
  waveCapDisabled = false;
  // 清空世界，防止残留
  enemies = []; bullets = []; eBullets = []; cans = [];
  particles = []; rings = []; burnMarks = []; drops = [];
  missileList = [];
  floatTexts = [];
  wave = 0;
  score = 0;
}

// ================= 暂停 =================
function drawConfirmRestart(){
  // 全屏遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  // 对话框面板
  const boxW = 460, boxH = 300;
  const boxX = W/2 - boxW/2, boxY = H/2 - boxH/2 - 30;
  ctx.fillStyle = 'rgba(20,14,12,0.98)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#ff7a5a';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9a7a';
  ctx.font = 'bold 34px "Microsoft YaHei",sans-serif';
  ctx.fillText('确认退出游戏？', W/2, boxY + 62);

  // 提示文字
  ctx.fillStyle = '#e8d8d0';
  ctx.font = '20px "Microsoft YaHei",sans-serif';
  ctx.fillText('本局将结算并返回主菜单', W/2, boxY + 116);

  ctx.fillStyle = '#ff9a7a';
  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.fillText('第 ' + Math.max(1, wave) + ' 波  ·  得分 ' + score, W/2, boxY + 152);

  ctx.fillStyle = '#b0a0a0';
  ctx.font = '15px "Microsoft YaHei",sans-serif';
  ctx.fillText('此操作不可撤销', W/2, boxY + 184);

  // 取消按钮
  const no = CONFIRM_NO_BTN;
  const nx = no.x - no.w/2, ny = no.y - no.h/2;
  rr(nx, ny, no.w, no.h, 12);
  ctx.fillStyle = 'rgba(120,130,120,0.25)';
  ctx.fill();
  ctx.strokeStyle = '#8a9a90';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#c8d8ce';
  ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
  ctx.fillText('取消', no.x, no.y + 9);

  // 确认按钮
  const yes = CONFIRM_YES_BTN;
  const yx = yes.x - yes.w/2, yy = yes.y - yes.h/2;
  rr(yx, yy, yes.w, yes.h, 12);
  ctx.fillStyle = 'rgba(255,90,60,0.28)';
  ctx.fill();
  ctx.strokeStyle = '#ff5a3c';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffd0c0';
  ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
  ctx.fillText('确认', yes.x, yes.y + 9);
}
function drawPauseOverlay(){
  drawAppOverlay(0.85);

  drawAppTitle('游 戏 暂 停', W/2, 110, 48);

  ctx.textAlign = 'center';
  ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
  ctx.strokeText('第 ' + Math.max(1, wave) + ' 波  ·  得分 ' + score, W/2, 152);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillText('第 ' + Math.max(1, wave) + ' 波  ·  得分 ' + score, W/2, 152);

  drawDamageStats(W / 2, 200, false);

  drawAppButton(RESUME_BTN,     '继 续',     '#7fe0a0', '#289858', { fontSize: 30 });
  drawAppButton(PAUSE_LB_BTN,   '排行榜',    '#ffd24a', '#c87820', { fontSize: 22 });
  drawAppButton(PAUSE_HELP_BTN, '玩法说明',  '#7fb8ff', '#3878b8', { fontSize: 22 });
  drawAppButton(RESTART_BTN,    '退出游戏',  '#ff8fb0', '#c84870', { fontSize: 22 });

  ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255, 220, 200, 0.75)';
  ctx.textAlign = 'center';
  ctx.fillText('按 P 或 Esc 也可继续', W / 2, H - 40);
}

// ================= Buff 选择 =================
function drawBuffSelect(){
  const ease = 1 - Math.pow(1 - Math.max(0, buffFadeIn), 3);

  ctx.save();
  ctx.globalAlpha = ease;

  const n = buffChoices.length;

  const CW = 196;
  const CH = 352;
  const GAP = 12;

  // ★ 面板宽度始终按 3 张卡算，卡片居中显示
  const panelCardCount = 3;
  const panelTotalW = CW * panelCardCount + GAP * (panelCardCount - 1);

  // 检查选项里是否有解锁卡（先判定，面板高度要用）
  const hasUnlockCard = buffChoices.some(c => c && c.isUnlock);

  // ===== 面板尺寸 =====
  const panelPad = 30;
  const headerH = 150;
  const panelW = panelTotalW + panelPad * 2;
  const panelH = headerH + CH + (hasUnlockCard ? 130 : 40);
  const panelX = (W - panelW) / 2;
  const panelY = (H - panelH) / 2;

  // ===== 背景面板 =====
  rr(panelX, panelY, panelW, panelH, 24);
  const panelGrd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrd.addColorStop(0, 'rgba(20, 36, 26, 0.94)');
  panelGrd.addColorStop(1, 'rgba(8, 20, 14, 0.94)');
  ctx.fillStyle = panelGrd;
  ctx.fill();

  // 外边框发光
  ctx.save();
  ctx.shadowColor = 'rgba(140, 240, 180, 0.7)';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(140, 240, 180, 0.85)';
  ctx.lineWidth = 3;
  rr(panelX, panelY, panelW, panelH, 24);
  ctx.stroke();
  ctx.restore();

  // 内层细线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  rr(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 20);
  ctx.stroke();

  // 顶部高光
  ctx.save();
  rr(panelX, panelY, panelW, panelH, 24);
  ctx.clip();
  const hl = ctx.createLinearGradient(0, panelY, 0, panelY + 14);
  hl.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(panelX, panelY, panelW, 14);
  ctx.restore();

  // ===== 标题区 =====
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleText = isSecondPick ? '✨ 暴击触发！ ✨' : ('第 ' + wave + ' 波清除');
  const titleSize = isSecondPick ? 40 : 34;
  const titleY = panelY + 55;

  ctx.font = 'bold ' + titleSize + 'px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(titleText, W / 2, titleY);

  if(isSecondPick){
    const tg = ctx.createLinearGradient(0, titleY - 22, 0, titleY + 22);
    tg.addColorStop(0, '#fff5c0');
    tg.addColorStop(0.5, '#ffd24a');
    tg.addColorStop(1, '#ffb020');
    ctx.fillStyle = tg;
  } else {
    ctx.fillStyle = '#8ef0a8';
  }
  ctx.fillText(titleText, W / 2, titleY);

  // 副标题
  const subText = isSecondPick ? '再选一项强化！' : '请选择一项强化';
  const subY = panelY + 105;

  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(subText, W / 2, subY);
  ctx.fillStyle = '#dfe9e3';
  ctx.fillText(subText, W / 2, subY);

  // ===== 卡片区域（居中） =====
  const cardAreaW = CW * n + GAP * (n - 1);
  const sx = panelX + (panelW - cardAreaW) / 2;
  const sy = panelY + headerH;

  buffCards = [];

  for(let i = 0; i < n; i++){
    const b = buffChoices[i];
    const x = sx + i * (CW + GAP);
    const y = sy;

    // 卡片依次入场
    const cardDelay = i * 0.15;
    const cardP = Math.max(0, Math.min(1, (buffFadeIn - cardDelay) / 0.6));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const cardEase = 1 + c3 * Math.pow(cardP - 1, 3) + c1 * Math.pow(cardP - 1, 2);
    const offsetY = (1 - cardEase) * 60;
    const cardAlpha = Math.min(1, cardP * 1.5);

    buffCards.push({ x, y, w: CW, h: CH, buff: b });

    ctx.save();
    ctx.globalAlpha = ease * cardAlpha;
    ctx.translate(0, offsetY);

    const lv = player.buffLevels[b.id] || 0;
    const pulse = 0.5 + Math.sin(gameTime * 4 + i * 1.2) * 0.5;

    // ★ 按稀有度取色
    const rarity = getBuffRarity(b);
    const rc = RARITY_COLORS[rarity] || RARITY_COLORS.blue;

    // 武器类型名
    const wtype = BUFF_WEAPON_TYPE[b.id];
    const wname = b.isUnlock ? '解锁' : (WEAPON_TYPE_NAMES[wtype] || '通用');

    // ==================== 卡片底 ====================
    rr(x, y, CW, CH, 16);
    const grd = ctx.createLinearGradient(x, y, x, y + CH);
    grd.addColorStop(0, rc.bgTop);
    grd.addColorStop(1, rc.bgBot);
    ctx.fillStyle = grd;
    ctx.fill();

    // 外发光
    ctx.save();
    if(b.isUnlock){
      const boost = 0.5 + Math.sin(gameTime * 6) * 0.5;
      ctx.shadowColor = rc.glow;
      ctx.shadowBlur = 32 + boost * 28;
      ctx.strokeStyle = rc.border;
      ctx.lineWidth = 5;
    } else {
      ctx.shadowColor = rc.glow;
      ctx.shadowBlur = 16 + pulse * 10;
      ctx.strokeStyle = rc.border;
      ctx.lineWidth = 3;
    }
    rr(x, y, CW, CH, 16);
    ctx.stroke();
    ctx.restore();

    // ==================== 塔罗风装饰 ====================
    rr(x + 5, y + 5, CW - 10, CH - 10, 12);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    rr(x + 8, y + 8, CW - 16, CH - 16, 10);
    ctx.strokeStyle = rc.border;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const drawDiamond = (dx, dy, size, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(dx, dy - size);
      ctx.lineTo(dx + size, dy);
      ctx.lineTo(dx, dy + size);
      ctx.lineTo(dx - size, dy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    const cornerColor = rc.border;
    const cs = 5;
    drawDiamond(x + 14, y + 14, cs, cornerColor);
    drawDiamond(x + CW - 14, y + 14, cs, cornerColor);
    drawDiamond(x + 14, y + CH - 14, cs, cornerColor);
    drawDiamond(x + CW - 14, y + CH - 14, cs, cornerColor);

    // 顶部菱形吊坠
    const topCx = x + CW / 2;
    ctx.fillStyle = cornerColor;
    ctx.beginPath();
    ctx.moveTo(topCx, y - 6);
    ctx.lineTo(topCx + 8, y + 2);
    ctx.lineTo(topCx, y + 10);
    ctx.lineTo(topCx - 8, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 底部菱形吊坠
    ctx.fillStyle = cornerColor;
    ctx.beginPath();
    ctx.moveTo(topCx, y + CH + 6);
    ctx.lineTo(topCx + 8, y + CH - 2);
    ctx.lineTo(topCx, y + CH - 10);
    ctx.lineTo(topCx - 8, y + CH - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 左右凸起
    const drawSideBump = (bx, dir) => {
      ctx.fillStyle = cornerColor;
      ctx.beginPath();
      ctx.moveTo(bx, y + CH / 2 - 8);
      ctx.lineTo(bx + dir * 6, y + CH / 2);
      ctx.lineTo(bx, y + CH / 2 + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    drawSideBump(x, 1);
    drawSideBump(x + CW, -1);

    // 顶部高光
    ctx.save();
    rr(x, y, CW, 8, 16);
    ctx.clip();
    const hlGrd = ctx.createLinearGradient(x, y, x + CW, y);
    hlGrd.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    hlGrd.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
    hlGrd.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.fillStyle = hlGrd;
    ctx.fillRect(x, y, CW, 6);
    ctx.restore();

    // ==================== 推荐标签 ====================
    if(isRecommended(b.id)){
      const tagW = 70;
      const tagH = 26;
      const tagX = x + CW - tagW + 8;
      const tagY = y - 12;
      const tagPulse = 0.5 + Math.sin(gameTime * 5) * 0.5;

      ctx.save();
      ctx.shadowColor = '#ff2b2b';
      ctx.shadowBlur = 14 + tagPulse * 12;
      rr(tagX, tagY, tagW, tagH, 8);
      ctx.fillStyle = '#ff3030';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + tagPulse * 0.35) + ')';
      rr(tagX + 3, tagY + 3, tagW - 6, 4, 2);
      ctx.fill();

      ctx.strokeStyle = '#ffd0d0';
      ctx.lineWidth = 1.5;
      rr(tagX, tagY, tagW, tagH, 8);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('推荐', tagX + tagW / 2, tagY + tagH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // ==================== 区域 1：标题（颜色按稀有度） ====================
    const sec1Bot = y + 76;

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
    const nameY = y + 38;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(b.name, x + CW / 2, nameY);
    ctx.fillStyle = rc.title;
    ctx.fillText(b.name, x + CW / 2, nameY);
    ctx.restore();

    ctx.fillStyle = '#5a6a88';
    ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
    if(b.isUnlock){
      ctx.fillText('解锁新武器', x + CW / 2, y + 64);
    } else {
      ctx.fillText('Lv.' + lv + ' / ' + b.max, x + CW / 2, y + 64);
    }

    // 分割线 1
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 24, sec1Bot);
    ctx.lineTo(x + CW - 24, sec1Bot);
    ctx.stroke();

    // ==================== 区域 2：图标 + 右下角武器类型标签 ====================
    const sec2Bot = y + 195;
    const iconCy = (sec1Bot + sec2Bot) / 2;
    const iconR = 44;

    drawCircleIconBack(x + CW / 2, iconCy, iconR, '#f4fbff', 'rgba(120, 180, 220, 0.9)');
    drawBuffIcon(b.id, x + CW / 2, iconCy, iconR * 1.3, b.color || '#2a4a62');

    // 右下角小标签
    {
      const tagW = 52;
      const tagH = 22;
      const tagCx = x + CW / 2 + iconR * 0.65;
      const tagCy = iconCy + iconR * 0.65;
      const tagX = tagCx - tagW / 2;
      const tagY = tagCy - tagH / 2;

      rr(tagX, tagY, tagW, tagH, 8);
      ctx.fillStyle = rc.tagBg;
      ctx.fill();
      ctx.strokeStyle = rc.tagBorder;
      ctx.lineWidth = 1.5;
      rr(tagX, tagY, tagW, tagH, 8);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wname, tagCx, tagCy + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // 分割线 2
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 24, sec2Bot);
    ctx.lineTo(x + CW - 24, sec2Bot);
    ctx.stroke();

    // ==================== 区域 3：描述底框 ====================
    const boxTop = sec2Bot + 8;
    const boxLeft = x + 10;
    const boxRight = x + CW - 10;
    const boxBottom = y + CH - 10;

    rr(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 10);
    ctx.fillStyle = 'rgba(200, 208, 215, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 160, 185, 0.55)';
    ctx.lineWidth = 1;
    rr(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 10);
    ctx.stroke();

    const descAreaY = boxTop + 26;
    const descAreaW = boxRight - boxLeft - 12;
    const descCx = (boxLeft + boxRight) / 2;

    const descLines = drawRichWrappedTextCenter(
      b.desc, descCx, descAreaY, descAreaW, 24, 2, '#1a3a52', 19
    );

    const previewText = getBuffPreviewText(b.id, lv);
    if(previewText){
      const previewY = descAreaY + descLines * 24 + 12;
      drawRichWrappedTextCenter(
        previewText, descCx, previewY, descAreaW, 24, 2, '#c87820', 19
      );
    }

    ctx.restore();

    // ★ 有解锁卡时：非解锁卡加暗色遮罩
    if(hasUnlockCard && !b.isUnlock){
      ctx.save();
      ctx.globalAlpha = ease;
      rr(x, y, CW, CH, 16);
      ctx.fillStyle = 'rgba(6, 12, 9, 0.72)';
      ctx.fill();
      ctx.restore();
    }
  }

  // ★ 解锁卡强指引：脉冲光环 + 下方箭头提示
  if(hasUnlockCard){
    const unlockCard = buffChoices.find(c => c && c.isUnlock);
    const unlockIdx = buffChoices.indexOf(unlockCard);
    const ux = sx + unlockIdx * (CW + GAP);
    const uy = sy;

    const pulse = 0.5 + Math.sin(gameTime * 5) * 0.5;

    // 大光环
    ctx.save();
    ctx.globalAlpha = ease;
    ctx.shadowColor = 'rgba(255, 210, 74, 1)';
    ctx.shadowBlur = 40 + pulse * 30;
    ctx.strokeStyle = 'rgba(255, 210, 74, ' + (0.9 - pulse * 0.3) + ')';
    ctx.lineWidth = 5;
    rr(ux - 8 - pulse * 6, uy - 8 - pulse * 6,
       CW + 16 + pulse * 12, CH + 16 + pulse * 12, 22);
    ctx.stroke();
    ctx.restore();

    // 下方箭头（朝上指卡片）
    ctx.save();
    ctx.globalAlpha = ease;
    const arrowCx = ux + CW / 2;
    const arrowTop = uy + CH + 16 + pulse * 6;

    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(arrowCx, arrowTop);              // 顶点朝上
    ctx.lineTo(arrowCx + 20, arrowTop + 26);
    ctx.lineTo(arrowCx - 20, arrowTop + 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 下方文字
    ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    const txt = '点击金色卡片解锁新技能';
    const txtY = arrowTop + 26 + 26;
    ctx.strokeText(txt, W/2, txtY);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(txt, W/2, txtY);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  ctx.restore();
}

// ================= 死亡 =================
function drawDeadScreen(){
  drawAppOverlay(0.9);

  drawAppTitle('喵 星 陨 落', W/2, 80, 52);

  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
  ctx.strokeText('存活到第 ' + wave + ' 波  ·  得分 ' + score, W/2, 122);
  ctx.fillStyle = '#ffd0c0';
  ctx.fillText('存活到第 ' + wave + ' 波  ·  得分 ' + score, W/2, 122);

  drawDamageStats(W/2, 180, false);

  drawAppButton(DEAD_LB_BTN,      '排行榜',   '#ffd24a', '#c87820', { fontSize: 24 });
  drawAppButton(DEAD_RESTART_BTN, '重新开始', '#7fe0a0', '#289858', { fontSize: 24 });

  ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255, 220, 200, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('按 R 也可重开', W/2, H - 40);
}

// ================= 教程界面 =================
function drawTutorialScreen(){
  const step = tutorialQueue[tutorialStep];
  if(!step) return;

  // ============ 有演示动画：全屏遮罩 + 演示区 + 描述 ============
  if(step.demo){
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 顶部标题
    ctx.font = 'bold 30px "Microsoft YaHei",sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(step.title, W/2, 100);
    const tg = ctx.createLinearGradient(0, 78, 0, 122);
    tg.addColorStop(0, '#fff5c0');
    tg.addColorStop(1, '#ffd24a');
    ctx.fillStyle = tg;
    ctx.fillText(step.title, W/2, 100);

    // 演示区：屏幕居中
    const demoW = 460;
    const demoH = 260;
    const demoX = (W - demoW) / 2;
    const demoY = H / 2 - demoH / 2 - 40;
    drawTutorialDemo(step.demo, demoX, demoY, demoW, demoH);

    // 描述
    ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#dfe9e3';
    let ly = demoY + demoH + 70;
    for(const line of step.lines){
      ctx.fillText(line, W/2, ly);
      ly += 38;
    }

    // 提示
    const pls = 0.5 + Math.sin(gameTime * 3) * 0.5;
    ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(140, 240, 180, ' + (0.55 + pls * 0.45) + ')';
    ctx.fillText(step.hint || '点击屏幕继续', W/2, ly + 40);

    // 进度点
    drawTutorialProgressDots();

    ctx.textBaseline = 'alphabetic';
    return;
  }

  // ============ 无演示：原挖洞 + 高亮 + 面板逻辑 ============
  const pos = step.getPos();
  const pulse = 0.5 + Math.sin(gameTime * 4) * 0.5;

  // ===== 1. 遮罩：用 evenodd 挖洞，让高亮区域透明 =====
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);

  if(step.shape === 'circle'){
    ctx.arc(pos.x, pos.y, pos.r, 0, TAU);
  } else if(step.shape === 'rect'){
    const r = 16;
    const x = pos.x, y = pos.y, w = pos.w, h = pos.h;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fill('evenodd');
  ctx.restore();

  // ===== 2. 高亮边框 + 脉冲 =====
  ctx.save();
  ctx.strokeStyle = 'rgba(140, 240, 180, ' + (0.7 + pulse * 0.3) + ')';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(140, 240, 180, 0.9)';
  ctx.shadowBlur = 22;
  if(step.shape === 'circle'){
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.r + pulse * 8, 0, TAU);
    ctx.stroke();
  } else if(step.shape === 'rect'){
    rr(pos.x - pulse * 4, pos.y - pulse * 4, pos.w + pulse * 8, pos.h + pulse * 8, 20);
    ctx.stroke();
  }
  ctx.restore();

  // ===== 3. 文字面板：根据高亮框位置动态计算 =====
  const panelW = W - 80;
  const lines = step.lines || [];
  const panelH = 60 + lines.length * 38 + 70;

  let panelY;
  if(step.shape === 'circle'){
    if(step.panelAnchor === 'above'){
      panelY = pos.y - pos.r - 40 - panelH;
    } else {
      panelY = pos.y + pos.r + 40;
    }
  } else {
    if(step.panelAnchor === 'above'){
      panelY = pos.y - 40 - panelH;
    } else {
      panelY = pos.y + pos.h + 40;
    }
  }
  // 屏幕边界保护
  panelY = Math.max(20, Math.min(H - panelH - 20, panelY));

  const panelX = 40;

  rr(panelX, panelY, panelW, panelH, 20);
  const bgGrd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  bgGrd.addColorStop(0, 'rgba(10, 24, 16, 0.96)');
  bgGrd.addColorStop(1, 'rgba(4, 12, 8, 0.96)');
  ctx.fillStyle = bgGrd;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 240, 180, 0.85)';
  ctx.lineWidth = 3;
  rr(panelX, panelY, panelW, panelH, 20);
  ctx.stroke();

  // 顶部高光
  ctx.save();
  rr(panelX, panelY, panelW, panelH, 20);
  ctx.clip();
  const hl = ctx.createLinearGradient(0, panelY, 0, panelY + 12);
  hl.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(panelX, panelY, panelW, 12);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题
  ctx.font = 'bold 28px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.strokeText(step.title, W/2, panelY + 46);
  const titleGrd = ctx.createLinearGradient(0, panelY + 30, 0, panelY + 60);
  titleGrd.addColorStop(0, '#e0fff0');
  titleGrd.addColorStop(1, '#5cd88a');
  ctx.fillStyle = titleGrd;
  ctx.fillText(step.title, W/2, panelY + 46);

  // 描述
  ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#dfe9e3';
  let ly = panelY + 92;
  for(const line of lines){
    ctx.fillText(line, W/2, ly);
    ly += 38;
  }

  // 底部提示（保证在进度点上方至少 28px，避免和点重叠）
  const pulse2 = 0.5 + Math.sin(gameTime * 3) * 0.5;
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(140, 240, 180, ' + (0.55 + pulse2 * 0.45) + ')';
  const hintY = Math.min(panelY + panelH - 30, H - 70);
  ctx.fillText(step.hint || '点击屏幕继续', W/2, hintY);

  drawTutorialProgressDots();
}


// ================= 玩法说明列表 =================
const HELP_LIST_ITEMS = [
  { key: 'basic',         title: '基础操作',   desc: '摇杆移动 · 自动开火',   color: '#7fe0a0', icon: 'speed' },
  { key: 'frozen_bullet', title: '冰冻弹',     desc: '猫粮命中 · 概率冰冻',   color: '#a0e8ff', icon: 'frozen_bullet' },
  { key: 'can',           title: '罐头',       desc: '自动投掷 · 范围爆炸',   color: '#ff9f6b', icon: 'canpower' },
  { key: 'orb',           title: '毛球',       desc: '环绕防御 · 击退敌人',   color: '#ffb0d0', icon: 'orb_count' },
  { key: 'laser',         title: '激光',       desc: '锁定输出 · 附带减速',   color: '#88eeff', icon: 'laserpower' },
  { key: 'missile',       title: '追踪导弹',   desc: '追踪打击 · 充能制',     color: '#ff8a3c', icon: 'missile_damage' },
  { key: 'airstrike',     title: '全屏轰炸',   desc: '空投炸弹 · 群伤清场',   color: '#ff6b4a', icon: 'airstrike' }
];

function startHelpTutorial(key){
  if(key === 'basic'){
    tutorialQueue = INITIAL_TUTORIAL_STEPS.slice();
  } else {
    tutorialQueue = buildSkillIntroSteps(key);
  }
  tutorialStep = 0;
  tutorialOnFinish = 'return-help';
  state = 'tutorial';
  last = performance.now();
}

// ================= 教程进度点 =================
function drawTutorialProgressDots(){
  const totalDots = tutorialQueue.length;
  const dotSpacing = 24;
  const startX = W/2 - (totalDots - 1) * dotSpacing / 2;
  const dotY = H - 28;
  for(let i = 0; i < totalDots; i++){
    const dx = startX + i * dotSpacing;
    const active = (i === tutorialStep);
    ctx.beginPath();
    ctx.arc(dx, dotY, active ? 6 : 4, 0, TAU);
    ctx.fillStyle = active ? '#8ef0a8' : 'rgba(140, 240, 180, 0.35)';
    ctx.fill();
  }
}

// ================= 教程演示动画 =================
function drawTutorialDemo(key, x, y, w, h){
  const t = gameTime % 3.0;

  ctx.save();
  ctx.beginPath();
  rr(x, y, w, h, 14);
  ctx.clip();

  // 背景
  const bgGrd = ctx.createLinearGradient(x, y, x, y + h);
  bgGrd.addColorStop(0, 'rgba(20, 34, 26, 0.96)');
  bgGrd.addColorStop(1, 'rgba(8, 18, 12, 0.96)');
  ctx.fillStyle = bgGrd;
  ctx.fillRect(x, y, w, h);

  // 网格
  ctx.strokeStyle = 'rgba(80, 140, 100, 0.12)';
  ctx.lineWidth = 1;
  for(let i = 20; i < w; i += 40){
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i, y + h);
    ctx.stroke();
  }
  for(let j = 20; j < h; j += 40){
    ctx.beginPath();
    ctx.moveTo(x, y + j);
    ctx.lineTo(x + w, y + j);
    ctx.stroke();
  }

  // 分派
  if(key === 'orb') demoOrb(x, y, w, h, t);
  else if(key === 'can') demoCan(x, y, w, h, t);
  else if(key === 'laser') demoLaser(x, y, w, h, t);
  else if(key === 'missile') demoMissile(x, y, w, h, t);
  else if(key === 'airstrike') demoAirstrike(x, y, w, h, t);
  else if(key === 'frozen_bullet') demoFrozenBullet(x, y, w, h, t);

  // 边框
  ctx.strokeStyle = 'rgba(140, 240, 180, 0.7)';
  ctx.lineWidth = 2.5;
  rr(x, y, w, h, 14);
  ctx.stroke();

  ctx.restore();
}

// ---------- 毛球：猫 + 毛球挡子弹 ----------
function demoOrb(x, y, w, h, t){
  const cx = x + w/2;
  const cy = y + h/2;

  const catSprite = getCurrentCatSprite();
  if(catSprite && catSprite.loaded && catSprite.img){
    const sz = 70;
    ctx.drawImage(catSprite.img, cx - sz/2, cy - sz/2, sz, sz);
  }

  // 3 个毛球绕转
  const orbR = 50;
  const ang = t * 3;
  for(let i = 0; i < 3; i++){
    const a = ang + i * TAU / 3;
    const ox = cx + Math.cos(a) * orbR;
    const oy = cy + Math.sin(a) * orbR;
    const orbGrd = ctx.createRadialGradient(ox - 4, oy - 4, 1, ox, oy, 12);
    orbGrd.addColorStop(0, '#ffe0ec');
    orbGrd.addColorStop(0.6, '#ffb0d0');
    orbGrd.addColorStop(1, '#e080a8');
    ctx.fillStyle = orbGrd;
    ctx.beginPath();
    ctx.arc(ox, oy, 12, 0, TAU);
    ctx.fill();
  }

  // 子弹：0~1.0s 从右下飞到毛球环边缘
  const startX = x + w - 30;
  const startY = y + h - 30;
  const endX = cx + 30;
  const endY = cy + 30;

  if(t < 1.0){
    const p = t / 1.0;
    const bx = startX + (endX - startX) * p;
    const by = startY + (endY - startY) * p;
    ctx.fillStyle = '#ff4a4a';
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,180,140,.8)';
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, 3, 0, TAU);
    ctx.fill();
  } else if(t < 1.6){
    const p2 = (t - 1.0) / 0.6;
    ctx.save();
    ctx.globalAlpha = 1 - p2;
    ctx.strokeStyle = '#ffb0d0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(endX, endY, 12 + p2 * 22, 0, TAU);
    ctx.stroke();
    ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#8ef0a8';
    ctx.textAlign = 'center';
    ctx.fillText('挡下！', endX, endY - 28);
    ctx.restore();
  }
}

// ---------- 罐头：猫投罐 → 敌人群炸 ----------
function demoCan(x, y, w, h, t){
  const catX = x + 50;
  const catY = y + h - 55;
  const targetX = x + w - 80;
  const targetY = y + h - 55;

  const catSprite = getCurrentCatSprite();
  if(catSprite && catSprite.loaded && catSprite.img){
    ctx.drawImage(catSprite.img, catX - 35, catY - 35, 70, 70);
  }

  // 10 只小老鼠，密集挤在一起
  const enemySprite = SPRITES['enemy_zombie'];
  const offsets = [
    { dx: -30, dy: -20 }, { dx: -10, dy: -24 }, { dx: 12, dy: -22 }, { dx: 30, dy: -18 },
    { dx: -36, dy: 2 },   { dx: -14, dy: -2 },  { dx: 8, dy: -2 },   { dx: 32, dy: 2 },
    { dx: -26, dy: 20 },  { dx: -6, dy: 22 },   { dx: 14, dy: 22 },  { dx: 32, dy: 20 }
  ];
  const exploded = t >= 1.0;
  for(const off of offsets){
    const ex = targetX + off.dx;
    const ey = targetY + off.dy;
    if(enemySprite && enemySprite.loaded && enemySprite.img){
      ctx.save();
      if(exploded && t < 1.8) ctx.globalAlpha = 0.4;
      ctx.drawImage(enemySprite.img, ex - 18, ey - 18, 36, 36);
      ctx.restore();
    }
  }

  // 罐头飞行 0~0.8s
  if(t < 0.8){
    const p = t / 0.8;
    const bx = catX + (targetX - catX) * p;
    const byBase = catY + (targetY - catY) * p;
    const by = byBase - Math.sin(p * Math.PI) * 32;
    ctx.fillStyle = '#c6ced4';
    ctx.beginPath();
    ctx.ellipse(bx, by, 13, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8543f';
    ctx.fillRect(bx - 13, by - 3, 26, 6);
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bx, by, 13, 10, 0, 0, TAU);
    ctx.stroke();
  }

  // 预警圈 0.4~1.1s
  if(t > 0.4 && t < 1.1){
    const pulse = 0.5 + Math.sin(gameTime * 20) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.strokeStyle = '#ff5b5b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 55, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.2 + pulse * 0.2;
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 爆炸 1.0~1.7s
  if(t > 1.0 && t < 1.7){
    const p3 = (t - 1.0) / 0.7;
    ctx.save();
    ctx.globalAlpha = 1 - p3;
    const g = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, 55 * p3 + 20);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
    g.addColorStop(0.6, 'rgba(255, 140, 60, 0.5)');
    g.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 55 * p3 + 20, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 激光：猫眼射光 → 大怪持续掉血 ----------
function demoLaser(x, y, w, h, t){
  const catX = x + 50;
  const catY = y + h/2;
  const targetX = x + w - 70;
  const targetY = y + h/2;

  const catSprite = getCurrentCatSprite();
  if(catSprite && catSprite.loaded && catSprite.img){
    ctx.drawImage(catSprite.img, catX - 35, catY - 35, 70, 70);
  }

  const enemySprite = SPRITES['enemy_brute'] || SPRITES['enemy_zombie'];
  if(enemySprite && enemySprite.loaded && enemySprite.img){
    ctx.drawImage(enemySprite.img, targetX - 28, targetY - 28, 56, 56);
  }

  // 血条
  let hpP = 1.0;
  if(t > 0.5) hpP = Math.max(0, 1.0 - (t - 0.5) / 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(targetX - 28, targetY - 48, 56, 6);
  ctx.fillStyle = '#e05050';
  ctx.fillRect(targetX - 28, targetY - 48, 56 * hpP, 6);

  // 激光 0.5~2.0s
  if(t > 0.5 && t < 2.0){
    const alpha = Math.min(1, (t - 0.5) * 4) * Math.min(1, (2.0 - t) * 4);
    if(alpha > 0){
      const eyeX = catX + 8;
      const eyeY = catY - 8;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grd = ctx.createLinearGradient(eyeX, eyeY, targetX, targetY);
      grd.addColorStop(0, 'rgba(120, 240, 255, 0.7)');
      grd.addColorStop(1, 'rgba(200, 250, 255, 0.9)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(eyeX, eyeY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(eyeX, eyeY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      const eg = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 18);
      eg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      eg.addColorStop(0.5, 'rgba(120, 240, 255, 0.6)');
      eg.addColorStop(1, 'rgba(120, 240, 255, 0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 18, 0, TAU);
      ctx.fill();
      if(Math.floor(t * 12) % 2 === 0){
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.arc(targetX, targetY, 32, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ---------- 导弹：追踪飞行 → 命中爆炸 ----------
function demoMissile(x, y, w, h, t){
  const catX = x + 50;
  const catY = y + h - 50;
  const targetX = x + w - 70;
  const targetY = y + 60;

  const catSprite = getCurrentCatSprite();
  if(catSprite && catSprite.loaded && catSprite.img){
    ctx.drawImage(catSprite.img, catX - 35, catY - 35, 70, 70);
  }

  const enemySprite = SPRITES['enemy_armored'] || SPRITES['enemy_zombie'];
  const shieldActive = t < 1.5;
  const shieldBreak  = t >= 1.5 && t < 1.75;
  if(enemySprite && enemySprite.loaded && enemySprite.img){
    ctx.drawImage(enemySprite.img, targetX - 30, targetY - 30, 60, 60);
    // 护盾六边形
    if(shieldActive || shieldBreak){
      const R = 44;
      const pulse = 0.5 + Math.sin(gameTime * 6) * 0.5;
      ctx.save();
      if(shieldBreak){
        const k = 1 - (t - 1.5) / 0.25;
        ctx.globalAlpha = k * 0.9;
        // 破盾瞬间向外扩散
        const exR = R + (1 - k) * 26;
        ctx.strokeStyle = '#a0d8ff';
        ctx.lineWidth = 4 * k;
        ctx.beginPath();
        for(let i = 0; i < 6; i++){
          const a = -Math.PI / 2 + i * TAU / 6 + gameTime * 0.5;
          const px = targetX + Math.cos(a) * exR;
          const py = targetY + Math.sin(a) * exR;
          if(i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        // 内部淡蓝填充
        ctx.fillStyle = 'rgba(160, 216, 255, ' + (0.15 + pulse * 0.1) + ')';
        ctx.beginPath();
        for(let i = 0; i < 6; i++){
          const a = -Math.PI / 2 + i * TAU / 6 + gameTime * 0.5;
          const px = targetX + Math.cos(a) * R;
          const py = targetY + Math.sin(a) * R;
          if(i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 外边框
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#a0d8ff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 导弹 0.3~1.5s
  if(t > 0.3 && t < 1.7){
    const p = Math.min(1, (t - 0.3) / 1.2);
    const bx = catX + (targetX - catX) * p;
    const by = catY + (targetY - catY) * p;
    const arcOffset = Math.sin(p * Math.PI) * 55;
    const baseAngle = Math.atan2(targetY - catY, targetX - catX);
    const perp = baseAngle + Math.PI/2;
    const mx = bx + Math.cos(perp) * arcOffset;
    const my = by + Math.sin(perp) * arcOffset;

    // 尾迹
    ctx.strokeStyle = 'rgba(255, 140, 60, 0.4)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(catX, catY);
    ctx.quadraticCurveTo((catX + targetX) / 2 + Math.cos(perp) * 55, (catY + targetY) / 2 + Math.sin(perp) * 55, mx, my);
    ctx.stroke();

    // 导弹
    const mA = Math.atan2(targetY - my, targetX - mx);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(mA);
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(8, -3);
    ctx.lineTo(12, 0);
    ctx.lineTo(8, 3);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath();
    ctx.arc(9, 0, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 爆炸 1.6~2.2s（护盾破碎后再炸）
  if(t > 1.6 && t < 2.2){
    const p2 = (t - 1.6) / 0.6;
    ctx.save();
    ctx.globalAlpha = 1 - p2;
    const g = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, 40 * p2 + 15);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
    g.addColorStop(0.6, 'rgba(255, 140, 60, 0.6)');
    g.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 40 * p2 + 15, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 轰炸：天上落弹 → 多点爆炸 ----------
function demoAirstrike(x, y, w, h, t){
  const targets = [
    { x: x + w * 0.30, y: y + h * 0.70 },
    { x: x + w * 0.50, y: y + h * 0.66 },
    { x: x + w * 0.70, y: y + h * 0.70 }
  ];

  const enemySprite = SPRITES['enemy_zombie'];
  for(const tg of targets){
    if(enemySprite && enemySprite.loaded && enemySprite.img){
      ctx.save();
      if(t > 1.3) ctx.globalAlpha = 0.4;
      ctx.drawImage(enemySprite.img, tg.x - 18, tg.y - 18, 36, 36);
      ctx.restore();
    }
  }

  // 预警圈 0.2~1.3s
  if(t > 0.2 && t < 1.4){
    const pulse = 0.5 + Math.sin(gameTime * 15) * 0.5;
    for(const tg of targets){
      ctx.save();
      ctx.globalAlpha = 0.5 + pulse * 0.3;
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, 28, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.15 + pulse * 0.15;
      ctx.fillStyle = '#ff5b5b';
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, 28, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // 炸弹下落 0.2~1.3s
  if(t > 0.2 && t < 1.3){
    const p = (t - 0.2) / 1.1;
    for(const tg of targets){
      const bombY = y + (tg.y - y) * p;
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(tg.x, bombY, 9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff8a3c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 180, 60, 0.7)';
      ctx.beginPath();
      ctx.moveTo(tg.x - 4, bombY - 9);
      ctx.lineTo(tg.x, bombY - 20);
      ctx.lineTo(tg.x + 4, bombY - 9);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 爆炸 1.3~1.9s
  if(t > 1.3 && t < 1.9){
    const p2 = (t - 1.3) / 0.6;
    for(const tg of targets){
      ctx.save();
      ctx.globalAlpha = 1 - p2;
      const g = ctx.createRadialGradient(tg.x, tg.y, 0, tg.x, tg.y, 32 * p2 + 15);
      g.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
      g.addColorStop(0.6, 'rgba(255, 140, 60, 0.6)');
      g.addColorStop(1, 'rgba(255, 100, 40, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, 32 * p2 + 15, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
// ---------- 冰冻弹：子弹命中 → 敌人被冰封 ----------
function demoFrozenBullet(x, y, w, h, t){
  const catX = x + 50;
  const catY = y + h - 55;
  const targetX = x + w - 80;
  const targetY = y + h - 55;

  const catSprite = getCurrentCatSprite();
  if(catSprite && catSprite.loaded && catSprite.img){
    ctx.drawImage(catSprite.img, catX - 32, catY - 32, 64, 64);
  }

  const enemySprite = SPRITES['enemy_runner'] || SPRITES['enemy_zombie'];
  const frozen = t > 0.9;

  // 敌人（冻结后保持冰蓝色调）
  if(enemySprite && enemySprite.loaded && enemySprite.img){
    ctx.save();
    ctx.drawImage(enemySprite.img, targetX - 22, targetY - 22, 44, 44);

    // 冰晶包裹
    if(frozen){
      const rw = 26, rh = 30;
      const iceP = Math.min(1, (t - 0.9) / 0.4);

      ctx.globalAlpha = 0.55 * iceP;
      ctx.fillStyle = '#7fd0ff';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY - rh);
      ctx.lineTo(targetX + rw * 0.85, targetY - rh * 0.55);
      ctx.lineTo(targetX + rw * 0.85, targetY + rh * 0.55);
      ctx.lineTo(targetX, targetY + rh);
      ctx.lineTo(targetX - rw * 0.85, targetY + rh * 0.55);
      ctx.lineTo(targetX - rw * 0.85, targetY - rh * 0.55);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.95 * iceP;
      ctx.strokeStyle = 'rgba(200, 245, 255, 1)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 冰刺
      ctx.globalAlpha = 0.85 * iceP;
      ctx.fillStyle = 'rgba(180, 235, 255, 0.9)';
      const spikes = [
        [targetX, targetY - rh, targetX, targetY - rh * 1.35, targetX + rw * 0.18, targetY - rh * 1.15],
        [targetX + rw * 0.85, targetY - rh * 0.55, targetX + rw * 1.2, targetY - rh * 0.75, targetX + rw * 1.05, targetY - rh * 0.35],
        [targetX + rw * 0.85, targetY + rh * 0.55, targetX + rw * 1.2, targetY + rh * 0.75, targetX + rw * 1.05, targetY + rh * 0.35],
        [targetX, targetY + rh, targetX, targetY + rh * 1.35, targetX - rw * 0.18, targetY + rh * 1.15],
        [targetX - rw * 0.85, targetY + rh * 0.55, targetX - rw * 1.2, targetY + rh * 0.75, targetX - rw * 1.05, targetY + rh * 0.35],
        [targetX - rw * 0.85, targetY - rh * 0.55, targetX - rw * 1.2, targetY - rh * 0.75, targetX - rw * 1.05, targetY - rh * 0.35]
      ];
      for(const sp of spikes){
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1]);
        ctx.lineTo(sp[2], sp[3]);
        ctx.lineTo(sp[4], sp[5]);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 子弹飞行 0.2~0.7s
  if(t > 0.2 && t < 0.9){
    const p = (t - 0.2) / 0.7;
    const bx = catX + 20 + (targetX - catX - 20) * p;
    const by = catY + (targetY - catY) * p;

    ctx.fillStyle = 'rgba(0, 20, 40, 0.85)';
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7fd0ff';
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 1.5, 2.5, 0, TAU);
    ctx.fill();
  }

  // 冰冻瞬间闪光 + "冰冻！"文字
  if(t > 0.85 && t < 1.6){
    const flash = Math.max(0, 1 - (t - 0.85) / 0.4);
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#a0e8ff';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 40, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (t - 0.85) / 0.7);
    ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeText('冰冻！', targetX, targetY - 42);
    ctx.fillStyle = '#a0e8ff';
    ctx.fillText('冰冻！', targetX, targetY - 42);
    ctx.restore();
  }
}
// ================= 关卡过关弹窗 =================
function drawStageClearScreen(){
  const info = stageClearInfo;
  if(!info) return;

  // ★ 不黑屏：只轻微暗化，游戏世界可见
  ctx.fillStyle = 'rgba(4, 8, 6, 0.35)';
  ctx.fillRect(0, 0, W, H);

  // ===== 面板 =====
  const panelW = W - 100;
  const panelH = 300;
  const panelX = 50;
  const panelY = (H - panelH) / 2;

  rr(panelX, panelY, panelW, panelH, 24);
  const panelGrd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrd.addColorStop(0, 'rgba(20, 36, 26, 0.97)');
  panelGrd.addColorStop(1, 'rgba(8, 20, 14, 0.97)');
  ctx.fillStyle = panelGrd;
  ctx.fill();

  // 外发光
  ctx.save();
  ctx.shadowColor = 'rgba(255, 210, 74, 0.75)';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = 'rgba(255, 210, 74, 0.9)';
  ctx.lineWidth = 3;
  rr(panelX, panelY, panelW, panelH, 24);
  ctx.stroke();
  ctx.restore();

  // 内线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  rr(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 20);
  ctx.stroke();

  // 顶部高光
  ctx.save();
  rr(panelX, panelY, panelW, panelH, 24);
  ctx.clip();
  const hl = ctx.createLinearGradient(0, panelY, 0, panelY + 14);
  hl.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(panelX, panelY, panelW, 14);
  ctx.restore();

  // ===== 标题（严格居中） =====
  const titleText = info.isLastStage ? '教学完成' : ('第 ' + info.finishedStage + ' 关 通过');
  const titleY = panelY + 100;

  // 描边层
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(titleText, W / 2, titleY);
  ctx.restore();

  // 填充层（独立 save/restore，位置完全一致）
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px "Microsoft YaHei",sans-serif';
  const titleGrd = ctx.createLinearGradient(0, titleY - 30, 0, titleY + 30);
  titleGrd.addColorStop(0, '#fff5c0');
  titleGrd.addColorStop(0.5, '#ffd24a');
  titleGrd.addColorStop(1, '#ffb020');
  ctx.fillStyle = titleGrd;
  ctx.fillText(titleText, W / 2, titleY);
  ctx.restore();

  // ===== 按钮（面板中下、文字严格居中） =====
  const btn = STAGE_CLEAR_BTN;
  btn.y = panelY + panelH - 80;
  const btnText = info.isLastStage
    ? '进入无尽模式 ▶'
    : ('进入第 ' + (info.finishedStage + 1) + ' 关 ▶');

  // 强制 alphabetic baseline，让 drawAppButton 内部文字垂直居中
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  drawAppButton(btn, btnText, '#7fe0a0', '#289858', { fontSize: 30, pulse: true });
  ctx.restore();
}

// ================= 低血量警告 =================
function drawLowHpWarning(){
  if(!player) return;
  if(state !== 'playing') return;

  const p = player.hp / player.maxHp;

  // 血量 > 40% 不显示
  if(p > 0.4) return;

  // 血量 20%~40%：轻度红光脉动
  // 血量 <= 20%：强烈红光脉动 + 全屏红闪
  let intensity, speed;
  if(p <= 0.2){
    intensity = 0.75;
    speed = 6;
  } else {
    intensity = 0.35 + (0.4 - p) / 0.2 * 0.3;   // 0.35 ~ 0.65
    speed = 3;
  }

  const pulse = 0.5 + 0.5 * Math.sin(gameTime * speed * 2);
  const alpha = intensity * (0.35 + pulse * 0.65);

  ctx.save();

  // 1. 边缘红光（从屏幕四周向内）
  const edgeGrd = ctx.createRadialGradient(
    W/2, H/2, H * 0.30,
    W/2, H/2, H * 0.72
  );
  edgeGrd.addColorStop(0,   'rgba(255, 0, 0, 0)');
  edgeGrd.addColorStop(0.7, 'rgba(255, 0, 0, ' + (alpha * 0.35) + ')');
  edgeGrd.addColorStop(1,   'rgba(255, 0, 0, ' + alpha + ')');
  ctx.fillStyle = edgeGrd;
  ctx.fillRect(0, 0, W, H);

  // 2. 极低血量（<=20%）：全屏红闪
  if(p <= 0.2){
    ctx.fillStyle = 'rgba(255, 0, 0, ' + (alpha * 0.28) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // 3. 极低血量：屏幕边缘红色粗边 + 脉动
  if(p <= 0.2){
    const bw = 8 + pulse * 8;
    ctx.strokeStyle = 'rgba(255, 30, 30, ' + (0.6 + pulse * 0.4) + ')';
    ctx.lineWidth = bw;
    ctx.strokeRect(bw/2, bw/2, W - bw, H - bw);
  }

  // 4. 文字提示（仅极低血量）
  if(p <= 0.2){
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Microsoft YaHei",sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const warnY = H * 0.22 + Math.sin(gameTime * 8) * 4;
    ctx.strokeText('⚠ 血量危险！', W/2, warnY);
    ctx.fillStyle = 'rgba(255, 80, 80, ' + (0.7 + pulse * 0.3) + ')';
    ctx.fillText('⚠ 血量危险！', W/2, warnY);
  }

  ctx.restore();
}

// ================= 音频调试面板 =================
function drawAudioDebug(){
  if(!audioDebugPanel) return;

  const pw = 400;
  const ph = 200;
  const px = 14;
  const py = H - ph - 14;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'left';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#4ade80';
  ctx.fillText('AUDIO DEBUG  [F2 / ` 关闭]', px + 12, py + 22);

  // AudioContext 状态
  const acState = actx ? actx.state : '(未创建)';
  const acColor = (actx && actx.state === 'running') ? '#4ade80' : '#f87171';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('AudioContext:', px + 12, py + 48);
  ctx.fillStyle = acColor;
  ctx.fillText(acState, px + 130, py + 48);

  // 电平条
  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('输出电平:', px + 12, py + 76);
  const barX = px + 130, barY = py + 64;
  const barW = 250, barH = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, barY, barW, barH);
  const fillW = Math.min(barW, audioLevel * 6 * barW);
  ctx.fillStyle = audioLevel > 0.005 ? '#4ade80' : '#444';
  ctx.fillRect(barX, barY, fillW, barH);

  // BGM 状态
  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('菜单BGM:', px + 12, py + 102);
  ctx.fillStyle = menuBgm.intervalId ? '#4ade80' : '#666';
  ctx.fillText(menuBgm.intervalId ? '播放中' : '停止', px + 130, py + 102);

  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('战斗BGM:', px + 12, py + 126);
  ctx.fillStyle = bgm.intervalId ? '#4ade80' : '#666';
  ctx.fillText(bgm.intervalId ? '播放中' : '停止', px + 130, py + 126);

  // 当前状态
  ctx.fillStyle = '#a0d8b8';
  ctx.fillText('游戏状态:', px + 12, py + 150);
  ctx.fillStyle = '#ffe080';
  ctx.fillText(String(state), px + 130, py + 150);

  // 提示
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(160,200,180,0.75)';
  ctx.fillText('电平条有反应 = 有声音输出', px + 12, py + 178);
  ctx.fillStyle = 'rgba(160,200,180,0.5)';
  ctx.fillText('若为 suspended 请点击一次屏幕', px + 12, py + 192);
}

// ================= 渲染 =================
function render(){
  ctx.fillStyle = '#0a0d0b';
  ctx.fillRect(0, 0, W, H);

  // 全屏 UI 状态（无游戏世界背景）
  if(state === 'boot'){ drawBootScreen(); return; }
  if(state === 'menu'){ drawMainMenu(); return; }
  if(state === 'catselect'){ drawCatSelectScreen(); return; }
  if(state === 'help'){ drawHelpScreen(); return; }
  if(state === 'leaderboard' && lbFrom === 'menu'){ drawLeaderboardScreen(); return; }

  if(!player) return;

  let sx = 0, sy = 0;
  if(cam.shake > 0.2){
    sx = rand(-cam.shake, cam.shake);
    sy = rand(-cam.shake, cam.shake);
  }

  ctx.save();
  ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);

  drawGround();
  drawBurnMarks();
  drawDrops();

  for(const ring of rings){
    const p = 1 - ring.life / ring.t;
    if(!isFinite(p) || p <= 0.001) continue;
    const col = ring.color || '#ffcf5c';
    ctx.strokeStyle = col;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.maxR * p, 0, TAU); ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.18;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.maxR * p, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const list = [];
  for(const e of enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
  list.push({ y: player.y, f: drawCat });
  for(const bro of catBros) list.push({ y: bro.y, f: () => drawOneCatBro(bro) });
  list.sort((a, b) => a.y - b.y);
  for(const item of list) item.f();

  drawOrbs();
  drawLaser();

  const hasFrozen = (player.buffLevels.frozen_bullet || 0) > 0;
  for(const b of bullets){
    if(hasFrozen){
      // 冰冻子弹：蓝色 + 冰霜高光
      ctx.fillStyle = 'rgba(0, 20, 40, 0.85)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7fd0ff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, b.r * 0.45, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(20, 10, 0, 0.85)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb84a';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff0c0';
      ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, b.r * 0.45, 0, TAU); ctx.fill();
    }
  }

  for(const b of eBullets){
    ctx.fillStyle = b.dmg > 10 ? '#ff4a4a' : '#a34fe0';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = b.dmg > 10 ? 'rgba(255,180,140,.8)' : 'rgba(220,160,255,.75)';
    ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, b.r * 0.42, 0, TAU); ctx.fill();
  }

  for(const p of particles){
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

 // 罐头投掷路线 + 落点预警
  for(const c of cans){
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffcf5c';
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(c.sx, c.sy);
    ctx.lineTo(c.tx, c.ty);
    ctx.stroke();
    ctx.setLineDash([]);

    // 落点脉冲圈
    const pulse = 0.5 + Math.sin(gameTime * 12) * 0.5;
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    ctx.strokeStyle = '#ff5b5b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.tx, c.ty, player.blastRadius * (0.7 + pulse * 0.2), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.25 + pulse * 0.25;
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath();
    ctx.arc(c.tx, c.ty, player.blastRadius * (0.7 + pulse * 0.2), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 飞行中的罐头（放大版）
  for(const c of cans){
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 18, 9, 0, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(c.x, c.y - c.z);
    ctx.rotate(c.spin);
    // 罐头主体
    ctx.fillStyle = '#c6ced4';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 3; ctx.stroke();
    // 红色标签
    ctx.fillStyle = '#e8543f'; ctx.fillRect(-22, -6, 44, 12);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-7, -6, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawMissiles();
  drawAirstrikeBombs();
  drawBubble();
  drawCatBroBubble();
  drawFloatTexts();

  ctx.restore();

  if(laser.flash > 0){
    const col = laser.isGold ? '255, 230, 150' : '200, 240, 255';
    ctx.fillStyle = 'rgba(' + col + ',' + (laser.flash * 0.28) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if(state === 'buff') drawBuffSelect();
  else if(state === 'catbro'){ drawHUD(); drawCatBroSelect(); }
  else if(state === 'paused'){ drawHUD(); drawPauseOverlay(); }
  else if(state === 'confirm'){ drawHUD(); drawPauseOverlay(); drawConfirmRestart(); }
  else if(state === 'leaderboard'){ drawLeaderboardScreen(); }
  else if(state === 'victory'){ drawVictoryScreen(); }
  else if(state === 'stageclear'){ drawHUD(); drawStageClearScreen(); }
  else {
    drawHUD();
    if(state === 'dead') drawDeadScreen();
    if(state === 'tutorial') drawTutorialScreen();
  }

  // 低血量警告（叠在 HUD 之上）
  drawLowHpWarning();

  // 技能 tips 显示在最上层
  drawSkillTip();

  // 音频调试面板（按 F2 / ` 切换）
  drawAudioDebug();
}

function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
    render();
  } catch(e){
    console.error('[loop error]', e);
  }
  requestAnimationFrame(loop);
}

loadLeaderboard();
loadCatPref();
gameTime = 0;
state = 'boot';
requestAnimationFrame(loop);

})();