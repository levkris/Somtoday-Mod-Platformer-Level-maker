let level = {
  title: 'New Level',
  description: '',
  song: '',
  worldWidth: 3000,
  worldHeight: 1400,
  spawnX: 60,
  spawnY: 120,
  bgColor: '#1a0806',
  bgColor2: '#0e0302',
  bgTexture: '',
  bgTextureMode: 'tile',
  bgTextureAlpha: 1,
};

let objects = [];
let groups = {};
let selSet = new Set();
let tool = 'select';
let zoom = 1;
let pan = { x: 40, y: 40 };
let dragging = false;
let dragType = null;
let ds = { cx: 0, cy: 0, ox: 0, oy: 0, ow: 0, oh: 0, panX: 0, panY: 0, boxX: 0, boxY: 0, _starts: null, _boxEndX: 0, _boxEndY: 0 };
let placeType = null;
let showGrid = true;
let snapSize = 20;
let undoStack = [];
let redoStack = [];
let spaceHeld = false;
let clipboard = null;
let textures = {};
let texImgCache = {};
let idCtr = 1;
let mwx = 0;
let mwy = 0;
let pickMode = null;
let boxActive = false;
let renamingGroupId = null;
let pendingRestore = null;
let _saveTimer = null;

function mkId() { return idCtr++; }

function defaultObj(type) {
  const base = {
    type, _id: mkId(), name: '', ghost: false,
    texture: '', textureMode: 'tile', textureFrames: 1, textureFps: 8,
    rotation: 0, invertX: false, invertY: false,
  };
  const D = {
    floor:               { x: 0, y: 0, w: 200, h: 40, oneWay: false },
    wall:                { x: 0, y: 0, w: 40, h: 200, opaque: false, keyId: '', keyColor: '#ffd700', keyhole: 'visible', closeOnAreaId: '', riseWithId: '', riseYOnly: false, riseYOffset: 0, textureGhost: '' },
    lava:                { x: 0, y: 0, w: 200, h: 60, flowUp: false, flowSpeed: 80, flowDuration: 0, flowAreaId: '', riseId: '' },
    trampoline:          { x: 0, y: 0, w: 80, h: 20, strength: 2.5 },
    enemy:               { x: 0, y: 0, w: 50, h: 50, min: '', max: '', detectionRadius: 200, stuck: false },
    orb:                 { x: 0, y: 0, r: 20, strength: 2.5 },
    movingPlatformUp:    { x: 0, y: 0, w: 120, h: 20, startY: 0, endY: 300, triggerMode: false, triggerTimeout: 1, returnTimeout: 2, oneWay: false },
    movingPlatformRight: { x: 0, y: 0, w: 120, h: 20, startX: 0, endX: 300, oneWay: false },
    coin:                { x: 0, y: 0, r: 14, blue: false },
    key:                 { x: 0, y: 0, r: 16, keyId: 'key_1', color: '#ffd700' },
    checkpoint:          { x: 0, y: 0 },
    end:                 { x: 0, y: 0, w: 200, h: 100 },
    text:                { x: 0, y: 0, content: 'Sample text', color: '#ffffff', font: '20px sans-serif', ghost: false },
    portal:              { x: 0, y: 0, w: 40, h: 200, 'portal-id': 'p1', 'to-portal-id': 'p2' },
    area:                { x: 0, y: 0, w: 300, h: 300, id: 'area1', checkpointX: '', checkpointY: '' },
    camera:              { x: 0, y: 0, areaId: 'area1', lockX: false, lockY: false, targetCamX: '', targetCamY: '' },
    music:               { x: 0, y: 0, areaId: 'area1', song: '', fadeDuration: 1.5, restartOnDie: false },
    enemySpawner:        { x: 0, y: 0, w: 50, h: 50, areaId: 'area1', count: 5, spread: 50, detectionRadius: 400, speed: 300, stuck: false },
    despawnEnemies:      { x: 0, y: 0, areaId: 'area1', spawnerAreaId: 'area1' },
  };
  return Object.assign({}, base, D[type] || {});
}

function gameRect(o) {
  if (o.type === 'orb' || o.type === 'coin' || o.type === 'key') {
    const r = o.r || 16;
    return { x: (o.x || 0) - r, y: (o.y || 0) - r, w: r * 2, h: r * 2 };
  }
  if (o.type === 'checkpoint') return { x: o.x || 0, y: o.y || 0, w: 14, h: 80 };
  if (o.type === 'movingPlatformUp') return { x: o.x || 0, y: o.startY || 0, w: o.w || 120, h: o.h || 20 };
  if (o.type === 'movingPlatformRight') return { x: o.startX || 0, y: o.y || 0, w: o.w || 120, h: o.h || 20 };
  if (['camera', 'music', 'despawnEnemies'].includes(o.type)) return { x: (o.x || 0) - 16, y: (o.y || 0) - 16, w: 32, h: 32 };
  return { x: o.x || 0, y: o.y || 0, w: o.w || 100, h: o.h || 40 };
}

function scrRect(o) {
  const g = gameRect(o);
  const c = g2c(g.x, g.y, g.h);
  return { x: c.x, y: c.y, w: g.w * zoom, h: g.h * zoom };
}

function selBounds() {
  if (selSet.size < 2) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  selSet.forEach(o => {
    const g = gameRect(o);
    x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y);
    x2 = Math.max(x2, g.x + g.w); y2 = Math.max(y2, g.y + g.h);
  });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const RESIZABLE = ['floor','wall','lava','trampoline','end','portal','area','movingPlatformUp','movingPlatformRight','orb','coin','key','enemySpawner'];

function canResize(o) { return selSet.size <= 1 && RESIZABLE.includes(o.type); }

function applyRect(o, nx, ny, nw, nh, moveX, moveY) {
  const MIN = 4;
  nw = Math.max(MIN, nw);
  nh = Math.max(MIN, nh);
  if (o.type === 'orb' || o.type === 'coin' || o.type === 'key') {
    o.x = sn(nx + nw / 2); o.y = sn(ny + nh / 2); o.r = Math.round((nw + nh) / 4);
    return;
  }
  if (o.type === 'movingPlatformUp') {
    if (moveX) o.x = sn(nx);
    o.startY = sn(ny); o.w = sn(nw); o.h = sn(nh);
    return;
  }
  if (o.type === 'movingPlatformRight') {
    o.startX = sn(nx);
    if (moveY) o.y = sn(ny);
    o.w = sn(nw); o.h = sn(nh);
    return;
  }
  if (['camera', 'music', 'despawnEnemies'].includes(o.type)) {
    if (moveX) o.x = sn(nx + nw / 2);
    if (moveY) o.y = sn(ny + nh / 2);
    return;
  }
  if (o.type !== 'checkpoint') { o.w = sn(nw); o.h = sn(nh); }
  if (moveX) o.x = sn(nx);
  if (moveY) o.y = sn(ny);
}

// Game coords: Y increases upward. Screen coords: Y increases downward.
function g2c(gx, gy, gh) {
  return { x: pan.x + gx * zoom, y: pan.y + (level.worldHeight - gy - (gh || 0)) * zoom };
}
function s2g(sx, sy) {
  return { x: (sx - pan.x) / zoom, y: level.worldHeight - ((sy - pan.y) / zoom) };
}
function sn(v) {
  return document.getElementById('snap-chk').checked ? Math.round(v / snapSize) * snapSize : Math.round(v);
}

function primarySel() { return selSet.size === 1 ? [...selSet][0] : null; }

function pushUndo() {
  undoStack.push({
    o: JSON.parse(JSON.stringify(objects)),
    l: Object.assign({}, level),
    g: JSON.parse(JSON.stringify(groups)),
  });
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  debouncedSave();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push({ o: JSON.parse(JSON.stringify(objects)), l: Object.assign({}, level), g: JSON.parse(JSON.stringify(groups)) });
  const s = undoStack.pop();
  objects = s.o; level = s.l; groups = s.g || {};
  selSet = new Set();
  refresh();
  debouncedSave();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push({ o: JSON.parse(JSON.stringify(objects)), l: Object.assign({}, level), g: JSON.parse(JSON.stringify(groups)) });
  const s = redoStack.pop();
  objects = s.o; level = s.l; groups = s.g || {};
  selSet = new Set();
  refresh();
  debouncedSave();
}

function parseSegs(html, bold, color) {
  const segs = [];
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  function walk(node, b, c) {
    if (node.nodeType === 3) {
      if (node.nodeValue) segs.push({ t: node.nodeValue, bold: b, color: c });
    } else if (node.nodeType === 1) {
      const tn = node.tagName.toLowerCase();
      node.childNodes.forEach(ch => walk(ch, b || tn === 'b', TAG_COLORS[tn] !== undefined ? TAG_COLORS[tn] : c));
    }
  }
  walk(tmp, bold, color);
  return segs;
}

function blendDoor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + Math.round(r * .22 + 60) + ',' + Math.round(g * .22 + 60) + ',' + Math.round(b * .22 + 60) + ')';
  } catch (e) { return '#555'; }
}
