(function(){
'use strict';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const TAU = Math.PI * 2;
const CAT_BATTLE_VERSION = 'cat_battle_1.14';
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
// 右侧技能按钮已全部移除，改为左侧冷却条显示
// 暂停界面按钮（在 drawPauseOverlay 里动态计算，这里存一份供点击检测）
const RESUME_BTN       = { x: W/2, y: 0, w: 220, h: 60 };
const PAUSE_LB_BTN     = { x: W/2, y: 0, w: 220, h: 56 };
const RESTART_BTN      = { x: W/2, y: 0, w: 220, h: 56 };

// 死亡界面按钮已改为弹窗内联，不需要全局常量
const LB_CLOSE_BTN     = { x: W/2, y: H - 80, w: 240, h: 62 };
// 退出确认弹窗按钮（在 drawConfirmRestart 里动态计算，绘制/点击共用）
const CONFIRM_NO_BTN  = { x: W/2 - 90, y: 0, w: 160, h: 60 };   // 左边：取消
const CONFIRM_YES_BTN = { x: W/2 + 90, y: 0, w: 160, h: 60 };   // 右边：确认
const AVATAR      = { x: 50, y: 50, r: 36 };
const HELP_QUICK_BTN = { x: 50, y: 240, r: 48 };

// 主菜单按钮
const MENU_START_BTN = { x: W/2, y: 880, w: 400, h: 96 };
const MENU_LB_BTN    = { x: W/2, y: 1000, w: 400, h: 96 };
const MENU_HELP_BTN  = { x: W/2, y: 1120, w: 400, h: 96 };
// 游戏说明返回
const HELP_BACK_BTN  = { x: W/2, y: H - 80, w: 260, h: 72 };
// 胜利界面按钮
const VICTORY_CONTINUE_BTN = { x: W/2, y: 820, w: 400, h: 88 };
const VICTORY_END_BTN      = { x: W/2, y: 940, w: 400, h: 88 };
// 关卡上限
const MAX_WAVE = 20;
// ================= 刷怪系统 v3 =================
const SPAWN_CHECK_INTERVAL   = 0.10;   // 补怪检查间隔（秒）
const SPAWN_BATCH_MAX        = 4;      // 单次最多补几只
const SPAWN_X_MARGIN         = 60;     // 出生点左右留白
const SPAWN_Y_TOP            = -60;    // 出生 y
const SPAWN_Y_JITTER         = 30;     // 出生 y 随机浮动
const MAX_ENEMIES_HARD_CAP   = 48;     // 同屏硬上限
const ELITE_CHANCE_BASE      = 0.08;   // 精英基础概率
const ELITE_CHANCE_PER_STAGE = 0.005;  // 每关 +0.5%
const ELITE_CHANCE_MAX       = 0.15;   // 精英概率上限

// 进度条坐标（右侧竖版）
const PROG_CARD_X = 638;
const PROG_CARD_Y = 130;
const PROG_CARD_W = 70;
const PROG_CARD_H = 720;
const PROG_BAR_X  = 653;
const PROG_BAR_Y  = 230;
const PROG_BAR_W  = 40;
const PROG_BAR_H  = 540;
// ================= 闯关模式 =================
const TOTAL_STAGES = 10;                          // 总关卡数
const STAGE_PROGRESS_KEY = 'cat_battle_stage_progress_v2';

let gameMode = 'stage';              // 'stage' | 'endless'
let currentStageNum = 1;             // 闯关模式下当前关卡号

let stageProgress = {
  unlockedMax: 1,                    // 已解锁到第几关
  stars: {}                          // { 关卡号: 星数 0~3 }
};

// ================= 永久技能树 v2 =================
// 1.04：技能树不再负责解锁武器，也不再提供武器专属永久强化。
// 三条永久成长线：攻击 / 灵活 / 生存。
const SKILL_TREE_KEY = 'cat_battle_skill_tree_v2';
const SKILL_POINTS_KEY = 'cat_battle_skill_points_v2';
const SKILL_MIGRATION_KEY = 'cat_battle_skill_tree_v2_migrated';

const SKILL_BRANCHES = [
  { key:'offense', name:'攻击', color:'#ffd24a' },
  { key:'agility', name:'灵活', color:'#7fd8ff' },
  { key:'survival', name:'生存', color:'#7fe0a0' }
];

// 星级负责“资格”，技能点负责“购买”。
// 18 个节点：3 / 6 / 9 / 12 / 15 / 18 星逐层开放。
const SKILL_TREE = [
  // 攻击：稳定提升三种主武器的共同基础能力，不碰武器机制。
  { id:'offense_damage1', branch:'offense', tier:1, reqStars:3,  cost:1, label:'+3%',  desc:'主角造成的伤害 +3%' },
  { id:'offense_rate1',   branch:'offense', tier:2, reqStars:6,  cost:1, label:'+3%',  desc:'主角攻击间隔缩短 3%' },
  { id:'offense_crit1',   branch:'offense', tier:3, reqStars:9,  cost:2, label:'+2%',  desc:'暴击率 +2%' },
  { id:'offense_damage2', branch:'offense', tier:4, reqStars:12, cost:2, label:'+5%',  desc:'主角造成的伤害额外 +5%' },
  { id:'offense_crit2',   branch:'offense', tier:5, reqStars:15, cost:2, label:'+10%', desc:'暴击伤害 +10%' },
  { id:'offense_core',    branch:'offense', tier:6, reqStars:18, cost:3, label:'+6%',  desc:'核心：主角造成的伤害额外 +6%' },

  // 灵活：强化走位和战斗覆盖，不直接增加武器倍率。
  { id:'agility_speed1',  branch:'agility', tier:1, reqStars:3,  cost:1, label:'+4%',  desc:'移动速度 +4%' },
  { id:'agility_range1',  branch:'agility', tier:2, reqStars:6,  cost:1, label:'+8%',  desc:'主武器有效射程 +8%' },
  { id:'agility_speed2',  branch:'agility', tier:3, reqStars:9,  cost:2, label:'+5%',  desc:'移动速度额外 +5%' },
  { id:'agility_range2',  branch:'agility', tier:4, reqStars:12, cost:2, label:'+8%',  desc:'主武器有效射程额外 +8%' },
  { id:'agility_rate',    branch:'agility', tier:5, reqStars:15, cost:2, label:'+3%',  desc:'所有主武器攻击间隔额外缩短 3%' },
  { id:'agility_core',    branch:'agility', tier:6, reqStars:18, cost:3, label:'+5%',  desc:'核心：移动速度额外 +5%' },

  // 生存：主角活得更久，并给城墙一个轻量长期成长。
  { id:'survival_hp1',    branch:'survival', tier:1, reqStars:3,  cost:1, label:'+6',   desc:'最大生命 +6' },
  { id:'survival_wall1',  branch:'survival', tier:2, reqStars:6,  cost:1, label:'-5%',  desc:'城墙受到伤害 -5%' },
  { id:'survival_hp2',    branch:'survival', tier:3, reqStars:9,  cost:2, label:'+8',   desc:'最大生命额外 +8' },
  { id:'survival_guard',  branch:'survival', tier:4, reqStars:12, cost:2, label:'-5%',  desc:'主角受到伤害 -5%' },
  { id:'survival_wall2',  branch:'survival', tier:5, reqStars:15, cost:2, label:'-5%',  desc:'城墙受到伤害额外 -5%' },
  { id:'survival_core',   branch:'survival', tier:6, reqStars:18, cost:3, label:'+10',  desc:'核心：最大生命额外 +10' }
];

let skillTree       = {};
let skillPoints     = 0;
let skillTreeFrom   = 'catselect';
let skillNodeRects  = [];
let skillBackBtn    = null;
let skillResetBtn   = null;
let skillScrollY = 0;
let skillScrollMaxY = 0;
let skillScroll = {dragging:false,startY:0,startScrollY:0,startX:0,moved:false};
let skillDetailNode = null;
let skillDetailCloseRect = null;
let skillDetailLearnRect = null;
let taskRects       = [];
let taskBackBtn     = null;
let taskSkillTreeEntryRect = null;
let taskScrollY     = 0;

const CATCHOOSE_BRO_BTN   = { x: 92,  y: 885, w: 104, h: 78 };
const CATCHOOSE_TASK_BTN  = { x: 224, y: 885, w: 104, h: 78 };
const CATCHOOSE_SKILL_BTN = { x: 356, y: 885, w: 104, h: 78 };

let stageScrollY = 0;
let stageScrollMaxY = 0;
let stageScroll = { dragging: false, startY: 0, startScrollY: 0 };
let stageCards = [];                 // 选关卡片的点击热区
let stageSelectCloseRect = null;
let stageVictoryInfo = null;         // 关卡结算数据
let stageVictoryBtnRects = [];       // 结算界面的按钮热区
let stageTotalEnemies = 0;   // 本关总怪物数（用于"剩余"统计）
// 是否已解锁全部武器

// 武器解锁中文名
const WEAPON_UNLOCK_NAMES = {
  can:       '罐头',
  orb:       '毛球',
  laser:     '激光',
  missile:   '追踪导弹',
  airstrike: '全屏轰炸'
};

// 主菜单动效状态
let bootAnimT = 0;   // 启动屏出现动画计时
let menuTime = 0;
let menuEnterT = 0;
let menuTapCount = 0;      // 隐藏操作：连点计数
let menuTapLast = 0;       // 上次点击时间
let menuToast = { text: '', life: 0 };  // 隐藏操作反馈文字
function menuInit(){ menuTime = 0; menuEnterT = 0; menuToast.life = 0; menuTapCount = 0; }
const MAIN_NAV = [
  {id:'stages', label:'闯关'}, {id:'tasks', label:'任务'}, {id:'home', label:'家园'},
  {id:'inventory', label:'背包'}, {id:'shop', label:'商城'}
];
let mainNavRects = [];
let mainResetConfirm = false;
let placeholderFrom = 'inventory';
let mainResetConfirmRects = [];
let mainResetBtnRect = null;
let menuStartBtnRect = null;
let currentPrepStage = 1;
let prepWeaponRects = [];
let prepCatRects = [];
let prepStartRect = null;
let stagePrepResetBtnRect = null;
let homeCatRects = [];
let bootStartBtnRect = null;
function hitRect(r,p){ return r && p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h; }
function clearAllGameData(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && (k.indexOf('cat_battle')===0 || k.indexOf('catBattle')===0)) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
    // 同时处理旧版本可能使用的 sessionStorage 临时记录。
    const sessionKeys=[];
    for(let i=0;i<sessionStorage.length;i++){
      const k=sessionStorage.key(i);
      if(k && (k.indexOf('cat_battle')===0 || k.indexOf('catBattle')===0)) sessionKeys.push(k);
    }
    sessionKeys.forEach(k=>sessionStorage.removeItem(k));
  }catch(e){}

  // 不再“清除后立刻写回默认存档”。直接刷新页面，让所有内存状态也回到代码默认值。
  menuTapCount=0;
  menuToast={text:'已清除全部数据，从头开始游戏',life:3};
  try{
    location.reload();
  }catch(e){
    // 极端环境无法 reload 时仍回到全新内存状态。
    stageProgress={unlockedMax:1,stars:{}};
    skillTree={}; skillPoints=0; taskState={claimed:{}};
    taskStats={totalKills:0,zombieKills:0,wavesCleared:0};
    catBroCollection={}; catBroDeploy=[]; lastCatBroReward=null;
    currency={coins:500,diamonds:0};
    savedWeaponUnlock={laser:false,missile:false,can:false,orb:false,airstrike:false};
    unlockedWeapons={catfood:true,laser:true,missile:true,can:false,orb:false,airstrike:false};
    currentWeapon='catfood'; currentStageNum=1; currentPrepStage=1; gameMode='stage';
    state='boot'; menuInit(); last=performance.now();
  }
}


// ================= 猫选择 =================
const CAT_OPTIONS = [
  { key: 'mimi', spriteKey: 'cat_mimi', defaultName: '米米' },
  { key: 'hart', spriteKey: 'cat_hart', defaultName: '哈特咩' }
];
const CAT_PREF_KEY = 'cat_battle_cat_pref_v1';

// ================= 猫小弟永久收藏 v1.06 =================
const CATBRO_COLLECTION_KEY = 'cat_battle_catbro_collection_v1';
const CATBRO_DEPLOY_KEY = 'cat_battle_catbro_deploy_v1';
const CATBRO_COLLECTION = [
  {id:'orange',  name:'橘猫',   rate:1.35, dmg:7,  skill:'稳定射击', desc:'攻击稳定，基础伤害较低'},
  {id:'black',   name:'黑猫',   rate:2.10, dmg:25, skill:'重击',     desc:'攻击慢，但单发伤害高'},
  {id:'calico',  name:'三花',   rate:1.80, dmg:8,  skill:'三连射',   desc:'每次攻击连续发射3发'},
  {id:'cow',     name:'奶牛猫', rate:1.80, dmg:11, skill:'穿透',     desc:'子弹可穿透3个敌人'},
  {id:'ragdoll', name:'布偶猫', rate:1.90, dmg:10, skill:'减速',     desc:'命中后使敌人减速'},
  {id:'tuxedo',  name:'黑白猫', rate:2.00, dmg:10, skill:'爆炸',     desc:'命中造成54范围伤害'},
  {id:'tabby',   name:'狸花猫', rate:1.70, dmg:9,  skill:'连发',     desc:'每次攻击连续发射3发'},
  {id:'golden',  name:'金渐层', rate:1.85, dmg:11, skill:'追踪',     desc:'子弹会轻微追踪目标'},
  {id:'white',   name:'纯白猫', rate:2.35, dmg:30, skill:'远射',     desc:'超长射程，单发伤害高'},
  {id:'siamese', name:'暹罗猫', rate:1.95, dmg:11, skill:'双发',     desc:'每次攻击同时发射2发'}
];
let catBroCollection = {};
let catBroDeploy = [];
let catBroCollectionRects = [];
let catBroCollectionBackRect = null;
let catBroCollectionStartRect = null;
let catBroSelectedId = null;
let lastCatBroReward = null;

function loadCatBroCollection(){
  try{
    const raw = localStorage.getItem(CATBRO_COLLECTION_KEY);
    if(raw){ const d=JSON.parse(raw); if(d && typeof d==='object') catBroCollection=d; }
    const dr = localStorage.getItem(CATBRO_DEPLOY_KEY);
    if(dr){ const d=JSON.parse(dr); if(Array.isArray(d)) catBroDeploy=d.filter(id=>CATBRO_COLLECTION.some(c=>c.id===id)).slice(0,3); }
  }catch(e){}
}
function saveCatBroCollection(){
  try{
    localStorage.setItem(CATBRO_COLLECTION_KEY, JSON.stringify(catBroCollection));
    localStorage.setItem(CATBRO_DEPLOY_KEY, JSON.stringify(catBroDeploy));
  }catch(e){}
}
function isCatBroOwned(id){ return catBroCollection[id] === true; }
function getOwnedCatBroCount(){ return CATBRO_COLLECTION.filter(c=>isCatBroOwned(c.id)).length; }
function unlockRandomCatBroForStage(stageNum){
  // 每个关卡首次通关只给一次猫小弟；重复提高星级不会重复发放。
  const key='stage_'+stageNum;
  if(catBroCollection._stages && catBroCollection._stages[key]) return null;
  if(!catBroCollection._stages) catBroCollection._stages={};
  catBroCollection._stages[key]=true;
  const pool=CATBRO_COLLECTION.filter(c=>!catBroCollection[c.id]);
  if(!pool.length){ saveCatBroCollection(); return null; }
  const got=pool[Math.floor(Math.random()*pool.length)];
  catBroCollection[got.id]=true;
  saveCatBroCollection();
  return got;
}
function toggleCatBroDeploy(id){
  if(!isCatBroOwned(id)) return false;
  const i=catBroDeploy.indexOf(id);
  if(i>=0){ catBroDeploy.splice(i,1); saveCatBroCollection(); return true; }
  if(catBroDeploy.length>=3) return false;
  catBroDeploy.push(id); saveCatBroCollection(); return true;
}
function getDeployedCatBros(){
  return catBroDeploy.map(id=>CATBRO_COLLECTION.find(c=>c.id===id)).filter(Boolean);
}

let catType = 'mimi';
let catNames = { mimi: '米米', hart: '哈特咩' };
let editingCatKey = null;
let nameInput = null;

// 猫选择界面按钮
const CATCHOOSE_STAGE_BTN   = { x: W/2, y: 1010, w: 400, h: 86 };   // 开始闯关
const CATCHOOSE_ENDLESS_BTN = { x: W/2, y: 1110, w: 400, h: 76 };   // 无尽模式
const CATCHOOSE_BACK_BTN    = { x: W/2, y: 1200, w: 300, h: 60 };
// 两张猫卡片的矩形（用于点击检测）
const CAT_CARD_RECTS = [
  { x: 60,  y: 400, w: 280, h: 400, key: 'mimi' },
  { x: 380, y: 400, w: 280, h: 400, key: 'hart' }
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
  laser:  ['你们才是真正的英雄~', '我想做什么就做什么！！！', '我miaolander来啦！！！'],
  missile:['追踪导弹！发射！', '锁定目标！', '不陪我玩就炸飞你们！！', '点杀最高血量！', '看我炸扁你们！'],
  heal:   ['回血啦喵~', '呼——舒服多了', '血包真香！'],
  orb:    ['毛球起飞！', '毛球开启！', '看我的毛球！'],
  airstrike: ['空袭来了！', '炸弹雨来咯！', '天上掉罐头啦！', '快躲开喵！'],
  avatar: ['新头像好看吗喵？', '这个头像我喜欢！', '本喵上镜吗？'],
  double: ['双重强化！', '双份快乐喵！', '运气爆棚！']
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
  bg_beach: { img: null, loaded: false },

  // ★ 新增：战斗背景 / 菜单背景
  bg_battle: { img: null, loaded: false },
  bg_menu:   { img: null, loaded: false },

  btn_start:   { img: null, loaded: false },
  btn_history: { img: null, loaded: false },
  btn_help:    { img: null, loaded: false },

  btn_plate_red:    { img: null, loaded: false },
  btn_plate_yellow: { img: null, loaded: false },
  btn_plate_blue:   { img: null, loaded: false },
  btn_plate_green:  { img: null, loaded: false }
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

const CAT_LOCAL_PATH = 'images/cat.webp';
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

// 敌人运行时渲染缓存：战斗中不再反复缩放 500x500 WebP。
const enemyRenderCache = Object.create(null);
const ENEMY_CACHE_SIZES = {
  zombie:[15,22], runner:[13,19], brute:[27,38], spitter:[17,24],
  skeleton:[18,24], armored:[18,24], elite:[30,38]
};
function buildEnemyRenderCache(key, img){
  if(!img) return;
  const vis = ENEMY_VISUAL[key] || {scale:6,yOff:-0.3};
  const sizes = ENEMY_CACHE_SIZES[key] || [20];
  for(const r of sizes){
    const w = Math.max(1, Math.round(r * vis.scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = w;
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(img, 0, 0, w, w);
    enemyRenderCache[key + ':' + r] = c;
  }
}
function getEnemyRenderSprite(e){
  return enemyRenderCache[e.type + ':' + e.r] || null;
}

function loadImage(src, onDone){
  const img = new Image();
  let finished = false;
  const done = (ok) => { if(finished) return; finished = true; onDone(ok ? img : null, ok); };
  img.onload = async () => {
    // 关键性能修复：先让浏览器完成图片解码，避免第一只怪物出现时
    // drawImage 在主线程同步解码 500x500 WebP，造成明显卡顿。
    try {
      if(typeof img.decode === 'function') await img.decode();
    } catch(e) {}
    done(true);
  };
  img.onerror = () => done(false);
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
  loadImage('images/cat_mimi.webp', (img, ok) => {
    if(ok){ SPRITES.cat_mimi.img = img; SPRITES.cat_mimi.loaded = true; }
  });
  loadImage('images/cat_hart.webp', (img, ok) => {
    if(ok){ SPRITES.cat_hart.img = img; SPRITES.cat_hart.loaded = true; }
  });
  loadImage('images/catbro.webp', (img, ok) => {
    if(ok){ SPRITES.catbro.img = img; SPRITES.catbro.loaded = true; }
  });
  loadImage('images/catbro2.webp', (img, ok) => {
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

  // ★ 新增：bg_battle.webp / bg_menu.webp
  loadImage('images/bg_battle.webp', (img, ok) => {
    if(ok){ SPRITES.bg_battle.img = img; SPRITES.bg_battle.loaded = true; }
  });
  loadImage('images/bg_menu.webp', (img, ok) => {
    if(ok){ SPRITES.bg_menu.img = img; SPRITES.bg_menu.loaded = true; }
  });
  // ★ 主菜单 3 个按钮（带文字位图）
  loadImage('images/ui/btn_start.png', (img, ok) => {
    if(ok){ SPRITES.btn_start.img = img; SPRITES.btn_start.loaded = true; }
  });
  loadImage('images/ui/btn_history.png', (img, ok) => {
    if(ok){ SPRITES.btn_history.img = img; SPRITES.btn_history.loaded = true; }
  });
  loadImage('images/ui/btn_help.png', (img, ok) => {
    if(ok){ SPRITES.btn_help.img = img; SPRITES.btn_help.loaded = true; }
  });

  // ★ 通用按钮底板（空底，三段切 + 代码文字）
  loadImage('images/ui/btn_plate_red.png', (img, ok) => {
    if(ok){ SPRITES.btn_plate_red.img = img; SPRITES.btn_plate_red.loaded = true; }
  });
  loadImage('images/ui/btn_plate_yellow.png', (img, ok) => {
    if(ok){ SPRITES.btn_plate_yellow.img = img; SPRITES.btn_plate_yellow.loaded = true; }
  });
  loadImage('images/ui/btn_plate_blue.png', (img, ok) => {
    if(ok){ SPRITES.btn_plate_blue.img = img; SPRITES.btn_plate_blue.loaded = true; }
  });
  loadImage('images/ui/btn_plate_green.png', (img, ok) => {
    if(ok){ SPRITES.btn_plate_green.img = img; SPRITES.btn_plate_green.loaded = true; }
  });

  for(const k of ENEMY_SPRITE_KEYS){
    loadImage('images/enemy_' + k + '.webp', (img, ok) => {
      if(ok){
        SPRITES['enemy_' + k].img = img;
        SPRITES['enemy_' + k].loaded = true;
        buildEnemyRenderCache(k, img);
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
let analyserData = null;
let lastBgmState = null;
const sfxLastAt = Object.create(null);
const SFX_MIN_GAP = { shoot:0.12, hit:0.045, boom:0.12, laser:0.18, missile:0.12, hurt:0.12, buff:0.12, pickup:0.06, orb:0.08 };

function audioInit(){
  try{
    if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === 'suspended') actx.resume();

    // 建立主输出链：所有音源 → masterGain → analyser → destination
    if(!masterGain && actx){
      masterGain = actx.createGain();
      masterGain.gain.value = 1.0;
      analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      analyserData = new Uint8Array(analyser.fftSize);
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
    try{ lastBgmState = state; syncBGM(); }catch(e){}
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
    const nowMs = performance.now();
    const gap = SFX_MIN_GAP[kind] || 0.05;
    if(sfxLastAt[kind] !== undefined && nowMs - sfxLastAt[kind] < gap * 1000) return;
    sfxLastAt[kind] = nowMs;
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
    state === 'confirm' || state === 'buff' || state === 'victory';

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
  missile:   { name: '导弹',    color: '#ff8a3c' }
};

// ================= 关卡进度存储 =================
function loadStageProgress(){
  try{
    const raw = localStorage.getItem(STAGE_PROGRESS_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d && typeof d.unlockedMax === 'number'){
      stageProgress.unlockedMax = Math.max(1, Math.min(TOTAL_STAGES, d.unlockedMax));
    }
    if(d && d.stars && typeof d.stars === 'object'){
      stageProgress.stars = d.stars;
    }
  }catch(e){}
}
function saveStageProgress(){
  try{
    localStorage.setItem(STAGE_PROGRESS_KEY, JSON.stringify(stageProgress));
  }catch(e){}
}

// ================= 技能树存档 =================
function loadSkillTree(){
  try{
    const raw = localStorage.getItem(SKILL_TREE_KEY);
    if(raw){
      const d = JSON.parse(raw);
      if(d && typeof d === 'object'){
        if(d.nodes && typeof d.nodes === 'object') skillTree = d.nodes;
        if(Number.isFinite(d.points)) skillPoints = Math.max(0, Math.floor(d.points));
      }
    }

    // 从 1.03 旧技能树一次性迁移：旧树已经花掉的星 + 尚未花掉的星 = 当前累计星数。
    // 这样不会让玩家因为换树而丢失既有进度；1.04 起星星只负责门槛，技能点负责消费。
    if(localStorage.getItem(SKILL_MIGRATION_KEY) !== '1'){
      let oldSpent = 0;
      try{
        const oldRaw = localStorage.getItem('cat_battle_skill_tree_v1');
        if(oldRaw){
          const old = JSON.parse(oldRaw);
          if(old && typeof old === 'object'){
            const oldNodes = [
              ['bullet_dmg1',2],['bullet_rate1',2],['bullet_dmg2',3],['bullet_multi',3],
              ['laser_dmg1',2],['laser_cd1',2],['laser_width1',2],['laser_dur1',3],
              ['missile_dmg1',2],['missile_count1',3],['missile_cd1',2],['missile_speed1',2],
              ['can_dmg1',2],['can_blast1',2],['can_cd1',2],['can_blast2',3],
              ['gen_speed',2],['gen_hp',3],['gen_crit',2],['gen_buff',3]
            ];
            for(const [id,cost] of oldNodes) if(old[id] === true) oldSpent += cost;
          }
        }
      }catch(e){}
      const earned = getTotalEarnedStars();
      skillPoints = Math.max(skillPoints, earned);
      // 旧树免费解锁节点不算技能点消费；实际付费节点全部已经包含在累计星中。
      if(oldSpent > 0) skillPoints = Math.max(skillPoints, earned);
      localStorage.setItem(SKILL_MIGRATION_KEY, '1');
      saveSkillTree();
    }
  }catch(e){}
}
function saveSkillTree(){
  try{
    localStorage.setItem(SKILL_TREE_KEY, JSON.stringify({nodes:skillTree, points:skillPoints}));
    localStorage.setItem(SKILL_POINTS_KEY, String(skillPoints));
  }catch(e){}
}

function getTotalEarnedStars(){
  let total = 0;
  for(const k in stageProgress.stars) total += stageProgress.stars[k] || 0;
  return total;
}
function getSpentSkillPoints(){
  let total = 0;
  for(const id in skillTree){
    if(!skillTree[id]) continue;
    const node = SKILL_TREE.find(n => n.id === id);
    if(node) total += node.cost;
  }
  return total;
}
function getAvailableSkillPoints(){
  return Math.max(0, skillPoints - getSpentSkillPoints());
}
function canUnlockSkill(node){
  if(skillTree[node.id]) return false;
  if(getTotalEarnedStars() < node.reqStars) return false;
  if(node.tier > 1){
    const prev = SKILL_TREE.find(n => n.branch === node.branch && n.tier === node.tier - 1);
    if(prev && !skillTree[prev.id]) return false;
  }
  return getAvailableSkillPoints() >= node.cost;
}
function getSkillLockReason(node){
  if(skillTree[node.id]) return 'owned';
  if(getTotalEarnedStars() < node.reqStars) return 'stars';
  if(node.tier > 1){
    const prev = SKILL_TREE.find(n => n.branch === node.branch && n.tier === node.tier - 1);
    if(prev && !skillTree[prev.id]) return 'prev';
  }
  if(getAvailableSkillPoints() < node.cost) return 'points';
  return 'ok';
}
function hasAvailableSkill(){
  return SKILL_TREE.some(n => getSkillLockReason(n) === 'ok');
}
function unlockSkill(node){
  if(!canUnlockSkill(node)) return false;
  skillTree[node.id] = true;
  saveSkillTree();
  recalcPlayerStats();
  return true;
}
function resetSkillTree(){
  const refund = getSpentSkillPoints();
  skillTree = {};
  skillPoints = Math.max(skillPoints, refund);
  saveSkillTree();
  recalcPlayerStats();
}

// ================= 永久技能加成计算 =================
function getSkillBonus(){
  const b = {
    damageMult: 1,
    fireRateMult: 1,
    critBonus: 0,
    critMultBonus: 0,
    speedMult: 1,
    rangeMult: 1,
    hpBonus: 0,
    playerDamageTakenMult: 1,
    wallDamageTakenMult: 1
  };

  if(skillTree.offense_damage1) b.damageMult += 0.03;
  if(skillTree.offense_rate1)   b.fireRateMult *= 0.97;
  if(skillTree.offense_crit1)   b.critBonus += 0.02;
  if(skillTree.offense_damage2) b.damageMult += 0.05;
  if(skillTree.offense_crit2)   b.critMultBonus += 0.10;
  if(skillTree.offense_core)    b.damageMult += 0.06;

  if(skillTree.agility_speed1) b.speedMult += 0.04;
  if(skillTree.agility_range1) b.rangeMult += 0.08;
  if(skillTree.agility_speed2) b.speedMult += 0.05;
  if(skillTree.agility_range2) b.rangeMult += 0.08;
  if(skillTree.agility_rate)   b.fireRateMult *= 0.97;
  if(skillTree.agility_core)   b.speedMult += 0.05;

  if(skillTree.survival_hp1)   b.hpBonus += 6;
  if(skillTree.survival_wall1) b.wallDamageTakenMult *= 0.95;
  if(skillTree.survival_hp2)   b.hpBonus += 8;
  if(skillTree.survival_guard) b.playerDamageTakenMult *= 0.95;
  if(skillTree.survival_wall2) b.wallDamageTakenMult *= 0.95;
  if(skillTree.survival_core)  b.hpBonus += 10;

  return b;
}

// ================= 任务系统 v1（1.05） =================
// 任务只负责“获得技能点”；星级仍只负责技能树解锁资格。
const TASK_STATE_KEY = 'cat_battle_tasks_v1';
const TASK_STATS_KEY = 'cat_battle_task_stats_v1';
const TASKS = [
  { id:'clear_stage_2', title:'首次突破', desc:'通关第 2 关', type:'stage', target:2, reward:2 },
  { id:'clear_stage_5', title:'深入战线', desc:'通关第 5 关', type:'stage', target:5, reward:3 },
  { id:'clear_stage_8', title:'守城精英', desc:'通关第 8 关', type:'stage', target:8, reward:4 },
  { id:'kill_100', title:'清理战场', desc:'累计消灭 100 个敌人', type:'kills', target:100, reward:2 },
  { id:'kill_300', title:'火力全开', desc:'累计消灭 300 个敌人', type:'kills', target:300, reward:3 },
  { id:'kill_600', title:'战场老兵', desc:'累计消灭 600 个敌人', type:'kills', target:600, reward:4 },
  { id:'clear_3', title:'连续推进', desc:'累计通关 3 个不同关卡', type:'stages', target:3, reward:2 },
  { id:'stars_15', title:'三星之路', desc:'累计获得 15 颗关卡星星', type:'stars', target:15, reward:4 }
];
let taskState = { claimed:{} };
let taskStats = { totalKills:0, zombieKills:0, wavesCleared:0 };

function loadTaskState(){
  try{
    const raw = localStorage.getItem(TASK_STATE_KEY);
    if(raw){
      const d = JSON.parse(raw);
      if(d && d.claimed && typeof d.claimed === 'object') taskState.claimed = d.claimed;
    }
    const sr = localStorage.getItem(TASK_STATS_KEY);
    if(sr){
      const d = JSON.parse(sr);
      if(d && typeof d === 'object'){
        taskStats.totalKills = Math.max(0, Math.floor(Number(d.totalKills) || 0));
        taskStats.zombieKills = Math.max(0, Math.floor(Number(d.zombieKills) || 0));
        taskStats.wavesCleared = Math.max(0, Math.floor(Number(d.wavesCleared) || 0));
      }
    }
  }catch(e){}
}
function saveTaskState(){
  try{
    localStorage.setItem(TASK_STATE_KEY, JSON.stringify(taskState));
    localStorage.setItem(TASK_STATS_KEY, JSON.stringify(taskStats));
  }catch(e){}
}
function getTaskProgress(task){
  if(task.type === 'stage') return Math.max(0, stageProgress.stars[task.target] ? 1 : 0);
  if(task.type === 'kills') return taskStats.totalKills;
  if(task.type === 'stages'){
    let n = 0;
    for(const k in stageProgress.stars) if((stageProgress.stars[k] || 0) > 0) n++;
    return n;
  }
  if(task.type === 'stars') return getTotalEarnedStars();
  return 0;
}
function isTaskComplete(task){ return getTaskProgress(task) >= task.target; }
function isTaskClaimed(task){ return taskState.claimed[task.id] === true; }
function claimTask(task){
  if(!isTaskComplete(task) || isTaskClaimed(task)) return false;
  taskState.claimed[task.id] = true;
  skillPoints += task.reward;
  saveTaskState();
  saveSkillTree();
  recalcPlayerStats();
  return true;
}
function getClaimableTaskCount(){
  let n=0;
  for(const t of TASKS) if(isTaskComplete(t) && !isTaskClaimed(t)) n++;
  return n;
}
function recordEnemyTaskKill(e){
  taskStats.totalKills++;
  if(e && (e.type === 'zombie' || e.type === 'elite_zombie')) taskStats.zombieKills++;
  saveTaskState();
}
function recordWaveTaskClear(){
  taskStats.wavesCleared++;
  saveTaskState();
}

function recordStageResult(stageNum, stars){
  const prev = stageProgress.stars[stageNum] || 0;
  const firstClear = prev <= 0;
  if(stars > prev) stageProgress.stars[stageNum] = stars;
  if(stageNum >= stageProgress.unlockedMax){
    stageProgress.unlockedMax = Math.min(TOTAL_STAGES, stageNum + 1);
  }
  saveStageProgress();
  saveTaskState();
  if(firstClear){
    const got=unlockRandomCatBroForStage(stageNum);
    lastCatBroReward = got || null;
    if(got) banner={text:'获得猫小弟：'+got.name,life:2.2};
  } else {
    lastCatBroReward = null;
  }
}
function calcStarsByCastleHp(hp){
  if(hp >= 80) return 3;
  if(hp >= 60) return 2;
  if(hp >= 40) return 1;
  return 0;
}
function calcStars(hpRatio){ return calcStarsByCastleHp(Math.round(hpRatio * 100)); }

// ================= 关卡配置 =================
// 第 1 关 = 教学关（走原有逻辑）
// 第 2 关起：每关 3 波，难度线性递增
// ================= 关卡波次压力预算（v1.03） =================
// 6 波固定结构：预算代表“压力量级”，不是死板的怪物数量。
const STAGE_WAVE_PRESSURE = [10, 13, 17, 21, 27, 34];
const ENEMY_PRESSURE = {
  zombie: 1.0,
  runner: 1.15,
  brute: 2.8,
  spitter: 1.8,
  elite_zombie: 2.8,
  elite_runner: 3.0,
  elite_brute: 7.0,
  elite_spitter: 4.0
};
const STAGE_WAVE_TYPES = {
  1: ['zombie','runner'],
  2: ['zombie','runner','spitter'],
  3: ['zombie','runner','spitter','brute'],
  4: ['zombie','runner','spitter','brute'],
  5: ['zombie','runner','spitter','brute'],
  6: ['zombie','runner','spitter','brute']
};

function buildPressureWave(stageNum, waveNum){
  const baseBudget = STAGE_WAVE_PRESSURE[clamp(waveNum - 1, 0, 5)];
  // 关卡递增主要提升压力预算；不直接把怪物血量无限放大。
  const budget = baseBudget * (1 + Math.max(0, stageNum - 1) * 0.08);
  const pool = STAGE_WAVE_TYPES[waveNum] || STAGE_WAVE_TYPES[6];
  const queue = [];
  let remaining = budget;

  // 第 3、6 波各保证至少一个精英，形成明确的节奏节点。
  if(waveNum === 3 || waveNum === 6){
    const eliteType = waveNum === 3 ? 'elite_zombie' : 'elite_brute';
    queue.push(eliteType);
    remaining -= ENEMY_PRESSURE[eliteType];
  }

  let guard = 0;
  while(remaining >= 1 && guard++ < 100){
    const candidates = pool.filter(t => ENEMY_PRESSURE[t] <= remaining + 0.01);
    if(!candidates.length) break;
    // 越高波越容易出现重型/远程，但仍保留大量基础单位。
    const weights = candidates.map(t => {
      if(waveNum >= 5 && t === 'brute') return 1.35;
      if(waveNum >= 3 && t === 'spitter') return 1.15;
      if(t === 'runner') return 1.05;
      return 1;
    });
    let total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random() * total;
    let pick = candidates[0];
    for(let i=0;i<candidates.length;i++){
      r -= weights[i];
      if(r <= 0){ pick=candidates[i]; break; }
    }
    queue.push(pick);
    remaining -= ENEMY_PRESSURE[pick];
  }

  // 防止预算尾数导致波次过短。
  if(queue.length < 5) queue.push('zombie','runner');
  for(let i=queue.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [queue[i],queue[j]]=[queue[j],queue[i]];
  }
  return queue;
}

function getStageConfig(stageNum){
  const N = stageNum;
  return {
    hpScale: 1 + Math.max(0, N - 1) * 0.08,
    spScale: 1 + Math.max(0, N - 1) * 0.02,
    dmgScale: 1 + Math.max(0, N - 1) * 0.025
  };
}
function getStageWavePlan(stageNum, waveNum){
  return buildPressureWave(stageNum, waveNum);
}

// ================= 进度条目标 & 同屏怪数 =================
// 计算本关 4 个击杀目标：T1=普通波1, T2=普通波2, T3=普通波3, T4=Boss
function calcProgressTargets(stageNum){
  const N = stageNum;
  // 1 : 2 : 4 : 8 等比递增（基础值翻倍）
  const T1 = 12 + (N - 1) * 4;
  const T2 = T1 * 2;
  const T3 = T2 * 2;
  const T4 = T3 * 2;
  return [T1, T2, T3, T4];
}

// 计算标记列表（用于进度条绘制）
function calcProgressMarkers(stageNum){
  const targets = calcProgressTargets(stageNum);
  const total = targets[3];
  const out = [];
  for(let i = 0; i < 4; i++){
    out.push({
      kills: targets[i],
      ratio: targets[i] / total,
      triggered: false
    });
  }
  return out;
}

// 计算当前同屏怪数上限
function calcMaxEnemies(){
  const stageBonus = Math.max(0, currentStage - 1) * 1.5;
  const waveBonus  = Math.max(0, waveInStage - 1) * 3;
  let buffTotal = 0;
  if(player && player.buffLevels){
    for(const k in player.buffLevels) buffTotal += player.buffLevels[k];
  }
  const n = 12 + waveBonus + stageBonus + buffTotal;
  return Math.min(MAX_ENEMIES_HARD_CAP, Math.floor(n));
}

// 计算当前精英怪概率
function calcEliteChance(){
  const c = ELITE_CHANCE_BASE + (currentStage - 1) * ELITE_CHANCE_PER_STAGE;
  return Math.min(ELITE_CHANCE_MAX, c);
}

// ================= 开始某关 =================
function confirmWeaponSelection(){
  // 图片已经在启动阶段 decode；这里不再做任何同步加载。
  currentWeapon = currentWeapon || 'catfood';
  state='playing';
  waveInStage=1; wave=1;
  startWave(1);
  last=performance.now();
}
function drawWeaponSelect(){
  ctx.fillStyle='rgba(18,28,24,0.96)'; ctx.fillRect(0,0,W,H);
  drawUIText('选择主武器',W/2,150,'title',{size:42,strokeWidth:7});
  drawUIText('一局只使用一种主武器，6 波强化会围绕它成长',W/2,198,'body',{size:19,strokeWidth:4});
  const cards=[
    {key:'catfood',name:'猫粮',sub:'弹幕 / 穿透 / 爆炸',color:'#ffd24a',x:120},
    {key:'laser',name:'激光',sub:'持续锁定 / 灼热 / 防御',color:'#88eeff',x:360},
    {key:'missile',name:'导弹',sub:'追踪 / 齐射 / 爆炸',color:'#ff8a3c',x:600}
  ];
  weaponSelectRects=[];
  for(const c of cards){
    const selected=currentWeapon===c.key;
    const y=430;
    ctx.save();
    ctx.fillStyle=selected?'rgba(255,255,255,0.16)':'rgba(255,255,255,0.07)';
    ctx.strokeStyle=selected?c.color:'rgba(255,255,255,0.25)'; ctx.lineWidth=selected?5:2;
    ctx.beginPath(); ctx.roundRect(c.x-100,y-150,200,300,28); ctx.fill(); ctx.stroke();
    ctx.fillStyle=c.color; ctx.beginPath(); ctx.arc(c.x,y-55,48,0,TAU); ctx.fill();
    drawUIText(c.key==='catfood'?'●':(c.key==='laser'?'║':'➤'),c.x,y-55,'body',{size:42,strokeWidth:4});
    drawUIText(c.name,c.x,y+25,'body',{size:28,strokeWidth:5});
    drawUIText(c.sub,c.x,y+65,'muted',{size:15,strokeWidth:3});
    if(selected) drawUIText('已选择',c.x,y+115,'accent',{size:18,strokeWidth:4});
    ctx.restore();
    weaponSelectRects.push({x:c.x-100,y:y-150,w:200,h:300,key:c.key});
  }
  const bx=W/2, by=790;
  drawAppButton({x:bx,y:by,w:300,h:68},'开始守城','#ffd24a','#fff',{fontSize:25});
  weaponSelectStartRect={x:bx-150,y:by-34,w:300,h:68};
  drawUIText('提示：键盘 1/2/3 可快速选择武器',W/2,890,'muted',{size:16,strokeWidth:3});
}

function startStageGame(stageNum){
  gameMode = 'stage';
  currentStageNum = stageNum;
  reset('stage', stageNum);
}
// ================= 空袭支援过场 =================
function startSupportStrike(kind){
  // kind: 'support' | 'boss'
  state = 'support';
  supportFx = {
    kind: kind,
    phase: 'banner',
    t: 0,
    bombs: [],
    dropX: WORLD.w / 2,
    dropY: WORLD.h * 0.55,
    airdrop: null
  };
  cam.shake = Math.max(cam.shake, 10);
  if(kind === 'boss'){
    // 提前锁定，防止空投期间刷怪
    bossPhase = true;
  }
}

function updateSupportStrike(dt){
  if(!supportFx) return;
  const fx = supportFx;
  fx.t += dt;

  // 阶段时间表（绝对时间）
  const T_BOMBING      = 0.4;
  const T_EXPLODE      = 1.2;
  const T_AIRDROP_FALL = 1.6;
  const T_AIRDROP_LAND = 2.4;
  const T_AIRDROP_OPEN = 2.9;
  const T_DONE         = 3.4;

  // ============ 阶段切换（按 fx.t 绝对时间，只进不退） ============
  if(fx.phase === 'banner' && fx.t >= T_BOMBING){
    fx.phase = 'bombing';
    const n = 8 + Math.floor(Math.random() * 4);
    for(let i = 0; i < n; i++){
      fx.bombs.push({
        x: rand(60, WORLD.w - 60),
        y: rand(WORLD.h * 0.15, WORLD.h * 0.85),
        startY: -200 - Math.random() * 400,
        t: 0,
        dur: 0.35
      });
    }
  }
  else if(fx.phase === 'bombing' && fx.t >= T_EXPLODE){
    fx.phase = 'exploding';

    for(const b of fx.bombs){
      rings.push({ x: b.x, y: b.y, maxR: 180, life: 0.5, t: 0.5, color: '#ff8a3c' });
      burst(b.x, b.y, 20, '#ffcf5c', 380);
      burst(b.x, b.y, 12, '#ff6b3c', 300);
    }

    // ★ 直接 splice 移除怪物（不依赖 e.dead 标记）
    for(let i = enemies.length - 1; i >= 0; i--){
      const e = enemies[i];
      if(e.isBoss) continue;
      burst(e.x, e.y, 10, e.color, 220);
      enemies.splice(i, 1);
    }

    cam.shake = Math.max(cam.shake, 24);
    sfx('boom');
  }
  else if(fx.phase === 'exploding' && fx.t >= T_AIRDROP_FALL){
    fx.phase = 'airdrop_fall';
    fx.airdrop = { phase: 'falling', t: 0, x: fx.dropX, y: fx.dropY };
  }
  else if(fx.phase === 'airdrop_fall' && fx.t >= T_AIRDROP_LAND){
    fx.phase = 'airdrop_land';
    if(fx.airdrop){
      fx.airdrop.phase = 'landed';
      fx.airdrop.t = 0;
    }
    cam.shake = Math.max(cam.shake, 14);
    rings.push({ x: fx.dropX, y: fx.dropY, maxR: 90, life: 0.5, t: 0.5, color: '#ffd24a' });
    burst(fx.dropX, fx.dropY, 20, '#c8a878', 240);
  }
  else if(fx.phase === 'airdrop_land' && fx.t >= T_AIRDROP_OPEN){
    fx.phase = 'airdrop_open';
    if(fx.airdrop){
      fx.airdrop.phase = 'opening';
      fx.airdrop.t = 0;
    }
  }
  else if(fx.phase === 'airdrop_open' && fx.t >= T_DONE){
    fx.phase = 'done';
    endSupportStrike();
    return;
  }

  // ============ 逐帧动画更新 ============
  if(fx.phase === 'bombing'){
    for(const b of fx.bombs) b.t += dt;
  }
  if(fx.airdrop){
    if(fx.airdrop.phase === 'falling') fx.airdrop.t += dt;
    if(fx.airdrop.phase === 'opening') fx.airdrop.t += dt;
  }
}

function endSupportStrike(){
  const fx = supportFx;
  supportFx = null;

  // 普通波：进 buff
  if(!fx || fx.kind !== 'boss'){
    buffChoices = rollBuffChoices();
    if(buffChoices.length > 0){
      buffFadeIn = 0;
      state = 'buff';
      last = performance.now();
    } else {
      state = 'playing';
      last = performance.now();
    }
    return;
  }

  // Boss 波：先进 buff，选完 buff 再触发 Boss 入场
  buffChoices = rollBuffChoices();
  if(buffChoices.length > 0){
    pendingBossIntro = true;
    buffFadeIn = 0;
    state = 'buff';
    last = performance.now();
  } else {
    // 没 buff 可抽，直接入场
    state = 'playing';
    spawnBoss();
    last = performance.now();
  }
}

// 生成 Boss（从屏幕上方走入）
function getBossTier(stageNum){
  return Math.min(4, Math.max(1, stageNum));
}
function getBossConfig(stageNum){
  const tier = getBossTier(stageNum);
  const hp = [1700, 2000, 2350, 2750][tier - 1];
  return { tier, hp, name:'BOSS ' + tier };
}

// 生成 Boss：4 个阶段型 Boss，血量不再随关卡无限指数膨胀。
function spawnBoss(){
  bossPhase = true;
  bossSummonTimer = 3.5;
  const cfg = getBossConfig(currentStage);
  const hp = cfg.hp;
  const e = {
    id: nextEnemyId++, isBoss:true, bossTier:cfg.tier,
    x:WORLD.w/2, y:330, targetY:330, introT:0, introDuration:1.15,
    r:64, hp, maxHp:hp, speed:0, dmg:0, color:'#a83232', type:'elite', visualType:'elite',
    elite:true, ranged:true, shootCd:1.8, bossAttackTimer:0, bossBurstCount:0,
    bossSummonTimer:3.6, bossBurstTimer:0, bossBurstRemaining:0, angle:Math.PI/2, atkCd:0, hitFlash:0,
    slowTimer:0, frozenTimer:0, dead:false, laserHeatStacks:0, laserHeatTimer:0, laserLastHit:-999
  };
  enemies.push(e); bossEnemy=e;
  banner={text:cfg.name + ' 出现！',life:2.5}; cam.shake=Math.max(cam.shake,20); sfx('boom');
}

// ================= 空袭支援过场绘制 =================
function drawSupportStrikeOverlay(){
  if(!supportFx) return;
  const fx = supportFx;

  // 顶部横幅
  if(fx.phase === 'banner' || fx.phase === 'bombing'){
    const text = (fx.kind === 'boss')
      ? 'BOSS 即将出现！'
      : '友军支援到达！';
    const y = H * 0.28;
    const pulse = 0.5 + Math.sin(gameTime * 8) * 0.5;

    ctx.save();
    ctx.globalAlpha = Math.min(1, fx.t * 4);
    drawUIText(text, W/2, y, 'title', {
      size: 44,
      gradient: UI_GRADIENT_GOLD,
      glow: true,
      glowColor: 'rgba(255, 210, 74, ' + (0.6 + pulse * 0.4) + ')',
      glowSize: 24 + pulse * 16
    });
    ctx.restore();
  }

  // 落弹
  if(fx.phase === 'bombing'){
    for(const b of fx.bombs){
      const p = Math.min(1, b.t / b.dur);
      if(p >= 1) continue;
      const by = b.startY + (b.y - b.startY) * p;
      ctx.save();
      ctx.translate(b.x, by);
      // 尾焰
      ctx.fillStyle = 'rgba(255,180,60,0.8)';
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(0, -24 - Math.random() * 8);
      ctx.lineTo(6, -10);
      ctx.closePath();
      ctx.fill();
      // 弹体
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff8a3c';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 空投箱
  if(fx.airdrop){
    drawAirdropBox(fx.airdrop.x, fx.airdrop.y, 180,
                   fx.airdrop.phase, Math.min(1, fx.airdrop.t / 0.8));
  }
}

// ================= 空投箱绘制 =================
function drawAirdropBox(cx, cy, size, phase, t){
  const boxW = size * 0.72;
  const boxH = size * 0.60;
  const bx   = cx - boxW / 2;
  const by   = cy - boxH / 2;

  // ============ 降落伞（仅 falling）============
  if(phase === 'falling'){
    const sway  = Math.sin(t * Math.PI * 4) * 8;
    const paraY = cy - size * 0.95;
    const paraW = size * 0.95;
    const paraH = size * 0.55;

    ctx.strokeStyle = '#e8d8b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + sway - paraW*0.35, paraY + paraH*0.3);
    ctx.lineTo(bx + boxW*0.2, by + 4);
    ctx.moveTo(cx + sway + paraW*0.35, paraY + paraH*0.3);
    ctx.lineTo(bx + boxW*0.8, by + 4);
    ctx.moveTo(cx + sway - paraW*0.15, paraY + paraH*0.5);
    ctx.lineTo(bx + boxW*0.2, by + 4);
    ctx.moveTo(cx + sway + paraW*0.15, paraY + paraH*0.5);
    ctx.lineTo(bx + boxW*0.8, by + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + sway - paraW/2, paraY);
    ctx.quadraticCurveTo(cx + sway, paraY - paraH, cx + sway + paraW/2, paraY);
    ctx.closePath();
    const grd = ctx.createLinearGradient(cx + sway - paraW/2, 0, cx + sway + paraW/2, 0);
    grd.addColorStop(0.00, '#e84040');
    grd.addColorStop(0.22, '#e84040');
    grd.addColorStop(0.22, '#ffffff');
    grd.addColorStop(0.45, '#ffffff');
    grd.addColorStop(0.45, '#e84040');
    grd.addColorStop(0.67, '#e84040');
    grd.addColorStop(0.67, '#ffffff');
    grd.addColorStop(0.90, '#ffffff');
    grd.addColorStop(0.90, '#e84040');
    grd.addColorStop(1.00, '#e84040');
    ctx.fillStyle = grd;
    ctx.fill();
  }

  // ============ 打开时的金光 ============
  if(phase === 'opening' || phase === 'opened'){
    const glowR = size * (0.8 + t * 0.8);
    const glowA = (phase === 'opened' ? 0.75 : t * 0.75);
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grd.addColorStop(0.0, 'rgba(255, 248, 180, ' + glowA + ')');
    grd.addColorStop(0.4, 'rgba(255, 210, 74, '  + (glowA * 0.55) + ')');
    grd.addColorStop(1.0, 'rgba(255, 210, 74, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, TAU); ctx.fill();
  }

  // ============ 地面阴影 ============
  const shadowScale = phase === 'falling' ? 0.6 : 1.0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + boxH/2 + 5,
              boxW * 0.55 * shadowScale, 9 * shadowScale, 0, 0, TAU);
  ctx.fill();

  // ============ 箱身（木质）============
  const woodGrd = ctx.createLinearGradient(bx, by, bx, by + boxH);
  woodGrd.addColorStop(0.00, '#b88a5a');
  woodGrd.addColorStop(0.45, '#8b5a2b');
  woodGrd.addColorStop(1.00, '#5a3818');
  ctx.fillStyle = woodGrd;
  ctx.fillRect(bx, by, boxW, boxH);

  ctx.strokeStyle = 'rgba(60, 35, 15, 0.35)';
  ctx.lineWidth = 1;
  for(let i = 1; i < 5; i++){
    ctx.beginPath();
    ctx.moveTo(bx + boxW * i / 5, by + 4);
    ctx.lineTo(bx + boxW * i / 5, by + boxH - 4);
    ctx.stroke();
  }

  // ============ 金属边条 ============
  const metalDark  = '#3a2410';
  const metalLight = '#8a6a3a';
  ctx.fillStyle = metalDark;
  ctx.fillRect(bx - 3, by - 3, boxW + 6, 6);
  ctx.fillRect(bx - 3, by + boxH - 3, boxW + 6, 6);
  ctx.fillRect(bx - 3, by - 3, 6, boxH + 6);
  ctx.fillRect(bx + boxW - 3, by - 3, 6, boxH + 6);

  // 铆钉
  ctx.fillStyle = metalLight;
  const rivets = [
    [bx + 6, by + 6], [bx + boxW - 6, by + 6],
    [bx + 6, by + boxH - 6], [bx + boxW - 6, by + boxH - 6]
  ];
  for(const r of rivets){
    ctx.beginPath(); ctx.arc(r[0], r[1], 2.5, 0, TAU); ctx.fill();
  }

  // ============ 中央锁扣 ============
  ctx.fillStyle = '#d4a840';
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a6a20';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ============ 未打开时的「?」============
  if(phase === 'landed'){
    const pulse = 0.7 + Math.sin(gameTime * 6) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.font = 'bold ' + Math.round(size * 0.38) + 'px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3a2008';
    ctx.strokeText('?', cx, cy + 1);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('?', cx, cy + 1);
    ctx.restore();
  }

  // ============ 掀盖动画 ============
  if(phase === 'opening' || phase === 'opened'){
    const lidA = (phase === 'opened' ? 1 : t) * -1.35;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(lidA);
    const lidGrd = ctx.createLinearGradient(0, -10, 0, 6);
    lidGrd.addColorStop(0, '#b88a5a');
    lidGrd.addColorStop(1, '#5a3818');
    ctx.fillStyle = lidGrd;
    ctx.fillRect(0, -10, boxW, 12);
    ctx.fillStyle = metalDark;
    ctx.fillRect(-3, -10, 6, 12);
    ctx.fillRect(boxW - 3, -10, 6, 12);
    ctx.restore();
  }
}

// ================= 显示关卡结算 =================
function showStageVictory(){
  const stageNum = currentStage;
  const hpRatio = castleHp / castleMaxHp;
  const stars = calcStarsByCastleHp(castleHp);
  recordStageResult(stageNum, stars);
  stageVictoryInfo = {
    stageNum: stageNum,
    stars: stars,
    hpRatio: hpRatio,
    castleHp: castleHp,
    isLast: stageNum >= TOTAL_STAGES,
    catReward: lastCatBroReward
  };
  state = 'stageVictory';
  stageVictoryAnimT = 0;
  lastCatBroReward = null;
  last = performance.now();
}

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

  const tSize  = compact ? 17 : 28;
  const sSize  = compact ? 12 : 16;
  const nSize  = compact ? 13 : 20;
  const dSize  = compact ? 12 : 18;
  const fSize  = compact ? 13 : 20;
  const rowH   = compact ? 26 : 44;
  const barW   = compact ? 260 : 400;
  const barH   = compact ? 8  : 14;
  const nameW  = compact ? 64 : 104;

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

  drawAppTitle('历 史 战 绩', W/2, 110, 42);

  drawUIText('最佳 6 次战绩', W/2, 142, 'muted', { size: 18 });

  lbTagRects = [];

  if(leaderboard.length === 0){
    drawUIText('暂无记录，快去战斗吧！', W/2, H/2, 'muted', { size: 20 });
  } else {
    const cardX = 24;
    const cardW = W - 48;
    const cardH = 145;
    const gap = 10;
    let cy = 170;

    // ★ 最多显示 6 条（存档仍保留 10 条）
    const maxShow = 6;
    const showCount = Math.min(maxShow, leaderboard.length);

    for(let i = 0; i < showCount; i++){
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
      ctx.font = 'bold 36px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = rankColor;
      ctx.fillText('#' + (i + 1), x + 26, y + 60);

      drawUIText('第 ' + e.wave + ' 波', x + 116, y + 44, 'title', {
        size: 26, align: 'left', strokeWidth: 4
      });

      drawUIText('强化 ' + e.buffs, x + cardW - 24, y + 40, 'muted', {
        size: 20, align: 'right', strokeWidth: 3
      });

      drawUIText('伤害 ' + e.damage, x + 116, y + 82, 'accent', {
        size: 24, align: 'left', strokeWidth: 4,
        glow: true, glowColor: 'rgba(255, 210, 74, 0.6)', glowSize: 10
      });

      if(e.weapons && e.weapons.length > 0){
        let tagX = x + 116;
        const tagY = y + 118;
        for(const wid of e.weapons){
          const w = WEAPON_NAMES[wid];
          if(!w) continue;
          ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
          const tw = ctx.measureText(w.name).width + 20;
          if(tagX + tw > x + cardW - 20) break;
          rr(tagX, tagY - 14, tw, 28, 8);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.fill();
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 1.8;
          rr(tagX, tagY - 14, tw, 28, 8);
          ctx.stroke();

          drawUIText(w.name, tagX + tw/2, tagY + 2, 'body', {
            size: 16, strokeWidth: 3,
            glow: true, glowColor: w.color, glowSize: 6
          });

          tagX += tw + 6;
        }
      }

      // 整张卡片作为点击热区
      lbTagRects.push({ x, y, w: cardW, h: cardH, entryIndex: i });

      cy += cardH + gap;
    }
  }

  // ★ 关闭按钮上方提示
  drawUIText('点击可查看详细战斗数据', W/2, LB_CLOSE_BTN.y - LB_CLOSE_BTN.h/2 - 26,
             'muted', { size: 18 });

  drawAppButton(LB_CLOSE_BTN, '关 闭', '#ff8fb0', '#c84870', { fontSize: 24 });


  if(lbBuffPopup >= 0){
    drawLbBuffPopup();
  }
}

function drawLbBuffPopup(){
  const entry = leaderboard[lbBuffPopup];
  if(!entry){ lbBuffPopup = -1; return; }

  // 遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.93)';
  ctx.fillRect(0, 0, W, H);

  const buffLevels = entry.buffLevels || {};
  const buffIds = Object.keys(buffLevels).filter(k => buffLevels[k] > 0);

  const stats = entry.damageStats || {};
  const statEntries = Object.keys(stats)
    .filter(k => stats[k] > 0)
    .sort((a, b) => stats[b] - stats[a]);
  let statTotal = 0;
  for(const k of statEntries) statTotal += stats[k];
  if(statTotal <= 0) statTotal = 1;

  // ===== 主题色（适配深蓝面板） =====
  const C_TITLE   = '#ffe080';                     // 主标题：金色
  const C_SUB     = 'rgba(180, 220, 240, 0.9)';    // 副标题：淡青
  const C_SECTION = '#7fd0ff';                     // 小节标题：亮青
  const C_MUTED   = 'rgba(150, 195, 215, 0.65)';   // 空态/次要文字
  const C_NUM     = '#dfe9e3';                     // 数值：近白
  const C_LINE    = 'rgba(120, 200, 240, 0.35)';   // 分隔线
  const C_TRACK   = 'rgba(0, 20, 40, 0.6)';        // 进度条底

  const PAD = 64;   // ★ 从 40 改到 64，避开 panel_bg 四角装饰
  const panelW = W - 60;
  const cols = 2;
  const buffRows = Math.max(1, Math.ceil(buffIds.length / cols));
  const buffRowH = 60;
  const headerH = 140;
  const sectionGap = 20;
  const dmgTitleH = 46;
  const dmgRowH = 48;
  const dmgRows = Math.max(1, statEntries.length);
  const footerH = 100;

  const panelH = headerH
    + buffRows * buffRowH
    + sectionGap + dmgTitleH + dmgRows * dmgRowH
    + footerH;

  const panelX = (W - panelW) / 2;
  const panelY = Math.max(18, (H - panelH) / 2);

  // 面板底
  UI.drawPanel(ctx, panelX, panelY, panelW, panelH, 'panel_bg');

  // ===== 标题 =====
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = C_TITLE;
  ctx.fillText('第 ' + entry.wave + ' 波 · 本局详情', W/2, panelY + 58);

  ctx.font = '17px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = C_SUB;
  ctx.fillText(
    '共 ' + buffIds.length + ' 种强化 · 总伤害 ' + Math.round(statTotal),
    W/2, panelY + 92
  );

  // 金色装饰短线
  ctx.strokeStyle = 'rgba(255, 210, 74, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W/2 - 40, panelY + 108);
  ctx.lineTo(W/2 + 40, panelY + 108);
  ctx.stroke();

  // 分隔线
  ctx.strokeStyle = C_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + PAD, panelY + 122);
  ctx.lineTo(panelX + panelW - PAD, panelY + 122);
  ctx.stroke();

  // ===== 强化列表 =====
  let cursorY = panelY + headerH;

  ctx.textAlign = 'left';
  ctx.font = 'bold 19px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = C_SECTION;
  ctx.fillText('强化选择', panelX + PAD, cursorY - 8);

  if(buffIds.length === 0){
    ctx.font = '18px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = C_MUTED;
    ctx.fillText('暂无强化记录', panelX + PAD, cursorY + 28);
  } else {
    const colW = (panelW - PAD * 2) / cols;
    for(let i = 0; i < buffIds.length; i++){
      const id = buffIds[i];
      const def = BUFFS.find(b => b.id === id);
      if(!def) continue;
      const lv = buffLevels[id];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = panelX + PAD + col * colW;
      const cy = cursorY + row * buffRowH;

      drawBuffIcon(def.id, cx + 20, cy + buffRowH / 2 - 6, 28, def.color);

      ctx.textAlign = 'left';
      ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = def.color;
      ctx.fillText(def.name, cx + 46, cy + 22);

      ctx.font = '16px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = C_MUTED;
      ctx.fillText('Lv.' + lv, cx + 46, cy + 44);
    }
  }

  cursorY += buffRows * buffRowH + sectionGap;

  // 分隔线
  ctx.strokeStyle = C_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + PAD, cursorY - sectionGap / 2);
  ctx.lineTo(panelX + panelW - PAD, cursorY - sectionGap / 2);
  ctx.stroke();

  // ===== 伤害分析 =====
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = C_SECTION;
  ctx.fillText('伤害分析', panelX + PAD, cursorY + 16);

  cursorY += dmgTitleH - 4;

  if(statEntries.length === 0){
    ctx.font = '18px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = C_MUTED;
    ctx.fillText('暂无伤害数据', panelX + PAD, cursorY + 26);
  } else {
    const nameW = 78;
    const numW = 128;
    const barX = panelX + PAD + nameW;
    const barMaxW = panelW - PAD * 2 - nameW - numW - 24;
    const numRightX = panelX + panelW - PAD;
    const barH = 14;

    for(let i = 0; i < statEntries.length; i++){
      const k = statEntries[i];
      const w = WEAPON_NAMES[k] || { name: k, color: '#cccccc' };
      const dmg = stats[k];
      const ratio = dmg / statTotal;
      const pct = Math.round(ratio * 100);
      const cy = cursorY + i * dmgRowH;

      // 武器名
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = w.color;
      ctx.fillText(w.name, panelX + PAD, cy + 26);

      // 进度条底（深色，在深蓝面板上更沉）
      const barY = cy + 14;
      ctx.fillStyle = C_TRACK;
      ctx.fillRect(barX, barY, barMaxW, barH);

      // 进度条填充
      const fillW = Math.max(3, barMaxW * ratio);
      ctx.fillStyle = w.color;
      ctx.fillRect(barX, barY, fillW, barH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(barX, barY, fillW, 3);

      // 数字（近白）
      ctx.textAlign = 'right';
      ctx.font = 'bold 17px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = C_NUM;
      ctx.fillText(Math.round(dmg) + ' (' + pct + '%)', numRightX, cy + 26);
    }
  }

  // ===== 关闭按钮 =====
  const btnW = 220, btnH = 62;
  const btnX = W / 2 - btnW / 2;
  const btnY = panelY + panelH - footerH + 20;
  const btn   = { x: W / 2, y: btnY + btnH / 2, w: btnW, h: btnH };

  drawAppButton(btn, '关 闭', '#ff8fb0', '#c84870', { fontSize: 26 });

  lbPopupCloseRect = { x: btnX, y: btnY, w: btnW, h: btnH };
}
// ================= 存档系统 =================
const SAVE_KEY = 'cat_battle_save_v2';
// ================= 货币系统 =================
const CURRENCY_KEY = 'cat_battle_currency_v1';
let currency = { coins: 500, diamonds: 0 };

function loadCurrency(){
  try{
    const raw = localStorage.getItem(CURRENCY_KEY);
    if(!raw){
      // 新玩家首次进入：给初始货币
      currency.coins = 500;
      currency.diamonds = 0;
      saveCurrency();
      return;
    }
    const d = JSON.parse(raw);
    if(typeof d.coins    === 'number') currency.coins    = Math.max(0, Math.floor(d.coins));
    if(typeof d.diamonds === 'number') currency.diamonds = Math.max(0, Math.floor(d.diamonds));
  }catch(e){}
}
function saveCurrency(){
  try{
    localStorage.setItem(CURRENCY_KEY, JSON.stringify(currency));
  }catch(e){}
}
function addCoins(n){
  if(!n || n <= 0) return;
  currency.coins += n;
  saveCurrency();
}
function addDiamonds(n){
  if(!n || n <= 0) return;
  currency.diamonds += n;
  saveCurrency();
}
// ================= 武器解锁存档 =================
const WEAPON_UNLOCK_KEY = 'cat_battle_weapon_unlock_v1';

// 通关第 N 关解锁哪把武器
// 数值是关卡号，-1 表示暂不解锁
// 武器解锁已移至技能树（SKILL_TREE）

let savedWeaponUnlock = {
  laser: false,
  missile: false,
  can: false,
  orb: false,
  airstrike: false
};

function loadWeaponUnlock(){
  try{
    const raw = localStorage.getItem(WEAPON_UNLOCK_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(!d || typeof d !== 'object') return;
    for(const k in savedWeaponUnlock){
      if(d[k] === true) savedWeaponUnlock[k] = true;
    }
  }catch(e){}
}
function saveWeaponUnlock(){
  try{
    localStorage.setItem(WEAPON_UNLOCK_KEY, JSON.stringify(savedWeaponUnlock));
  }catch(e){}
}
function unlockWeapon(key){
  if(!key || !(key in savedWeaponUnlock)) return false;
  if(savedWeaponUnlock[key]) return false;
  savedWeaponUnlock[key] = true;
  saveWeaponUnlock();
  return true;
}
// 检查某个武器是否已解锁
function isWeaponUnlocked(wtype){
  if(wtype === 'bullet') return true;      // 猫粮永远有
  if(wtype === 'move' || wtype === 'life') return true;
  return !!savedWeaponUnlock[wtype];
}
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
  if(k === 'r' && state === 'dead') reset();
  if(k === 'f2' || k === '`'){
    e.preventDefault();
    audioDebugPanel = !audioDebugPanel;
    return;
  }
  if(state === 'weaponSelect' && (k === '1' || k === '2' || k === '3')){
    currentWeapon = k === '1' ? 'catfood' : (k === '2' ? 'laser' : 'missile');
    return;
  }
  if((state === 'playing' || state === 'buff') && waveInStage <= 1 && stageKillCount === 0 && (k === '1' || k === '2' || k === '3')){
    currentWeapon = k === '1' ? 'catfood' : (k === '2' ? 'laser' : 'missile');
    banner = { text: currentWeapon === 'catfood' ? '🥫 猫粮' : (currentWeapon === 'laser' ? '⚡ 激光' : '🚀 导弹'), life: 0.8 };
    if(player){ player.buffLevels={}; recalcPlayerStats(); }
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
    if(bootStartBtnRect && hitRect(bootStartBtnRect,p)){
      currentPrepStage=Math.max(1,Math.min(TOTAL_STAGES,stageProgress.unlockedMax||1));
      state='stagePrep';
      last=performance.now();
    }
    return;
  }

  if(state === 'weaponSelect'){
    for(const r of weaponSelectRects){
      if(p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h){ currentWeapon=r.key; return; }
    }
    if(weaponSelectStartRect && p.x>=weaponSelectStartRect.x && p.x<=weaponSelectStartRect.x+weaponSelectStartRect.w && p.y>=weaponSelectStartRect.y && p.y<=weaponSelectStartRect.y+weaponSelectStartRect.h){
      confirmWeaponSelection(); return;
    }
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
        if(pendingStageClearAfterBuff){
          pendingStageClearAfterBuff = false;
          showStageVictory();
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

  // ============ 主菜单 / 五大主导航 ============
  // 全局底部导览：所有主界面都可直接切换，不需要点左上角返回。
  if(GLOBAL_NAV_STATES.has(state) && handleGlobalNav(p)) return;

  if(state === 'menu'){
    if(mainResetConfirm){
      if(hitRect(mainResetConfirmRects[0],p)){ clearAllGameData(); return; }
      if(hitRect(mainResetConfirmRects[1],p)){ mainResetConfirm=false; return; }
      return;
    }
    if(mainResetBtnRect && hitRect(mainResetBtnRect,p)){ mainResetConfirm=true; return; }
    // 中央开始按钮区域
    if(menuStartBtnRect && hitRect(menuStartBtnRect,p)){ currentPrepStage=Math.max(1,Math.min(TOTAL_STAGES,stageProgress.unlockedMax||1)); state='stagePrep'; last=performance.now(); return; }
    return;
  }
  // ============ 闯关准备界面 ============
  if(state === 'stagePrep'){
    if(stagePrepResetBtnRect && hitRect(stagePrepResetBtnRect,p)){ mainResetConfirm=true; return; }
    if(mainResetConfirm){
      if(hitRect(mainResetConfirmRects[0],p)){ clearAllGameData(); return; }
      if(hitRect(mainResetConfirmRects[1],p)){ mainResetConfirm=false; return; }
      return;
    }
    if(prepStartRect && hitRect(prepStartRect,p)){ startStageGame(currentPrepStage); return; }
    if(p.y>=278 && p.y<=396){
      const col=Math.floor((p.x-28)/137), row=Math.floor((p.y-278)/66), n=row*5+col+1;
      if(col>=0 && col<5 && row>=0 && row<2 && n<=TOTAL_STAGES && n<=stageProgress.unlockedMax){ currentPrepStage=n; return; }
    }
    for(const r of prepWeaponRects){ if(hitRect(r,p)){ currentWeapon=r.key; return; } }
    for(const r of prepCatRects){ if(hitRect(r,p)){ toggleCatBroDeploy(r.id); return; } }
    return;
  }
  if(state === 'home'){
    for(const r of homeCatRects){ if(hitRect(r,p) && isCatBroOwned(r.id)){ toggleCatBroDeploy(r.id); return; } }
    return;
  }
  if(state === 'placeholder'){ return; }
  // ============ 任务界面 ============
  if(state === 'tasks'){
    if(taskSkillTreeEntryRect && hitRect(taskSkillTreeEntryRect,p)){ skillTreeFrom='tasks'; state='skillTree'; return; }
    for(const r of taskRects){
      if(p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h){
        if(r.claimable){
          if(claimTask(r.task)) sfx('pickup');
        } else if(!r.complete){
          sfx('hit');
        }
        return;
      }
    }
    return;
  }

  // ============ 技能树 ============
  if(state === 'skillTree'){
    // 弹窗优先于滚动，导航仍可在最底部快速切换。
    if(skillDetailNode){
      if(skillDetailCloseRect && hitRect(skillDetailCloseRect,p)){ skillDetailNode=null; return; }
      if(skillDetailLearnRect && hitRect(skillDetailLearnRect,p)){
        if(unlockSkill(skillDetailNode)){ sfx('buff'); skillDetailNode=null; }
        else sfx('hit');
        return;
      }
      // 点击弹窗主体不关闭，避免误触；点空白区域不做操作。
      return;
    }
    if(skillResetBtn && p.x>=skillResetBtn.x-skillResetBtn.w/2 && p.x<=skillResetBtn.x+skillResetBtn.w/2 && p.y>=skillResetBtn.y-skillResetBtn.h/2 && p.y<=skillResetBtn.y+skillResetBtn.h/2){
      resetSkillTree(); sfx('pickup'); return;
    }
    // 技能列表采用 pointerdown 记录、pointerup 打开详情，支持拖拽滚动而不误开技能。
    const listTop=310, listBottom=GLOBAL_NAV_Y-18;
    if(p.y>=listTop && p.y<=listBottom){
      skillScroll.dragging=true; skillScroll.startY=p.y; skillScroll.startX=p.x; skillScroll.startScrollY=skillScrollY; skillScroll.moved=false;
      return;
    }
    return;
  }
  // ============ 选关界面 ============
  if(state === 'stageSelect'){
    // 红X：返回选猫
    if(stageSelectCloseRect &&
       p.x >= stageSelectCloseRect.x && p.x <= stageSelectCloseRect.x + stageSelectCloseRect.w &&
       p.y >= stageSelectCloseRect.y && p.y <= stageSelectCloseRect.y + stageSelectCloseRect.h){
      state = 'catselect';
      return;
    }
    // 点卡片
    for(const c of stageCards){
      if(c.unlocked &&
         p.x >= c.x && p.x <= c.x + c.w &&
         p.y >= c.y && p.y <= c.y + c.h){
        startStageGame(c.num);
        return;
      }
    }
    // 开始拖动
    stageScroll.dragging = true;
    stageScroll.startY = p.y;
    stageScroll.startScrollY = stageScrollY;
    return;
  }

  // ============ 关卡结算界面 ============
  if(state === 'stageVictory'){
    for(const r of stageVictoryBtnRects){
      if(p.x >= r.x && p.x <= r.x + r.w &&
         p.y >= r.y && p.y <= r.y + r.h){
        if(r.action === 'next'){
          startStageGame(currentStage + 1);
        } else if(r.action === 'back'){
          state = 'stageSelect';
          stageScrollY = 0;
          stageVictoryInfo = null;
        } else if(r.action === 'skill'){
          skillTreeFrom = 'stageVictory';
          state = 'skillTree';
          last = performance.now();
        }
        return;
      }
    }
    return;
  }
  // ============ 猫小弟收藏 / 部署 ============
  if(state === 'catbroCollection'){
    if(catBroCollectionBackRect && p.x>=catBroCollectionBackRect.x && p.x<=catBroCollectionBackRect.x+catBroCollectionBackRect.w && p.y>=catBroCollectionBackRect.y && p.y<=catBroCollectionBackRect.y+catBroCollectionBackRect.h){
      state='catselect'; return;
    }
    for(const r of catBroCollectionRects){
      if(p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h){
        if(isCatBroOwned(r.id)){
          const before=catBroDeploy.length;
          toggleCatBroDeploy(r.id);
          if(before>=3 && !catBroDeploy.includes(r.id)) banner={text:'最多部署3只猫小弟',life:1.2};
        }
        return;
      }
    }
    if(catBroCollectionStartRect && p.x>=catBroCollectionStartRect.x && p.x<=catBroCollectionStartRect.x+catBroCollectionStartRect.w && p.y>=catBroCollectionStartRect.y && p.y<=catBroCollectionStartRect.y+catBroCollectionStartRect.h){
      state='catselect'; return;
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

    // 猫小弟收藏入口
    if(CATCHOOSE_BRO_BTN && p.x>=CATCHOOSE_BRO_BTN.x-CATCHOOSE_BRO_BTN.w/2 && p.x<=CATCHOOSE_BRO_BTN.x+CATCHOOSE_BRO_BTN.w/2 && p.y>=CATCHOOSE_BRO_BTN.y-CATCHOOSE_BRO_BTN.h/2 && p.y<=CATCHOOSE_BRO_BTN.y+CATCHOOSE_BRO_BTN.h/2){
      state='catbroCollection'; last=performance.now(); return;
    }

    // 开始闯关
    const sb = CATCHOOSE_STAGE_BTN;
    if(p.x >= sb.x - sb.w/2 && p.x <= sb.x + sb.w/2 &&
       p.y >= sb.y - sb.h/2 && p.y <= sb.y + sb.h/2){
      saveCatPref();
      state = 'stageSelect';
      stageScrollY = 0;
      return;
    }

    // 任务入口
    {
      const tb = CATCHOOSE_TASK_BTN;
      if(p.x >= tb.x - tb.w/2 && p.x <= tb.x + tb.w/2 &&
         p.y >= tb.y - tb.h/2 && p.y <= tb.y + tb.h/2){
        taskScrollY = 0;
        state = 'tasks';
        last = performance.now();
        return;
      }
    }

    // 技能树入口
    {
      const skb = CATCHOOSE_SKILL_BTN;
      if(p.x >= skb.x - skb.w/2 && p.x <= skb.x + skb.w/2 &&
         p.y >= skb.y - skb.h/2 && p.y <= skb.y + skb.h/2){
        skillTreeFrom = 'catselect';
        state = 'skillTree';
        last = performance.now();
        return;
      }
    }
    // 无尽模式（仅解锁后响应）
    if(isEndlessUnlocked()){
      const eb2 = CATCHOOSE_ENDLESS_BTN;
      if(p.x >= eb2.x - eb2.w/2 && p.x <= eb2.x + eb2.w/2 &&
         p.y >= eb2.y - eb2.h/2 && p.y <= eb2.y + eb2.h/2){
        saveCatPref();
        reset('endless', 0);
        return;
      }
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
    const boxH2 = 660;
    const boxY2 = (H - boxH2) / 2;

    // 继续战斗
    if(p.x >= W/2 - 150 && p.x <= W/2 + 150 &&
       p.y >= boxY2 + boxH2 - 120 - 31 && p.y <= boxY2 + boxH2 - 120 + 31){
      waveCapDisabled = true;
      waveBreakTimer = 1.6;
      state = 'playing';
      last = performance.now();
      return;
    }
    // 结算并返回主界面
    if(p.x >= W/2 - 150 && p.x <= W/2 + 150 &&
       p.y >= boxY2 + boxH2 - 52 - 28 && p.y <= boxY2 + boxH2 - 52 + 28){
      returnToMenu();
      return;
    }
    return;
  }

  if(state === 'dead'){
    // ★ 关卡模式：点红X → 返回选关；点左边按钮 → 返回选关；点右边 → 重试本关
    if(gameMode === 'stage'){
      if(deadCloseRect &&
         p.x >= deadCloseRect.x && p.x <= deadCloseRect.x + deadCloseRect.w &&
         p.y >= deadCloseRect.y && p.y <= deadCloseRect.y + deadCloseRect.h){
        state = 'stageSelect';
        stageScrollY = 0;
        return;
      }
      const boxH3 = 700;
      const boxY3 = (H - boxH3) / 2;
      const btnY3 = boxY3 + boxH3 - 90;
      if(p.x >= W/2 - 105 - 90 && p.x <= W/2 - 105 + 90 &&
         p.y >= btnY3 - 32 && p.y <= btnY3 + 32){
        state = 'stageSelect';
        stageScrollY = 0;
        return;
      }
      if(p.x >= W/2 + 105 - 90 && p.x <= W/2 + 105 + 90 &&
         p.y >= btnY3 - 32 && p.y <= btnY3 + 32){
        reset('stage', currentStageNum);
        return;
      }
      return;
    }

    // ★ 无尽模式红X：返回主菜单
    if(deadCloseRect &&
       p.x >= deadCloseRect.x && p.x <= deadCloseRect.x + deadCloseRect.w &&
       p.y >= deadCloseRect.y && p.y <= deadCloseRect.y + deadCloseRect.h){
      returnToMenu();
      return;
    }

    // 按钮位置（跟 drawDeadScreen 内部保持一致）
    const boxH2 = 700;
    const boxY2 = (H - boxH2) / 2;
    const btnY  = boxY2 + boxH2 - 90;

    // ★ 退出游戏：返回主菜单
    if(p.x >= W/2 - 105 - 90 && p.x <= W/2 - 105 + 90 &&
       p.y >= btnY - 32 && p.y <= btnY + 32){
      returnToMenu();
      return;
    }
    // 重新开始
    if(p.x >= W/2 + 105 - 90 && p.x <= W/2 + 105 + 90 &&
       p.y >= btnY - 32 && p.y <= btnY + 32){
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
    // ★ 红X：继续游戏
    if(pauseCloseRect &&
       p.x >= pauseCloseRect.x && p.x <= pauseCloseRect.x + pauseCloseRect.w &&
       p.y >= pauseCloseRect.y && p.y <= pauseCloseRect.y + pauseCloseRect.h){
      state = 'playing';
      last = performance.now();
      return;
    }

    // 继续
    const rs = RESUME_BTN;
    if(p.x >= rs.x - rs.w/2 && p.x <= rs.x + rs.w/2 &&
       p.y >= rs.y - rs.h/2 && p.y <= rs.y + rs.h/2){
      state = 'playing';
      last = performance.now();
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
    // ★ 红X：取消，回到暂停
    if(confirmCloseRect &&
       p.x >= confirmCloseRect.x && p.x <= confirmCloseRect.x + confirmCloseRect.w &&
       p.y >= confirmCloseRect.y && p.y <= confirmCloseRect.y + confirmCloseRect.h){
      state = 'paused';
      return;
    }

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
  if(isMouse){
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
  if(state === 'skillTree' && skillScroll.dragging && !skillDetailNode){
    e.preventDefault();
    const p = toCanvasXY(e.clientX, e.clientY);
    const dy = p.y - skillScroll.startY;
    if(Math.abs(dy) > 8 || Math.abs(p.x-skillScroll.startX) > 8) skillScroll.moved=true;
    skillScrollY = clamp(skillScroll.startScrollY - dy, 0, skillScrollMaxY);
    return;
  }
  // 选关滚动
  if(state === 'stageSelect' && stageScroll.dragging){
    e.preventDefault();
    const p = toCanvasXY(e.clientX, e.clientY);
    const dy = p.y - stageScroll.startY;
    stageScrollY = Math.max(0, Math.min(stageScrollMaxY, stageScroll.startScrollY - dy));
    return;
  }

  if(e.pointerId !== moveJoy.id) return;
  e.preventDefault();
  const p = toCanvasXY(e.clientX, e.clientY);
  updateJoy(moveJoy, p);
}

function onPointerUp(e){
  if(state === 'skillTree' && skillScroll.dragging){
    const p=toCanvasXY(e.clientX,e.clientY);
    const didMove=skillScroll.moved;
    skillScroll.dragging=false;
    if(!didMove){
      for(const r of skillNodeRects){
        if(hitRect(r,p)){ skillDetailNode=r.node; return; }
      }
    }
    return;
  }
  if(state === 'stageSelect'){
    stageScroll.dragging = false;
  }
  if(e.pointerId === moveJoy.id) resetJoy(moveJoy, MOVE_BASE);
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
  try{ lastBgmState = state; syncBGM(); }catch(e){}
  setTimeout(() => { try{ lastBgmState = state; syncBGM(); }catch(e){} }, 300);
  setTimeout(() => { try{ lastBgmState = state; syncBGM(); }catch(e){} }, 800);
}
cv.addEventListener('click', audioUnlockByClick);
cv.addEventListener('wheel', e=>{
  if(state==='skillTree' && !skillDetailNode){
    e.preventDefault();
    skillScrollY=clamp(skillScrollY+e.deltaY*0.75,0,skillScrollMaxY);
  }
},{passive:false});

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
  zombie:  { hp: 42,  speed: 70, r: 15, dmg: 5,  color: '#7a7a7a' },
  runner:  { hp: 34,  speed: 120, r: 13, dmg: 5,  color: '#9aa0a4' },
  brute:   { hp: 150, speed: 45, r: 27, dmg: 10, color: '#4a4a4a' },
  spitter: { hp: 52,  speed: 72, r: 17, dmg: 0,  color: '#a83232', ranged: true },
  elite_zombie:  { hp: 105, speed: 76,  r: 22, dmg: 8,  color: '#ffd45a', elite: true },
  elite_runner:  { hp: 82, speed: 132, r: 19, dmg: 8,  color: '#ff9a3d', elite: true },
  elite_brute:   { hp: 390, speed: 48, r: 38, dmg: 16, color: '#d7a86e', elite: true },
  elite_spitter: { hp: 150, speed: 78, r: 24, dmg: 0,  color: '#d96cff', ranged: true, elite: true }
};

// ================= 掉落物 =================
const DROP_TYPES = {
  // value = 单位数（1 单位 = 1/4 颗心）
  heal_small:   { kind:'heal',  value:2, color:'#ff9a9a', icon:'✚' },  // 0.5 颗心
  heal_medium:  { kind:'heal',  value:4, color:'#ff6b6b', icon:'✚' },  // 1 颗心
  heal_large:   { kind:'heal',  value:8, color:'#ff4a4a', icon:'✚' },  // 2 颗心
  coin:         { kind:'coin',    color:'#ffd24a', icon:'¥' },
  diamond:      { kind:'diamond', color:'#88e0ff', icon:'◆' }
};
const HEAL_POOL = ['heal_small','heal_small','heal_medium','heal_medium','heal_large'];
const DROP_DURATION = 22;
const DROP_MAX_ON_FIELD = 25;   // ★ 屏幕上最多同时存在 25 个掉落物

// ================= BUFF =================
const BUFFS = [
  // ===== 猫粮 =====
  { id:'firerate',      name:'极速射击', desc:'猫粮射速 +25%', max:2, icon:'⚡', color:'#ffd24a' },
  { id:'multishot',     name:'多重发射', desc:'Lv.1 三连发 → Lv.2 五连发', max:2, icon:'🎯', color:'#6fd0ff' },
  { id:'pierce',        name:'穿透猫粮', desc:'猫粮可以连续穿透敌人', max:2, icon:'➜', color:'#7fe0a0' },
  { id:'can_explode',   name:'爆裂猫粮', desc:'猫粮命中后产生范围爆炸', max:2, icon:'✦', color:'#ff9f6b' },
  { id:'giant_food',    name:'巨型猫粮', desc:'猫粮变大并提高伤害', max:2, icon:'●', color:'#ffd080' },

  // ===== 激光 =====
  { id:'laser_width',   name:'宽幅激光', desc:'激光宽度提升', max:2, icon:'▌', color:'#88eeff' },
  { id:'laser_burn',    name:'灼热锁定', desc:'持续照射同一目标，伤害逐层提高', max:2, icon:'♨', color:'#7feaff' },
  { id:'laser_defense', name:'光束防御', desc:'激光可以击落普通敌方子弹', max:2, icon:'✦', color:'#b8f8ff' },
  { id:'laser_double',  name:'双束激光', desc:'同时发射两条激光', max:1, icon:'Ⅱ', color:'#8ff7ff' },

  // ===== 导弹 =====
  { id:'missile_multishot', name:'多重导弹', desc:'Lv.1 三连发 → Lv.2 五连发', max:2, icon:'🚀', color:'#ff8a3c' },
  { id:'missile_explode',   name:'爆裂导弹', desc:'命中后产生范围爆炸', max:2, icon:'✦', color:'#ffb04a' },
  { id:'missile_split',     name:'分裂导弹', desc:'命中后分裂出小导弹', max:2, icon:'◇', color:'#ff7a55' },
  { id:'missile_giant',     name:'巨型导弹', desc:'导弹体积、伤害和爆炸范围提升', max:2, icon:'🚀', color:'#ffd080' },
  { id:'missile_reload',    name:'快速装填', desc:'导弹发射间隔缩短', max:2, icon:'⚡', color:'#ff9f6b' }
];

// 判断一个 buff 当前是否可抽（武器已解锁 + 未满级）
function isBuffAvailable(b){
  if(!b) return false;
  if((player.buffLevels[b.id] || 0) >= b.max) return false;
  const wtype = BUFF_WEAPON_TYPE[b.id];
  if(!wtype) return false;
  const activeType = currentWeapon === 'catfood' ? 'bullet' : currentWeapon;
  return wtype === activeType;
}

// 强化卡显示文本（合并基础描述 + 数值预览为一行）
// lv = 0：显示新卡基础值
// lv > 0：显示升级后的范围（当前 → 下一级）
function getBuffDisplayText(id, lv){
  const next = lv + 1;
  const names = {
    firerate: lv === 0 ? '猫粮射速 +25%' : '猫粮射速进一步提高',
    multishot: lv === 0 ? '单发 → 三连发' : '三连发 → 五连发',
    pierce: lv === 0 ? '穿透 1 个额外敌人' : '进一步增加穿透能力',
    can_explode: lv === 0 ? '命中后小范围爆炸' : '爆炸范围进一步扩大',
    giant_food: lv === 0 ? '猫粮变大、伤害提高' : '超级巨型猫粮',
    laser_width: lv === 0 ? '激光宽度提升' : '激光大幅变宽',
    laser_burn: lv === 0 ? '持续照射后获得灼热层数' : '灼热叠加更快、上限更高',
    laser_defense: lv === 0 ? '可击落普通敌方子弹' : '可击落更强的普通投射物',
    laser_double: '同时发射两条激光',
    missile_multishot: lv === 0 ? '单发 → 三连发' : '三连发 → 五连发',
    missile_explode: lv === 0 ? '命中后范围爆炸' : '大型爆炸',
    missile_split: lv === 0 ? '命中后分裂小导弹' : '更多分裂导弹',
    missile_giant: lv === 0 ? '巨型导弹：伤害与爆炸范围提升' : '超级巨型导弹',
    missile_reload: lv === 0 ? '发射间隔缩短' : '进一步缩短发射间隔'
  };
  return names[id] || '';
}
const BUFF_CATEGORY = {
  firerate:'bullet', multishot:'bullet', pierce:'bullet', can_explode:'bullet', giant_food:'bullet',
  laser_width:'laser', laser_burn:'laser', laser_defense:'laser', laser_double:'laser',
  missile_multishot:'missile', missile_explode:'missile', missile_split:'missile', missile_giant:'missile', missile_reload:'missile'
};

// ============ 稀有度 & 武器类型 ============
// 稀有度：blue 小提升 / purple 中提升 / red 大提升（质变）/ gold 解锁武器

// buff 属于哪种武器
const BUFF_WEAPON_TYPE = {
  firerate:'bullet', multishot:'bullet', pierce:'bullet', can_explode:'bullet', giant_food:'bullet',
  laser_width:'laser', laser_burn:'laser', laser_defense:'laser', laser_double:'laser',
  missile_multishot:'missile', missile_explode:'missile', missile_split:'missile', missile_giant:'missile', missile_reload:'missile'
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

const DAMAGE_COLORS = {
  bullet:    '#ffe080',
  orb:       '#ffb0d0',
  can:       '#ff9f6b',
  laser:     '#88eeff',
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
  } else if(id === 'missile_count' || id === 'missile_damage' || id === 'missile_charge' || id === 'missile_cooldown'){
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

  } else if(id === 'laserup' || id === 'laserpower' || id === 'laser_width' || id === 'laser_cooldown' || id === 'laser_slow'){
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
  const critChance = CRIT_CHANCE + (player.skillCritBonus || 0);
  if(!noCrit && Math.random() < critChance){
    dmg *= (CRIT_MULT + (player.skillCritMultBonus || 0));
    crit = true;
  }

  // 护盾吸收（不区分武器，就是额外血条）
  if(e.shield > 0){
    e.shield -= dmg;
    e.hitFlash = 1;
    if(runDamageStats && type){
      runDamageStats[type] = (runDamageStats[type] || 0) + dmg;
    }
    if(!silent){
      addFloatText(e.x, e.y - e.r - 6, Math.round(dmg), '#a0d8ff', crit);
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

  // 正常伤害（无克制，直接扣血）
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
const renderEntityList = [];
let missileList = [];
let cam, wave, waveActive, spawnQueue, waveTimer, waveBreakTimer, score, gameTime, banner;
let nextEnemyId = 1;
let lbFrom = 'dead';
// 弹窗红X的点击热区
let weaponSelectRects = [];
let weaponSelectStartRect = null;
let pauseCloseRect   = null;
let deadCloseRect    = null;
let confirmCloseRect = null;
let last = performance.now();

let waveTotal = 0;

// ===== 城堡防守战核心状态 =====
const CASTLE_MAX_HP = 100;
const CASTLE_WALL_Y = 1060;
const CASTLE_FRONT_Y = 1018;
const RANGED_STOP_Y = 570;
let castleHp = CASTLE_MAX_HP;
let castleMaxHp = CASTLE_MAX_HP;
let playerDead = false;
let currentWeapon = 'catfood'; // 测试阶段默认猫粮；1/2/3 可切换主武器
let stageSpawnQueue = [];
let stageSpawnIndex = 0;
let stageSpawnTimer = 0;
let stageWaveClearHandled = false;
let bossSummonTimer = 0;

// ============ 教学关卡状态 ============
let currentStage = 1;         // 当前关卡 1~6，0 表示无尽模式
let waveInStage = 0;          // 本关打到第几波（1~4）
let unlockedWeapons = {};     // 已解锁的武器集合
let stageKillCount = 0;         // 本关击杀数
let pendingStageClearAfterBuff = false;  // 教学关最后一波：选完强化后再进过关弹窗
let tutorialStep = 0;           // 教程当前步骤
let tutorialQueue = [];         // 当前播放的教程步骤列表
let tutorialOnFinish = null;    // 教程结束动作：'start-game' | 'continue-wave' | 'return-help'
let helpListRects = [];         // 玩法说明列表项的点击区域

// ============ 教学关卡配置 ============
// unlockThisStage：进入这一关后，第一次清波时弹出"解锁卡"
const STAGE_WAVES = 6;
const TUTORIAL_MAX_STAGE = 1;

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
    highlight: () => ({ shape: 'circle', x: 46, y: H * 0.38, r: 46 }),
    panelAnchor: 'left'
  },
  missile: {
    name: '追踪导弹',
    color: '#ff8a3c',
    intro: '自动追踪高血量敌人，充能制发射',
    trigger: '按空格或点右侧按钮',
    when: '面对远程怪或高血量怪时效果最好',
    detail: '自动追踪最高血量敌人，充能制，最多 3 层',
    highlight: () => ({ shape: 'circle', x: 46, y: H * 0.38 + 100, r: 46 }),
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

// 每个武器系列对应的 buff id
const BUFF_POOLS = {
  bullet:    ['firerate', 'multishot', 'frozen_bullet'],
  laser:     ['laser_width', 'laser_cooldown', 'laser_slow'],
  missile:   ['missile_count', 'missile_cooldown'],
  can:       ['canpower', 'blast'],
  orb:       ['orb_count', 'orb_damage'],
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

let waveCapDisabled = false;   // 胜利后选择继续，则解除 10 波上限
let pendingStageVictory = false;   // 4 波清完，等待 1.5 秒进结算
let progressKills   = 0;     // 本关已击杀
let progressTargets = [];    // 本关 4 个目标 [T1,T2,T3,T4]
let progressTarget  = 0;     // = progressTargets[3]
let progressMarkers = [];    // 标记列表
let bossPhase       = false; // 是否进入 Boss 阶段
let bossEnemy       = null;  // Boss 引用
let bossWarnings   = [];     // Boss4 地面预警
let supportFx       = null;  // 空袭过场状态
let airdropFx       = null;  // 空投箱状态
let progressPulse   = 0;     // 进度条满时闪烁
let stageEnding     = false; // Boss 已死，等待结算
let pendingBossIntro= false; // 选完 buff 后触发 Boss 入场
let stageVictoryAnimT = 0;         // 结算弹窗动画进度 0→1
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
let battleFadeGradient = null;
let runCoins = 0;      // 本场战斗累计获得的金币
let runDiamonds = 0;   // 本场战斗累计获得的钻石

// ============ 猫小弟 ============
let catBros = [];             // 所有猫小弟
let playerMoveSpeed = 0;      // 主角当前帧速度（px/s），用于猫小弟跟随判定
let playerPrevX = 0;
let playerPrevY = 0;

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
const LASER_DURATION    = 0.82;
const LASER_BASE_RADIUS = 2400;
const LASER_BASE_DAMAGE = 140;
const ENERGY_REGEN      = 0;   // 已改为命中/击杀获取
const CAN_BASE_DAMAGE   = 80;      // 罐头伤害（100 → 80）
const CAN_ATTACK_RANGE  = 360;     // 罐头攻击距离（约半屏）
const AIRSTRIKE_RANGE   = 360;     // 空袭攻击距离（约半屏）
const FIRE_BASE_RANGE   = 1300;
const BULLET_HOMING     = false;

const ORB_BASE_DAMAGE   = 26;
const ORB_BASE_RADIUS   = 180;
const ORB_BASE_SIZE     = 26;
const ORB_BASE_SPEED    = 0.8;
const ORB_DURATION  = 8;    // 毛球持续时间（秒）
const ORB_COOLDOWN  = 12;   // 毛球冷却（秒）
const ORB_HIT_CD        = 0.38;
const ORB_KNOCKBACK     = 55;
const BUFF_CRIT_CHANCE  = 0.25;

const MISSILE_BASE_COUNT   = 1;
const MISSILE_BASE_DAMAGE  = 92;
const MISSILE_MAX_CHARGES  = 3;
const MISSILE_CHARGE_TIME  = 4;
const MISSILE_SPEED        = 640;

let laser = {
  active: false,
  angle: -Math.PI / 2 - Math.PI / 3,   // 起始：左 -60°
  hitCdMap: new Map(),                  // 敌人 id → 上次命中时间戳
  timer: 0,
  duration: 1.4,
  flash: 0,
  swingTrail: []                        // 光剑拖尾：[{angle, age}]
};

function reset(mode, stageNum){
  // 无参调用 → 用当前模式重开
  if(mode === undefined){
    mode = gameMode || 'stage';
    stageNum = (mode === 'stage') ? (currentStageNum || 1) : 0;
  }

  // 关键修复：准备界面选好的武器必须贯穿 reset()，不能每次重开又强制回到猫粮。
  const selectedWeapon = (currentWeapon === 'laser' || currentWeapon === 'missile') ? currentWeapon : 'catfood';

  clearProgress();
  castleHp = CASTLE_MAX_HP;
  castleMaxHp = CASTLE_MAX_HP;
  playerDead = false;
  currentWeapon = selectedWeapon;
  stageSpawnQueue = []; stageSpawnIndex = 0; stageSpawnTimer = 0; stageWaveClearHandled = false;
  bossSummonTimer = 4.0;
  state = 'playing';
  waveCapDisabled = false;

  const savedAvatar = globalAvatarImg || (player && player.avatarImg) || null;
  globalAvatarImg = savedAvatar;

  player = {
    x: WORLD.w/2, y: WORLD.h * 0.72, r: 18,
    speed: 240, hp: 100, maxHp: 100, skillCritBonus: 0,
    facing: -Math.PI/2, fireCd: 0, fireRate: 0.5, recoil: 0,
    bulletDamage: 10, pierce: 1, multishot: 0,
    bulletRangeMult: 1,
    blastRadius: 140,
    canDamage: CAN_BASE_DAMAGE,
    laserDamage: LASER_BASE_DAMAGE,
    laserRadius: LASER_BASE_RADIUS,
    invuln: 0,
    avatarImg: savedAvatar,
    buffLevels: {},
    orbCount: 0,
    orbDamage: ORB_BASE_DAMAGE,
    orbRadius: ORB_BASE_RADIUS,
    orbSize: ORB_BASE_SIZE,
    orbSpeedMult: 1,
    orbAngle: 0,
    orbHitCd: new Map(),
    orbActiveTimer: 0,     // 剩余持续时间
    orbCooldown: 0,        // 剩余冷却
    missileCount: MISSILE_BASE_COUNT,
    missileDamage: MISSILE_BASE_DAMAGE,
    missileCooldown: 0,          // 剩余冷却
    missileCooldownMax: 5        // 冷却总时长（秒）
  };
  recalcPlayerStats();

  enemies = []; bullets = []; eBullets = []; cans = [];
  particles = []; rings = []; burnMarks = []; drops = [];
  floatTexts = [];
  missileList = [];
  cam = { x: 0, y: 0, shake: 0 };

  stageKillCount = 0;
  pendingStageClearAfterBuff = false;
  pendingStageVictory = false;
  progressKills   = 0;
  progressTargets = [];
  progressTarget  = 0;
  progressMarkers = [];
  bossPhase       = false;
  bossEnemy       = null;
    bossWarnings     = [];
  supportFx       = null;
  airdropFx       = null;
  progressPulse    = 0;
  spawnCheckTimer  = 0;
  stageEnding      = false;
  pendingBossIntro = false;

  // 关卡模式：初始化进度目标
  if(mode === 'stage' && stageNum >= 1){
    progressTargets = calcProgressTargets(stageNum);
    progressTarget  = progressTargets[3];
    progressMarkers = calcProgressMarkers(stageNum);
  }
  stageVictoryAnimT = 0;

  tutorialStep = 0;
  tutorialQueue = [];
  tutorialOnFinish = null;
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
  const deployed = getDeployedCatBros();
  deployed.forEach((cfg, idx)=>initCatBro(cfg, idx));
  playerMoveSpeed = 0;
  playerPrevX = player.x;
  playerPrevY = player.y;
  waveTotal = 0;
  buffChoices = []; buffCards = [];
  orbBuffGiven = false;
  forcedBuffQueue = [];
  waveClearTimer = 0;
  buffFadeIn = 0;
  pendingCritReward = false;
  isSecondPick = false;
  bubble.life = 0; bubble.text = '';
  laser.active = false;
  laser.angle = -Math.PI / 2 - Math.PI / 3;
  laser.hitCdMap = new Map();
  laser.swingTrail = [];
  laser.timer = 0;
  laser.flash = 0;
  laserCooldown = 0;
    // 毛球技能状态已在 player 对象里初始化
  stopBGM();
  runDamageStats = {};
  runCoins = 0;
  runDiamonds = 0;
  resetJoy(moveJoy, MOVE_BASE);

  generateGroundDecorations();
  updateCameraInstant();
  setBackground('grass');

  // ===== 模式分流 =====
  if(mode === 'endless'){
    gameMode = 'endless';
    currentStageNum = 0;

    unlockedWeapons.can       = true;
    unlockedWeapons.orb       = true;
    unlockedWeapons.laser     = true;
    unlockedWeapons.missile   = true;
    unlockedWeapons.airstrike = true;
    recalcPlayerStats();

    currentStage = 0;        // 无尽模式
    waveInStage = 0;
    wave = 0;
    state = 'playing';
    waveBreakTimer = 1.6;
    banner = { text: '无尽模式', life: 2.0 };
    last = performance.now();
    return;
  }

  // ===== 闯关模式 =====
  gameMode = 'stage';
  currentStageNum = stageNum;
  currentStage = stageNum;
  unlockedWeapons = {};
  castleHp = CASTLE_MAX_HP;
  castleMaxHp = CASTLE_MAX_HP;
  playerDead = false;
  currentWeapon = selectedWeapon;
  stageSpawnQueue = []; stageSpawnIndex = 0; stageSpawnTimer = 0; stageWaveClearHandled = false;
  bossSummonTimer = 4.0;

  stageTotalEnemies = 0;

  // ★ 武器解锁来自技能树
  const sk = getSkillBonus();
  unlockedWeapons.catfood   = true;
  unlockedWeapons.laser     = true;
  unlockedWeapons.missile   = true;
  unlockedWeapons.can       = false;
  unlockedWeapons.orb       = false;
  unlockedWeapons.airstrike = false;
  recalcPlayerStats();

  waveInStage = 1;
  wave = 1;
  currentWeapon = selectedWeapon;
  state = 'playing';
  waveInStage=1; wave=1;
  startWave(1);
  last = performance.now();
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
  const sk = getSkillBonus();

  // ===== 猫粮 =====
  const foodLv = b.firerate || 0;
  player.bulletDamage = 14 * (1 + 0.18 * (b.giant_food || 0)) * (1 + 0.10 * foodLv) * sk.damageMult;
  player.fireRate = (0.38 / (1 + 0.25 * foodLv)) * sk.fireRateMult;
  player.pierce = 1 + (b.pierce || 0);
  player.multishot = (b.multishot || 0) === 0 ? 0 : ((b.multishot || 0) === 1 ? 2 : 4);
  player.foodExplosionLevel = b.can_explode || 0;
  player.foodSizeMult = 1 + 0.28 * (b.giant_food || 0);

  // ===== 激光 =====
  player.laserDamage = 32 * sk.damageMult;
  player.laserWidthMult = 1 + 0.45 * (b.laser_width || 0);
  player.laserCooldownMax = 0.42 * sk.fireRateMult;
  player.laserDuration = 0.82;
  player.laserBurnLevel = b.laser_burn || 0;
  player.laserDefenseLevel = b.laser_defense || 0;
  player.laserDouble = (b.laser_double || 0) > 0;

  // ===== 导弹 =====
  const mm = b.missile_multishot || 0;
  player.missileCount = mm === 0 ? 1 : (mm === 1 ? 3 : 5);
  player.missileDamage = 92 * (1 + 0.30 * (b.missile_giant || 0)) * sk.damageMult;
  player.missileCooldownMax = (1.15 / (1 + 0.18 * (b.missile_reload || 0))) * sk.fireRateMult;
  player.missileSpeedMult = 1;
  player.missileExplosionLevel = b.missile_explode || 0;
  player.missileSplitLevel = b.missile_split || 0;
  player.missileGiantLevel = b.missile_giant || 0;

  // ===== 旧武器兼容值（不再作为主武器） =====
  player.canDamage   = CAN_BASE_DAMAGE * (1 + 0.50 * (b.canpower || 0));
  player.blastRadius = 140 * (1 + 0.35 * (b.blast || 0));

  // ===== 毛球 =====
  if(unlockedWeapons.orb){
    player.orbCount = 3 + (b.orb_count || 0);
  } else {
    player.orbCount = 0;
  }
  player.orbDamage    = ORB_BASE_DAMAGE * (1 + 0.50 * (b.orb_damage || 0));
  player.orbSize      = ORB_BASE_SIZE;
  player.orbRadius    = ORB_BASE_RADIUS;
  player.orbSpeedMult = 1;

  // ===== 空袭 =====
  const al = b.airstrike || 0;
  player.airstrikeLevel  = al;
  player.airstrikeCount  = 3 + al;
  player.airstrikeDamage = 70 + al * 25;
  player.airstrikeCD     = 6.0 / (1 + 0.12 * (al > 0 ? al - 1 : 0));

  // ===== 1.04 永久成长：只作用于主角/城墙，不再绑定某一把武器 =====
  player.globalDamageMult = sk.damageMult;
  player.globalFireRateMult = sk.fireRateMult;
  player.bulletRangeMult = sk.rangeMult;
  player.maxHp = 100 + sk.hpBonus;
  player.hp = Math.min(player.hp, player.maxHp);
  player.speed = 240 * sk.speedMult;
  player.skillCritBonus = sk.critBonus;
  player.skillCritMultBonus = sk.critMultBonus;
  player.skillDamageTakenMult = sk.playerDamageTakenMult;
  player.skillWallDamageTakenMult = sk.wallDamageTakenMult;
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

  // ============ 无尽模式：原有逻辑 ============
  const pool = BUFFS.filter(isBuffAvailable);

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
  return picks;
}

function chooseBuff(id){
  try { if(id) applyBuff(id); } catch(err){ console.warn('chooseBuff error:', err); }
  sfx('buff');
  if(currentStage >= 1){
    if(waveInStage >= STAGE_WAVES){
      pendingBossIntro = false;
      waveInStage = STAGE_WAVES + 1;
      state = 'playing';
      waveBreakTimer = 0.8;
      banner = { text:'第 6 波结束 · BOSS 来袭', life:2.0 };
      last = performance.now();
      return;
    }
    waveInStage++;
    wave = waveInStage;
    state = 'playing';
    waveBreakTimer = 1.0;
    last = performance.now();
    return;
  }
  state = 'playing';
  waveBreakTimer = 1.5;
  last = performance.now();
}

// ================= 掉落物 =================
function addDrop(x, y, type, value){
  if(drops.length >= DROP_MAX_ON_FIELD) return;   // 屏幕上限保护
  const isCurrency = (type === 'coin' || type === 'diamond');
  drops.push({
    x: clamp(x, 30, WORLD.w - 30),
    y: clamp(y, 30, WORLD.h - 30),
    vx: rand(-80, 80), vy: rand(-80, 80),
    type,
    value: value || 1,
    life: DROP_DURATION, maxLife: DROP_DURATION,
    bob: Math.random() * TAU,
    r: isCurrency ? 18 : 14,
    attractDelay: isCurrency ? 0.5 : 0   // ★ 金币/钻石延迟 0.5 秒才被吸附
  });
}
function spawnEliteDrops(x, y){
  addDrop(x + rand(-14,14), y + rand(-14,14), randLine(HEAL_POOL));
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
  } else if(t.kind === 'coin'){
    const amount = d.value || 1;
    addCoins(amount);
    runCoins += amount;   // ★ 累计本场
    burst(player.x, player.y, 10, '#ffd24a', 220);
    rings.push({ x:player.x, y:player.y, maxR: 38, life:0.35, t:0.35, color: '#ffd24a' });
    addFloatText(player.x, player.y - 30, '+' + amount, '#ffd24a', false);
  } else if(t.kind === 'diamond'){
    const amount = d.value || 1;
    addDiamonds(amount);
    runDiamonds += amount;   // ★ 累计本场
    burst(player.x, player.y, 14, '#88e0ff', 260);
    rings.push({ x:player.x, y:player.y, maxR: 48, life:0.4, t:0.4, color: '#88e0ff' });
    addFloatText(player.x, player.y - 30, '+' + amount, '#88e0ff', false);
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

    // ★ 延迟吸附：生成后短暂时间内自由飞散，不被玩家吸走
    if(d.attractDelay > 0){
      d.attractDelay -= dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 0.93; d.vy *= 0.93;
    } else if(dist < 360){
      const safeDist = Math.max(dist, 1);
      const pull = 620 * dt / safeDist;
      d.x += dx * pull; d.y += dy * pull;
    } else {
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 0.93; d.vy *= 0.93;
    }
    d.x = clamp(d.x, 20, WORLD.w - 20);
    d.y = clamp(d.y, 20, WORLD.h - 20);

    // 碰撞判定用最新位置重算
    const fdx = player.x - d.x, fdy = player.y - d.y;
    const fdist = Math.hypot(fdx, fdy);
    if(fdist < player.r + d.r){
      pickupDrop(d);
      drops.splice(i, 1);
    }
  }
}

// ================= 波次 =================
function pickType(n){
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
  waveBreakTimer = 0;
  waveTimer = 0;
  stageWaveClearHandled = false;
  if(currentStage >= 1){
    bossPhase = false;
    bossEnemy = null;
    stageSpawnQueue = getStageWavePlan(currentStage, n);
    stageSpawnIndex = 0;
    stageSpawnTimer = 0.2;
    waveTotal = stageSpawnQueue.length;
    banner = { text: '第 ' + n + ' / 6 波 · 压力 ' + STAGE_WAVE_PRESSURE[n-1], life: 1.8 };
    return;
  }
  // 无尽模式兼容
  waveSpawn.active = true;
  waveSpawn.currentStage = 0;
  waveSpawn.stageTimer = 0;
  waveSpawn.stageDuration = getEndlessDuration(n) / 3;
  const totalCount = getEndlessCount(n);
  const perStage = Math.ceil(totalCount / 3);
  waveSpawn.stagePools = [{remaining:perStage},{remaining:perStage},{remaining:Math.max(0,totalCount-perStage*2)}];
  waveSpawn.totalSpawned = 0; waveSpawn.totalTarget = totalCount; waveSpawn.wave = n; waveSpawn.spawnTimer = 0;
  waveTotal = totalCount;
  banner = { text: '第 ' + n + ' 波 · ' + totalCount + ' 只', life: 2.0 };
}

// ================= 补怪系统（关卡模式 & 无尽模式通用） =================
let spawnCheckTimer = 0;

function updateSpawning(dt){
  if(stageEnding || bossPhase) return;
  if(currentStage >= 1){
    stageSpawnTimer -= dt;
    if(stageSpawnIndex < stageSpawnQueue.length && stageSpawnTimer <= 0){
      spawnEnemy(stageSpawnQueue[stageSpawnIndex++]);
      stageSpawnTimer = stageSpawnQueue.length >= 14 ? 0.68 : 0.82;
    }
    return;
  }
  // 无尽模式保留旧补怪
  spawnCheckTimer -= dt;
  if(spawnCheckTimer > 0) return;
  spawnCheckTimer = SPAWN_CHECK_INTERVAL;
  const cap = MAX_ENEMIES_ON_FIELD;
  const lack = cap - enemies.length;
  if(lack <= 0) return;
  const batch = Math.min(SPAWN_BATCH_MAX, lack);
  for(let i=0;i<batch;i++) spawnEnemy(pickType(Math.max(1,wave)));
}
function isWaveClear(){
  if(currentStage >= 1){
    return stageSpawnIndex >= stageSpawnQueue.length && enemies.every(e => e.dead);
  }
  if(!waveSpawn.active) return false;
  const lastIdx = waveSpawn.stagePools.length - 1;
  if(waveSpawn.currentStage < lastIdx) return false;
  return waveSpawn.stagePools[lastIdx].remaining === 0 && enemies.length === 0;
}

const CASTLE_LANE_MIN_X = 145;
const CASTLE_LANE_MAX_X = WORLD.w - 145;
function getEnemySpawnX(){ return rand(CASTLE_LANE_MIN_X, CASTLE_LANE_MAX_X); }
function clampEnemyToLane(e){
  if(!e || e.isBoss) return;
  e.x = clamp(e.x, CASTLE_LANE_MIN_X, CASTLE_LANE_MAX_X);
}

function spawnEnemy(type, spawnX, spawnY){
  let elite = false;
  let baseType = type;
  if(type.indexOf('elite_') === 0){ elite = true; baseType = type.slice(6); }
  const base = ENEMY_TYPES[type] || ENEMY_TYPES[baseType] || ENEMY_TYPES.zombie;
  let x = spawnX != null ? clamp(spawnX, CASTLE_LANE_MIN_X, CASTLE_LANE_MAX_X) : getEnemySpawnX();
  let y = spawnY != null ? spawnY : (50 + rand(-20,20));
  const cfg = currentStage >= 1 ? getStageConfig(currentStage) : null;
  const waveHpMult = currentStage >= 1 ? 1 + (waveInStage - 1) * 0.12 : 1;
  const hpScale = cfg ? cfg.hpScale * waveHpMult : getEndlessHpScale(Math.max(1,wave));
  const spScale = cfg ? cfg.spScale : getEndlessSpScale(Math.max(1,wave));
  const dmgScale = cfg ? cfg.dmgScale : getEndlessDmgScale(Math.max(1,wave));
  const e = {
    id: nextEnemyId++, x, y, r: base.r,
    hp: base.hp * hpScale, maxHp: base.hp * hpScale,
    speed: base.speed * spScale, dmg: base.dmg * dmgScale, color: base.color,
    type: baseType, visualType: baseType, elite, ranged: !!base.ranged,
    angle: Math.PI/2, atkCd: 0, hitFlash: 0, slowTimer: 0, frozenTimer: 0,
    shootCd: base.ranged ? (elite ? 1.35 : 1.65) : 0,
    wallAtkCd: 0, dead:false,
    laserHeatStacks:0, laserHeatTimer:0, laserLastHit:-999
  };
  if(elite){
    // 精英：体型已经体现在基础 r；额外只强化一个核心属性
    if(baseType === 'runner') e.speed *= 1.18;
    if(baseType === 'spitter'){ e.shootCd = elite ? 1.35 : 1.65; e.eliteProjectileCount = 2; }
    if(baseType === 'brute') e.hp *= 1.15;
    if(baseType === 'zombie') e.speed *= 1.08;
  }
  enemies.push(e);
}

// ================= 特效 =================
function burst(x, y, n, color, spd){
  const room = Math.max(0, 420 - particles.length);
  n = Math.min(n, room);
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
  // ★ 未激活或未解锁 → 不工作
  if(player.orbActiveTimer <= 0) return;
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
  if(!player || player.orbActiveTimer <= 0) return;
  if(player.orbCount <= 0) return;

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
// 返回按血量排序的前 N 个敌人（不重复）
function findTopHpEnemies(count){
  const arr = [];
  for(const e of enemies){
    if(e.dead) continue;
    arr.push(e);
  }
  arr.sort((a, b) => b.hp - a.hp);
  return arr.slice(0, count);
}
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
  if(player.missileCooldown > 0) return;
  if(enemies.length === 0) return;

  // ★ 只有敌人靠近半屏内才触发
  const HALF_SCREEN = H * 0.5;
  let nearestD = Infinity;
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if(d < nearestD) nearestD = d;
  }
  if(nearestD > HALF_SCREEN) return;

  player.missileCooldown = player.missileCooldownMax;

  const count = player.missileCount;
  // ★ 按血量从高到低取敌人，导弹循环分配
  const targets = findTopHpEnemies(count);
  if(targets.length === 0) return;

  for(let i = 0; i < count; i++){
    const target = targets[i % targets.length];

    const a = (i / count) * TAU + Math.random() * 0.4;
    const sx = player.x + Math.cos(a) * 18;
    const sy = player.y + Math.sin(a) * 18;
    const dirA = Math.atan2(target.y - sy, target.x - sx);

    missileList.push({
      x: sx, y: sy,
      vx: 0, vy: 0,
      launchA: dirA,
      spawnDelay: i * 0.08,
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
  // ★ 冷却计时
  if(player.missileCooldown > 0){
    player.missileCooldown = Math.max(0, player.missileCooldown - dt);
  }

  for(let i = missileList.length - 1; i >= 0; i--){
    const m = missileList[i];
    m.life -= dt;
    if(m.life <= 0){ missileList.splice(i, 1); continue; }

    // ★ 发射延迟：等待期间显示在原地
    if(m.spawnDelay > 0){
      m.spawnDelay -= dt;
      continue;
    }
    // ★ 延迟结束，给予初始速度
    if(m.vx === 0 && m.vy === 0 && m.launchA !== undefined){
      m.vx = Math.cos(m.launchA) * MISSILE_SPEED;
      m.vy = Math.sin(m.launchA) * MISSILE_SPEED;
    }

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
      const spd = MISSILE_SPEED * (player.missileSpeedMult || 1);
      m.vx = Math.cos(newA) * spd;
      m.vy = Math.sin(newA) * spd;
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
        const explodeLv = player.missileExplosionLevel || 0;
        if(explodeLv > 0){
          const rr = explodeLv === 1 ? 92 : 132;
          const splashMult = explodeLv === 1 ? 0.58 : 0.82;
          for(const ex of enemies){
            if(ex === e || ex.dead) continue;
            if(Math.hypot(ex.x-m.x, ex.y-m.y) <= rr){
              dealDamage(ex, m.damage * splashMult, 'missile');
              burst(ex.x, ex.y, 5 + explodeLv * 2, '#ff9b4a', 240);
            }
          }
          rings.push({x:m.x,y:m.y,maxR:rr,life:0.42,t:0.42,color:'#ff9b4a'});
          burst(m.x,m.y,20 + explodeLv*8,'#ff8a3c',360 + explodeLv*70);
        } else {
          burst(m.x, m.y, 14, '#ff8a3c', 320);
          rings.push({ x:m.x, y:m.y, maxR: 46, life:0.35, t:0.35, color:'#ff8a3c' });
        }
        burst(m.x, m.y, 6, '#ffe0a0', 200);
        const splitLv = player.missileSplitLevel || 0;
        // 子导弹不可再次分裂，避免指数增长导致卡死
        if(splitLv > 0 && !m.isSplitChild){
          const childCount = splitLv === 1 ? 3 : 5;
          const childSpeed = MISSILE_SPEED * 0.78;
          const spread = splitLv === 1 ? 0.95 : 1.25;
          const baseA = Math.atan2(m.vy, m.vx);
          for(let k=0;k<childCount;k++){
            const a = baseA - spread/2 + (childCount > 1 ? spread*k/(childCount-1) : 0);
            let childTarget = null, bestD = Infinity;
            for(const ex of enemies){
              if(ex.dead || ex === e) continue;
              const d = Math.hypot(ex.x-m.x, ex.y-m.y);
              if(d < bestD){bestD=d; childTarget=ex;}
            }
            missileList.push({x:m.x,y:m.y,vx:Math.cos(a)*childSpeed,vy:Math.sin(a)*childSpeed,launchA:a,spawnDelay:k*0.035,targetId:childTarget?childTarget.id:null,damage:m.damage*(splitLv===1?0.50:0.55),life:2.4,trail:[],isSplitChild:true});
          }
          burst(m.x,m.y,12 + splitLv*4,'#ff7a55',300);
        }
        cam.shake = Math.max(cam.shake, explodeLv > 0 ? 9 : 7);
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
    const mDmgLv = player.buffLevels.missile_damage || 0;
    const mScale = 1.7 * (1 + 0.12 * mDmgLv);   // ★ 伤害等级越高，导弹越大

    for(const t of m.trail){
      const a = Math.max(0, t.life / 0.25);
      ctx.fillStyle = 'rgba(255, 140, 60,' + (a * 0.55) + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 12 * a * (mScale / 1.7), 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(m.x, m.y);
    const ang = Math.atan2(m.vy, m.vx);
    ctx.rotate(ang);
    ctx.scale(mScale, mScale);

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
  let best = null, bd = 1e9;
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if(d < bd){ bd = d; best = e; }
  }
  if(!best || bd > CAN_ATTACK_RANGE) return false;

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

// ================= 掉落判定 =================
function rollEnemyDrop(type, x, y){
  // 怪分类
  let tier;
  if(type === 'armored' || type === 'elite') tier = 'elite';
  else if(type === 'skeleton' || type === 'brute') tier = 'advanced';
  else tier = 'normal';

  // 金币：100% 掉落
  let coinCount;
  if(tier === 'elite')         coinCount = 5 + Math.floor(Math.random() * 4);   // 5~8
  else if(tier === 'advanced') coinCount = 2 + Math.floor(Math.random() * 3);   // 2~4
  else                         coinCount = 1 + Math.floor(Math.random() * 2);   // 1~2
  addDrop(x + rand(-14,14), y + rand(-14,14), 'coin', coinCount);

  // 钻石：按概率
  let diamondChance;
  if(tier === 'elite')         diamondChance = 0.50;
  else if(tier === 'advanced') diamondChance = 0.12;
  else                         diamondChance = 0.05;

  if(Math.random() < diamondChance){
    let diamondCount = 1;
    if(tier === 'elite' && Math.random() < 0.5) diamondCount = 2;
    addDrop(x + rand(-20,20), y + rand(-20,20), 'diamond', diamondCount);
  }
}

function killEnemy(e, giveEnergy){
  if(e.dead) return;
  e.dead = true;
  score += 10 + Math.floor(e.maxHp / 8);
  stageKillCount++;
  recordEnemyTaskKill(e);
  burst(e.x, e.y, 16, e.color, 220);
  burst(e.x, e.y, 8, '#c94a4a', 180);

  // ★ 掉落系统暂时屏蔽（后续开放）
  // rollEnemyDrop(e.type, e.x, e.y);

  if(e.elite){
    rings.push({ x:e.x, y:e.y, maxR: 70, life:0.5, t:0.5,
                 color: e.demon ? '#ff5a3c' : '#c8d0c8' });
    // spawnEliteDrops(e.x, e.y);   // 掉落系统暂时屏蔽
  }
  // ★ Boss 死亡 → 触发结算
  if(e.isBoss){
    bossPhase    = false;
    bossEnemy    = null;
    stageEnding  = true;
    waveActive   = false;
    pendingStageVictory = true;
    waveClearTimer = 1.2;
    banner = { text: 'BOSS 已击败！', life: 1.5 };
    return;
  }
  // ★ 进度累计（Boss 阶段不再累计）
  if(currentStage >= 1 && !bossPhase && !e.isBoss){
    progressKills++;
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
const LASER_COOLDOWN_MAX = 0.42;   // 冷却总时长

function fireOrb(){
  if(state !== 'playing' || !player) return;
  if(!unlockedWeapons.orb) return;
  if(player.orbCooldown > 0) return;
  if(player.orbCooldown > 0) return;
  if(player.orbCount <= 0) return;

  player.orbActiveTimer = ORB_DURATION;
  player.orbCooldown    = 0;     // 冷却从技能结束时才开始算

  say(randLine(LINES.orb), true);
  sfx('orb');
  cam.shake = Math.max(cam.shake, 8);
  rings.push({ x: player.x, y: player.y, maxR: 90, life: 0.45, t: 0.45, color: '#ffb0d0' });
}

function fireLaser(){
  if(state !== 'playing' || !player || playerDead) return;
  if(!unlockedWeapons.laser || currentWeapon !== 'laser') return;
  if(laser.active || laserCooldown > 0 || enemies.length === 0) return;
  laser.active=true; laser.timer=0; laser.flash=1; laser.duration=player.laserDuration||0.82; laser.hitCdMap=new Map();
  say('激光！',true); sfx('laser'); cam.shake=Math.max(cam.shake,5);
}
function laserBeamHit(ox,oy,angle,L,beamHalfWidth,dt){
  const cosA=Math.cos(angle), sinA=Math.sin(angle);
  for(const e of enemies){
    if(e.dead) continue;
    const dx=e.x-ox, dy=e.y-oy, proj=dx*cosA+dy*sinA;
    if(proj<0 || proj>L) continue;
    const perp=Math.abs(-dx*sinA+dy*cosA);
    if(perp>e.r+beamHalfWidth) continue;
    e.laserLastHit=gameTime;
    if(e.laserHeatTimer===undefined) e.laserHeatTimer=0;
    if(e.laserHeatStacks===undefined) e.laserHeatStacks=0;
    e.laserHeatTimer += dt;
    if((player.laserBurnLevel||0)>0 && e.laserHeatTimer >= (player.laserBurnLevel>=2 ? 0.55 : 0.8)){
      e.laserHeatTimer=0; e.laserHeatStacks=Math.min(player.laserBurnLevel>=2?5:3,e.laserHeatStacks+1);
      addFloatText(e.x,e.y-e.r-8,'灼热 '+e.laserHeatStacks,'#88eeff',false);
    }
    const mult=1+0.20*e.laserHeatStacks;
    const hitCd=0.14;
    const lastHit=laser.hitCdMap.get(e.id)||-999;
    if(gameTime-lastHit>=hitCd){
      laser.hitCdMap.set(e.id,gameTime);
      dealDamage(e,player.laserDamage*mult*0.55,'laser');
      burst(e.x+rand(-5,5),e.y+rand(-5,5),4,'#88eeff',170);
      if(e.hp<=0) killEnemy(e);
    }
  }
  if((player.laserDefenseLevel||0)>0){
    for(let i=eBullets.length-1;i>=0;i--){
      const b=eBullets[i];
      if(b.isBossBullet) continue;
      const dx=b.x-ox,dy=b.y-oy,proj=dx*cosA+dy*sinA;
      if(proj<0||proj>L) continue;
      const perp=Math.abs(-dx*sinA+dy*cosA);
      if(perp<=beamHalfWidth+b.r){
        burst(b.x,b.y,7,'#b8f8ff',180); eBullets.splice(i,1);
      }
    }
  }
}
function updateLaser(dt){
  if(laser.flash>0) laser.flash=Math.max(0,laser.flash-dt*3);
  // 灼热衰减
  for(const e of enemies){
    if(e.dead) continue;
    if(gameTime-(e.laserLastHit||-999)>1.25){
      e.laserHeatTimer=0;
      if(e.laserHeatStacks>0) e.laserHeatStacks=Math.max(0,e.laserHeatStacks-dt*1.5);
    }
  }
  if(!laser.active) return;
  laser.timer+=dt;
  laser.angle=-Math.PI/2;
  const L=player.laserRadius||LASER_BASE_RADIUS;
  const beamHalfWidth=24*(player.laserWidthMult||1);
  if(player.laserDouble){
    const off=58*(player.laserWidthMult||1);
    laserBeamHit(player.x-off,player.y-player.r*0.6,-Math.PI/2,L,beamHalfWidth*0.86,dt);
    laserBeamHit(player.x+off,player.y-player.r*0.6,-Math.PI/2,L,beamHalfWidth*0.86,dt);
  }else{
    laserBeamHit(player.x,player.y-player.r*0.6,laser.angle,L,beamHalfWidth,dt);
  }
  if(laser.timer>=laser.duration){
    laser.active=false; laser.hitCdMap.clear(); laserCooldown=player.laserCooldownMax||0.42;
  }
}

function damagePlayer(d){
  if(player.invuln>0 || state!=='playing' || playerDead) return;
  player.hp=Math.max(0,player.hp-d); player.invuln=0.3; cam.shake=Math.max(cam.shake,9); sfx('hurt');
  addFloatText(player.x,player.y-30,'-'+Math.round(d),'#ff5b5b',false);
  if(player.hp<=0){
    playerDead=true; player.hp=0;
    banner={text:'猫咪倒下了！守住城墙！',life:2.2};
    burst(player.x,player.y,30,'#ff7b4a',280); cam.shake=18;
  }
}
function damageCastle(amount){
  if(stageEnding) return;
  amount *= (player.skillWallDamageTakenMult || 1);
  castleHp=Math.max(0,castleHp-amount);
  addFloatText(WORLD.w/2,CASTLE_WALL_Y-30,'-'+amount,'#ff5b5b',true);
  rings.push({x:WORLD.w/2,y:CASTLE_WALL_Y,maxR:90,life:0.45,t:0.45,color:'#ff5b5b'});
  cam.shake=Math.max(cam.shake,8);
  if(castleHp<=0){
    stageEnding=true; state='dead'; deadDelay=0.6; recordRun(); clearProgress();
    banner={text:'城墙失守！',life:2};
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
  if(analyser && analyserData){
    analyser.getByteTimeDomainData(analyserData);
    let max = 0;
    for(let i = 0; i < analyserData.length; i++){
      const v = Math.abs(analyserData[i] - 128);
      if(v > max) max = v;
    }
    const target = max / 128;
    audioLevel = audioLevel * 0.7 + target * 0.3;
  }

  // BGM 只在 state 发生变化时同步，避免每帧检查
  if(state !== lastBgmState){
    lastBgmState = state;
    syncBGM();
  }

  // 强化卡淡入进度
  if(state === 'buff'){
    buffFadeIn = Math.min(1, buffFadeIn + dt * 3);
  }

    // ============ 空袭支援过场 ============
  if(state === 'support'){
    gameTime += dt;
    if(cam) cam.shake = Math.max(0, cam.shake - dt * 46);
    updateEffects(dt);
    if(supportFx) updateSupportStrike(dt);
    return;
  }

  if(state !== 'playing'){
    if(cam) cam.shake = Math.max(0, cam.shake - dt * 46);

    if(state === 'boot' || state === 'menu' || state === 'catselect' || state === 'stagePrep' || state === 'home' || state === 'placeholder' ||
       state === 'help' || state === 'victory' || state === 'stageVictory' ||
       state === 'tutorial'){
      gameTime += dt;
    }
    if(state === 'stageVictory'){
      stageVictoryAnimT = Math.min(1.6, stageVictoryAnimT + dt * 2.5);
    }
    if(state === 'boot'){
      bootAnimT += dt;
    }

    if(state === 'menu' || state === 'catselect' || state === 'stagePrep' || state === 'home' || state === 'placeholder'){
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

  // ★ 激光持续中不计冷却，结束后才计
  if(!laser.active && laserCooldown > 0){
    laserCooldown = Math.max(0, laserCooldown - dt);
  }

  // ★ 毛球计时
  if(player.orbActiveTimer > 0){
    player.orbActiveTimer -= dt;
    if(player.orbActiveTimer <= 0){
      player.orbActiveTimer = 0;
      player.orbCooldown = ORB_COOLDOWN;   // 技能结束 → 进入冷却
    }
  } else if(player.orbCooldown > 0){
    player.orbCooldown = Math.max(0, player.orbCooldown - dt);
  }
  if(player.recoil > 0) player.recoil = Math.max(0, player.recoil - dt);

  updateDrops(dt);

  canAutoTimer += dt;
  if(canAutoTimer >= CAN_AUTO_INTERVAL){
    if(tryThrowCan()) canAutoTimer = 0;
  }

  // ===== 自动释放当前主武器 =====
  if(enemies.length > 0 && !playerDead){
    if(currentWeapon === 'laser' && unlockedWeapons.laser && !laser.active && laserCooldown <= 0) fireLaser();
    if(currentWeapon === 'missile' && unlockedWeapons.missile && player.missileCooldown <= 0) fireMissile();
  }


  let mx = 0, my = 0;
  let kx = 0, ky = 0;
  if(playerDead){ mx = 0; my = 0; }
  if(isDown('w','arrowup','keyw'))    ky -= 1;
  if(isDown('s','arrowdown','keys'))  ky += 1;
  if(isDown('a','arrowleft','keya'))  kx -= 1;
  if(isDown('d','arrowright','keyd')) kx += 1;

  if(!playerDead && (kx || ky)){
    const kl = Math.hypot(kx, ky);
    mx = kx / kl; my = ky / kl;
  } else if(!playerDead && moveJoy.id !== -1){
    const mag = Math.hypot(moveJoy.dx, moveJoy.dy);
    if(mag > 0.15){
      const sp = Math.min(1, (mag - 0.15) / 0.55);
      mx = (moveJoy.dx / mag) * sp;
      my = (moveJoy.dy / mag) * sp;
    }
  }

  // ★ 主角位置更新（这两行不见了）
  if(!playerDead){
    player.x = clamp(player.x + mx * player.speed * dt, player.r, WORLD.w - player.r);
    player.y = clamp(player.y + my * player.speed * dt, player.r, WORLD.h - player.r);
  }
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

  // 面朝方向固定朝屏幕上方
  player.facing = -Math.PI / 2;

  updateOrbs(dt);
  updateCatBro(dt);

  player.fireCd -= dt;
  const FIRE_RANGE = FIRE_BASE_RANGE * player.bulletRangeMult;
  const bulletLife = 2.0 * player.bulletRangeMult;
  if(currentWeapon === 'catfood' && !playerDead && gunTarget && gunTargetD < FIRE_RANGE && player.fireCd <= 0){
    player.fireCd = player.fireRate;
    player.recoil = 0.08;
    const shots = 1 + player.multishot;

    // 枪口：玩家正上方
    const mzX = player.x;
    const mzY = player.y - player.r * 1.2;

    // 多弹道：以正上方为中心扇形散开
    const BASE_ANGLE      = -Math.PI / 2;
    const SPREAD_PER_SHOT = 0.18;
    const spreadTotal     = (shots - 1) * SPREAD_PER_SHOT;

    // 多发降低单发伤害，避免三/五连发成为无风险倍率提升
    const multishotPenalty = shots >= 5 ? 0.50 : (shots >= 3 ? 0.70 : 1.0);
    for(let s = 0; s < shots; s++){
      const a = BASE_ANGLE - spreadTotal / 2 + s * SPREAD_PER_SHOT
              + rand(-0.02, 0.02);

      const dmgLv = player.buffLevels.damage || 0;
      const bulletR = 9 * (player.foodSizeMult || 1) * (1 + 0.12 * dmgLv);   // ★ 伤害等级越高，子弹越大

      bullets.push({
        x: mzX, y: mzY,
        vx: Math.cos(a) * 740, vy: Math.sin(a) * 740,
        r: bulletR, dmg: player.bulletDamage * multishotPenalty, life: bulletLife,
        pierce: player.pierce, hitSet: null,
        targetId: BULLET_HOMING && gunTarget ? gunTarget.id : null,
        homingTimer: 0,
        homingDelay: 0.08
      });
    }

    const muzzleA = -Math.PI / 2;
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
        dealDamage(e, b.dmg * bm, b.fromCatBro ? 'catbro' : 'bullet');
        if(b.fromCatBro){
          if(b.broSkill==='减速') e.slowTimer=Math.max(e.slowTimer||0,1.8);
          if(b.broSkill==='爆炸'){
            for(const ex of enemies){
              if(ex===e || ex.dead) continue;
              if(Math.hypot(ex.x-e.x,ex.y-e.y)<=54) dealDamage(ex,54,'catbro');
            }
            rings.push({x:e.x,y:e.y,maxR:54,life:0.28,t:0.28,color:'#ffb84a'});
          }
        }
        burst(b.x, b.y, 4, '#e8c46a', 150);
        if(!b.fromCatBro && player.foodExplosionLevel){
          const lv = player.foodExplosionLevel;
          const rr = lv === 1 ? 92 : 128;
          const splashMult = lv === 1 ? 0.62 : 0.86;
          for(const ex of enemies){
            if(ex===e || ex.dead) continue;
            if(Math.hypot(ex.x-e.x,ex.y-e.y)<=rr){
              dealDamage(ex, b.dmg * splashMult, 'bullet');
              burst(ex.x, ex.y, 5 + lv * 2, '#ffb04a', 220 + lv * 60);
            }
          }
          burst(e.x, e.y, 18 + lv * 8, '#ffb04a', 360 + lv * 80);
          rings.push({x:e.x,y:e.y,maxR:rr,life:0.42,t:0.42,color:'#ffb04a'});
          rings.push({x:e.x,y:e.y,maxR:rr*0.58,life:0.24,t:0.24,color:'#ffe0a0'});
        }
        sfx('hit');

        // 主角猫粮的冰冻效果（猫小弟固定猫粮枪不继承主角强化）
        const fl = b.fromCatBro ? 0 : (player.buffLevels.frozen_bullet || 0);
        if(fl > 0 && e.frozenTimer <= 0){
          let chance = 0.30;
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

    // ★ Boss 入场：从屏幕上方走入
    if(e.isBoss && e.introT < 1){
      e.introT = Math.min(1, e.introT + dt / e.introDuration);
      const it = 1 - Math.pow(1 - e.introT, 3);
      e.y = lerp(-150, e.targetY, it);
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      e.angle = Math.PI / 2;
      continue;
    }

    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if(e.frozenTimer <= 0){
      e.atkCd -= dt;
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
    }

    // 减速 / 冰冻计时
    if(e.slowTimer > 0) e.slowTimer -= dt;
    if(e.frozenTimer > 0) e.frozenTimer -= dt;
    const frozen=e.frozenTimer>0;
    const slowMul = frozen ? 0 : (e.slowTimer > 0 ? 0.35 : 1);
    if(e.isBoss){
      e.shootCd -= dt;
      e.bossSummonTimer -= dt;
      const tier = e.bossTier || 1;
      const aim = Math.atan2(player.y-e.y, player.x-e.x);

      // Boss1~4 都使用裂变母弹，但每个等级有独立攻击节奏。
      if(e.shootCd <= 0){
        e.shootCd = tier === 2 ? 2.30 : (tier === 3 ? 2.45 : (tier === 4 ? 2.05 : 2.60));
        const count = tier === 2 ? 2 : 1;
        for(let n=0;n<count;n++){
          const off = count === 1 ? 0 : (n === 0 ? -0.12 : 0.12);
          const aa = aim + off;
          eBullets.push({
            x:e.x, y:e.y, vx:Math.cos(aa)*255, vy:Math.sin(aa)*255,
            r:14, dmg:player.maxHp*(tier===4?0.16:0.14), life:5.5,
            isBossBullet:true, splitTimer:tier===1?0.80:0.62,
            splitCount:tier>=3?7:5,
            splitSpread:tier>=3?Math.PI*0.82:Math.PI*0.64, canSplit:true
          });
        }
        if(tier === 2){
          e.bossBurstRemaining = 2;
          e.bossBurstTimer = 0.34;
        }
      }

      if(tier === 2 && e.bossBurstRemaining > 0){
        e.bossBurstTimer -= dt;
        if(e.bossBurstTimer <= 0){
          e.bossBurstRemaining--;
          e.bossBurstTimer = 0.34;
          const aa = aim + (Math.random()-0.5)*0.14;
          eBullets.push({
            x:e.x,y:e.y,vx:Math.cos(aa)*270,vy:Math.sin(aa)*270,
            r:12,dmg:player.maxHp*0.12,life:5,isBossBullet:true,
            splitTimer:0.52,splitCount:5,splitSpread:Math.PI*0.62,canSplit:true
          });
        }
      }

      // Boss3：从 Boss 脚下召唤 2~3 只近战单位，绝不贴墙生成。
      if(tier === 3 && e.bossSummonTimer <= 0){
        e.bossSummonTimer = 5.8;
        const n = 2 + Math.floor(Math.random()*2);
        for(let k=0;k<n;k++){
          const type = Math.random() < 0.55 ? 'runner' : 'zombie';
          spawnEnemy(type, clamp(e.x + rand(-42,42), CASTLE_LANE_MIN_X, CASTLE_LANE_MAX_X), e.y + e.r + 18 + rand(-8,12));
        }
        burst(e.x,e.y+45,16,'#ff8a3c',260);
        banner={text:'BOSS 召唤援军！',life:1.1};
      }

      // Boss4：方向性落石/炮击，先给地面预警，再落点爆炸。
      if(tier === 4 && e.bossAttackTimer <= 0){
        e.bossAttackTimer = 4.2;
        const laneX = clamp(player.x + rand(-150,150), 80, WORLD.w-80);
        const laneY = clamp(player.y + rand(-170,100), 180, CASTLE_FRONT_Y-80);
        bossWarnings.push({x:laneX,y:laneY,t:0.95,maxT:0.95,r:78,damage:player.maxHp*0.18});
        const aa = Math.atan2(laneY-e.y,laneX-e.x);
        eBullets.push({x:e.x,y:e.y,vx:Math.cos(aa)*180,vy:Math.sin(aa)*180,r:14,dmg:player.maxHp*0.10,life:4,isBossBullet:true,splitTimer:0.9,splitCount:7,splitSpread:Math.PI*0.70,canSplit:true});
      } else if(tier === 4){
        e.bossAttackTimer -= dt;
      }
      continue;
    }
    if(frozen) continue;
    if(e.ranged){
      // 远程怪快速抵达中段后停下；若玩家进入射程，即使尚未完全停下也允许开火。
      if(e.y < RANGED_STOP_Y) e.y += e.speed*slowMul*dt;
      e.shootCd-=dt;
      const rangeOk = Math.hypot(player.x-e.x, player.y-e.y) <= 980;
      if(e.shootCd<=0 && (e.y>=RANGED_STOP_Y-80 || rangeOk)){
        e.shootCd=e.elite?2.15:2.75;
        const a=Math.atan2(player.y-e.y,player.x-e.x);
        const count=e.eliteProjectileCount||1;
        for(let k=0;k<count;k++){
          const off=count===1?0:(k===0?-0.10:0.10);
          const aa=a+off;
          const speed=e.elite?245:225;
          eBullets.push({x:e.x,y:e.y,vx:Math.cos(aa)*speed,vy:Math.sin(aa)*speed,r:e.elite?12:10,dmg:player.maxHp*(e.elite?0.15:0.10),life:5.5,isBossBullet:false,enemyShot:true});
          rings.push({x:e.x,y:e.y,maxR:e.elite?34:28,life:0.20,t:0.20,color:'#c45cff'});
        }
        burst(e.x,e.y,4,'#c45cff',120);
      }
    }else{
      // 近战怪走到城墙前，被墙挡住后攻击；高速怪天然可以超车
      const stopY=CASTLE_FRONT_Y-e.r;
      if(e.y<stopY) e.y+=e.speed*slowMul*dt;
      // 近战怪进入主角警戒距离后优先攻击主角；主角不在附近才继续压墙。
      const playerDist = Math.hypot(e.x-player.x, e.y-player.y);
      if(!playerDead && playerDist <= e.r + player.r + 18){
        e.wallAtkCd-=dt;
        if(e.wallAtkCd<=0){
          e.wallAtkCd=e.elite?1.25:1.6;
          damagePlayer(e.dmg || 5);
          e.hitFlash=1;
        }
      } else if(e.y>=stopY){
        e.y=stopY;
        e.wallAtkCd-=dt;
        if(e.wallAtkCd<=0){
          e.wallAtkCd=e.elite?1.25:1.6;
          damageCastle(e.dmg || 5);
        }
      }
    }
    e.angle=Math.PI/2;
  }

  // Boss4 地面预警：倒计时结束后结算伤害，并用闪烁圈提示玩家走位。
  for(let i=bossWarnings.length-1;i>=0;i--){
    const w=bossWarnings[i];
    w.t-=dt;
    if(w.t<=0){
      if(!playerDead && Math.hypot(player.x-w.x,player.y-w.y)<=w.r){
        damagePlayer(w.damage);
      }
      burst(w.x,w.y,24,'#ff6b3c',340);
      rings.push({x:w.x,y:w.y,maxR:w.r,life:0.55,t:0.55,color:'#ff5b5b'});
      bossWarnings.splice(i,1);
    }
  }

  for(let i = eBullets.length - 1; i >= 0; i--){
    const b = eBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    // ★ Boss 子弹裂变
    if(b.canSplit && b.splitTimer !== undefined && b.splitTimer > 0){
      b.splitTimer -= dt;
      if(b.splitTimer <= 0){
        const count  = b.splitCount  || 7;
        const spread = b.splitSpread || Math.PI * 0.7;
        const baseA  = Math.atan2(b.vy, b.vx);
        const spd    = Math.hypot(b.vx, b.vy);
        for(let k = 0; k < count; k++){
          const a = baseA - spread / 2
                  + (count > 1 ? spread * k / (count - 1) : 0);
          eBullets.push({
            x: b.x, y: b.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            r: 9,
            dmg: b.dmg,
            life: 3, isBossBullet: true, canSplit: false
          });
        }
        burst(b.x, b.y, 14, '#ff8a3c', 280);
        rings.push({ x: b.x, y: b.y, maxR: 60, life: 0.35, t: 0.35, color: '#ff8a3c' });
        sfx('hit');
        eBullets.splice(i, 1);
        continue;
      }
    }

    if(b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.w || b.y > WORLD.h){
      eBullets.splice(i, 1); continue;
    }
    if(!playerDead && Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r){
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

  // Boss 死亡后：等待 1.2 秒 → 结算
  if(waveClearTimer > 0){
    waveClearTimer -= dt;
    if(waveClearTimer <= 0){
      waveClearTimer = 0;
      if(pendingStageVictory){
        pendingStageVictory = false;
        showStageVictory();
        return;
      }
    }
  }

  if(currentStage >= 1){
    // ============ 关卡模式：6 波固定编排 ============
    if(waveBreakTimer > 0){
      waveBreakTimer -= dt;
      if(waveBreakTimer <= 0){
        waveBreakTimer = 0;
        if(waveInStage > STAGE_WAVES){
          spawnBoss();
        } else {
          startWave(waveInStage);
        }
      }
    } else if(!stageEnding){
      updateSpawning(dt);
      if(!bossPhase && !stageWaveClearHandled && isWaveClear()){
        stageWaveClearHandled = true;
        waveActive = false;
        banner = { text:'第 ' + waveInStage + ' 波清除', life:1.2 };
        buffChoices = rollBuffChoices();
        if(buffChoices.length){
          state='buff'; buffFadeIn=0; last=performance.now();
        } else {
          chooseBuff(null);
        }
      }
      // Boss 特殊行为统一由敌人 AI 处理，避免旧补怪逻辑在城墙附近重复生成。
    }
  }
  // ============ 无尽模式 ============
  else if(waveActive){
    waveTimer += dt;
    updateSpawning(dt);

    const _waveClear = isWaveClear();
    if(_waveClear){
      waveActive = false;
      waveSpawn.active = false;
      score += 60 * wave;
      banner = { text: '第 ' + wave + ' 波清除', life: 1.5 };
      buffChoices = rollBuffChoices();
      if(buffChoices.length > 0){
        waveClearTimer = 1.5;
        waveBreakTimer = 99;
      } else {
        waveBreakTimer = 1.6;
      }
    }
  }
  // ============ 波间缓冲（两种模式共用） ============
  else {
    waveBreakTimer -= dt;
    if(waveBreakTimer <= 0){
      wave++;
      if(currentStage >= 1 && currentStage <= TOTAL_STAGES){
        waveInStage++;
      }
      startWave(wave);
    }
  }
}

// ================= 统一 UI 文字体系 =================
// 五色体系：
//   title   主标题（金）
//   body    正文（纯白）
//   accent  高亮（亮金）
//   danger  危险（橙红）
//   success 成功（亮绿）
//   muted   次要信息（淡青灰）
const UI_COLORS = {
  title:   '#ffd24a',
  body:    '#ffffff',
  accent:  '#ffe080',
  danger:  '#ff6b4a',
  success: '#7fe0a0',
  muted:   'rgba(180, 210, 230, 0.85)',
  stroke:  'rgba(10, 20, 35, 0.92)'
};

// 主标题金色渐变（三色）
const UI_GRADIENT_GOLD = ['#fff8d0', '#ffd24a', '#ffa820'];

// 统一 UI 文字绘制
//   text      要画的文本
//   x, y      位置（默认基线居中）
//   colorKey  UI_COLORS 的 key
//   opts: {
//     size        字号（默认 24）
//     align       'left' | 'center' | 'right'（默认 center）
//     bold        是否加粗（默认 true）
//     strokeWidth 描边厚度（默认 字号 × 0.14，最小 3）
//     glow        是否外发光
//     glowColor   发光颜色（默认用填充色）
//     glowSize    发光半径（默认 16）
//     gradient    [c0, c1, c2] 三色渐变，给定时覆盖 colorKey
//     alpha       整体透明度
//   }
function drawUIText(text, x, y, colorKey, opts){
  opts = opts || {};
  const size  = opts.size || 24;
  const color = UI_COLORS[colorKey] || UI_COLORS.body;
  const align = opts.align || 'center';
  const bold  = opts.bold !== false;
  const font  = (bold ? 'bold ' : '') + size + 'px "Microsoft YaHei",sans-serif';
  const sw    = opts.strokeWidth || Math.max(3, size * 0.14);
  const scale = opts.scale || 1;

  ctx.save();

  // ★ 用 translate 移动原点，这样缩放以 (x, y) 为中心
  ctx.translate(x, y);
  if(scale !== 1) ctx.scale(scale, scale);

  ctx.textAlign = align;
  ctx.font = font;
  if(opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

  // 1. 外发光（先画，被后面的描边和填充略微覆盖，正好形成柔光边）
  if(opts.glow){
    ctx.save();
    ctx.shadowColor = opts.glowColor || color;
    ctx.shadowBlur  = opts.glowSize  || 16;
    ctx.lineWidth   = sw;
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = UI_COLORS.stroke;
    ctx.strokeText(text, 0, 0);
    ctx.restore();
  }

  // 2. 统一描边
  ctx.lineWidth   = sw;
  ctx.lineJoin    = 'round';
  ctx.strokeStyle = UI_COLORS.stroke;
  ctx.strokeText(text, 0, 0);

  // 3. 填充
  if(opts.gradient){
    const grd = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.28);
    grd.addColorStop(0,   opts.gradient[0]);
    grd.addColorStop(0.5, opts.gradient[1]);
    grd.addColorStop(1,   opts.gradient[2]);
    ctx.fillStyle = grd;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

// 多段富文本绘制（居中对齐）
//   parts: [{ text, colorKey, gold }]
//     colorKey  UI_COLORS 的 key，默认 'body'
//     gold      true 时加金色外发光（配合 colorKey: 'accent' 用）
//   opts: { size }
function drawUITextRich(parts, x, y, opts){
  opts = opts || {};
  const size = opts.size || 20;
  const font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';

  // 预计算总宽
  ctx.save();
  ctx.font = font;
  let totalW = 0;
  for(const p of parts) totalW += ctx.measureText(p.text).width;
  ctx.restore();

  // 从左往右逐段绘制
  let cx = x - totalW / 2;
  for(const p of parts){
    const isGold = p.gold === true;
    drawUIText(p.text, cx, y, p.colorKey || 'body', {
      size: size,
      align: 'left',
      glow: isGold,
      glowColor: 'rgba(255, 210, 74, 0.75)',
      glowSize: 14
    });
    ctx.save();
    ctx.font = font;
    cx += ctx.measureText(p.text).width;
    ctx.restore();
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

function drawCastleDefense(){
  // 城堡防守战视觉层：左右墙、中央石路、底部城门
  const wallY=CASTLE_WALL_Y;
  ctx.save();
  // 中央石路
  ctx.fillStyle='rgba(185,175,160,0.35)';
  ctx.fillRect(120,0,480,wallY);
  ctx.strokeStyle='rgba(120,110,100,0.35)'; ctx.lineWidth=6;
  ctx.strokeRect(120,0,480,wallY);
  // 左右城墙
  for(const x of [0,WORLD.w-110]){
    ctx.fillStyle='rgba(105,92,78,0.95)'; ctx.fillRect(x,0,110,wallY+80);
    ctx.fillStyle='rgba(210,195,170,0.24)';
    for(let y=20;y<wallY;y+=70){ ctx.fillRect(x+8,y,94,46); }
    ctx.strokeStyle='rgba(65,55,45,0.55)'; ctx.lineWidth=3; ctx.strokeRect(x+3,3,104,wallY+74);
  }
  // 城墙横线
  ctx.fillStyle='#756554'; ctx.fillRect(0,wallY, WORLD.w, 26);
  ctx.fillStyle='#bca78c'; ctx.fillRect(0,wallY,WORLD.w,7);
  // 城门
  ctx.fillStyle='#4b3425'; ctx.fillRect(WORLD.w/2-105,wallY-55,210,110);
  ctx.strokeStyle='#d8b47b'; ctx.lineWidth=8; ctx.strokeRect(WORLD.w/2-105,wallY-55,210,110);
  ctx.fillStyle='rgba(255,255,255,0.16)'; ctx.fillRect(WORLD.w/2-88,wallY-38,176,8);
  // 城墙 HP 条
  const ratio=castleHp/castleMaxHp;
  ctx.fillStyle='rgba(20,15,12,0.78)'; ctx.fillRect(150,wallY+38,420,34);
  ctx.fillStyle=ratio>=0.6?'#7fe0a0':'#ff6b4a'; ctx.fillRect(154,wallY+42,412*ratio,26);
  drawUIText('城墙  '+Math.ceil(castleHp)+' / 100',WORLD.w/2,wallY+63,'body',{size:20,strokeWidth:4});
  ctx.restore();
}

function drawGround(){
  // ★ 优先用 bg_battle.webp 铺满整个 WORLD
  const battleSpr = SPRITES.bg_battle;
  if(battleSpr && battleSpr.loaded && battleSpr.img){
    const bg = battleSpr.img;

    // 1. 背景铺满
    ctx.drawImage(bg, 0, 0, WORLD.w, WORLD.h);

    // ===== 可调参数 =====
    // FADE_COLOR：淡化色，取"背景主色的浅化版"或中性浅色
    //   - 草地/沙滩场景 → 浅灰绿 '235, 242, 238'（当前值）
    //   - 深蓝/夜景场景 → 换 '30, 50, 70'（用深色淡化，让中间变暗）
    // MID_ALPHA：中间淡化强度，0.5 轻微 / 0.7 明显 / 0.85 几乎盖住
    // SIDE_EDGE：两侧"透明带"宽度占比，越小两侧越显眼
    const FADE_COLOR = '235, 242, 238';
    const MID_ALPHA  = 0.62;
    const SIDE_EDGE  = 0.20;

    // 2. 中间淡化遮罩：左右两侧透明 → 中间不透明
    if(!battleFadeGradient){
      battleFadeGradient = ctx.createLinearGradient(0, 0, WORLD.w, 0);
      battleFadeGradient.addColorStop(0,              'rgba(' + FADE_COLOR + ', 0)');
      battleFadeGradient.addColorStop(SIDE_EDGE,      'rgba(' + FADE_COLOR + ', ' + MID_ALPHA + ')');
      battleFadeGradient.addColorStop(0.5,            'rgba(' + FADE_COLOR + ', ' + MID_ALPHA + ')');
      battleFadeGradient.addColorStop(1 - SIDE_EDGE,  'rgba(' + FADE_COLOR + ', ' + MID_ALPHA + ')');
      battleFadeGradient.addColorStop(1,              'rgba(' + FADE_COLOR + ', 0)');
    }
    ctx.fillStyle = battleFadeGradient;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    // 3. 边缘描边
    ctx.strokeStyle = 'rgba(120,200,140,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
    return;
  }

  // ===== 兜底：原来的草地/沙滩 pattern 逻辑 =====
  const spriteKey = BACKGROUND_KEYS[currentBgKey] || 'grass';
  const spr = SPRITES[spriteKey];

  let pattern = null;
  if(spr && spr.loaded && spr.img){
    if(!spr.pattern){
      spr.pattern = ctx.createPattern(spr.img, 'repeat');
    }
    pattern = spr.pattern;
  } else {
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
    ctx.beginPath(); ctx.ellipse(0, 16 - bob, 12, 4.5, 0, 0, TAU); ctx.fill();

    const pulse = 0.5 + Math.sin(d.bob * 2) * 0.5;

    // 外圈光晕（跟随 drop 大小）
    ctx.globalAlpha = a * (0.28 + pulse * 0.2);
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(0, 0, d.r * 1.7 + pulse * 4, 0, TAU); ctx.fill();

    // 底盘
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU);
    ctx.fillStyle = t.color; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    // 金币 / 钻石：优先用素材图标（放大到 d.r × 2.4）
    const useIcon = (d.type === 'coin' || d.type === 'diamond');
    let drawn = false;
    if(useIcon){
      const iconKey = d.type === 'coin' ? 'icon_coin' : 'icon_diamond';
      const iconImg = UI.assets[iconKey];
      if(iconImg){
        const sz = d.r * 2.4;
        ctx.drawImage(iconImg, -sz/2, -sz/2, sz, sz);
        drawn = true;
      }
    }
    if(!drawn){
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, 0, 1);
      ctx.textBaseline = 'alphabetic';
    }

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
  if(e.dead) return;
  const r = e.r;
  const facingRight = Math.cos(e.angle) >= 0;
  const walkPhase = Math.sin(gameTime * 8 + e.id * 1.7) * 0.5;
  const hurt = e.hitFlash > 0;

  if(e.elite){
    const pulse = 0.5 + Math.sin(gameTime * 4 + e.id) * 0.5;
    ctx.fillStyle = 'rgba(255,190,80,' + (0.10 + pulse * 0.07) + ')';
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 13 + pulse * 4, 0, TAU); ctx.fill();
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
    const cached = getEnemyRenderSprite(e);
    if(cached) ctx.drawImage(cached, -cached.width/2, -cached.height/2);
    else ctx.drawImage(sprite.img, -w/2, -h/2, w, h);

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

// ===== 猫小弟队形槽位计算 =====
// 所有槽位分布在主角背后（与 facing 相反方向）的扇形区域内
function computeCatBroTarget(idx, total, px, py, facing){
  const backAngle = facing + Math.PI;   // 背后方向

  const MAX_HALF = Math.PI / 3;         // 扇形半角 60° → 总 120°
  const BASE_DIST = 130;                // 基准距离（离主角多远）

  let angleOffset = 0;

  if(total === 1){
    angleOffset = 0;                    // 正后方
  } else if(total === 2){
    // 两个：左后 + 右后，严格对称
    angleOffset = (idx === 0 ? -1 : 1) * MAX_HALF * 0.75;
  } else {
    // 3 个及以上：通用对称分配
    if(total % 2 === 1){
      if(idx === 0){
        angleOffset = 0;                // 中间一个
      } else {
        const k = Math.ceil(idx / 2);
        const s = (idx % 2 === 1) ? 1 : -1;
        angleOffset = s * (MAX_HALF * 2 / (total + 1)) * k;
      }
    } else {
      const k = Math.floor(idx / 2) + 1;
      const s = (idx % 2 === 0) ? 1 : -1;
      angleOffset = s * (MAX_HALF * 2 / (total + 1)) * k;
    }
  }

  const a = backAngle + angleOffset;
  return {
    x: px + Math.cos(a) * BASE_DIST,
    y: py + Math.sin(a) * BASE_DIST
  };
}

// ================= 猫小弟 =================
function initCatBro(cfg, idx){
  const slots=[
    {x:92,y:1000},
    {x:W/2,y:1000},
    {x:W-92,y:1000}
  ];
  const slot=slots[idx%slots.length];
  const spriteKey = idx===1 ? 'catbro2' : 'catbro';
  const bro={
    id:cfg.id, name:cfg.name, skill:cfg.skill, config:cfg,
    spriteKey, r:20, x:slot.x, y:slot.y,
    facing:-Math.PI/2, skills:['catfood'], slotIndex:idx,
    fireCd:1.10 + idx*0.18,
    bubble:{text:'',life:0,maxLife:2.2}, speakCd:0,
    orbAngle:0, laserFx:null
  };
  catBros.push(bro);
}
function catBroFindTarget(bro){
  let best=null,bestD=Infinity;
  const maxRange = (bro.config && bro.config.id==='white') ? 1800 : Infinity;
  // 优先墙边敌人，其次最近敌人；符合“先守墙”的定位。
  for(const e of enemies){
    if(e.dead) continue;
    const d=Math.hypot(e.x-bro.x,e.y-bro.y);
    if(d>maxRange) continue;
    const wallPriority = e.y > CASTLE_FRONT_Y-180 ? -100000 : 0;
    const score=d+wallPriority;
    if(score<bestD){bestD=score;best=e;}
  }
  if(!best && bossEnemy && !bossEnemy.dead) best=bossEnemy;
  return best;
}
function fireCatBroProjectile(bro,target,angle,offset=0){
  const cfg=bro.config;
  const speed=650;
  const x=bro.x + Math.cos(angle)*offset;
  const y=bro.y + Math.sin(angle)*offset - 18;
  const b={x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:7,
    dmg:cfg.dmg,life:2.6,pierce:cfg.skill==='穿透'?3:1,hitSet:null,fromCatBro:true,
    homing:cfg.skill==='追踪',targetId:target?target.id:null,homingTimer:0,
    broSkill:cfg.skill, broId:cfg.id};
  bullets.push(b);
}
function updateCatBro(dt){
  if(!player || state!=='playing') return;
  for(const bro of catBros){
    if(bro.bubble.life>0) bro.bubble.life-=dt;
    bro.fireCd-=dt;
    if(bro.fireCd<=0){
      const target=catBroFindTarget(bro);
      if(target){
        const a=Math.atan2(target.y-bro.y,target.x-bro.x);
        const skill=bro.config.skill;
        if(skill==='三连射' || skill==='连发'){
          for(let k=-1;k<=1;k++) fireCatBroProjectile(bro,target,a+k*0.12,k*10);
        } else if(skill==='双发'){
          fireCatBroProjectile(bro,target,a,-8); fireCatBroProjectile(bro,target,a,8);
        } else {
          fireCatBroProjectile(bro,target,a,0);
        }
        bro.facing=a;
        if(Math.random()<0.12) bro.bubble.text=bro.name+'！';
        bro.bubble.life=0.9;
      }
      bro.fireCd=bro.config.rate;
    }
  }
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

// ================= 全屏轰炸 =================
function doAirstrike(){
  const targets = [];
  for(const e of enemies){
    if(e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if(d < AIRSTRIKE_RANGE) targets.push(e);   // ★ 只打半屏内的敌人
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
  if(unlockedWeapons.airstrike){
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
  const startY = H * 0.38;
  const gap = 100;

  // 收集要显示的所有技能
  const skills = [];

  // ===== 激光 =====
  if(unlockedWeapons.laser){
    const cdMax = player.laserCooldownMax || LASER_COOLDOWN_MAX;
    const cdP = laser.active ? 0 : (laserCooldown > 0 ? 1 - laserCooldown / cdMax : 1);
    skills.push({
      icon: 'laser_width',
      color: '#88eeff',
      cdP: cdP,
      remain: laserCooldown,
      ready: laserCooldown <= 0 && !laser.active,
      label: laser.active ? '发射中' : null,
      labelColor: 'success'
    });
  }

  // ===== 导弹 =====
  if(unlockedWeapons.missile){
    const cdMax = player.missileCooldownMax || 5;
    const cdP = player.missileCooldown > 0 ? 1 - player.missileCooldown / cdMax : 1;
    skills.push({
      icon: 'missile_count',
      color: '#ff8a3c',
      cdP: cdP,
      remain: player.missileCooldown,
      ready: player.missileCooldown <= 0,
      label: null,
      labelColor: 'accent'
    });
  }

  // ===== 毛球 =====
  if(unlockedWeapons.orb){
    let cdP, remain, label = null;
    if(player.orbActiveTimer > 0){
      cdP = 1;
      remain = player.orbActiveTimer;
      label = '生效中';
    } else if(player.orbCooldown > 0){
      cdP = 1 - player.orbCooldown / ORB_COOLDOWN;
      remain = player.orbCooldown;
    } else {
      cdP = 1;
      remain = 0;
    }
    skills.push({
      icon: 'orb_count',
      color: '#ffb0d0',
      cdP: cdP,
      remain: remain,
      ready: player.orbActiveTimer <= 0 && player.orbCooldown <= 0,
      label: label,
      labelColor: 'success'
    });
  }

  // ===== 罐头 =====
  if(unlockedWeapons.can){
    const cdP = Math.min(1, canAutoTimer / CAN_AUTO_INTERVAL);
    skills.push({
      icon: 'canpower',
      color: '#ff9f6b',
      cdP: cdP,
      remain: Math.max(0, CAN_AUTO_INTERVAL - canAutoTimer),
      ready: cdP >= 1,
      label: null,
      labelColor: 'accent'
    });
  }

  // ===== 空袭 =====
  if(unlockedWeapons.airstrike){
    const cdTotal = player.airstrikeCD || 6;
    const cdP = Math.min(1, airstrikeTimer / cdTotal);
    skills.push({
      icon: 'airstrike',
      color: '#ff6b4a',
      cdP: cdP,
      remain: Math.max(0, cdTotal - airstrikeTimer),
      ready: cdP >= 1,
      label: null,
      labelColor: 'accent'
    });
  }

  // ===== 逐个绘制 =====
  for(let i = 0; i < skills.length; i++){
    const s = skills[i];
    const y = startY + i * gap;

    ctx.save();

    // 圆底
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.arc(cx, y, R, 0, TAU); ctx.fill();

    // 图标
    drawBuffIcon(s.icon, cx, y, R * 1.15, s.color);

    // 扇形冷却阴影
    if(s.cdP < 1){
      const startAngle = -Math.PI/2 + TAU * s.cdP;
      const endAngle = -Math.PI/2 + TAU;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.arc(cx, y, R, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fill();
    }

    // 边框（就绪时用主色，否则灰蓝）
    ctx.strokeStyle = s.ready ? s.color : 'rgba(120,150,180,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, y, R, 0, TAU); ctx.stroke();

    // 文字
    if(s.label){
      drawUIText(s.label, cx, y + R + 18, s.labelColor, { size: 16, strokeWidth: 4 });
    } else if(s.ready){
      drawUIText('就绪', cx, y + R + 18, 'accent', { size: 18, strokeWidth: 4 });
    } else {
      drawUIText(s.remain.toFixed(1), cx, y + R + 18, 'accent', { size: 20, strokeWidth: 4 });
    }

    ctx.restore();
  }
}
// ================= 激光 =================
function drawLaser(){
  if(!laser.active || !player) return;

  const L  = player.laserRadius;
  const doubleOff = player.laserDouble ? 58 * (player.laserWidthMult || 1) : 0;
  const ox = player.x - doubleOff;
  const oy = player.y - player.r * 0.6;

  const c1 = '120, 240, 255';
  const c2 = '200, 250, 255';

  const fadeIn  = Math.min(1, laser.timer / 0.10);
  const fadeOut = Math.min(1, (laser.duration - laser.timer) / 0.2);
  const alpha   = Math.min(fadeIn, fadeOut);

  const laserWidthBonus = player.buffLevels.laser_width || 0;
  const wScale = 2 + 0.30 * laserWidthBonus;
  const pulse  = 0.88 + Math.sin(gameTime * 28) * 0.12;

  // ============ 拖尾残影（光剑划过的痕迹） ============
  for(const tr of laser.swingTrail){
    const ta = Math.max(0, 1 - tr.age / 0.18);
    if(ta <= 0.05) continue;
    ctx.save();
    ctx.globalAlpha = alpha * ta * 0.40;
    ctx.translate(ox, oy);
    ctx.rotate(tr.angle);
    const tw = 34 * wScale * ta;
    const tg = ctx.createLinearGradient(0, -tw, 0, tw);
    tg.addColorStop(0,   'rgba(' + c1 + ', 0)');
    tg.addColorStop(0.5, 'rgba(' + c1 + ', 0.65)');
    tg.addColorStop(1,   'rgba(' + c1 + ', 0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, -tw, L, tw * 2);
    ctx.restore();
  }

  // ============ 主光束（当前帧角度） ============
  const angle = laser.angle;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ox, oy);
  ctx.rotate(angle);

  {
    const outerW = 52 * wScale * pulse;
    const g = ctx.createLinearGradient(0, -outerW, 0, outerW);
    g.addColorStop(0,    'rgba(' + c1 + ', 0)');
    g.addColorStop(0.35, 'rgba(' + c1 + ', 0.20)');
    g.addColorStop(0.5,  'rgba(' + c1 + ', 0.50)');
    g.addColorStop(0.65, 'rgba(' + c1 + ', 0.20)');
    g.addColorStop(1,    'rgba(' + c1 + ', 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -outerW, L, outerW * 2);
  }

  {
    const midW = 24 * wScale * pulse;
    const g = ctx.createLinearGradient(0, -midW, 0, midW);
    g.addColorStop(0,   'rgba(' + c2 + ', 0)');
    g.addColorStop(0.5, 'rgba(' + c2 + ', 0.95)');
    g.addColorStop(1,   'rgba(' + c2 + ', 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -midW, L, midW * 2);
  }

  {
    const coreW = 7 * wScale * pulse;
    const g = ctx.createLinearGradient(0, -coreW, 0, coreW);
    g.addColorStop(0,   'rgba(255, 255, 255, 0.7)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    g.addColorStop(1,   'rgba(255, 255, 255, 0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -coreW, L, coreW * 2);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -30 * wScale, L, 60 * wScale);
  ctx.clip();
  const flowSpeed = gameTime * 1600;
  const flowLen = 110;
  const flowPeriod = 280;
  for(let i = 0; i < 8; i++){
    const fx = ((flowSpeed + i * flowPeriod) % (L + flowLen)) - flowLen;
    const fa = 0.30 + Math.sin(gameTime * 9 + i * 1.3) * 0.15;
    const g = ctx.createLinearGradient(fx, 0, fx + flowLen, 0);
    g.addColorStop(0,   'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,' + fa + ')');
    g.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx, -24 * wScale, flowLen, 48 * wScale);
  }
  ctx.restore();

  ctx.restore();

  // ============ 起点光晕 ============
  ctx.save();
  ctx.globalAlpha = alpha;
  const startPulse = 0.9 + Math.sin(gameTime * 22) * 0.1;
  const startR = 42 * wScale * startPulse;
  const sg = ctx.createRadialGradient(ox, oy, 0, ox, oy, startR);
  sg.addColorStop(0,    'rgba(255, 255, 255, 1)');
  sg.addColorStop(0.25, 'rgba(' + c2 + ', 0.9)');
  sg.addColorStop(0.6,  'rgba(' + c1 + ', 0.45)');
  sg.addColorStop(1,    'rgba(' + c1 + ', 0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(ox, oy, startR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // ============ 命中爆闪 ============
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const beamHalf = 26 * wScale;
  for(const e of enemies){
    if(e.dead) continue;
    const dx = e.x - ox, dy = e.y - oy;
    const proj = dx * cosA + dy * sinA;
    if(proj < 0 || proj > L) continue;
    const perp = Math.abs(-dx * sinA + dy * cosA);
    if(perp > e.r + beamHalf) continue;

    const hitPulse = 0.75 + Math.sin(gameTime * 26 + e.id) * 0.25;
    const hitR = e.r * 1.6 * hitPulse;
    const hg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, hitR);
    hg.addColorStop(0,   'rgba(255, 255, 255, 0.75)');
    hg.addColorStop(0.4, 'rgba(' + c2 + ', 0.55)');
    hg.addColorStop(1,   'rgba(' + c1 + ', 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(e.x, e.y, hitR, 0, TAU);
    ctx.fill();
  }

  if(player.laserDouble){
    const ox2 = player.x + doubleOff;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox2, oy);
    ctx.rotate(-Math.PI/2);
    const outer2 = 42 * wScale * pulse;
    const g2 = ctx.createLinearGradient(0, -outer2, 0, outer2);
    g2.addColorStop(0, 'rgba(' + c1 + ',0)');
    g2.addColorStop(0.5, 'rgba(' + c1 + ',0.48)');
    g2.addColorStop(1, 'rgba(' + c1 + ',0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, -outer2, L, outer2 * 2);
    const core2 = 6 * wScale * pulse;
    const cg2 = ctx.createLinearGradient(0, -core2, 0, core2);
    cg2.addColorStop(0, 'rgba(255,255,255,0.72)');
    cg2.addColorStop(0.5, 'rgba(255,255,255,1)');
    cg2.addColorStop(1, 'rgba(255,255,255,0.72)');
    ctx.fillStyle = cg2;
    ctx.fillRect(0, -core2, L, core2 * 2);
    ctx.restore();
  }

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
  const cx = b.x, cy = b.y;

  // ★ 跟暂停按钮同尺寸（PAUSE_BTN.r * 1.9）
  const btnSize = PAUSE_BTN.r * 1.9;
  UI.drawIcon(ctx, 'icon_settings', cx - btnSize/2, cy - btnSize/2, btnSize);

  // 下方"玩法说明"标签
  const labelY = cy + btnSize/2 + 18;
  drawUIText('玩法说明', cx, labelY, 'body', {
    size: 17,
    glow: true,
    glowColor: 'rgba(120, 180, 255, 0.7)',
    glowSize: 10
  });
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
    drawUIText(label, bx, by + JOY_R + 28, 'muted', { size: 18, alpha: 0.55 });
  }
  ctx.restore();
}

// ================= 通用图标按钮 =================
// 圆角方形底框 + 居中图标
//   cx, cy   中心点
//   size     按钮整体尺寸（正方形边长）
//   iconKey  图标素材的 key
//   opts: {
//     frameKey   底框素材（默认 frame_blue）
//     iconRatio  图标占按钮的比例（默认 0.58）
//   }
function drawIconButton(cx, cy, size, iconKey, opts){
  opts = opts || {};
  const frameKey  = opts.frameKey  || 'frame_blue';
  const iconRatio = opts.iconRatio !== undefined ? opts.iconRatio : 0.58;

  // 底框
  UI.drawFrame(ctx, cx - size/2, cy - size/2, size, size, frameKey);

  // 图标
  const iconSize = size * iconRatio;
  UI.drawIcon(ctx, iconKey, cx - iconSize/2, cy - iconSize/2, iconSize);
}

// ================= 按钮 =================
function drawPauseButton(){
  const x = PAUSE_BTN.x, y = PAUSE_BTN.y, r = PAUSE_BTN.r;

  // icon_pause 素材自带圆角方形底，直接放大当按钮
  const btnSize = r * 1.9;
  UI.drawIcon(ctx, 'icon_pause', x - btnSize/2, y - btnSize/2, btnSize);
}


// ================= HUD =================
// ================= 战斗中：本场获得的货币显示 =================
// 位置：猫咪头像下方
function drawRunCurrency(){
  if(!player) return;

  const baseX = 22;
  const startY = 102;
  const lineH = 32;
  const iconSize = 26;
  const gapAfterIcon = 8;

  // ---- 金币行 ----
  const coinIcon = UI.assets['icon_coin'];
  if(coinIcon){
    ctx.drawImage(coinIcon, baseX, startY, iconSize, iconSize);
  }
  drawUIText('×' + runCoins, baseX + iconSize + gapAfterIcon,
             startY + iconSize/2 + 1, 'title', {
    size: 18, align: 'left', strokeWidth: 3,
    glow: true, glowColor: 'rgba(255, 210, 74, 0.6)', glowSize: 6
  });

  // ---- 钻石行 ----
  const y2 = startY + lineH;
  const diaIcon = UI.assets['icon_diamond'];
  if(diaIcon){
    ctx.drawImage(diaIcon, baseX, y2, iconSize, iconSize);
  }
  drawUIText('×' + runDiamonds, baseX + iconSize + gapAfterIcon,
             y2 + iconSize/2 + 1, 'body', {
    size: 18, align: 'left', strokeWidth: 3,
    glow: true, glowColor: 'rgba(136, 224, 255, 0.6)', glowSize: 6
  });
}

// ================= 右侧竖版击杀进度条 =================
function drawKillProgressBar(){
  if(currentStage < 1) return;   // 无尽模式不显示

  const cx = PROG_CARD_X + PROG_CARD_W / 2;

  // ===== 卡片底 =====
  rr(PROG_CARD_X, PROG_CARD_Y, PROG_CARD_W, PROG_CARD_H, 18);
  const cardGrd = ctx.createLinearGradient(PROG_CARD_X, PROG_CARD_Y,
                                            PROG_CARD_X, PROG_CARD_Y + PROG_CARD_H);
  cardGrd.addColorStop(0, 'rgba(30, 42, 54, 0.92)');
  cardGrd.addColorStop(1, 'rgba(12, 20, 30, 0.92)');
  ctx.fillStyle = cardGrd;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 180, 220, 0.55)';
  ctx.lineWidth = 2;
  rr(PROG_CARD_X, PROG_CARD_Y, PROG_CARD_W, PROG_CARD_H, 18);
  ctx.stroke();

  // ===== 关卡号 / 波次 =====
  drawUIText('第 ' + currentStage + ' 关', cx, PROG_CARD_Y + 28, 'title', {
    size: 18, strokeWidth: 3,
    glow: true, glowColor: 'rgba(255, 210, 74, 0.5)', glowSize: 8
  });
  drawUIText(Math.max(1, waveInStage) + ' / 4 波', cx, PROG_CARD_Y + 54, 'success', {
    size: 15, strokeWidth: 3
  });

  // 分隔线
  ctx.strokeStyle = 'rgba(120, 180, 220, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PROG_CARD_X + 8, PROG_CARD_Y + 72);
  ctx.lineTo(PROG_CARD_X + PROG_CARD_W - 8, PROG_CARD_Y + 72);
  ctx.stroke();

  // ===== 进度条底 =====
  rr(PROG_BAR_X, PROG_BAR_Y, PROG_BAR_W, PROG_BAR_H, 8);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 180, 220, 0.4)';
  ctx.lineWidth = 1.5;
  rr(PROG_BAR_X, PROG_BAR_Y, PROG_BAR_W, PROG_BAR_H, 8);
  ctx.stroke();

  // ===== 进度填充（从下往上）=====
  const ratio = progressTarget > 0
    ? Math.min(1, progressKills / progressTarget)
    : 0;
  const fillH = PROG_BAR_H * ratio;
  if(fillH > 0){
    const fillY = PROG_BAR_Y + PROG_BAR_H - fillH;
    ctx.save();
    rr(PROG_BAR_X, PROG_BAR_Y, PROG_BAR_W, PROG_BAR_H, 8);
    ctx.clip();

    const fillGrd = ctx.createLinearGradient(0, PROG_BAR_Y + PROG_BAR_H, 0, PROG_BAR_Y);
    fillGrd.addColorStop(0.0, '#5fe0a0');
    fillGrd.addColorStop(0.5, '#ffd24a');
    fillGrd.addColorStop(1.0, '#ff8a3c');
    ctx.fillStyle = fillGrd;
    ctx.fillRect(PROG_BAR_X, fillY, PROG_BAR_W, fillH);

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(PROG_BAR_X + 4, fillY, 4, fillH);
    ctx.restore();
  }

  // ===== 标记点 =====
  for(let i = 0; i < progressMarkers.length; i++){
    const m = progressMarkers[i];
    const markRatio = m.ratio;
    const my = PROG_BAR_Y + PROG_BAR_H - PROG_BAR_H * markRatio;

    // 横线（穿过进度条）
    ctx.save();
    ctx.strokeStyle = m.triggered
      ? 'rgba(255, 210, 74, 0.95)'
      : 'rgba(200, 220, 240, 0.55)';
    ctx.lineWidth = m.triggered ? 3 : 2;
    if(!m.triggered){
      ctx.setLineDash([5, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(PROG_BAR_X - 6, my);
    ctx.lineTo(PROG_BAR_X + PROG_BAR_W + 6, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 右侧图标 + 文字
    const iconX = PROG_BAR_X + PROG_BAR_W + 10;
    const iconY = my;

    if(m.isBoss){
      // 骷髅：简单绘制
      ctx.save();
      ctx.fillStyle = m.triggered ? '#ffd24a' : '#c8d8e8';
      ctx.beginPath();
      ctx.arc(iconX + 9, iconY - 2, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(iconX + 6, iconY - 2, 2, 0, TAU);
      ctx.arc(iconX + 12, iconY - 2, 2, 0, TAU);
      ctx.fill();
      // 下颚
      ctx.fillStyle = m.triggered ? '#ffd24a' : '#c8d8e8';
      ctx.fillRect(iconX + 4, iconY + 4, 10, 4);
      ctx.restore();
    } else {
      // 小飞机
      ctx.save();
      ctx.fillStyle = m.triggered ? '#ffd24a' : '#c8d8e8';
      ctx.beginPath();
      ctx.moveTo(iconX, iconY);
      ctx.lineTo(iconX + 18, iconY - 3);
      ctx.lineTo(iconX + 18, iconY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(iconX + 6, iconY);
      ctx.lineTo(iconX + 3, iconY - 7);
      ctx.lineTo(iconX + 12, iconY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(iconX + 6, iconY);
      ctx.lineTo(iconX + 3, iconY + 7);
      ctx.lineTo(iconX + 12, iconY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 击杀数（图标下方）
    drawUIText(String(m.kills), iconX + 9, iconY + 18, 'accent', {
      size: 12, strokeWidth: 3
    });
  }

  // ===== 底部击杀数 =====
  const textY = PROG_CARD_Y + PROG_CARD_H - 24;
  drawUITextRich([
    { text: String(progressKills) },
    { text: ' / ' + progressTarget }
  ], cx, textY, { size: 15 });
}

function drawBuffTags(){
  const ids = Object.keys(player.buffLevels).filter(k => player.buffLevels[k] > 0);
  if(ids.length === 0) return;
  let x = 96, y = 100;
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  for(const id of ids){
    const def = BUFFS.find(b => b.id === id);
    if(!def) continue;
    const lv = player.buffLevels[id];
    const label = def.name + ' ×' + lv;
    const tw = ctx.measureText(label).width;
    const w = tw + 52;
    if(x + w > 440){ x = 96; y += 32; }
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    rr(x, y - 16, w, 28, 8); ctx.fill();
    drawBuffIcon(def.id, x + 18, y - 2, 24, def.color);
    drawUIText(label, x + 38, y + 5, 'body', {
      size: 16, align: 'left', strokeWidth: 3,
      glow: true, glowColor: def.color, glowSize: 8
    });
    x += w + 8;
  }
}

function drawActiveItems(){
  // 目前没有需要显示的持续状态道具
  // 后续若新增（比如双倍伤害药水），在这里 push
  const items = [];
  if(items.length === 0) return;
  // （保留原有布局逻辑，等有 items 再加回来）
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
  const barW = 200;
  const barH = 22;
  const ratio = Math.max(0, Math.min(1, player.hp / player.maxHp));
  UI.drawBar(ctx, startX, centerY - barH / 2, barW, barH, ratio, 'bar_fill_green');
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
  drawUIText(currentWeapon === 'catfood' ? '🥫 猫粮' : (currentWeapon === 'laser' ? '⚡ 激光' : '🚀 导弹'), 250, 56, 'accent', {size:22, strokeWidth:4});
  drawUIText('第 ' + Math.min(6, Math.max(1,waveInStage)) + ' / 6 波', W-120, 48, 'body', {size:20, strokeWidth:4});
  // drawRunCurrency();   // 掉落系统暂时屏蔽

  // 右侧竖版击杀进度条
  drawKillProgressBar();

  drawBuffTags();
  drawActiveItems();
  drawSkillIcons();
  drawJoystick(moveJoy, MOVE_BASE, '#7fe0a0', '移动');
  drawPauseButton();
  drawHelpQuickBtn();

  if(banner){
    const bannerY = H * 0.34;
    const age = banner.age || 0;
    const life = banner.life;

    const enterP = Math.min(1, age / 0.35);
    const enterEase = 1 - Math.pow(1 - enterP, 3);
    const scale = 0.6 + enterEase * 0.4;

    const fadeP = Math.min(1, life / 0.4);
    const alpha = Math.min(enterP, fadeP);
    const floatY = Math.sin(age * 4) * 4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, bannerY + floatY);
    ctx.scale(scale, scale);

    // 用素材横幅（青色）
    ctx.save();
    ctx.font = 'bold 34px "Microsoft YaHei",sans-serif';
    const textW2 = ctx.measureText(banner.text).width;
    ctx.restore();
    const bw2 = Math.max(400, textW2 + 140);
    const bh2 = 100;

    UI.drawBanner(ctx, -bw2/2, -bh2/2, bw2, bh2, banner.text, 'banner_main', 34);

    ctx.restore();
  }
}

// ================= 全局底部导览 =================
const GLOBAL_NAV_H = 118;
const GLOBAL_NAV_Y = H - GLOBAL_NAV_H;
const GLOBAL_NAV_ICONS = ['battle','task','home','bag','shop'];
const GLOBAL_NAV_STATES = new Set(['menu','stagePrep','stageSelect','weaponSelect','home','placeholder','tasks','skillTree','catbroCollection','catselect','help','leaderboard']);

function getActiveNavId(){
  if(state==='stagePrep' || state==='stageSelect' || state==='weaponSelect' || state==='catbroCollection' || state==='catselect') return 'stages';
  if(state==='tasks' || state==='skillTree') return 'tasks';
  if(state==='home') return 'home';
  if(state==='placeholder') return placeholderFrom;
  return null;
}
function drawNavIcon(id,cx,cy,active){
  const col=active?'#fff1b8':'#a9bacb';
  ctx.save(); ctx.translate(cx,cy); ctx.scale(active?1.14:0.92,active?1.14:0.92); ctx.translate(-cx,-cy); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=active?4.3:3.5; ctx.lineCap='round'; ctx.lineJoin='round';
  if(id==='battle'){
    ctx.beginPath(); ctx.moveTo(cx-12,cy+14); ctx.lineTo(cx+14,cy-12); ctx.moveTo(cx-7,cy+10); ctx.lineTo(cx+4,cy+21); ctx.moveTo(cx-2,cy+3); ctx.lineTo(cx-12,cy-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+2,cy-10); ctx.lineTo(cx+13,cy+1); ctx.stroke();
  } else if(id==='task'){
    rr(cx-15,cy-18,30,36,6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-8,cy-7); ctx.lineTo(cx-2,cy-1); ctx.lineTo(cx+9,cy-12); ctx.moveTo(cx-8,cy+8); ctx.lineTo(cx+9,cy+8); ctx.stroke();
  } else if(id==='home'){
    ctx.beginPath(); ctx.moveTo(cx-17,cy-1); ctx.lineTo(cx,cy-17); ctx.lineTo(cx+17,cy-1); ctx.moveTo(cx-12,cy-4); ctx.lineTo(cx-12,cy+16); ctx.lineTo(cx+12,cy+16); ctx.lineTo(cx+12,cy-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-4,cy+16); ctx.lineTo(cx-4,cy+6); ctx.lineTo(cx+4,cy+6); ctx.lineTo(cx+4,cy+16); ctx.stroke();
  } else if(id==='bag'){
    rr(cx-17,cy-9,34,29,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy-9,9,Math.PI,0,false); ctx.stroke();
  } else {
    rr(cx-18,cy-13,36,32,6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-11,cy-5); ctx.lineTo(cx+11,cy-5); ctx.moveTo(cx-11,cy+3); ctx.lineTo(cx+8,cy+3); ctx.stroke();
  }
  ctx.restore();
}
function drawGlobalNav(){
  if(!GLOBAL_NAV_STATES.has(state)) return;
  mainNavRects=[];
  const activeId=getActiveNavId();
  ctx.save();
  const g=ctx.createLinearGradient(0,GLOBAL_NAV_Y,0,H);
  g.addColorStop(0,'rgba(7,17,28,.94)'); g.addColorStop(1,'rgba(4,9,15,.99)');
  ctx.fillStyle=g; ctx.fillRect(0,GLOBAL_NAV_Y,W,GLOBAL_NAV_H);
  ctx.strokeStyle='rgba(153,192,218,.24)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,GLOBAL_NAV_Y); ctx.lineTo(W,GLOBAL_NAV_Y); ctx.stroke();
  const w=W/MAIN_NAV.length;
  MAIN_NAV.forEach((n,i)=>{
    const x=i*w, active=n.id===activeId;
    const rx=x+7, ry=active?GLOBAL_NAV_Y+4:GLOBAL_NAV_Y+12, rw=w-14, rh=active?GLOBAL_NAV_H-10:GLOBAL_NAV_H-22;
    if(active){
      rr(rx,ry,rw,rh,22);
      const ag=ctx.createLinearGradient(x,ry,x+w,ry+rh);
      ag.addColorStop(0,'rgba(96,164,196,.46)'); ag.addColorStop(1,'rgba(50,102,125,.24)');
      ctx.fillStyle=ag; ctx.fill();
      ctx.strokeStyle='rgba(176,235,249,.72)'; ctx.lineWidth=2.2; rr(rx,ry,rw,rh,22); ctx.stroke();
      ctx.fillStyle='#76f0da'; ctx.beginPath(); ctx.arc(x+w/2,ry+10,5,0,TAU); ctx.fill();
    } else {
      rr(rx,ry,rw,rh,18); ctx.fillStyle='rgba(255,255,255,.018)'; ctx.fill();
    }
    drawNavIcon(GLOBAL_NAV_ICONS[i],x+w/2,GLOBAL_NAV_Y+(active?47:50),active);
    drawUIText(n.label,x+w/2,GLOBAL_NAV_Y+(active?91:95),active?'body':'muted',{size:active?19:16,strokeWidth:active?3:2.4});
    mainNavRects.push({x:x+1,y:GLOBAL_NAV_Y+1,w:w-2,h:GLOBAL_NAV_H-2,id:n.id});
  });
  ctx.restore();
}
function handleGlobalNav(p){
  if(!GLOBAL_NAV_STATES.has(state)) return false;
  if(state==='menu' && mainResetConfirm) return false;
  for(const r of mainNavRects){
    if(!hitRect(r,p)) continue;
    if(r.id==='stages'){ currentPrepStage=Math.max(1,Math.min(TOTAL_STAGES,stageProgress.unlockedMax||1)); state='stagePrep'; }
    else if(r.id==='tasks'){ taskScrollY=0; state='tasks'; }
    else if(r.id==='home'){ state='home'; }
    else { state='placeholder'; placeholderFrom=r.id; }
    last=performance.now();
    return true;
  }
  return false;
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
  const pulse = 0.5 + 0.5 * Math.sin(menuTime * 1.6);
  drawUIText('猫咪大作战', cx, cy, 'title', {
    size: 84,
    gradient: UI_GRADIENT_GOLD,
    glow: true,
    glowColor: 'rgba(255, 210, 74, ' + (0.8 + pulse * 0.15) + ')',
    glowSize: 24 + pulse * 14
  });
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
  const menuSpr = SPRITES.bg_menu;
  if(menuSpr && menuSpr.loaded && menuSpr.img){
    const img = menuSpr.img;
    const imgRatio    = img.width / img.height;
    const screenRatio = W / H;

    let drawW, drawH, dx, dy;
    if(imgRatio > screenRatio){
      // 图更宽 → 按高度适配，左右裁掉
      drawH = H;
      drawW = H * imgRatio;
      dx = (W - drawW) / 2;
      dy = 0;
    } else {
      // 图更高 → 按宽度适配，上下裁掉
      drawW = W;
      drawH = W / imgRatio;
      dx = 0;
      dy = (H - drawH) / 2;
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
    return;
  }

  // ===== 兜底：简单渐变 =====
  const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
  skyGrd.addColorStop(0,   '#ffe8f2');
  skyGrd.addColorStop(0.5, '#fff5e0');
  skyGrd.addColorStop(1,   '#d0f5e0');
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, W, H);
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

// ================= 三段切按钮底板 =================
// 布局：[左侧装饰] [中间拉伸] [右侧装饰]
// 要求：按钮宽度 >= 左右两段宽度之和，否则退化为整体拉伸
function drawStyledButton(img, x, y, w, h){
  if(!img) return;
  const iw = img.width;
  const ih = img.height;

  // 左右两段占源图宽度比例（覆盖圆角 + 石块/草丛装饰）
  const sideRatio = 0.25;
  const sSrc = Math.min(iw * sideRatio, ih * 0.8);
  const sDst = sSrc * (h / ih);

  // 按钮太窄 → 直接整体拉伸
  if(sDst * 2 >= w){
    ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);
    return;
  }

  // 左段
  ctx.drawImage(img, 0, 0, sSrc, ih, x, y, sDst, h);
  // 中段（横向拉伸）
  ctx.drawImage(img, sSrc, 0, iw - sSrc * 2, ih,
                x + sDst, y, w - sDst * 2, h);
  // 右段
  ctx.drawImage(img, iw - sSrc, 0, sSrc, ih,
                x + w - sDst, y, sDst, h);
}

// 颜色 → 底板 key 映射
function pickPlateKey(borderColor){
  if(borderColor === '#7fb8ff' || borderColor === '#3878b8') return 'btn_plate_blue';
  if(borderColor === '#ff8fb0' || borderColor === '#c84870') return 'btn_plate_red';
  if(borderColor === '#ffb84a' || borderColor === '#c87820') return 'btn_plate_yellow';
  if(borderColor === '#7fe0a0' || borderColor === '#289858') return 'btn_plate_green';
  return 'btn_plate_yellow';
}

// ================= 按钮文字（米黄 + 深棕描边，参考主菜单按钮风格） =================
function drawButtonLabel(text, cx, cy, size){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';
  ctx.lineJoin = 'round';

  // 1. 底部投影（往下偏移，制造立体感）
  ctx.lineWidth = Math.max(4, size * 0.24);
  ctx.strokeStyle = 'rgba(30, 10, 5, 0.85)';
  ctx.strokeText(text, cx, cy + size * 0.07);

  // 2. 主描边：深棕
  ctx.lineWidth = Math.max(3.5, size * 0.18);
  ctx.strokeStyle = '#3a1a08';
  ctx.strokeText(text, cx, cy);

  // 3. 填充：米黄三色渐变（上亮下暖）
  const grd = ctx.createLinearGradient(cx, cy - size * 0.55, cx, cy + size * 0.45);
  grd.addColorStop(0,    '#fffbe8');
  grd.addColorStop(0.55, '#ffe8b8');
  grd.addColorStop(1,    '#e8b868');
  ctx.fillStyle = grd;
  ctx.fillText(text, cx, cy);

  ctx.restore();
}

function drawAppButton(b, text, borderColor, textColor, opts){
  opts = opts || {};
  const fontSize = opts.fontSize || 24;
  const disabled = opts.disabled === true;
  const x = b.x - b.w/2, y = b.y - b.h/2;
  const c = borderColor || '#7fd8ff';
  let top='rgba(34,50,66,.98)', bottom='rgba(19,29,40,.98)';
  if(c === '#7fe0a0' || c === '#289858'){ top='rgba(50,110,88,.98)'; bottom='rgba(24,68,54,.98)'; }
  else if(c === '#ff8fb0' || c === '#c84870' || c === '#ff8a8a' || c === '#b83d3d'){ top='rgba(116,55,72,.98)'; bottom='rgba(67,30,42,.98)'; }
  else if(c === '#ffd24a' || c === '#c87820'){ top='rgba(119,91,32,.98)'; bottom='rgba(70,52,18,.98)'; }
  else if(c === '#7fb8ff' || c === '#3878b8'){ top='rgba(47,82,112,.98)'; bottom='rgba(25,46,67,.98)'; }
  const grd=ctx.createLinearGradient(x,y,x,y+b.h);
  grd.addColorStop(0,top); grd.addColorStop(1,bottom);
  ctx.save();
  ctx.globalAlpha=disabled?0.5:1;
  ctx.shadowColor='rgba(0,0,0,.28)'; ctx.shadowBlur=12; ctx.shadowOffsetY=5;
  rr(x,y,b.w,b.h,18); ctx.fillStyle=grd; ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.strokeStyle=disabled?'rgba(160,170,180,.3)':c; ctx.lineWidth=2.5; rr(x,y,b.w,b.h,18); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1; rr(x+3,y+3,b.w-6,b.h*0.42,14); ctx.stroke();
  drawUIText(text,b.x,b.y+fontSize*0.30,disabled?'muted':'body',{size:fontSize,strokeWidth:Math.max(2,fontSize*0.10)});
  ctx.restore();
}

// 统一可爱标题
function drawAppTitle(text, cx, cy, size){
  size = size || 42;

  const img = UI.assets['banner_main'];
  if(!img){
    // 兜底：金色文字
    drawUIText(text, cx, cy, 'title', {
      size: size,
      gradient: UI_GRADIENT_GOLD,
      glow: true,
      glowColor: 'rgba(255, 210, 74, 0.75)',
      glowSize: 18
    });
    return;
  }

  // ===== 可调参数 =====
  const H_PER_SIZE = 3.6;   // 横幅高 = 字号 × 此值（3.2 偏紧 / 4.0 偏松）
  const SIDE_PAD   = 0.55;  // 左右各留 文字宽 × 此值 作为边距

  // 量文字宽
  ctx.save();
  ctx.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif';
  let textW = ctx.measureText(text).width;
  ctx.restore();

  let finalSize = size;
  let bannerW   = textW * (1 + SIDE_PAD * 2);
  let bannerH   = size * H_PER_SIZE;

  // 超屏 → 按比例缩字号 + 缩横幅
  const maxW = W - 40;
  if(bannerW > maxW){
    const k = maxW / bannerW;
    finalSize = size * k;
    bannerW   = maxW;
    bannerH   = finalSize * H_PER_SIZE;
  }

  // ★ 横向拉伸绘制，纵向高度按字号算
  ctx.drawImage(
    img,
    cx - bannerW / 2,
    cy - bannerH / 2,
    bannerW,
    bannerH
  );

  // 文字居中
  drawUIText(text, cx, cy, 'title', {
    size: finalSize,
    gradient: UI_GRADIENT_GOLD,
    glow: true,
    glowColor: 'rgba(255, 210, 74, 0.7)',
    glowSize: 16
  });
}
// ================= 通用弹窗面板 =================
// 结构：紫色胶囊条（标题）+ 深灰主体 + 右上角红X
// 返回：{ closeRect } 供点击检测
function drawDialogPanel(x, y, w, h, title, opts){
  opts = opts || {};
  const titleH      = opts.titleH      !== undefined ? opts.titleH      : 76;
  const closeSize   = opts.closeSize   !== undefined ? opts.closeSize   : 56;
  const titlePadX   = opts.titlePadX   !== undefined ? opts.titlePadX   : 10;
  const titleSize   = opts.titleSize   !== undefined ? opts.titleSize   : 30;
  const noClose     = opts.noClose === true;

  // 1. 主体从紫条中线下方开始画
  const bodyTop = y + titleH * 0.50;
  UI.drawDialogBody(ctx, x, bodyTop, w, h - titleH * 0.50);

  // 2. 紫条压在主体顶部
  const barX = x + titlePadX;
  const barW = w - titlePadX * 2;
  const barY = y;
  UI.drawTitleBar(ctx, barX, barY, barW, titleH);

  // 3. 标题文字：紫条几何中心 + 纵向基线修正
  const titleCx = barX + barW / 2;
  const titleCy = barY + titleH / 2 + titleSize * 0.35;
  drawUIText(title, titleCx, titleCy, 'body', {
    size: titleSize,
    strokeWidth: Math.max(3, titleSize * 0.14)
  });

  // 4. 红X（可选）
  if(noClose) return { closeRect: null };

  const closeCx = barX + barW - titleH / 2 - 14;
  const closeCy = barY + titleH / 2 + 2;
  UI.drawIcon(ctx, 'btn_close',
              closeCx - closeSize / 2,
              closeCy - closeSize / 2,
              closeSize);

  return {
    closeRect: {
      x: closeCx - closeSize / 2,
      y: closeCy - closeSize / 2,
      w: closeSize,
      h: closeSize
    }
  };
}


// ================= 主菜单角色 =================
// 主菜单单角色绘制
//   sprKey  SPRITES 的 key；'cat' 表示当前选中的猫
//   cx      水平中心
//   footY   脚部所在的 Y（三排角色用不同的 footY 制造纵深）
//   size    绘制尺寸
//   phase   动画相位偏移，避免所有角色同频
//   opts: { breath, bob }  呼吸幅度 / 上下浮动幅度
function drawMenuChar(sprKey, cx, footY, size, phase, opts){
  opts = opts || {};
  const breathAmp = opts.breath !== undefined ? opts.breath : 0.015;   // 默认弱化
  const bobAmp    = opts.bob    !== undefined ? opts.bob    : 2.2;

  const breath = 1 + Math.sin(menuTime * 1.6 + phase) * breathAmp;
  const bob    = Math.sin(menuTime * 2.0 + phase) * bobAmp;

  const cy = footY - size * 0.32;   // 脚部对齐 footY

  // 脚下阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.ellipse(cx, footY + 2, size * 0.28, size * 0.055, 0, 0, TAU);
  ctx.fill();

  // 取精灵
  let spr;
  if(sprKey === 'cat'){
    spr = getCurrentCatSprite();
  } else {
    spr = SPRITES[sprKey];
  }
  if(!spr || !spr.loaded || !spr.img) return;

  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(breath, breath);
  ctx.drawImage(spr.img, -size/2, -size/2, size, size);
  ctx.restore();
}

function drawMenuCharacters(){
  // 三排脚部基准线（越大越靠前、越大越靠下）
  const gBack  = 480;
  const gMid   = 610;
  const gFront = 730;

  // ===================== 后排（先画） =====================
  drawMenuChar('cat',            W*0.20, gBack,      250, 4.5, { breath: 0.02, bob: 2.8 });
  drawMenuChar('enemy_skeleton', W*0.60, gBack,       200, 0.9);
  drawMenuChar('enemy_spitter',  W*0.70, gBack,        200, 1.5);
  drawMenuChar('enemy_elite',    W*0.92, gBack - 15,  300, 2.1);

  // ===================== 中排 =====================
  drawMenuChar('catbro',         W*0.13, gMid - 20, 200, 3.9);   // 猫小弟 1（猫咪左前方）
  drawMenuChar('enemy_brute',    W*0.70, gMid, 200, 2.7);
  drawMenuChar('enemy_armored',  W*0.90, gMid, 200, 3.3);

  // ===================== 前排（最后画，覆盖后面的） =====================
  drawMenuChar('catbro2',        W*0.10, gFront, 180, 0.3);   // 猫小弟 2（猫咪左后方）
  drawMenuChar('enemy_zombie',   W*0.76, gFront,      200, 5.1);
  drawMenuChar('enemy_runner',   W*0.95, gFront - 8,  200, 5.7);
}

// ================= 选关界面 =================
// ===== 未点亮星星：直接用空星素材 =====
function getGreyStar(){
  return UI.assets['icon_star_empty'] || null;
}

function drawStarIcon(cx, cy, r, color, filled){
  // ★ 点亮 → 原色素材；未点亮 → 灰色素材
  const img = filled ? UI.assets['icon_star'] : getGreyStar();

  if(img){
    const sz = r * 2;
    ctx.save();
    ctx.globalAlpha = 1;                    // 灰度已由素材处理，不再降透明度
    ctx.drawImage(img, cx - sz/2, cy - sz/2, sz, sz);
    ctx.restore();
    return;
  }

  // 素材没加载 → 兜底代码画
  ctx.save();
  ctx.translate(cx, cy);
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
  if(filled){
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawStarRow(cx, cy, filled){
  const total = 3;
  const size = 38;
  const gap = 2;
  const totalW = total * size + (total - 1) * gap;
  const startX = cx - totalW / 2 + size / 2;
  for(let i = 0; i < total; i++){
    const sx = startX + i * (size + gap);
    drawStarIcon(sx, cy, size * 0.5, i < filled ? '#ffd24a' : 'rgba(150,170,190,0.55)', i < filled);
  }
}

function drawStageCard(x, y, w, h, num, stars, unlocked){
  const isCurrent = (unlocked && stars === 0 && num === stageProgress.unlockedMax);
  const isDone = stars > 0;
  const RADIUS = 22;

  rr(x, y, w, h, RADIUS);
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  if(!unlocked){
    grd.addColorStop(0, 'rgba(50, 62, 72, 0.92)');
    grd.addColorStop(1, 'rgba(26, 34, 42, 0.92)');
  } else if(isDone){
    grd.addColorStop(0, 'rgba(255, 248, 220, 0.98)');
    grd.addColorStop(1, 'rgba(255, 220, 150, 0.98)');
  } else {
    grd.addColorStop(0, 'rgba(220, 240, 255, 0.98)');
    grd.addColorStop(1, 'rgba(170, 210, 245, 0.98)');
  }
  ctx.fillStyle = grd;
  ctx.fill();

  let border = 'rgba(120, 160, 200, 0.7)';
  if(!unlocked) border = 'rgba(80, 100, 120, 0.6)';
  else if(isDone) border = '#ffb84a';
  else if(isCurrent) border = '#7fe0a0';

  ctx.strokeStyle = border;
  ctx.lineWidth = isCurrent ? 3.5 : 2;
  rr(x, y, w, h, RADIUS);
  ctx.stroke();

  const cx = x + w / 2;

  // 关卡号
  drawUIText('第 ' + num + ' 关', cx, y + 42, 'body', { size: 24, strokeWidth: 4 });

// （武器解锁提示已移除，改为技能树）
  // 星星
  drawStarRow(cx, y + h - 30, unlocked ? stars : 0);
}

// ================= 技能树界面 =================
function drawTasksScreen(){
  drawAppBackground();
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.91});
  drawCurrencyBar(34);
  drawAppTitle('任 务',W/2,88,40);
  const earned=getTotalEarnedStars(), points=getAvailableSkillPoints(), claimable=getClaimableTaskCount();

  rr(40,166,W-80,94,20); ctx.fillStyle='rgba(18,31,43,.96)'; ctx.fill(); ctx.strokeStyle='rgba(127,216,255,.23)'; ctx.lineWidth=1.8; rr(40,166,W-80,94,20); ctx.stroke();
  drawUIText('累计星星',62,204,'muted',{size:15,align:'left',strokeWidth:1.8}); drawUIText(earned+' ★',62,236,'accent',{size:27,align:'left',strokeWidth:2.8});
  drawUIText('可用技能点',W/2,204,'muted',{size:15,align:'center',strokeWidth:1.8}); drawUIText(String(points),W/2,236,'success',{size:28,align:'center',strokeWidth:2.8});
  drawUIText(claimable?('待领取 '+claimable+' 项'):'完成任务后手动领取',W-62,220,claimable?'accent':'muted',{size:14,align:'right',strokeWidth:2});

  rr(40,284,W-80,106,20); const sg=ctx.createLinearGradient(40,284,W-40,390); sg.addColorStop(0,'rgba(56,87,102,.98)'); sg.addColorStop(1,'rgba(22,38,51,.99)'); ctx.fillStyle=sg; ctx.fill(); ctx.strokeStyle='rgba(142,215,237,.35)'; ctx.lineWidth=2; rr(40,284,W-80,106,20); ctx.stroke();
  drawUIText('永久技能树',66,324,'body',{size:23,align:'left',strokeWidth:2.8});
  drawUIText('任务获得技能点，用于强化主角的基础能力',66,358,'muted',{size:14,align:'left',strokeWidth:1.8});
  drawUIText('进入  ›',W-62,342,'accent',{size:19,align:'right',strokeWidth:2.2});
  taskSkillTreeEntryRect={x:40,y:284,w:W-80,h:106};

  drawSectionLabel('任务列表',40,438,'#7fd8ff');
  taskRects=[];
  const cols=2,cardW=310,cardH=150,gapX=20,gapY=20,startY=468,startX=40;
  for(let i=0;i<TASKS.length;i++){
    const t=TASKS[i],col=i%2,row=Math.floor(i/2),x=startX+col*(cardW+gapX),y=startY+row*(cardH+gapY)-taskScrollY;
    if(y>GLOBAL_NAV_Y-12 || y+cardH<455) continue;
    const progress=Math.min(t.target,getTaskProgress(t)),complete=progress>=t.target,claimed=isTaskClaimed(t),canClaim=complete&&!claimed;
    rr(x,y,cardW,cardH,20); const g=ctx.createLinearGradient(x,y,x,y+cardH); g.addColorStop(0,claimed?'rgba(31,43,53,.92)':canClaim?'rgba(71,59,28,.98)':'rgba(19,32,45,.96)'); g.addColorStop(1,'rgba(12,22,31,.99)'); ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle=canClaim?'#ffd24a':claimed?'rgba(125,145,160,.25)':'rgba(115,170,195,.20)'; ctx.lineWidth=canClaim?2.6:1.4; rr(x,y,cardW,cardH,20); ctx.stroke();
    drawUIText(t.title,x+20,y+34,claimed?'muted':'body',{size:20,align:'left',strokeWidth:2.4});
    drawUIText('+'+t.reward+' 点',x+cardW-20,y+34,'success',{size:15,align:'right',strokeWidth:1.8});
    drawUIText(t.desc,x+20,y+61,'muted',{size:13,align:'left',strokeWidth:1.7});
    const bx=x+20,by=y+83,bw=cardW-40,bh=13; rr(bx,by,bw,bh,7); ctx.fillStyle='rgba(0,0,0,.38)'; ctx.fill(); rr(bx,by,bw*(progress/t.target),bh,7); ctx.fillStyle=complete?'#7fe0a0':'#5ba9d0'; ctx.fill();
    drawUIText(progress+' / '+t.target,x+20,y+122,'muted',{size:12,align:'left',strokeWidth:1.5});
    const br={x:x+cardW-122,y:y+117,w:105,h:36,task:t,claimable:canClaim,complete}; taskRects.push(br);
    drawAppButton({x:br.x+br.w/2,y:br.y+br.h/2,w:br.w,h:br.h},claimed?'已领取':canClaim?'领取 +'+t.reward:'未完成',claimed?'#596674':canClaim?'#ffd24a':'#344250','#fff',{fontSize:13,disabled:!canClaim&&!claimed,pulse:canClaim});
  }
  drawGlobalNav();
}


function drawSkillIconForNode(node,cx,cy,size,color){
  const branch=SKILL_BRANCHES.find(b=>b.key===node.branch);
  const col=color || (branch?branch.color:'#7fd8ff');
  ctx.save(); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.arc(cx,cy,size,0,TAU); ctx.fillStyle='rgba(0,0,0,.18)'; ctx.fill(); ctx.stroke();
  const icon=node.id;
  if(icon.includes('damage') || icon.includes('crit')){
    ctx.beginPath(); ctx.moveTo(cx-7,cy+9); ctx.lineTo(cx+4,cy-2); ctx.lineTo(cx-1,cy-2); ctx.lineTo(cx+8,cy-12); ctx.stroke();
  } else if(icon.includes('rate')){
    ctx.beginPath(); ctx.arc(cx,cy,size*.05,0,TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-10); ctx.moveTo(cx,cy); ctx.lineTo(cx+9,cy+5); ctx.stroke();
  } else if(icon.includes('speed')){
    ctx.beginPath(); ctx.moveTo(cx-12,cy); ctx.lineTo(cx+10,cy); ctx.moveTo(cx-5,cy-7); ctx.lineTo(cx+10,cy); ctx.lineTo(cx-5,cy+7); ctx.stroke();
  } else if(icon.includes('range')){
    ctx.beginPath(); ctx.arc(cx,cy,size*.48,0,TAU); ctx.moveTo(cx,cy); ctx.lineTo(cx+10,cy-10); ctx.stroke();
  } else if(icon.includes('hp')){
    ctx.beginPath(); ctx.moveTo(cx,cy+12); ctx.bezierCurveTo(cx-18,cy, cx-9,cy-11, cx,cy-4); ctx.bezierCurveTo(cx+9,cy-11, cx+18,cy, cx,cy+12); ctx.stroke();
  } else if(icon.includes('wall') || icon.includes('guard')){
    ctx.beginPath(); rr(cx-11,cy-11,22,22,4); ctx.stroke(); ctx.moveTo(cx-5,cy-11); ctx.lineTo(cx-5,cy+11); ctx.moveTo(cx+5,cy-11); ctx.lineTo(cx+5,cy+11); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx,cy,size*.3,0,TAU); ctx.fill();
  }
  ctx.restore();
}

function drawSkillTreeScreen(){
  drawAppBackground();
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.93});
  drawCurrencyBar(34);
  drawAppTitle('永久技能树',W/2,88,40);
  const stars=getTotalEarnedStars(), points=getAvailableSkillPoints();

  rr(40,158,W-80,86,20); ctx.fillStyle='rgba(18,31,43,.97)'; ctx.fill(); ctx.strokeStyle='rgba(127,216,255,.23)'; ctx.lineWidth=1.8; rr(40,158,W-80,86,20); ctx.stroke();
  drawUIText('累计 '+stars+' ★',62,207,'accent',{size:22,align:'left',strokeWidth:2.4});
  drawUIText('可用技能点 '+points,W-190,207,'success',{size:22,align:'right',strokeWidth:2.4});
  skillResetBtn={x:W-86,y:201,w:120,h:42};
  drawAppButton(skillResetBtn,'重置','#ff8fb0','#fff',{fontSize:15});
  drawUIText('每个技能点击后查看详情，再决定是否学习',W/2,276,'muted',{size:15,strokeWidth:1.8});

  const listX=40, listY=310, listW=W-80, viewH=GLOBAL_NAV_Y-listY-18;
  const cardH=188, gap=16;
  const nodes=SKILL_TREE.slice().sort((a,b)=>a.tier-b.tier || SKILL_BRANCHES.findIndex(x=>x.key===a.branch)-SKILL_BRANCHES.findIndex(x=>x.key===b.branch));
  const contentH=nodes.length*cardH+(nodes.length-1)*gap;
  skillScrollMaxY=Math.max(0,contentH-viewH);
  skillScrollY=clamp(skillScrollY,0,skillScrollMaxY);
  ctx.save(); ctx.beginPath(); rr(listX,listY,listW,viewH,24); ctx.clip();
  skillNodeRects=[];
  nodes.forEach((n,i)=>{
    const y=listY+i*(cardH+gap)-skillScrollY;
    if(y+cardH<listY-20 || y>listY+viewH+20) return;
    const branch=SKILL_BRANCHES.find(b=>b.key===n.branch);
    const reason=getSkillLockReason(n), owned=reason==='owned', can=reason==='ok';
    rr(listX,y,listW,cardH,24);
    const g=ctx.createLinearGradient(listX,y,listX,y+cardH);
    g.addColorStop(0,owned?'rgba(42,67,62,.98)':can?'rgba(62,56,30,.98)':'rgba(20,34,46,.98)');
    g.addColorStop(1,'rgba(10,21,30,.99)'); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=owned?branch.color:can?'#ffd24a':'rgba(125,160,180,.20)'; ctx.lineWidth=owned?2.8:can?2.4:1.4; rr(listX,y,listW,cardH,24); ctx.stroke();

    drawSkillIconForNode(n,listX+66,y+72,35,branch.color);
    drawUIText(branch.name,listX+116,y+36,'muted',{size:14,align:'left',strokeWidth:1.7});
    drawUIText(n.id.replaceAll('_',' '),listX+116,y+70,'body',{size:22,align:'left',strokeWidth:2.6});
    drawUIText(n.desc,listX+116,y+101,'muted',{size:15,align:'left',strokeWidth:1.8});

    const status=owned?'已学习':reason==='stars'?('需 '+n.reqStars+' ★'):reason==='prev'?'需先学前置':('消耗 '+n.cost+' 点');
    drawUIText(status,listX+116,y+139,owned?'success':can?'accent':'muted',{size:14,align:'left',strokeWidth:1.8});
    drawUIText(can?'点击查看详情':owned?'已拥有':'点击查看解锁条件',listX+listW-24,y+38,can||owned?'accent':'muted',{size:12,align:'right',strokeWidth:1.6});
    rr(listX+listW-150,y+105,124,48,14); ctx.fillStyle=can?'rgba(255,210,74,.12)':owned?'rgba(127,224,160,.08)':'rgba(255,255,255,.03)'; ctx.fill(); ctx.strokeStyle=can?'rgba(255,210,74,.45)':'rgba(255,255,255,.08)'; ctx.lineWidth=1.2; rr(listX+listW-150,y+105,124,48,14); ctx.stroke();
    drawUIText(owned?'已学习':(n.reqStars+'★ / '+n.cost+'点'),listX+listW-88,y+136,owned?'success':reason==='stars'?'danger':'accent',{size:14,strokeWidth:1.8});
    skillNodeRects.push({x:listX,y,w:listW,h:cardH,node:n});
  });
  ctx.restore();

  // 滚动位置指示
  if(skillScrollMaxY>0){
    const trackX=W-24, trackY=listY+10, trackH=viewH-20;
    rr(trackX,trackY,6,trackH,3); ctx.fillStyle='rgba(255,255,255,.08)'; ctx.fill();
    const thumbH=Math.max(70,trackH*(viewH/contentH));
    const thumbY=trackY+(trackH-thumbH)*(skillScrollY/skillScrollMaxY);
    rr(trackX,thumbY,6,thumbH,3); ctx.fillStyle='rgba(127,216,255,.65)'; ctx.fill();
  }

  if(skillDetailNode) drawSkillDetailModal(skillDetailNode);
  drawGlobalNav();
}

function drawSkillDetailModal(node){
  skillDetailCloseRect=null; skillDetailLearnRect=null;
  drawAppOverlay(.78);
  const boxW=620, boxH=500, x=(W-boxW)/2, y=Math.max(120,(GLOBAL_NAV_Y-boxH)/2);
  rr(x,y,boxW,boxH,28);
  const g=ctx.createLinearGradient(x,y,x,y+boxH); g.addColorStop(0,'rgba(24,39,53,.99)'); g.addColorStop(1,'rgba(9,19,28,.99)'); ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='rgba(154,223,245,.46)'; ctx.lineWidth=2.4; rr(x,y,boxW,boxH,28); ctx.stroke();
  const branch=SKILL_BRANCHES.find(b=>b.key===node.branch);
  drawSkillIconForNode(node,x+76,y+88,40,branch.color);
  drawUIText(branch.name,x+132,y+56,'muted',{size:15,align:'left',strokeWidth:1.8});
  drawUIText(node.id.replaceAll('_',' '),x+132,y+94,'body',{size:28,align:'left',strokeWidth:3});
  drawUIText('效果',x+42,y+158,'accent',{size:18,align:'left',strokeWidth:2.2});
  drawUIText(node.desc,x+42,y+204,'body',{size:21,align:'left',strokeWidth:2.5});
  drawUIText('解锁条件：累计 '+node.reqStars+' ★',x+42,y+260,'muted',{size:16,align:'left',strokeWidth:1.9});
  drawUIText('学习消耗：'+node.cost+' 技能点',x+42,y+294,'muted',{size:16,align:'left',strokeWidth:1.9});
  const reason=getSkillLockReason(node);
  if(reason==='owned'){
    drawUIText('这个技能已经学习',W/2,y+360,'success',{size:20,strokeWidth:2.4});
  } else if(reason==='ok'){
    skillDetailLearnRect={x:W/2-145,y:y+387,w:290,h:64};
    drawAppButton({x:W/2,y:y+419,w:290,h:64},'学习技能','#7fe0a0','#fff',{fontSize:24,pulse:true});
  } else {
    let msg=reason==='stars'?('还需要 '+Math.max(0,node.reqStars-getTotalEarnedStars())+' 颗星星'):reason==='prev'?'请先学习前置技能':'技能点不足';
    drawUIText(msg,W/2,y+374,'danger',{size:19,strokeWidth:2.2});
  }
  skillDetailCloseRect={x:W-108,y:y+24,w:64,h:52};
  drawAppButton({x:W-76,y:y+50,w:64,h:52},'×','#ff8fb0','#fff',{fontSize:28});
}


function drawStageSelectScreen(){
  drawAppBackground();

  const boxW = W - 60;
  const boxH = 800;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  const info = drawDialogPanel(boxX, boxY, boxW, boxH, '关 卡 选 择', {
    titleH: 76, titleSize: 32
  });
  stageSelectCloseRect = info.closeRect;

  // ===== 网格区域 =====
  const gridX = boxX + 28;
  const gridY = boxY + 122;
  const gridW = boxW - 56;
  const gridH = boxH - 196;

  const gapX = 12;
  const gapY = 14;
  const colCount = 3;

  // ★ 卡片宽度自适应弹窗宽度，上限 148（原始尺寸）
  const cellW = Math.min(158, Math.floor((gridW - gapX * (colCount - 1)) / colCount));
  const cellH = 160;

  const totalGridW = cellW * colCount + gapX * (colCount - 1);
  const startX = gridX + (gridW - totalGridW) / 2;

  const rowsTotal = Math.ceil(TOTAL_STAGES / colCount);
  const contentH = rowsTotal * (cellH + gapY);
  stageScrollMaxY = Math.max(0, contentH - gridH);
  if(stageScrollY > stageScrollMaxY) stageScrollY = stageScrollMaxY;
  if(stageScrollY < 0) stageScrollY = 0;

  ctx.save();
  ctx.beginPath();
  rr(gridX, gridY, gridW, gridH, 22);   // ★ 圆角裁剪，和弹窗内壁对齐
  ctx.clip();

  stageCards = [];
  for(let i = 0; i < TOTAL_STAGES; i++){
    const num = i + 1;
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const cx = startX + col * (cellW + gapX);
    const cy = gridY + row * (cellH + gapY) - stageScrollY;

    if(cy + cellH < gridY - 20 || cy > gridY + gridH + 20) continue;

    const unlocked = num <= stageProgress.unlockedMax;
    const stars = stageProgress.stars[num] || 0;
    drawStageCard(cx, cy, cellW, cellH, num, stars, unlocked);

    stageCards.push({ x: cx, y: cy, w: cellW, h: cellH, num, unlocked });
  }
  ctx.restore();

  // 滚动提示
  if(stageScrollMaxY > 0){
    drawUIText('↕ 上下拖动查看全部关卡', W/2, boxY + boxH - 24, 'muted', { size: 13 });
  } else {
    drawUIText('选择一个关卡开始挑战', W/2, boxY + boxH - 24, 'muted', { size: 14 });
  }
}

// ================= 关卡结算界面 =================
function drawStageVictoryScreen(){
  const info=stageVictoryInfo;
  if(!info) return;
  const ease=1-Math.pow(1-Math.max(0,Math.min(1,stageVictoryAnimT)),3);
  ctx.save();
  drawAppOverlay(0.84*ease);
  const boxW=Math.min(W-44,640), boxH=760;
  const boxX=(W-boxW)/2, boxY=Math.max(28,(H-boxH)/2);
  const pop=.95+.05*ease;
  ctx.translate(W/2,boxY+boxH/2); ctx.scale(pop,pop); ctx.translate(-W/2,-(boxY+boxH/2));
  rr(boxX,boxY,boxW,boxH,28);
  const grd=ctx.createLinearGradient(0,boxY,0,boxY+boxH);
  grd.addColorStop(0,'rgba(33,47,58,.99)'); grd.addColorStop(1,'rgba(16,24,32,.99)');
  ctx.fillStyle=grd; ctx.fill();
  ctx.strokeStyle='rgba(255,214,112,.72)'; ctx.lineWidth=3; rr(boxX,boxY,boxW,boxH,28); ctx.stroke();
  drawUIText(info.isLast?'全部关卡通关！':'第 '+info.stageNum+' 关通关',W/2,boxY+74,'title',{size:34,strokeWidth:3.5,glow:true,glowColor:'rgba(255,210,74,.45)',glowSize:10});
  drawUIText(info.stars>=3?'完美守城':info.stars===2?'稳住防线':'惊险守住',W/2,boxY+110,'muted',{size:16,strokeWidth:2});
  const sy=boxY+220;
  for(let i=0;i<3;i++){ drawStarIcon(W/2+(i-1)*110,sy,46,null,i<info.stars); }
  const statY=boxY+306, cardW=(boxW-74)/2;
  rr(boxX+24,statY,cardW,92,18); ctx.fillStyle='rgba(255,255,255,.055)'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=2; rr(boxX+24,statY,cardW,92,18); ctx.stroke();
  rr(boxX+50+cardW,statY,cardW,92,18); ctx.fillStyle='rgba(255,255,255,.055)'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.10)'; rr(boxX+50+cardW,statY,cardW,92,18); ctx.stroke();
  drawUIText('城墙剩余',boxX+24+cardW/2,statY+31,'muted',{size:14,align:'center',strokeWidth:1.8});
  drawUIText(Math.round(info.hpRatio*100)+'%',boxX+24+cardW/2,statY+68,'accent',{size:30,align:'center',strokeWidth:2.8});
  drawUIText('守城星级',boxX+50+cardW+cardW/2,statY+31,'muted',{size:14,align:'center',strokeWidth:1.8});
  drawUIText(info.stars+'/3',boxX+50+cardW+cardW/2,statY+68,'accent',{size:30,align:'center',strokeWidth:2.8});
  const rewardY=boxY+424;
  rr(boxX+24,rewardY,boxW-48,128,20); ctx.fillStyle=info.catReward?'rgba(127,224,160,.10)':'rgba(255,255,255,.045)'; ctx.fill(); ctx.strokeStyle=info.catReward?'rgba(127,224,160,.48)':'rgba(255,255,255,.10)'; ctx.lineWidth=2; rr(boxX+24,rewardY,boxW-48,128,20); ctx.stroke();
  drawUIText(info.catReward?'首通奖励':'本关奖励状态',boxX+48,rewardY+34,'success',{size:16,align:'left',strokeWidth:2});
  if(info.catReward){
    drawCatBroArtAt(info.catReward.id,boxX+86,rewardY+83,76);
    drawUIText(info.catReward.name,boxX+138,rewardY+73,'title',{size:25,align:'left',strokeWidth:2.8});
    drawUIText(info.catReward.skill,boxX+138,rewardY+103,'accent',{size:14,align:'left',strokeWidth:1.8});
  }else{
    drawUIText('已领取过本关首通猫小弟奖励',W/2,rewardY+83,'muted',{size:17,align:'center',strokeWidth:2});
  }
  stageVictoryBtnRects=[];
  let by=boxY+602;
  if(!info.isLast){
    const btn={x:W/2,y:by,w:boxW-72,h:62}; drawAppButton(btn,'下一关','#7fe0a0','#289858',{fontSize:25,pulse:true});
    stageVictoryBtnRects.push({x:btn.x-btn.w/2,y:btn.y-btn.h/2,w:btn.w,h:btn.h,action:'next'}); by+=78;
  }
  const back={x:W/2,y:by,w:boxW-72,h:56}; drawAppButton(back,'返回关卡','#7fb8ff','#3878b8',{fontSize:21});
  stageVictoryBtnRects.push({x:back.x-back.w/2,y:back.y-back.h/2,w:back.w,h:back.h,action:'back'});
  if(hasAvailableSkill()){ by+=72; const skill={x:W/2,y:by,w:250,h:46}; drawAppButton(skill,'查看技能树','#ffb84a','#c87820',{fontSize:17}); stageVictoryBtnRects.push({x:skill.x-skill.w/2,y:skill.y-skill.h/2,w:skill.w,h:skill.h,action:'skill'}); }
  ctx.restore();
}

// ================= 游戏说明 =================


// === 1.13 回滚补齐：恢复 1.11 中被 1.12 结算界面替换误删的 UI 函数 ===
function drawBootScreen(){
  // 启动页只保留原菜单背景 + 一个明确的开始游戏按钮；这里绝不显示底部导览。
  drawAppBackground();
  const shade=ctx.createLinearGradient(0,H*0.52,0,H);
  shade.addColorStop(0,'rgba(6,16,24,0)');
  shade.addColorStop(1,'rgba(5,12,18,.58)');
  ctx.fillStyle=shade; ctx.fillRect(0,0,W,H);

  bootStartBtnRect={x:W/2-190,y:H-245,w:380,h:88};
  drawAppButton({x:W/2,y:H-201,w:380,h:88},'开始游戏','#7fe0a0','#fff',{fontSize:31,pulse:true});
}

function drawCatBroArtAt(cfg, cx, cy, size, index, owned){
  const key = cfg && cfg.spriteKey && SPRITES[cfg.spriteKey] ? cfg.spriteKey : (index % 2 === 0 ? 'catbro' : 'catbro2');
  const spr = SPRITES[key];
  if(!spr || !spr.loaded || !spr.img){
    ctx.save(); ctx.globalAlpha=owned?0.55:0.25; ctx.fillStyle='#d7e4ea'; ctx.beginPath(); ctx.arc(cx,cy,size*0.42,0,TAU); ctx.fill(); ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.22;
  ctx.drawImage(spr.img,cx-size/2,cy-size/2,size,size);
  ctx.restore();
}

function drawCatBroCollectionScreen(){
  drawAppBackground();
  ctx.fillStyle='rgba(8,14,22,0.60)'; ctx.fillRect(0,0,W,H);
  drawCurrencyBar();
  drawAppTitle('猫 小 弟',W/2,95,40);
  drawUIText('永久收藏 · 最多部署3只',W/2,135,'muted',{size:17,strokeWidth:3});
  drawUIText('已拥有 '+getOwnedCatBroCount()+' / 10',W/2,170,'accent',{size:21,strokeWidth:3});
  catBroCollectionRects=[];
  const cols=2, cardW=300, cardH=205, gapX=30, gapY=18, startX=(W-cols*cardW-(cols-1)*gapX)/2, startY=205;
  CATBRO_COLLECTION.forEach((cfg,i)=>{
    const col=i%cols,row=Math.floor(i/cols),x=startX+col*(cardW+gapX),y=startY+row*(cardH+gapY);
    const owned=isCatBroOwned(cfg.id), deployed=catBroDeploy.includes(cfg.id);
    ctx.save(); rr(x,y,cardW,cardH,20); ctx.fillStyle=owned?'rgba(255,248,230,.96)':'rgba(55,65,78,.78)'; ctx.fill(); ctx.strokeStyle=deployed?'#ffd24a':owned?'#d9b47a':'rgba(255,255,255,.16)'; ctx.lineWidth=deployed?5:2; rr(x,y,cardW,cardH,20); ctx.stroke();
    if(owned){ drawCatSpriteAt(i%2?'catbro2':'catbro',x+65,y+92,105); }
    else { ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x+65,y+92,45,0,TAU); ctx.fill(); drawUIText('?',x+65,y+104,'muted',{size:46,strokeWidth:5}); }
    drawUIText(owned?cfg.name:'???',x+125,y+42,owned?'title':'muted',{size:24,strokeWidth:4});
    drawUIText(owned?cfg.skill:'未获得',x+125,y+76,owned?'accent':'muted',{size:16,strokeWidth:3});
    drawUIText(owned?cfg.desc:'首次通关一个新关卡获得',x+125,y+108,'muted',{size:13,strokeWidth:3});
    if(owned){
      drawUIText(deployed?'已部署':'点击部署',x+125,y+155,deployed?'accent':'title',{size:17,strokeWidth:3});
      drawUIText('攻击 '+cfg.dmg+' · '+cfg.rate.toFixed(2)+'s',x+125,y+181,'muted',{size:12,strokeWidth:2});
    }
    ctx.restore(); catBroCollectionRects.push({x,y,w:cardW,h:cardH,id:cfg.id});
  });
  const by=H-72;
  catBroCollectionBackRect={x:30,y:by-30,w:170,h:58};
  drawAppButton({x:115,y:by-1,w:170,h:58},'返 回','#7fb8ff','#3878b8',{fontSize:22});
  catBroCollectionStartRect={x:W-205,y:by-30,w:330,h:58};
  drawAppButton({x:W-40,y:by-1,w:330,h:58},'完成部署','#7fe0a0','#289858',{fontSize:22});
}

function drawCatSelectScreen(){
  drawAppBackground();

  // ★ 半透明遮罩：压暗背景海报，让 UI 更清晰
  ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
  ctx.fillRect(0, 0, W, H);

  drawCurrencyBar();
  drawAppTitle('选 择 你 的 猫 咪', W/2, 300, 42);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('两只猫属性完全相同，只有样子不同', W/2, 380);
  ctx.fillStyle = '#d878a0';
  ctx.fillText('两只猫属性完全相同，只有样子不同', W/2, 380);

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
    const imgCy = card.y + 160;
    const imgSize = 200;
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
  drawAppButton(CATCHOOSE_STAGE_BTN, '开 始 闯 关', '#7fe0a0', '#289858', { fontSize: 30, pulse: true });

  // 猫小弟入口：与任务/技能树分开，避免与“开始闯关”重叠。
  {
    const bb=CATCHOOSE_BRO_BTN;
    rr(bb.x-bb.w/2,bb.y-bb.h/2,bb.w,bb.h,16); ctx.fillStyle='rgba(230,248,255,.98)'; ctx.fill();
    ctx.strokeStyle='#67b7d9'; ctx.lineWidth=3; rr(bb.x-bb.w/2,bb.y-bb.h/2,bb.w,bb.h,16); ctx.stroke();
    drawUIText('🐾',bb.x,bb.y-7,'title',{size:22,strokeWidth:2});
    drawUIText('猫小弟 '+getOwnedCatBroCount()+'/10',bb.x,bb.y+25,'title',{size:13,strokeWidth:2});
  }

  // 任务入口
  {
    const tb = CATCHOOSE_TASK_BTN;
    rr(tb.x - tb.w/2, tb.y - tb.h/2, tb.w, tb.h, 16);
    const grd = ctx.createLinearGradient(tb.x, tb.y - tb.h/2, tb.x, tb.y + tb.h/2);
    grd.addColorStop(0, 'rgba(255, 244, 214, 0.98)');
    grd.addColorStop(1, 'rgba(255, 190, 92, 0.98)');
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = '#e59b36'; ctx.lineWidth = 3;
    rr(tb.x - tb.w/2, tb.y - tb.h/2, tb.w, tb.h, 16); ctx.stroke();
    drawUIText('任务', tb.x, tb.y + 28, 'title', {size:14,strokeWidth:3});
    // 清单图标
    ctx.strokeStyle='#8a5a20'; ctx.lineWidth=3;
    for(let i=0;i<3;i++){
      const yy=tb.y-28+i*13;
      ctx.beginPath(); ctx.moveTo(tb.x-23,yy); ctx.lineTo(tb.x-16,yy+6); ctx.lineTo(tb.x-6,yy-5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tb.x+1,yy); ctx.lineTo(tb.x+24,yy); ctx.stroke();
    }
    if(getClaimableTaskCount()>0){
      ctx.fillStyle='#ff3030'; ctx.beginPath(); ctx.arc(tb.x+tb.w/2-5,tb.y-tb.h/2+5,9,0,TAU); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
    }
  }

  // 技能树入口
  {
    const sb = CATCHOOSE_SKILL_BTN;
    rr(sb.x - sb.w/2, sb.y - sb.h/2, sb.w, sb.h, 16);
    const grd = ctx.createLinearGradient(sb.x, sb.y - sb.h/2, sb.x, sb.y + sb.h/2);
    grd.addColorStop(0, 'rgba(255, 248, 220, 0.98)');
    grd.addColorStop(1, 'rgba(255, 210, 74, 0.98)');
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#ffb84a';
    ctx.lineWidth = 3;
    rr(sb.x - sb.w/2, sb.y - sb.h/2, sb.w, sb.h, 16);
    ctx.stroke();

    // 星形
    const cxS = sb.x, cyS = sb.y - 12;
    const RS = 18;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    for(let i = 0; i < 5; i++){
      const a = -Math.PI / 2 + i * TAU / 5;
      const x1 = cxS + Math.cos(a) * RS;
      const y1 = cyS + Math.sin(a) * RS;
      const a2 = a + TAU / 10;
      const x2 = cxS + Math.cos(a2) * RS * 0.45;
      const y2 = cyS + Math.sin(a2) * RS * 0.45;
      if(i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5820';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字
    drawUIText('技能树', sb.x, sb.y + 28, 'title', {
      size: 14, strokeWidth: 3
    });

    // ★ 红点提示
    if(hasAvailableSkill()){
      const dotX = sb.x + sb.w/2 - 6;
      const dotY = sb.y - sb.h/2 + 6;
      const pulse = 0.5 + Math.sin(gameTime * 5) * 0.5;
      // 外发光
      ctx.save();
      ctx.globalAlpha = 0.45 + pulse * 0.35;
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12 + pulse * 4, 0, TAU);
      ctx.fill();
      ctx.restore();
      // 红点本体
      ctx.fillStyle = '#ff3030';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 9, 0, TAU);
      ctx.stroke();
    }
  }

  // 无尽模式：通过第 1 关后才显示
  if(isEndlessUnlocked()){
    drawAppButton(CATCHOOSE_ENDLESS_BTN, '无 尽 模 式', '#ffd24a', '#c87820', { fontSize: 30 });
    // 无尽按钮显示时，"返回"在第三行
    CATCHOOSE_BACK_BTN.y = 1200;
  } else {
    // 无尽按钮不显示时，"返回"上移到第二行，填补空隙
    CATCHOOSE_BACK_BTN.y = 1200;
  }

  drawAppButton(CATCHOOSE_BACK_BTN, '返 回', '#7fb8ff', '#3878b8', { fontSize: 30 });
}

function drawCurrencyBar(topY){
  if(topY === undefined) topY = 18;
  const h = 44;
  const gap = 8;
  const rightEdge = W - 14;

  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';

  const coinText = String(currency.coins);
  const diaText  = String(currency.diamonds);
  const coinTextW = ctx.measureText(coinText).width;
  const diaTextW  = ctx.measureText(diaText).width;

  const iconSize = h - 8;
  const coinBarW = iconSize + 6 + coinTextW + 22;
  const diaBarW  = iconSize + 6 + diaTextW  + 22;

  // 钻石在右，金币在左
  const diaX  = rightEdge - diaBarW;
  const coinX = diaX - gap - coinBarW;

  drawOneCurrencyBar(coinX, topY, coinBarW, h, 'icon_coin',    coinText, '#ffd24a');
  drawOneCurrencyBar(diaX,  topY, diaBarW,  h, 'icon_diamond', diaText,  '#88e0ff');
}

function drawHomeScreen(){
  drawAppBackground();
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.90});
  drawCurrencyBar(34);
  drawAppTitle('家 园',W/2,88,40);
  drawUIText('猫小弟收藏',42,155,'title',{size:23,align:'left',strokeWidth:2.8});
  drawUIText(getOwnedCatBroCount()+' / 10',W-42,155,'accent',{size:24,align:'right',strokeWidth:2.8});
  drawUIText('展示猫咪形象与名称 · 技能只做简要介绍',42,185,'muted',{size:14,align:'left',strokeWidth:1.8});

  homeCatRects=[];
  const cols=3, cardW=206, cardH=218, gapX=16, gapY=18, startX=30, startY=214;
  CATBRO_COLLECTION.forEach((c,i)=>{
    const col=i%cols,row=Math.floor(i/cols),x=startX+col*(cardW+gapX),y=startY+row*(cardH+gapY),owned=isCatBroOwned(c.id),dep=catBroDeploy.includes(c.id);
    rr(x,y,cardW,cardH,22);
    const g=ctx.createLinearGradient(x,y,x,y+cardH); g.addColorStop(0,owned?'rgba(35,56,68,.98)':'rgba(26,35,43,.90)'); g.addColorStop(1,owned?'rgba(14,27,38,.99)':'rgba(17,23,29,.94)'); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=dep?'#ffd24a':owned?'rgba(121,202,221,.34)':'rgba(120,140,155,.17)'; ctx.lineWidth=dep?3:1.4; rr(x,y,cardW,cardH,22); ctx.stroke();

    drawCatBroArtAt(c,x+cardW/2,y+76,118,i,owned);
    drawUIText(owned?c.name:'???',x+cardW/2,y+143,owned?'body':'muted',{size:22,align:'center',strokeWidth:2.8});
    drawUIText(owned?c.skill:'未获得',x+cardW/2,y+170,owned?'accent':'muted',{size:14,align:'center',strokeWidth:1.9});
    drawUIText(owned?c.desc:'首次通关新关卡获得',x+cardW/2,y+192,'muted',{size:11,align:'center',strokeWidth:1.5});
    if(owned){
      rr(x+58,y+197,90,14,7); ctx.fillStyle=dep?'rgba(255,210,74,.18)':'rgba(127,224,160,.10)'; ctx.fill();
      drawUIText(dep?'已部署':'未部署',x+cardW/2,y+208,dep?'accent':'muted',{size:10,strokeWidth:1.4});
      homeCatRects.push({x,y,w:cardW,h:cardH,id:c.id});
    }
  });

  drawUIText('点击已拥有的猫可切换部署状态 · 部署数量上限 3 只',W/2,1110,'muted',{size:13,strokeWidth:1.7});
  drawGlobalNav();
}

function drawMainMenu(){
  drawAppBackground();
  // 原菜单背景只负责“气氛”，所有信息都压进内容底框，避免角色原画与 UI 互相穿插。
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.88});
  drawCurrencyBar(34);

  // 品牌区
  drawCuteTitle(W/2,100);
  drawUIText('城堡防线 · 猫咪守城作战',W/2,152,'muted',{size:22,strokeWidth:2.5});
  drawUIText('主线进度  '+Math.min(TOTAL_STAGES,Math.max(1,stageProgress.unlockedMax))+' / '+TOTAL_STAGES,
    W/2,185,'accent',{size:18,strokeWidth:2.2});

  // 主视觉区：留足空间，不让人物和信息互相拥挤。
  const x=38,y=220,w=W-76,h=430;
  rr(x,y,w,h,28);
  const panel=ctx.createLinearGradient(x,y,x,y+h);
  panel.addColorStop(0,'rgba(22,39,54,.92)');
  panel.addColorStop(1,'rgba(10,22,33,.96)');
  ctx.fillStyle=panel; ctx.fill();
  ctx.strokeStyle='rgba(137,206,232,.38)'; ctx.lineWidth=2.5; rr(x,y,w,h,28); ctx.stroke();
  rr(x+8,y+8,w-16,h-16,22); ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1; ctx.stroke();

  drawSectionLabel('当前主角',x+28,y+46,'#7fe0a0');
  const heroCx=x+175, heroCy=y+207;
  ctx.fillStyle='rgba(87,210,183,.10)'; ctx.beginPath(); ctx.arc(heroCx,heroCy,126,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(112,226,205,.24)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(heroCx,heroCy,100+Math.sin(menuTime*2)*4,0,TAU); ctx.stroke();
  const spr=getCurrentCatSprite();
  if(spr && spr.loaded && spr.img) ctx.drawImage(spr.img,heroCx-110,heroCy-110,220,220);
  else { drawSimpleCatBroIcon(heroCx,heroCy,0,true); }
  drawUIText(getCurrentCatName(),heroCx,y+356,'title',{size:26,strokeWidth:3.2});
  drawUIText('当前战斗角色',heroCx,y+384,'muted',{size:15,strokeWidth:1.8});

  const rx=x+340;
  drawSectionLabel('下一目标',rx,y+46,'#ffd24a');
  drawUIText('第 '+Math.max(1,stageProgress.unlockedMax)+' 关',rx,y+100,'body',{size:40,align:'left',strokeWidth:3.3});
  drawUIText((stageProgress.stars[stageProgress.unlockedMax]||0)>0 ? '已通关 · 可再次挑战' : '首次挑战 · 首通可获得猫小弟',rx,y+134,'accent',{size:15,align:'left',strokeWidth:2});

  drawUIText('当前阵容',rx,y+190,'muted',{size:16,align:'left',strokeWidth:2});
  drawUIText('猫小弟',rx,y+228,'body',{size:21,align:'left',strokeWidth:2.5});
  drawUIText(getOwnedCatBroCount()+'/10',x+w-28,y+228,'accent',{size:23,align:'right',strokeWidth:2.5});
  drawUIText('部署',rx,y+267,'body',{size:21,align:'left',strokeWidth:2.5});
  drawUIText(catBroDeploy.length+'/3',x+w-28,y+267,'success',{size:23,align:'right',strokeWidth:2.5});
  drawUIText('武器',rx,y+306,'body',{size:21,align:'left',strokeWidth:2.5});
  drawUIText(currentWeapon==='catfood'?'猫粮':currentWeapon==='laser'?'激光':'导弹',x+w-28,y+306,'accent',{size:20,align:'right',strokeWidth:2.4});

  // 主 CTA 放大，同时保留充足上下间距。
  menuStartBtnRect={x:W/2-150,y:700,w:300,h:78};
  drawAppButton({x:W/2,y:739,w:300,h:78},'开始守城','#7fe0a0','#fff',{fontSize:29,pulse:true});

  // 四个状态信息块，故意放大而不是继续压缩。
  const chips=[
    ['累计星星',getTotalEarnedStars()+' ★','#ffd24a'],
    ['技能点',getAvailableSkillPoints()+' 点','#7fd8ff'],
    ['猫小弟',getOwnedCatBroCount()+' / 10','#7fe0a0'],
    ['当前武器',currentWeapon==='catfood'?'猫粮':currentWeapon==='laser'?'激光':'导弹','#ffb84a']
  ];
  const chipW=148, chipH=66, chipGap=8, chipY=826;
  chips.forEach((c,i)=>{
    const cx=x+8+i*(chipW+chipGap),cy=chipY;
    rr(cx,cy,chipW,chipH,17);
    ctx.fillStyle='rgba(255,255,255,.045)'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1.2; rr(cx,cy,chipW,chipH,17); ctx.stroke();
    drawUIText(c[0],cx+14,cy+25,'muted',{size:12,align:'left',strokeWidth:1.6});
    drawUIText(c[1],cx+chipW-14,cy+48,'body',{size:18,align:'right',strokeWidth:2.2});
    ctx.fillStyle=c[2]; rr(cx+14,cy+53,38,4,2); ctx.fill();
  });

  // 清档：明确、独立，但不会喧宾夺主。
  mainResetBtnRect={x:38,y:919,w:190,h:58};
  rr(mainResetBtnRect.x,mainResetBtnRect.y,mainResetBtnRect.w,mainResetBtnRect.h,17);
  ctx.fillStyle='rgba(105,46,56,.36)'; ctx.fill();
  ctx.strokeStyle='rgba(255,125,125,.66)'; ctx.lineWidth=1.7; rr(mainResetBtnRect.x,mainResetBtnRect.y,mainResetBtnRect.w,mainResetBtnRect.h,17); ctx.stroke();
  drawUIText('↺  清除全部数据',mainResetBtnRect.x+mainResetBtnRect.w/2,mainResetBtnRect.y+36,'danger',{size:16,strokeWidth:2.2});
  drawUIText('测试用',mainResetBtnRect.x+mainResetBtnRect.w/2,mainResetBtnRect.y+55,'muted',{size:10,strokeWidth:1.4});

  if(menuToast.life>0) drawUIText(menuToast.text,W/2,989,'success',{size:18,strokeWidth:2.6});

  if(mainResetConfirm){
    drawAppOverlay(.80);
    const pw=606,ph=318,px=(W-pw)/2,py=(H-ph)/2-42;
    rr(px,py,pw,ph,28);
    const pg=ctx.createLinearGradient(px,py,px,py+ph); pg.addColorStop(0,'rgba(28,39,52,.99)'); pg.addColorStop(1,'rgba(15,22,31,.99)');
    ctx.fillStyle=pg; ctx.fill(); ctx.strokeStyle='rgba(255,125,125,.78)'; ctx.lineWidth=2.5; rr(px,py,pw,ph,28); ctx.stroke();
    drawUIText('确定清除全部游戏数据？',W/2,py+66,'danger',{size:31,strokeWidth:4});
    drawUIText('关卡、星级、任务、技能点、猫小弟收藏等都会归零',W/2,py+118,'muted',{size:16,strokeWidth:2.2});
    drawUIText('清除后将从第 1 关重新开始',W/2,py+148,'muted',{size:16,strokeWidth:2});
    drawAppButton({x:W/2-112,y:py+237,w:184,h:62},'取消','#7fb8ff','#fff',{fontSize:21});
    drawAppButton({x:W/2+112,y:py+237,w:184,h:62},'确认清除','#ff8a8a','#fff',{fontSize:21});
    mainResetConfirmRects=[
      {x:W/2-112-92,y:py+237-31,w:184,h:62},
      {x:W/2+112-92,y:py+237-31,w:184,h:62}
    ];
  } else mainResetConfirmRects=[];

  drawGlobalNav();
}

function drawMenuSpriteButton(b, sprKey){
  const spr = SPRITES[sprKey];

  if(!spr || !spr.loaded || !spr.img){
    const fallback = {
      btn_start:   ['开 始 游 戏', '#ff8fb0', '#c84870'],
      btn_history: ['历 史 战 绩', '#ffb84a', '#c87820'],
      btn_help:    ['游 戏 说 明', '#7fb8ff', '#3878b8']
    };
    const f = fallback[sprKey] || ['按 钮', '#ff8fb0', '#c84870'];
    drawAppButton(b, f[0], f[1], f[2], { fontSize: 30, pulse: true });
    return;
  }

  const img = spr.img;
  const dx = b.x - b.w / 2;
  const dy = b.y - b.h / 2;
  ctx.drawImage(img, dx, dy, b.w, b.h);
}

function drawOneCurrencyBar(x, y, w, h, iconKey, text, borderColor){
  // 深色胶囊
  rr(x, y, w, h, h/2);
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, 'rgba(22, 32, 42, 0.94)');
  grd.addColorStop(1, 'rgba(8, 14, 20, 0.94)');
  ctx.fillStyle = grd;
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  rr(x, y, w, h, h/2);
  ctx.stroke();

  // 图标
  const iconSize = h - 8;
  const iconImg = UI.assets[iconKey];
  if(iconImg){
    ctx.drawImage(iconImg, x + 4, y + 4, iconSize, iconSize);
  }

  // 数字
  drawUIText(text, x + w - 12, y + h/2 + 8, 'body', {
    size: 22,
    align: 'right',
    strokeWidth: 2
  });
}

function drawPlaceholderScreen(){
  drawAppBackground();
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.90});
  drawCurrencyBar(34);
  drawAppTitle(placeholderFrom==='inventory'?'背 包':'商 城',W/2,88,40);
  const title=placeholderFrom==='inventory'?'背包系统':'商城系统';
  const sub=placeholderFrom==='inventory'?'装备、道具与消耗品将在这里管理':'充值与商店内容将在这里开放';
  rr(42,230,W-84,420,28); ctx.fillStyle='rgba(17,29,41,.95)'; ctx.fill(); ctx.strokeStyle='rgba(127,216,255,.22)'; ctx.lineWidth=2; rr(42,230,W-84,420,28); ctx.stroke();
  drawUIText(title,W/2,382,'body',{size:34,strokeWidth:3.2});
  drawUIText(sub,W/2,432,'muted',{size:17,strokeWidth:2.1});
  drawUIText('占位功能',W/2,508,'accent',{size:21,strokeWidth:2.7});
  drawUIText('该入口暂不开发',W/2,546,'muted',{size:15,strokeWidth:1.8});
  drawGlobalNav();
}

function drawSectionLabel(text, x, y, accent){
  const c = accent || '#7fd8ff';
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  rr(x, y-22, 8, 30, 4); ctx.fill();
  ctx.fillStyle = c;
  rr(x, y-22, 8, 30, 4); ctx.fill();
  drawUIText(text, x+22, y, 'body', {size:22, align:'left', strokeWidth:2.6});
  ctx.restore();
}

function drawSimpleCatBroIcon(cx,cy,idx,owned){
  ctx.save(); ctx.globalAlpha=owned?1:.35; const coats=['#f2a35b','#222','#d9a0b0','#f5f5f5','#c9b39b','#333','#9a6b4a','#d8a54d','#f4f1e8','#d9c2a2']; const col=coats[idx%coats.length]; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx,cy,42,0,TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx-34,cy-22); ctx.lineTo(cx-42,cy-55); ctx.lineTo(cx-12,cy-35); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx+34,cy-22); ctx.lineTo(cx+42,cy-55); ctx.lineTo(cx+12,cy-35); ctx.closePath(); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-15,cy-4,8,0,TAU); ctx.arc(cx+15,cy-4,8,0,TAU); ctx.fill(); ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(cx-15,cy-4,3,0,TAU); ctx.arc(cx+15,cy-4,3,0,TAU); ctx.fill(); ctx.fillStyle='#e88'; ctx.beginPath(); ctx.arc(cx,cy+12,6,0,TAU); ctx.fill(); ctx.restore();
}

function drawStagePrepScreen(){
  drawAppBackground();
  drawUIScreenFrame({x:18,y:18,w:W-36,h:GLOBAL_NAV_Y-34,alpha:.90});
  drawCurrencyBar(34);
  drawAppTitle('闯 关',W/2,88,40);
  const stage=Math.max(1,Math.min(TOTAL_STAGES,currentPrepStage));
  const stars=stageProgress.stars[stage]||0;

  // 关卡信息
  rr(40,170,W-80,132,22); const ig=ctx.createLinearGradient(40,170,40,302); ig.addColorStop(0,'rgba(27,47,62,.98)'); ig.addColorStop(1,'rgba(12,24,35,.98)'); ctx.fillStyle=ig; ctx.fill(); ctx.strokeStyle='rgba(127,216,255,.30)'; ctx.lineWidth=2; rr(40,170,W-80,132,22); ctx.stroke();
  drawUIText('第 '+stage+' 关',66,218,'body',{size:32,align:'left',strokeWidth:3.3});
  drawUIText(stars ? '最佳 '+('★'.repeat(stars)) : '尚未通关',66,259,stars?'accent':'muted',{size:19,align:'left',strokeWidth:2.2});
  drawUIText('守住城墙 · 击败 Boss',W-66,221,'muted',{size:17,align:'right',strokeWidth:2});
  drawUIText('首通新关卡可获得 1 只未拥有猫小弟',W-66,261,'success',{size:14,align:'right',strokeWidth:2});

  drawSectionLabel('选择关卡',40,344,'#7fd8ff');
  for(let i=0;i<TOTAL_STAGES;i++){
    const n=i+1,col=i%5,row=Math.floor(i/5),x=40+col*128,y=370+row*70; const unlocked=n<=stageProgress.unlockedMax, done=(stageProgress.stars[n]||0)>0;
    rr(x,y,114,56,15); ctx.fillStyle=!unlocked?'rgba(32,43,54,.78)':done?'rgba(91,76,35,.78)':n===stage?'rgba(35,91,79,.90)':'rgba(23,39,53,.90)'; ctx.fill(); ctx.strokeStyle=!unlocked?'rgba(120,140,160,.24)':n===stage?'#7fe0a0':done?'#ffd24a':'rgba(128,183,215,.28)'; ctx.lineWidth=n===stage?2.5:1.5; rr(x,y,114,56,15); ctx.stroke();
    drawUIText(unlocked?String(n):'🔒',x+38,y+36,unlocked?'body':'muted',{size:20,strokeWidth:2.6});
    if(unlocked) drawUIText(done?('★'+(stageProgress.stars[n]||0)):'NEW',x+87,y+36,done?'accent':'muted',{size:12,strokeWidth:2});
  }

  drawSectionLabel('主武器',40,529,'#ffd24a');
  prepWeaponRects=[];
  const weapons=[
    ['catfood','猫粮','扇形弹幕 · 近距离命中率高','#ffd24a'],
    ['laser','激光','持续穿透 · 覆盖能力强','#79e7ff'],
    ['missile','导弹','自动追踪 · 稳定输出','#ff9d63']
  ];
  weapons.forEach((w,i)=>{
    const x=35+i*230,y=554,sel=currentWeapon===w[0];
    rr(x,y,215,156,22); const g=ctx.createLinearGradient(x,y,x,y+156); g.addColorStop(0,sel?'rgba(72,116,129,.32)':'rgba(20,33,46,.94)'); g.addColorStop(1,'rgba(11,21,30,.96)'); ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle=sel?w[3]:'rgba(160,190,210,.20)'; ctx.lineWidth=sel?3:1.5; rr(x,y,215,156,22); ctx.stroke();
    ctx.fillStyle=w[3]; ctx.globalAlpha=.13; ctx.beginPath(); ctx.arc(x+42,y+45,34,0,TAU); ctx.fill(); ctx.globalAlpha=1;
    drawUIText(w[1],x+86,y+48,'body',{size:24,align:'left',strokeWidth:2.8});
    drawUIText(w[2],x+15,y+91,'muted',{size:13,align:'left',strokeWidth:1.8});
    drawUIText(sel?'已选择':'点击选择',x+15,y+131,sel?'success':'muted',{size:14,align:'left',strokeWidth:1.8});
    prepWeaponRects.push({x,y,w:215,h:156,key:w[0]});
  });

  drawSectionLabel('猫小弟部署',40,750,'#7fe0a0');
  drawUIText(catBroDeploy.length+'/3',W-40,750,'accent',{size:21,align:'right',strokeWidth:2.6});
  prepCatRects=[];
  const owned=CATBRO_COLLECTION.filter(c=>isCatBroOwned(c.id));
  if(!owned.length){
    rr(40,775,W-80,116,20); ctx.fillStyle='rgba(18,30,42,.88)'; ctx.fill(); ctx.strokeStyle='rgba(127,216,255,.18)'; ctx.lineWidth=1.5; rr(40,775,W-80,891,20); ctx.stroke();
    drawCatBroArtAt(null, W/2, 824, 78, 0, false);
    drawUIText('暂无猫小弟',W/2,860,'body',{size:20,strokeWidth:2.5});
    drawUIText('首次通关一个尚未通关的关卡后获得',W/2,882,'muted',{size:13,strokeWidth:2});
  } else {
    owned.slice(0,6).forEach((c,i)=>{
      const col=i%3,row=Math.floor(i/3),x=35+col*230,y=775+row*92,dep=catBroDeploy.includes(c.id);
      rr(x,y,215,78,18); ctx.fillStyle=dep?'rgba(101,85,35,.72)':'rgba(17,29,41,.90)'; ctx.fill(); ctx.strokeStyle=dep?'#ffd24a':'rgba(150,185,205,.17)'; ctx.lineWidth=dep?2.5:1.2; rr(x,y,215,78,18); ctx.stroke();
      drawCatBroArtAt(c,x+42,y+39,66,i,true);
      drawUIText(c.name,x+83,y+30,'body',{size:16,align:'left',strokeWidth:2});
      drawUIText(c.skill,x+83,y+55,'muted',{size:12,align:'left',strokeWidth:1.6});
      drawUIText(dep?'已部署':'部署',x+195,y+45,dep?'accent':'body',{size:12,align:'right',strokeWidth:1.7});
      prepCatRects.push({x,y,w:215,h:78,id:c.id});
    });
  }

  prepStartRect={x:W/2-190,y:1010,w:380,h:76};
  drawAppButton({x:W/2,y:1048,w:380,h:76},'开始守城','#7fe0a0','#fff',{fontSize:28,pulse:true});

  stagePrepResetBtnRect={x:40,y:1102,w:190,h:42};
  rr(stagePrepResetBtnRect.x,stagePrepResetBtnRect.y,stagePrepResetBtnRect.w,stagePrepResetBtnRect.h,14);
  ctx.fillStyle='rgba(105,46,56,.32)'; ctx.fill();
  ctx.strokeStyle='rgba(255,125,125,.58)'; ctx.lineWidth=1.5; rr(stagePrepResetBtnRect.x,stagePrepResetBtnRect.y,stagePrepResetBtnRect.w,stagePrepResetBtnRect.h,14); ctx.stroke();
  drawUIText('↺ 清除全部数据',stagePrepResetBtnRect.x+stagePrepResetBtnRect.w/2,stagePrepResetBtnRect.y+27,'danger',{size:14,strokeWidth:1.8});

  // 清档确认弹窗也必须在闯关主界面可见，避免“点了按钮却不知道发生什么”。
  if(mainResetConfirm){
    drawAppOverlay(.82);
    const pw=606,ph=318,px=(W-pw)/2,py=(GLOBAL_NAV_Y-ph)/2-10;
    rr(px,py,pw,ph,28);
    const pg=ctx.createLinearGradient(px,py,px,py+ph); pg.addColorStop(0,'rgba(28,39,52,.99)'); pg.addColorStop(1,'rgba(15,22,31,.99)');
    ctx.fillStyle=pg; ctx.fill(); ctx.strokeStyle='rgba(255,125,125,.78)'; ctx.lineWidth=2.5; rr(px,py,pw,ph,28); ctx.stroke();
    drawUIText('确定清除全部游戏数据？',W/2,py+66,'danger',{size:31,strokeWidth:4});
    drawUIText('关卡、星级、任务、技能点、猫小弟收藏等都会归零',W/2,py+118,'muted',{size:16,strokeWidth:2.2});
    drawUIText('清除后将从第 1 关重新开始',W/2,py+148,'muted',{size:16,strokeWidth:2});
    drawAppButton({x:W/2-112,y:py+237,w:184,h:62},'取消','#7fb8ff','#fff',{fontSize:21});
    drawAppButton({x:W/2+112,y:py+237,w:184,h:62},'确认清除','#ff8a8a','#fff',{fontSize:21});
    mainResetConfirmRects=[
      {x:W/2-112-92,y:py+237-31,w:184,h:62},
      {x:W/2+112-92,y:py+237-31,w:184,h:62}
    ];
  } else mainResetConfirmRects=[];
  drawGlobalNav();
}

function drawUIScreenFrame(opts){
  opts = opts || {};
  const x = opts.x !== undefined ? opts.x : 18;
  const y = opts.y !== undefined ? opts.y : 18;
  const w = opts.w !== undefined ? opts.w : W - 36;
  const h = opts.h !== undefined ? opts.h : GLOBAL_NAV_Y - 34;
  const alpha = opts.alpha !== undefined ? opts.alpha : 0.90;

  ctx.save();
  rr(x, y, w, h, 30);
  const g = ctx.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0, `rgba(12,24,36,${alpha})`);
  g.addColorStop(1, `rgba(7,17,27,${Math.min(0.97, alpha+0.05)})`);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = 'rgba(184,224,236,.28)';
  ctx.lineWidth = 2.4;
  rr(x, y, w, h, 30);
  ctx.stroke();

  rr(x+8, y+8, w-16, h-16, 24);
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 顶部柔和光带，让深色底框不会显得像一块死黑矩形。
  const glow = ctx.createLinearGradient(x+30, y+28, x+w-30, y+28);
  glow.addColorStop(0, 'rgba(100,196,218,0)');
  glow.addColorStop(0.5, 'rgba(100,196,218,.12)');
  glow.addColorStop(1, 'rgba(100,196,218,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x+30, y+26, w-60, 3);
  ctx.restore();
}

function getEnterAnim(delay, dur){
  const p = Math.max(0, Math.min(1, (bootAnimT - delay) / dur));
  const ease = 1 - Math.pow(1 - p, 3);       // ease out cubic
  return {
    alpha:   Math.min(1, p * 1.6),
    offsetY: (1 - ease) * 55,                 // 从下方 55px 滑入
    scale:   0.72 + ease * 0.28               // 0.72 → 1.0
  };
}

function isEndlessUnlocked(){
  return (stageProgress.stars[1] || 0) > 0;
}

function layoutMenuButtons(){
  const MARGIN_BOTTOM = 120;
  const GAP = 16;

  const widths = {
    btn_start:   450,
    btn_history: 300,
    btn_help:    300
  };

  const keys = ['btn_start', 'btn_history', 'btn_help'];
  const rows = [];

  for(const k of keys){
    const spr = SPRITES[k];
    const wTarget = widths[k] || 300;
    let h = 96;
    if(spr && spr.loaded && spr.img){
      h = wTarget * (spr.img.height / spr.img.width);
    }
    rows.push({ key: k, w: wTarget, h: h });
  }

  let totalH = 0;
  for(const r of rows) totalH += r.h;
  totalH += GAP * (rows.length - 1);

  let cy = H - MARGIN_BOTTOM - totalH;
  const rects = [MENU_START_BTN, MENU_LB_BTN, MENU_HELP_BTN];
  for(let i = 0; i < rows.length; i++){
    const r = rows[i];
    const rect = rects[i];
    rect.x = W/2;
    rect.y = cy + r.h / 2;
    rect.w = r.w;
    rect.h = r.h;
    cy += r.h + GAP;
  }
}

function withEnterAnim(cx, cy, a, fn){
  ctx.save();
  ctx.globalAlpha = a.alpha;
  ctx.translate(cx, cy + a.offsetY);
  ctx.scale(a.scale, a.scale);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

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
  drawUIText('点击任意项目查看教学', W/2, 140, 'muted', { size: 16 });

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

    // 右侧箭头（素材）
    const arrowSize = 32;
    UI.drawIcon(
      ctx,
      'icon_arrow',
      x + cardW - 30 - arrowSize / 2,
      y + cardH / 2 - arrowSize / 2,
      arrowSize
    );

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

  const boxW = W - 60;
  const boxH = 680;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  // 无 X 关闭
  drawDialogPanel(boxX, boxY, boxW, boxH, '胜 利 !', {
    titleH: 80, titleSize: 34, noClose: true
  });

  // 通关文案
  drawUITextRich([
    { text: '你已通关全部 ' },
    { text: String(MAX_WAVE), colorKey: 'accent', gold: true },
    { text: ' 波！' }
  ], W/2, boxY + 130, { size: 26 });

  // 存活 · 得分
  drawUITextRich([
    { text: '存活至第 ' },
    { text: String(wave),  colorKey: 'accent', gold: true },
    { text: ' 波  ·  得分 ' },
    { text: String(score), colorKey: 'accent', gold: true }
  ], W/2, boxY + 176, { size: 20 });

  // 伤害统计
  drawDamageStats(W/2, boxY + 220, true);

  // 提问
  drawUIText('要继续挑战无尽模式吗？', W/2, boxY + boxH - 190, 'body', { size: 20 });

  // 两个按钮
  drawAppButton(
    { x: W/2, y: boxY + boxH - 120, w: 300, h: 62 },
    '继 续 战 斗', '#7fe0a0', '#289858', { fontSize: 24 }
  );
  drawAppButton(
    { x: W/2, y: boxY + boxH - 52, w: 300, h: 56 },
    '结算并返回主界面', '#ffb84a', '#c87820', { fontSize: 20 }
  );
}
function returnToMenu(){
  recordRun();
  clearProgress();
  state = 'stagePrep';
  currentPrepStage=Math.max(1,Math.min(TOTAL_STAGES,stageProgress.unlockedMax||1));
  stopBGM();
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
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  const boxW = 520;
  const boxH = 400;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2 - 30;

  const info = drawDialogPanel(boxX, boxY, boxW, boxH, '确认退出', {
    titleH: 72, closeSize: 54, titleSize: 30
  });
  confirmCloseRect = info.closeRect;

  drawUIText('本局将结算并返回主菜单', W/2, boxY + 140, 'body', { size: 20 });

  drawUITextRich([
    { text: '第 ' },
    { text: String(Math.max(1, wave)), colorKey: 'accent', gold: true },
    { text: ' 波  ·  得分 ' },
    { text: String(score),             colorKey: 'accent', gold: true }
  ], W/2, boxY + 188, { size: 22 });

  drawUIText('此操作不可撤销', W/2, boxY + 236, 'muted', { size: 16 });

  const btnW = 160, btnH = 60;
  const btnY = boxY + boxH - 60;

  // ★ 动态更新全局常量，让点击检测用同一份坐标
  CONFIRM_NO_BTN.x  = W/2 - btnW/2 - 10;
  CONFIRM_NO_BTN.y  = btnY;
  CONFIRM_NO_BTN.w  = btnW;
  CONFIRM_NO_BTN.h  = btnH;

  CONFIRM_YES_BTN.x = W/2 + btnW/2 + 10;
  CONFIRM_YES_BTN.y = btnY;
  CONFIRM_YES_BTN.w = btnW;
  CONFIRM_YES_BTN.h = btnH;

  drawAppButton(CONFIRM_NO_BTN,  '取 消', '#7fb8ff', '#3878b8', { fontSize: 24 });
  drawAppButton(CONFIRM_YES_BTN, '确 认', '#ff8fb0', '#c84870', { fontSize: 24 });
}
function drawPauseOverlay(){
  drawAppOverlay(0.85);

  const boxW = W - 60;
  const boxH = 560;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  const info = drawDialogPanel(boxX, boxY, boxW, boxH, '游 戏 暂 停', {
    titleH: 76, closeSize: 56, titleSize: 32
  });
  pauseCloseRect = info.closeRect;

  // ===== 波次·得分：胶囊底 =====
  const pillW = 340;
  const pillH = 68;
  const pillX = W/2 - pillW/2;
  const pillY = boxY + 130;

  rr(pillX, pillY, pillW, pillH, pillH/2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 200, 230, 0.40)';
  ctx.lineWidth = 1.5;
  rr(pillX, pillY, pillW, pillH, pillH/2);
  ctx.stroke();

  drawUITextRich([
    { text: '第 ' },
    { text: String(Math.max(1, wave)), colorKey: 'accent', gold: true },
    { text: ' 波  ·  得分 ' },
    { text: String(score),             colorKey: 'accent', gold: true }
  ], W/2, pillY + pillH/2 + 8, { size: 24 });

  // ===== 按钮：统一尺寸 =====
  const BTN_W = 260;
  const BTN_H = 72;

  RESUME_BTN.x = W/2;
  RESUME_BTN.y = boxY + 310;
  RESUME_BTN.w = BTN_W;
  RESUME_BTN.h = BTN_H;

  RESTART_BTN.x = W/2;
  RESTART_BTN.y = boxY + 430;
  RESTART_BTN.w = BTN_W;
  RESTART_BTN.h = BTN_H;

  drawAppButton(RESUME_BTN,  '继 续',    '#7fe0a0', '#289858', { fontSize: 28 });
  drawAppButton(RESTART_BTN, '退出游戏', '#ff8fb0', '#c84870', { fontSize: 28 });

  drawUIText('按 P 或 Esc 也可继续', W/2, boxY + boxH - 24, 'muted', { size: 14 });
}

// ================= Buff 选择 =================
function drawBuffSelect(){
  const ease = 1 - Math.pow(1 - Math.max(0, buffFadeIn), 3);

  ctx.save();
  ctx.globalAlpha = ease;

  const n = buffChoices.length;

  const CW = 204;
  const CH = 400;
  const GAP = 14;

  // ===== 全屏遮罩 =====
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(0, 0, W, H);

  // ===== 标题横幅 =====
  const bannerW = 440;
  const bannerH = 100;
  const bannerX = (W - bannerW) / 2;
  const bannerY = 300;

  const bannerImg = UI.assets['banner_sub'];
  if(bannerImg){
    ctx.drawImage(bannerImg, bannerX, bannerY, bannerW, bannerH);
  }

  drawUIText('请选择一项强化', W / 2, bannerY + bannerH / 2 + 8, 'body', {
    size: 28,
    strokeWidth: 4
  });

  // ===== 卡片区域 =====
  const cardAreaW = CW * n + GAP * (n - 1);
  const sx = (W - cardAreaW) / 2;
  const sy = bannerY + bannerH + 46;

  buffCards = [];

  // 统一配色（所有卡牌同一个颜色）
  const CARD_BORDER     = '#e8b020';
  const CARD_GLOW       = 'rgba(255, 210, 74, 0.75)';
  const CARD_TAG_BG     = '#e8b020';
  const CARD_TAG_BORDER = '#ffd0a0';

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

    // 武器类型名
    const wtype = BUFF_WEAPON_TYPE[b.id];
    const wname = WEAPON_TYPE_NAMES[wtype] || '通用';

    // ==================== 卡片底 ====================
    rr(x, y, CW, CH, 18);
    const grd = ctx.createLinearGradient(x, y, x, y + CH);
    grd.addColorStop(0, 'rgba(50, 62, 74, 0.98)');
    grd.addColorStop(1, 'rgba(20, 28, 38, 0.98)');
    ctx.fillStyle = grd;
    ctx.fill();

    // 外发光
    ctx.save();
    ctx.shadowColor = CARD_GLOW;
    ctx.shadowBlur = 16 + pulse * 10;
    ctx.strokeStyle = CARD_BORDER;
    ctx.lineWidth = 3;
    rr(x, y, CW, CH, 18);
    ctx.stroke();
    ctx.restore();

    // 顶部高光
    ctx.save();
    rr(x, y, CW, 8, 18);
    ctx.clip();
    const hlGrd = ctx.createLinearGradient(x, y, x + CW, y);
    hlGrd.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    hlGrd.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
    hlGrd.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = hlGrd;
    ctx.fillRect(x, y, CW, 5);
    ctx.restore();

    // ==================== 区域 1：标题 ====================
    const sec1Bot = y + 96;

    drawUIText(b.name, x + CW / 2, y + 48, 'title', {
      size: 26,
      gradient: UI_GRADIENT_GOLD,
      glow: true,
      glowColor: 'rgba(255, 210, 74, 0.55)',
      glowSize: 10
    });

    drawUIText('Lv.' + lv + ' / ' + b.max, x + CW / 2, y + 80, 'muted', { size: 16 });

    ctx.save();
    ctx.strokeStyle = CARD_BORDER;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 28, sec1Bot);
    ctx.lineTo(x + CW - 28, sec1Bot);
    ctx.stroke();
    ctx.restore();

    // ==================== 区域 2：图标 + 右下角武器类型标签 ====================
    const sec2Bot = y + 248;
    const iconCy = (sec1Bot + sec2Bot) / 2;

    // ★ 图标直接绘制，不用底框
    drawBuffIcon(b.id, x + CW / 2, iconCy, 72, b.color || '#ffd24a');

    // 右下角小标签
    {
      const tagW = 56;
      const tagH = 24;
      const tagCx = x + CW / 2 + 40;
      const tagCy = iconCy + 40;
      const tagX = tagCx - tagW / 2;
      const tagY = tagCy - tagH / 2;

      rr(tagX, tagY, tagW, tagH, 8);
      ctx.fillStyle = CARD_TAG_BG;
      ctx.fill();
      ctx.strokeStyle = CARD_TAG_BORDER;
      ctx.lineWidth = 1.5;
      rr(tagX, tagY, tagW, tagH, 8);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wname, tagCx, tagCy + 1);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.save();
    ctx.strokeStyle = CARD_BORDER;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 28, sec2Bot);
    ctx.lineTo(x + CW - 28, sec2Bot);
    ctx.stroke();
    ctx.restore();

    // ==================== 区域 3：描述 ====================
    const boxTop = sec2Bot + 10;
    const boxLeft = x + 14;
    const boxRight = x + CW - 14;
    const boxBottom = y + CH - 12;

    rr(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    rr(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 10);
    ctx.stroke();

    const descAreaY = boxTop + 30;
    const descAreaW = boxRight - boxLeft - 16;
    const descCx = (boxLeft + boxRight) / 2;

    const displayText = getBuffDisplayText(b.id, lv);
    drawRichWrappedTextCenter(
      displayText, descCx, descAreaY, descAreaW, 28, 3, '#ffd24a', 19
    );

    ctx.restore();
  }

  ctx.restore();
}

// ================= 死亡 =================
function drawDeadScreen(){
  drawAppOverlay(0.9);

  const boxW = W - 60;
  const boxH = 700;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  const info = drawDialogPanel(boxX, boxY, boxW, boxH, '喵 星 陨 落', {
    titleH: 76, closeSize: 56, titleSize: 32
  });
  deadCloseRect = info.closeRect;

  drawUITextRich([
    { text: '存活到第 ' },
    { text: String(wave),  colorKey: 'accent', gold: true },
    { text: ' 波  ·  得分 ' },
    { text: String(score), colorKey: 'accent', gold: true }
  ], W/2, boxY + 150, { size: 22 });

  drawDamageStats(W/2, boxY + 210, false);

  // 两个按钮左右并排
  const leftLabel  = (gameMode === 'stage') ? '返回选关' : '退出游戏';
  const rightLabel = '重新开始';
  const leftColor  = (gameMode === 'stage') ? '#7fb8ff' : '#ff8fb0';
  const leftText   = (gameMode === 'stage') ? '#3878b8' : '#c84870';

  drawAppButton(
    { x: W/2 - 105, y: boxY + boxH - 90, w: 180, h: 64 },
    leftLabel, leftColor, leftText, { fontSize: 22 }
  );
  drawAppButton(
    { x: W/2 + 105, y: boxY + boxH - 90, w: 180, h: 64 },
    rightLabel, '#7fe0a0', '#289858', { fontSize: 22 }
  );

  drawUIText('按 R 也可重开', W/2, boxY + boxH - 18, 'muted', { size: 15 });
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
    ctx.font = 'bold 18px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(160, 250, 200, ' + (0.65 + pls * 0.35) + ')';
    ctx.fillText(step.hint || '点击屏幕继续', W/2, ly + 42);

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
  drawUIText(step.title, W/2, panelY + 48, 'title', {
    size: 30,
    gradient: UI_GRADIENT_GOLD,
    glow: true,
    glowColor: 'rgba(255, 210, 74, 0.75)',
    glowSize: 16
  });

  // 描述
  let ly = panelY + 98;
  for(const line of lines){
    drawUIText(line, W/2, ly, 'body', { size: 22 });
    ly += 40;
  }

  // 底部提示（保证在进度点上方至少 28px，避免和点重叠）
  const pulse2 = 0.5 + Math.sin(gameTime * 3) * 0.5;
  const hintY = Math.min(panelY + panelH - 30, H - 70);
  drawUIText(step.hint || '点击屏幕继续', W/2, hintY, 'success', {
    size: 18,
    alpha: 0.65 + pulse2 * 0.35
  });

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
    const warnY = H * 0.22 + Math.sin(gameTime * 8) * 4;
    drawUIText('⚠ 血量危险！', W/2, warnY, 'danger', {
      size: 32,
      scale: 1 + pulse * 0.08,
      glow: true,
      glowColor: 'rgba(255, 80, 80, 0.95)',
      glowSize: 22 + pulse * 14
    });
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
  if(state === 'catselect'){ drawCatSelectScreen(); drawGlobalNav(); return; }
  if(state === 'stagePrep'){ drawStagePrepScreen(); return; }
  if(state === 'home'){ drawHomeScreen(); return; }
  if(state === 'placeholder'){ drawPlaceholderScreen(); return; }
  if(state === 'catbroCollection'){ drawCatBroCollectionScreen(); drawGlobalNav(); return; }
  if(state === 'stageSelect'){ drawStageSelectScreen(); drawGlobalNav(); return; }
  if(state === 'weaponSelect'){ drawWeaponSelect(); drawGlobalNav(); return; }
  if(state === 'tasks'){ drawTasksScreen(); return; }
  if(state === 'skillTree'){ drawSkillTreeScreen(); return; }
  if(state === 'help'){ drawHelpScreen(); drawGlobalNav(); return; }
  if(state === 'leaderboard' && lbFrom === 'menu'){ drawLeaderboardScreen(); drawGlobalNav(); return; }

  if(!player) return;

  let sx = 0, sy = 0;
  if(cam.shake > 0.2){
    sx = rand(-cam.shake, cam.shake);
    sy = rand(-cam.shake, cam.shake);
  }

  ctx.save();
  ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);

  drawGround();
  if(currentStage >= 1) drawCastleDefense();
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

  // Boss4 地面预警绘制
  for(const w of bossWarnings){
    const p = 1 - w.t / w.maxT;
    const pulse = 0.55 + Math.sin(gameTime*16) * 0.25;
    ctx.save();
    ctx.globalAlpha = 0.20 + pulse * 0.25;
    ctx.fillStyle = '#ff4f4f';
    ctx.beginPath(); ctx.arc(w.x,w.y,w.r*(0.82+0.10*p),0,TAU); ctx.fill();
    ctx.globalAlpha = 0.75 + pulse*0.2;
    ctx.strokeStyle = '#ffcf5c'; ctx.lineWidth = 5;
    ctx.setLineDash([12,8]);
    ctx.beginPath(); ctx.arc(w.x,w.y,w.r,0,TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  renderEntityList.length = 0;
  for(const e of enemies) renderEntityList.push({ y: e.y, kind: 0, obj: e });
  renderEntityList.push({ y: player.y, kind: 1, obj: player });
  for(const bro of catBros) renderEntityList.push({ y: bro.y, kind: 2, obj: bro });
  renderEntityList.sort((a, b) => a.y - b.y);
  for(const item of renderEntityList){
    if(item.kind === 0) drawEnemy(item.obj);
    else if(item.kind === 1) drawCat();
    else drawOneCatBro(item.obj);
  }

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
    const bossShot=!!b.isBossBullet;
    const enemyShot=!!b.enemyShot;
    const col=bossShot?'#ff4a4a':(enemyShot?'#c45cff':'#a34fe0');
    const glow=bossShot?'rgba(255,110,70,.28)':(enemyShot?'rgba(196,92,255,.25)':'rgba(163,79,224,.22)');
    const speed=Math.hypot(b.vx,b.vy)||1;
    const tx=b.x-b.vx/speed*18, ty=b.y-b.vy/speed*18;
    ctx.save();
    ctx.strokeStyle=glow; ctx.lineWidth=b.r*1.15; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
    ctx.fillStyle=bossShot?'rgba(255,210,170,.95)':'rgba(235,190,255,.92)';
    ctx.beginPath(); ctx.arc(b.x-2,b.y-2,b.r*.42,0,TAU); ctx.fill();
    ctx.restore();
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

  if(state === 'support'){
    drawHUD();
    drawSupportStrikeOverlay();
    drawLowHpWarning();
    drawAudioDebug();
    return;
  }
  else if(state === 'buff') drawBuffSelect();
  else if(state === 'paused'){ drawHUD(); drawPauseOverlay(); }
  else if(state === 'confirm'){ drawHUD(); drawPauseOverlay(); drawConfirmRestart(); }
  else if(state === 'leaderboard'){ drawLeaderboardScreen(); }
  else if(state === 'victory'){ drawVictoryScreen(); }
  else if(state === 'stageVictory'){ drawStageVictoryScreen(); }
  else {
    drawHUD();
    if(state === 'dead') drawDeadScreen();
    if(state === 'tutorial') drawTutorialScreen();
  }

  // 低血量警告（叠在 HUD 之上）
  drawLowHpWarning();

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

loadStageProgress();
loadTaskState();
loadLeaderboard();
loadCatPref();
loadCatBroCollection();
loadWeaponUnlock();
loadCurrency();
loadSkillTree();
gameTime = 0;
state = 'boot';
menuInit();
requestAnimationFrame(loop);

})();
