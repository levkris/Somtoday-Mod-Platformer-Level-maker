let _testActive = false;
let _testCanvas = null;
let _testCtx = null;
let _testAlive = false;
let _testAnimId = null;
let _testStopMusic = null;

function startTestPlay() {
  if (_testActive) { stopTestPlay(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'test-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:5000;display:flex;flex-direction:column;';

  const topBar = document.createElement('div');
  topBar.style.cssText = 'height:40px;background:#0f1628;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;padding:0 14px;gap:10px;flex-shrink:0;';
  topBar.innerHTML = `
    <span style="color:#fce512;font-weight:800;font-size:13px;font-family:sans-serif">▶ Test Play</span>
    <span style="color:#64748b;font-size:11px;font-family:monospace" id="test-status">Running...</span>
    <div style="flex:1"></div>
    <span style="color:#64748b;font-size:10px;font-family:monospace">ESC or click × to stop</span>
    <button id="test-stop-btn" style="background:rgba(252,64,64,0.15);border:1px solid rgba(252,64,64,0.4);color:#fc4040;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;font-family:sans-serif;">✕ Stop</button>
  `;
  overlay.appendChild(topBar);

  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1;overflow:hidden;position:relative;';
  const tc = document.createElement('canvas');
  tc.id = 'test-canvas';
  tc.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);';
  canvasWrap.appendChild(tc);
  overlay.appendChild(canvasWrap);
  document.body.appendChild(overlay);

  _testCanvas = tc;
  _testCtx = tc.getContext('2d');
  _testActive = true;

  document.getElementById('test-stop-btn').addEventListener('click', stopTestPlay);

  runEngine(tc, _testCtx, overlay);
}

function stopTestPlay() {
  if (_testStopMusic) { _testStopMusic(); _testStopMusic = null; }
  _testAlive = false;
  _testActive = false;
  if (_testAnimId) cancelAnimationFrame(_testAnimId);
  const overlay = document.getElementById('test-overlay');
  if (overlay) overlay.remove();
  _testCanvas = null;
  _testCtx = null;
}

function runEngine(canvas, ctx, overlay) {
  const lvlData = JSON.parse(JSON.stringify(level));
  const objData = JSON.parse(JSON.stringify(objects));

  const PW = 49, PH = 49;
  const GRAV = 1800;
  const JUMP_V = 620;
  const SPEED = 300;
  const MAX_FALL = -1400;
  const DEATH_DUR = 0.7;
  const DOOR_SLIDE_SPEED = 4;
  const FLAG_W = 14, FLAG_H = 80;
  const PORTAL_COOLDOWN = 0.4;

  const textureCache = {};

  function resolveTexKey(texPath) {
    if (!texPath) return null;
    if (textures[texPath]) return texPath;
    const norm = s => s.toLowerCase().replace(/\\/g, '/');
    const p = norm(texPath);
    let best = null, bestScore = 0;
    Object.keys(textures).forEach(name => {
      const n = norm(name);
      const ne = n.replace(/\.[^.]+$/, '');
      let score = 0;
      if (p === n || p.endsWith('/' + n)) score = 100;
      else if (p.endsWith(ne) || p.endsWith('/' + ne)) score = 90;
      else {
        const pp = p.split('/'), np = ne.split('/');
        for (let i = 1; i <= Math.min(pp.length, np.length); i++) {
          if (pp[pp.length - i] === np[np.length - i]) score += 10;
          else break;
        }
        if (p.includes(ne.split('/').pop())) score += 5;
      }
      if (score > bestScore) { bestScore = score; best = name; }
    });
    return bestScore >= 5 ? best : null;
  }

  function loadTexture(key) {
    if (!key) return null;
    const resolved = resolveTexKey(key);
    if (!resolved) return null;
    if (textureCache[resolved]) return textureCache[resolved];
    const dataUrl = textures[resolved];
    if (!dataUrl) return null;
    const img = new Image();
    img.src = dataUrl;
    const entry = { img, pat: null };
    img.onload = () => { entry.pat = ctx.createPattern(img, 'repeat'); };
    textureCache[resolved] = entry;
    return entry;
  }

  function parseLvl(lvlData, objData) {
    const l = {
      title: lvlData.title || '',
      description: '',
      song: lvlData.song || null,
      worldWidth: lvlData.worldWidth || 3000,
      worldHeight: lvlData.worldHeight || 1400,
      spawnX: lvlData.spawnX || 60,
      spawnY: lvlData.spawnY || 120,
      floors: [], walls: [], lavas: [],
      trampolines: [], enemies: [], orbs: [],
      mpUp: [], mpRight: [], coins: [], checkpoints: [],
      texts: [], portals: [], ends: [],
      keys: [], areas: [], cameras: [], musicTriggers: [],
      enemySpawners: [], despawnTriggers: [], drawOrder: [],
      bgColor: lvlData.bgColor || null,
      bgColor2: lvlData.bgColor2 || null,
      bgTexture: lvlData.bgTexture || null,
      bgTextureMode: lvlData.bgTextureMode || 'tile',
      bgTextureAlpha: lvlData.bgTextureAlpha != null ? lvlData.bgTextureAlpha : 1,
      _bgBaked: null, _bgBakedW: 0, _bgBakedH: 0,
    };

    objData.forEach(o => {
      const x = o.x || 0, y = o.y || 0;
      const w = o.w || o.width || 100, h = o.h || o.height || 40;
      const ghost = !!o.ghost;
      const oneWay = !!o.oneWay;
      const texture = o.texture || null;
      const textureMode = o.textureMode || 'tile';
      const textureFrames = o.textureFrames || 1;
      const textureFps = o.textureFps || 8;
      const rotation = o.rotation || 0;
      const invertX = !!o.invertX;
      const invertY = !!o.invertY;
      const baseObj = { ghost, texture, textureMode, textureFrames, textureFps, rotation, invertX, invertY, tex: null };

      if (o.type === 'floor') {
        const obj = { type: 'floor', x, y, w, h, oneWay, ...baseObj };
        l.floors.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'wall') {
        const obj = { type: 'wall', x, y, w, h, opaque: !!o.opaque, textureGhost: o.textureGhost || null, texGhost: null, playerOverlap: false,
          keyId: o.keyId || null, keyColor: o.keyColor || '#ffd700', keyholeVisible: o.keyhole !== 'invisible',
          doorOpen: false, doorSlide: 0, doorDir: 0,
          closeOnAreaId: o.closeOnAreaId || null, areaCloseSlide: o.closeOnAreaId ? 1 : 0, areaCloseDir: 0,
          riseWithId: o.riseWithId || null, riseYOnly: !!o.riseYOnly, riseYOffset: o.riseYOffset || 0,
          riseCurrentY: y, riseCurrentH: h, ...baseObj };
        l.walls.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'lava') {
        const obj = { type: 'lava', x, y, w, h, flowUp: !!o.flowUp, flowSpeed: o.flowSpeed || 50, flowDuration: o.flowDuration || 0,
          flowAreaId: o.flowAreaId || null, riseId: o.riseId || null, currentH: h, flowTimer: 0, flowing: !!o.flowUp && !o.flowAreaId, ...baseObj };
        l.lavas.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'trampoline') {
        const obj = { type: 'trampoline', x, y, w, h, strength: o.strength || 2.5, ...baseObj };
        l.trampolines.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'enemy') {
        const n1 = Math.floor(Math.random() * 5) + 1;
        let n2 = Math.floor(Math.random() * 10);
        if (n1 === 5 && n2 >= 5) n2 = 4;
        const obj = { type: 'enemy', x, y, w: 50, h: 50, startX: x, startY: y,
          min: o.min != null && o.min !== '' ? o.min : null,
          max: o.max != null && o.max !== '' ? o.max : null,
          detectionR: o.detectionRadius || 200, detected: false, label: `${n1},${n2}`,
          stuck: !!o.stuck, vy: 0, onGround: false, ...baseObj };
        l.enemies.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'orb') {
        const obj = { type: 'orb', x, y, r: o.r || 20, strength: o.strength || 2.5, actTimer: 0, ...baseObj };
        l.orbs.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'movingPlatformUp') {
        const obj = { type: 'mpUp', x, w, h, startY: o.startY || y, endY: o.endY || y + 300, cy: o.startY || y, dir: 1,
          triggerMode: !!o.triggerMode, triggerTimeout: o.triggerTimeout || 1, returnTimeout: o.returnTimeout || 2,
          triggerTimer: 0, returnTimer: 0, triggerState: 'idle', oneWay, ...baseObj };
        l.mpUp.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'movingPlatformRight') {
        const obj = { type: 'mpRight', y, w, h, startX: o.startX || x, endX: o.endX || x + 300, cx: o.startX || x, dir: 1, oneWay, ...baseObj };
        l.mpRight.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'coin') {
        const obj = { type: 'coin', x, y, r: o.r || 14, collected: false, bobTimer: Math.random() * Math.PI * 2, blue: !!o.blue, ...baseObj };
        l.coins.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'checkpoint') {
        l.checkpoints.push({ type: 'checkpoint', x, y, activated: false });
        l.drawOrder.push(l.checkpoints[l.checkpoints.length - 1]);
      } else if (o.type === 'end') {
        l.ends.push({ type: 'end', x, y, w, h });
      } else if (o.type === 'text') {
        const fam = o.fontFamily || 'sans-serif';
        const sz = o.fontSize || 20;
        const bold = !!o.bold;
        const baseColor = o.color || '#ffffff';
        const TAG_COLORS_L = { y: '#fce512', r: '#fc1212', g: '#4caf50', bl: '#5b9cf6', o: '#fc9312', p: '#c084fc', w: '#ffffff', gray: '#9b9b9c' };
        const rawContent = o._rawContent || o.content || '';
        function parseSegsLocal(htmlStr, isBold, color) {
          const segs = [];
          const tmp = document.createElement('div');
          tmp.innerHTML = htmlStr;
          function walk(node, b, c) {
            if (node.nodeType === 3) { if (node.nodeValue) segs.push({ text: node.nodeValue, bold: b, color: c }); }
            else if (node.nodeType === 1) {
              const tn2 = node.tagName.toLowerCase();
              const newBold = b || tn2 === 'b';
              const newColor = TAG_COLORS_L[tn2] !== undefined ? TAG_COLORS_L[tn2] : c;
              node.childNodes.forEach(ch => walk(ch, newBold, newColor));
            }
          }
          walk(tmp, isBold, color);
          return segs;
        }
        const segments = rawContent ? parseSegsLocal(rawContent, bold, baseColor) : [{ text: o.content || '', bold, color: baseColor }];
        l.texts.push({ type: 'text', x, y, segments, fontFamily: fam, fontSize: sz, bold, ghost });
        l.drawOrder.push(l.texts[l.texts.length - 1]);
      } else if (o.type === 'portal') {
        const obj = { type: 'portal', x, y, w, h, portalId: o['portal-id'] || null, toPortalId: o['to-portal-id'] || null, cooldown: 0, ...baseObj };
        l.portals.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'key') {
        const obj = { type: 'key', x, y, origX: x, origY: y, r: o.r || 16, keyId: o.keyId || 'key', keyColor: o.color || '#ffd700', collected: false, bobTimer: Math.random() * Math.PI * 2, ghost, _swapLocked: false };
        l.keys.push(obj); l.drawOrder.push(obj);
      } else if (o.type === 'area') {
        l.areas.push({ type: 'area', x, y, w, h, areaId: o.id || `area_${Math.random()}`,
          checkpointX: o.checkpointX != null && o.checkpointX !== '' ? parseFloat(o.checkpointX) : null,
          checkpointY: o.checkpointY != null && o.checkpointY !== '' ? parseFloat(o.checkpointY) : null,
          triggered: false });
      } else if (o.type === 'camera') {
        l.cameras.push({ type: 'camera', areaId: o.areaId || null, lockX: !!o.lockX, lockY: !!o.lockY,
          targetCamX: o.targetCamX != null && o.targetCamX !== '' ? parseFloat(o.targetCamX) : null,
          targetCamY: o.targetCamY != null && o.targetCamY !== '' ? parseFloat(o.targetCamY) : null });
      } else if (o.type === 'music') {
        l.musicTriggers.push({ areaId: o.areaId || null, song: o.song || null, fadeDuration: o.fadeDuration || 1.5, fired: false, restartOnDie: !!o.restartOnDie });
      } else if (o.type === 'enemySpawner') {
        if (!l.enemySpawners) l.enemySpawners = [];
        l.enemySpawners.push({ areaId: o.areaId || null, count: o.count || 1, spawnX: x, spawnY: y, spread: o.spread || 0,
          min: o.min != null ? o.min : null, max: o.max != null ? o.max : null,
          detectionR: o.detectionRadius || 200, stuck: !!o.stuck, ghost, texture: o.texture || null,
          textureMode: o.textureMode || 'tile', textureFrames: o.textureFrames || 1, textureFps: o.textureFps || 8,
          speed: o.speed || 100, fired: false, _pendingSpawns: 0, _spawnTimer: 0, _waitingForExit: false });
      } else if (o.type === 'despawnEnemies') {
        l.despawnTriggers.push({ areaId: o.areaId || null, spawnerAreaId: o.spawnerAreaId || null, fired: false });
      }
    });

    for (const obj of [...l.floors, ...l.walls, ...l.lavas, ...l.trampolines, ...l.enemies, ...l.orbs, ...l.mpUp, ...l.mpRight, ...l.coins, ...l.portals]) {
      if (obj.texture) {
        obj.tex = loadTexture(obj.texture);
      }
    }

    if (l.bgTexture) {
      l._bgTexEntry = loadTexture(l.bgTexture);
    }

    return l;
  }

  const parsedLvl = parseLvl(lvlData, objData);

  function resizeCanvas() {
    canvas.width = Math.min(window.innerWidth, 2600);
    canvas.height = canvas.parentElement.clientHeight;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    parsedLvl._bgBaked = null;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let px = parsedLvl.spawnX, py = parsedLvl.spawnY;
  let vx = 0, vy = 0;
  let onGround = false;
  let phase = 'playing';
  let camX = 0, camY = 0;
  let elapsed = 0;
  let jumpQ = false;
  let jumpAnim = 0, landAnim = 0;
  let snapCam = true;
  let checkpointHistory = [];
  let portalCooldownTimer = 0;
  let deathTimer = 0;
  let deathSlices = [];
  let standingOn = null;
  let heldKey = null;
  let sessionCoins = 0;
  let doorMsg = null;
  let coinPopups = [];
  let lastTs = null;
  let noclip = false;

  const KEY = {};
  _testAlive = true;

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  function onKeyDown(e) {
    if (['ArrowDown', 'ArrowUp', 'Space'].includes(e.code) && _testActive) e.preventDefault();
    KEY[e.code] = true;
    if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) jumpQ = true;
    if (e.code === 'Escape' && _testActive) { stopTestPlay(); return; }
    if (e.code === 'KeyN') noclip = !noclip;
  }
  function onKeyUp(e) { KEY[e.code] = false; }

  overlay.addEventListener('remove', cleanup);

  function cleanup() {
    _testAlive = false;
    _testStopMusic = null;
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', resizeCanvas);
    stopMusic();
  }

  let musicAudio = null;
  let musicFading = null;
  let currentSong = null;

  function _killAudio(a) {
    if (!a) return;
    try { a.pause(); a.src = ''; } catch(e) {}
  }

  function _killFading() {
    if (!musicFading) return;
    _killAudio(musicFading.outAudio);
    _killAudio(musicFading.inAudio);
    musicFading = null;
  }

  function stopMusic() {
    currentSong = null;
    _killFading();
    _killAudio(musicAudio);
    musicAudio = null;
  }

  _testStopMusic = stopMusic;

  function getSongDataUrl(name) {
    if (!name) return null;
    if (songs[name]) return songs[name];
    const norm = s => s.toLowerCase().replace(/\\/g, '/');
    const n = norm(name);
    const ne = n.replace(/\.[^.]+$/, '');
    let best = null, bestScore = 0;
    Object.keys(songs).forEach(key => {
      const k = norm(key);
      const ke = k.replace(/\.[^.]+$/, '');
      let score = 0;
      if (n === k || n.endsWith('/' + k)) score = 100;
      else if (ne === ke || n.endsWith('/' + ke) || ne.endsWith('/' + ke)) score = 90;
      else if (k.includes(ne.split('/').pop()) || ne.includes(ke.split('/').pop())) score = 50;
      if (score > bestScore) { bestScore = score; best = key; }
    });
    return bestScore > 0 ? songs[best] : null;
  }

  function playMusic(name) {
    currentSong = name;
    _killFading();
    _killAudio(musicAudio);
    musicAudio = null;
    if (!name) return;
    const dataUrl = getSongDataUrl(name);
    if (!dataUrl) return;
    try {
      musicAudio = new Audio(dataUrl);
      musicAudio.loop = true;
      musicAudio.volume = 0.7;
      musicAudio.play().catch(() => {});
    } catch(e) {}
  }

  function fadeMusicTo(name, duration) {
    duration = Math.max(0.05, duration || 1.5);
    currentSong = name;
    const outAudio = musicFading ? musicFading.inAudio : musicAudio;
    if (musicFading) { _killAudio(musicFading.outAudio); musicFading = null; }
    musicAudio = null;
    let inAudio = null;
    if (name) {
      const dataUrl = getSongDataUrl(name);
      if (dataUrl) {
        try {
          inAudio = new Audio(dataUrl);
          inAudio.loop = true;
          inAudio.volume = 0;
          inAudio.play().catch(() => {});
        } catch(e) {}
      }
    }
    musicFading = { outAudio, inAudio, timer: 0, duration };
  }

  function updateMusicFade(dt) {
    if (!musicFading) return;
    musicFading.timer += dt;
    const t = Math.min(1, musicFading.timer / musicFading.duration);
    if (musicFading.outAudio) musicFading.outAudio.volume = 0.7 * (1 - t);
    if (musicFading.inAudio) musicFading.inAudio.volume = 0.7 * t;
    if (t >= 1) {
      _killAudio(musicFading.outAudio);
      musicAudio = musicFading.inAudio;
      musicFading = null;
    }
  }

  if (parsedLvl.song) playMusic(parsedLvl.song);

  const COL = { floor: '#9b9b9c', wall: '#9b9b9c', lava: '#fc9312', tramp: '#1264fc', enemy: '#fc1212', coin: '#ffd700', coinShine: '#fff8a0', coinShadow: '#b8860b', orbCore: '#fce512', orbRing: '#eaecd1' };

  function hit(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

  function circleRectHit(cx2, cy2, radius, rx, ry, rw, rh) {
    const clX = Math.max(rx, Math.min(cx2, rx + rw));
    const clY = Math.max(ry, Math.min(cy2, ry + rh));
    const dx = cx2 - clX, dy = cy2 - clY;
    return dx * dx + dy * dy < radius * radius;
  }

  function wx(x) { return x - camX; }
  function wy(y, h) { return parsedLvl.worldHeight - y - h - camY; }

  function getDoorEffectiveRect(wl) {
    if (!wl.keyId) return { x: wl.x, y: wl.y, w: wl.w, h: wl.h };
    const slideOffset = wl.doorSlide * wl.h;
    return { x: wl.x, y: wl.y + slideOffset, w: wl.w, h: wl.h * (1 - wl.doorSlide) };
  }

  function getAreaCloseRect(wl) {
    if (!wl.closeOnAreaId) return { x: wl.x, y: wl.y, w: wl.w, h: wl.h };
    const vis = 1 - wl.areaCloseSlide;
    return { x: wl.x, y: wl.y, w: wl.w, h: wl.h * vis };
  }

  function getCurrentCheckpoint() {
    return checkpointHistory.length > 0 ? checkpointHistory[checkpointHistory.length - 1] : null;
  }

  function captureCollectedSnapshot() {
    const snap = new Set();
    parsedLvl.coins.forEach((co, i) => { if (co.collected) snap.add(i); });
    return snap;
  }

  function captureKeySnapshot() {
    const collectedKeys = new Set();
    parsedLvl.keys.forEach((k, i) => { if (k.collected) collectedKeys.add(i); });
    return { collectedKeys, heldKey: heldKey ? { ...heldKey } : null };
  }

  function captureDoorSnapshot() {
    const snap = {};
    parsedLvl.walls.forEach((w, i) => {
      if (w.keyId) snap[i] = { doorOpen: w.doorOpen, doorSlide: w.doorSlide };
    });
    return snap;
  }

  function captureAreaSnapshot() {
    return parsedLvl.areas.map(a => ({ triggered: a.triggered }));
  }

  function captureLavaSnapshot() {
    return parsedLvl.lavas.map(lv => ({ currentH: lv.currentH, flowTimer: lv.flowTimer, flowing: lv.flowing }));
  }

  function updateCam() {
    let tx = px + PW / 2 - canvas.width / 2;
    let ty = parsedLvl.worldHeight - (py + PH / 2) - canvas.height / 2;

    for (const cam of parsedLvl.cameras) {
      if (!cam.areaId) continue;
      const area = parsedLvl.areas.find(a => a.areaId === cam.areaId);
      if (!area) continue;
      const inArea = px + PW > area.x && px < area.x + area.w && py + PH > area.y && py < area.y + area.h;
      if (!inArea) continue;
      if (cam.lockX && cam.targetCamX !== null) tx = cam.targetCamX - canvas.width / 2;
      if (cam.lockY && cam.targetCamY !== null) ty = parsedLvl.worldHeight - cam.targetCamY - canvas.height / 2;
    }

    if (snapCam) { camX = tx; camY = ty; snapCam = false; }
    else { camX += (tx - camX) * 0.05; camY += (ty - camY) * 0.05; }
    camX = Math.max(0, Math.min(camX, parsedLvl.worldWidth - canvas.width));
    camY = Math.max(0, Math.min(camY, parsedLvl.worldHeight - canvas.height));
  }

  function createDeathSlices() {
    deathSlices = [];
    for (let i = 0; i < 6; i++) {
      const sliceH = PH / 6;
      deathSlices.push({ worldX: px, worldYBottom: py + PH - (i + 1) * sliceH, localY: i * sliceH, h: sliceH,
        vx: (Math.random() - 0.5) * 700, vy: 200 + Math.random() * 500,
        rot: 0, rotV: (Math.random() - 0.5) * 18 });
    }
  }

  function restoreFromCheckpoint(cp) {
    if (!cp) {
      px = parsedLvl.spawnX; py = parsedLvl.spawnY;
      elapsed = 0; sessionCoins = 0;
      parsedLvl.coins.forEach(co => { co.collected = false; });
      parsedLvl.keys.forEach(k => { k.collected = false; k.x = k.origX; k.y = k.origY; k._swapLocked = false; });
      heldKey = null;
      parsedLvl.walls.forEach(w => {
        if (w.keyId) { w.doorOpen = false; w.doorSlide = 0; w.doorDir = 0; }
        if (w.closeOnAreaId) { w.areaCloseSlide = 1; w.areaCloseDir = 0; }
      });
      parsedLvl.areas.forEach(a => { a.triggered = false; });
      parsedLvl.musicTriggers.forEach(mt => { mt.fired = false; });
      parsedLvl.lavas.forEach(lv => {
        if (lv.flowUp) { lv.currentH = lv.h; lv.flowTimer = 0; lv.flowing = !lv.flowAreaId; }
      });
      parsedLvl.enemies.forEach(en => { en.x = en.startX; en.y = en.startY; en.vy = 0; en.onGround = false; en.detected = false; });
      parsedLvl.checkpoints.forEach(cp2 => { cp2.activated = false; });
    } else {
      px = cp.x; py = cp.y;
      sessionCoins = cp.coins || 0;
      if (cp.collectedSnapshot) {
        parsedLvl.coins.forEach((co, i) => { co.collected = cp.collectedSnapshot.has(i); });
      }
      if (cp.keySnapshot) {
        parsedLvl.keys.forEach((k, i) => {
          k.collected = cp.keySnapshot.collectedKeys.has(i);
          if (!k.collected) { k.x = k.origX; k.y = k.origY; }
          k._swapLocked = false;
        });
        heldKey = cp.keySnapshot.heldKey ? { ...cp.keySnapshot.heldKey } : null;
      }
      if (cp.doorSnapshot) {
        parsedLvl.walls.forEach((w, i) => {
          if (w.keyId && cp.doorSnapshot[i] !== undefined) {
            w.doorOpen = cp.doorSnapshot[i].doorOpen;
            w.doorSlide = cp.doorSnapshot[i].doorSlide;
            w.doorDir = 0;
          }
        });
      }
      parsedLvl.areas.forEach((a, ai) => {
        a.triggered = cp.areaSnapshot ? (cp.areaSnapshot[ai]?.triggered || false) : false;
      });
      parsedLvl.walls.forEach(w => {
        if (!w.closeOnAreaId) return;
        const linkedArea = parsedLvl.areas.find(a => a.areaId === w.closeOnAreaId);
        const areaIdx = parsedLvl.areas.indexOf(linkedArea);
        const wasTriggered = cp.areaSnapshot && areaIdx !== -1 && cp.areaSnapshot[areaIdx]?.triggered;
        w.areaCloseSlide = wasTriggered ? 0 : 1;
        w.areaCloseDir = 0;
      });
      if (cp.lavaSnapshot) {
        parsedLvl.lavas.forEach((lv, i) => {
          const snap = cp.lavaSnapshot[i];
          if (!snap || !lv.flowUp) return;
          lv.currentH = snap.currentH;
          lv.flowTimer = snap.flowTimer;
          lv.flowing = snap.flowing;
        });
      }
      parsedLvl.musicTriggers.forEach(mt => { mt.fired = false; });
      parsedLvl.enemies.forEach(en => { en.x = en.startX; en.y = en.startY; en.vy = 0; en.onGround = false; en.detected = false; });
    }
  }

  function update(dt) {
    if (phase === 'dying') {
      deathTimer -= dt;
      for (const s of deathSlices) { s.worldX += s.vx * dt; s.worldYBottom += s.vy * dt; s.vy -= GRAV * dt; if (s.vy < MAX_FALL) s.vy = MAX_FALL; s.rot += s.rotV * dt; }
      if (deathTimer <= 0) {
        deathSlices = [];
        const cp = getCurrentCheckpoint();
        restoreFromCheckpoint(cp);
        vx = 0; vy = 0; onGround = false; portalCooldownTimer = 0; snapCam = true;
        parsedLvl.enemies.forEach(en => { if (!en._spawned) { en.x = en.startX; en.y = en.startY; en.vy = 0; en.onGround = false; } en.detected = false; });
        for (const orb of parsedLvl.orbs) orb.actTimer = 0;
        phase = 'playing';
      }
      updateCam(); return;
    }
    if (phase !== 'playing') return;

    elapsed += dt;
    if (portalCooldownTimer > 0) portalCooldownTimer -= dt;
    if (doorMsg && doorMsg.timer > 0) doorMsg.timer -= dt;

    updateMusicFade(dt);

    for (const popup of coinPopups) { popup.y -= 60 * dt; popup.life -= dt; }
    coinPopups = coinPopups.filter(p => p.life > 0);

    for (const wl of parsedLvl.walls) {
      if (!wl.keyId) continue;
      if (wl.doorDir === 1) { wl.doorSlide = Math.min(1, wl.doorSlide + DOOR_SLIDE_SPEED * dt); if (wl.doorSlide >= 1) { wl.doorSlide = 1; wl.doorDir = 0; wl.doorOpen = true; } }
    }
    for (const wl of parsedLvl.walls) {
      if (!wl.closeOnAreaId || wl.areaCloseDir === 0) continue;
      wl.areaCloseSlide = Math.max(0, wl.areaCloseSlide - DOOR_SLIDE_SPEED * dt);
      if (wl.areaCloseSlide <= 0) { wl.areaCloseSlide = 0; wl.areaCloseDir = 0; }
    }
    for (const lv of parsedLvl.lavas) {
      if (!lv.flowUp || !lv.flowing) continue;
      if (lv.flowDuration > 0 && lv.flowTimer >= lv.flowDuration) continue;
      lv.flowTimer += dt;
      lv.currentH = lv.h + lv.flowSpeed * Math.min(lv.flowTimer, lv.flowDuration > 0 ? lv.flowDuration : lv.flowTimer);
    }

    for (const area of parsedLvl.areas) {
      if (area.triggered) continue;
      const fullyInside = px >= area.x && px + PW <= area.x + area.w && py >= area.y && py + PH <= area.y + area.h;
      if (!fullyInside) continue;
      area.triggered = true;
      if (area.checkpointX !== null) {
        checkpointHistory.push({
          x: area.checkpointX,
          y: area.checkpointY != null ? area.checkpointY : area.checkpointX,
          coins: sessionCoins,
          elapsed,
          collectedSnapshot: captureCollectedSnapshot(),
          keySnapshot: captureKeySnapshot(),
          doorSnapshot: captureDoorSnapshot(),
          areaSnapshot: captureAreaSnapshot(),
          lavaSnapshot: captureLavaSnapshot(),
        });
      }
      for (const wl of parsedLvl.walls) { if (wl.closeOnAreaId === area.areaId) wl.areaCloseDir = 1; }
      for (const lv of parsedLvl.lavas) { if (lv.flowAreaId === area.areaId) { lv.flowing = true; lv.flowTimer = 0; } }
      for (const mt of parsedLvl.musicTriggers) {
        if (!mt.fired && mt.areaId === area.areaId) {
          mt.fired = true;
          fadeMusicTo(mt.song, mt.fadeDuration);
        }
      }
    }

    const goLeft = KEY['ArrowLeft'] || KEY['KeyA'];
    const goRight = KEY['ArrowRight'] || KEY['KeyD'];
    if (goRight && !goLeft) vx = SPEED;
    else if (goLeft && !goRight) vx = -SPEED;
    else vx = 0;

    if (standingOn?._mp) {
      if (standingOn.type === 'mpRight') px = Math.max(0, Math.min(px + standingOn._mp.deltaX, parsedLvl.worldWidth - PW));
      if (standingOn.type === 'mpUp') py += standingOn._mp.deltaY;
    }

    if (!onGround) { vy -= GRAV * dt; if (vy < MAX_FALL) vy = MAX_FALL; }

    const jumpHeld = KEY['ArrowUp'] || KEY['KeyW'] || KEY['Space'];
    if (!jumpHeld) jumpQ = false;

    const INNER = 12;
    const innerX = px + (PW - INNER) / 2, innerY = py + (PH - INNER) / 2;
    for (const orb of parsedLvl.orbs) {
      if (orb.ghost) continue;
      if (circleRectHit(orb.x, orb.y, orb.r, innerX, innerY, INNER, INNER) && jumpHeld && orb.actTimer <= 0) {
        vy = orb.strength * 370; onGround = false; orb.actTimer = 0.18; jumpAnim = 0.3; jumpQ = false; break;
      }
    }
    if ((jumpQ || (jumpHeld && onGround)) && onGround) { vy = JUMP_V; onGround = false; jumpAnim = 0.3; jumpQ = false; }
    for (const orb of parsedLvl.orbs) { if (orb.actTimer > 0) orb.actTimer -= dt; }

    for (const tr of parsedLvl.trampolines) {
      if (tr.ghost) continue;
      if (hit(px, py, PW, PH, tr.x, tr.y, tr.w, tr.h)) { vy = tr.strength * 380; onGround = false; jumpAnim = 0.3; }
    }

    for (const mp of parsedLvl.mpUp) {
      const oldCy = mp.cy;
      if (mp.triggerMode) {
        const playerOnTop = standingOn?._mp === mp;
        const fallDir = mp.endY > mp.startY ? 1 : -1;
        if (mp.triggerState === 'idle') {
          if (playerOnTop) {
            mp.triggerTimer += dt;
            mp.cy = mp.startY - Math.min(mp.triggerTimer / mp.triggerTimeout, 1) * 14;
          } else {
            mp.triggerTimer = Math.max(0, mp.triggerTimer - dt * 2.5);
            mp.cy = mp.startY - Math.min(mp.triggerTimer / mp.triggerTimeout, 1) * 14;
          }
          if (mp.triggerTimer >= mp.triggerTimeout) { mp.triggerState = 'falling'; mp.triggerTimer = 0; }
        } else if (mp.triggerState === 'falling') {
          mp.cy += fallDir * 200 * dt;
          if ((fallDir === 1 && mp.cy >= mp.endY) || (fallDir === -1 && mp.cy <= mp.endY)) {
            mp.cy = mp.endY; mp.triggerState = 'waiting'; mp.returnTimer = mp.returnTimeout;
          }
        } else if (mp.triggerState === 'waiting') {
          mp.returnTimer -= dt;
          if (mp.returnTimer <= 0) mp.triggerState = 'returning';
        } else if (mp.triggerState === 'returning') {
          mp.cy -= fallDir * 200 * dt;
          if ((fallDir === 1 && mp.cy <= mp.startY) || (fallDir === -1 && mp.cy >= mp.startY)) {
            mp.cy = mp.startY; mp.triggerState = 'idle'; mp.triggerTimer = 0;
          }
        }
      } else {
        mp.cy += mp.dir * 200 * dt;
        if (mp.cy >= mp.endY) { mp.cy = mp.endY; mp.dir = -1; }
        if (mp.cy <= mp.startY) { mp.cy = mp.startY; mp.dir = 1; }
      }
      mp.deltaY = mp.cy - oldCy;
    }

    for (const mp of parsedLvl.mpRight) {
      const oldCx = mp.cx;
      mp.cx += mp.dir * 160 * dt;
      if (mp.cx >= mp.endX) { mp.cx = mp.endX; mp.dir = -1; }
      if (mp.cx <= mp.startX) { mp.cx = mp.startX; mp.dir = 1; }
      mp.deltaX = mp.cx - oldCx;
    }

    for (const en of parsedLvl.enemies) {
      const spd = (en.speed ?? 100) * dt;
      const edx = (px + PW / 2) - (en.x + en.w / 2);
      const edy = (py + PH / 2) - (en.y + en.h / 2);
      en.detected = Math.sqrt(edx * edx + edy * edy) <= en.detectionR;
      if (en.detected) {
        const moveDir = en.x + en.w / 2 > px + PW / 2 ? -1 : 1;
        if (en.stuck) { en.x += moveDir * spd; }
        else {
          en.x += moveDir * spd;
          if (!en.onGround) { en.vy -= GRAV * dt; if (en.vy < MAX_FALL) en.vy = MAX_FALL; }
          en.y += en.vy * dt; en.onGround = false;
          const enSolids = [
            ...parsedLvl.floors.filter(f => !f.ghost),
            ...parsedLvl.mpUp.filter(mp => !mp.ghost).map(mp => ({ x: mp.x, y: mp.cy, w: mp.w, h: mp.h })),
            ...parsedLvl.mpRight.filter(mp => !mp.ghost).map(mp => ({ x: mp.cx, y: mp.y, w: mp.w, h: mp.h })),
            ...parsedLvl.walls.filter(w => !w.ghost && !w.keyId && !w.closeOnAreaId),
          ];
          for (const fl of enSolids) {
            if (!hit(en.x, en.y, en.w, en.h, fl.x, fl.y, fl.w, fl.h)) continue;
            const enBottom = en.y, enTop = en.y + en.h, flTop = fl.y + fl.h, flBottom = fl.y;
            const overlapY = Math.min(enTop - flBottom, flTop - enBottom);
            const overlapX = Math.min((en.x + en.w) - fl.x, (fl.x + fl.w) - en.x);
            if (overlapY < overlapX) {
              if (en.vy <= 0 && enBottom < flTop && enTop > flTop - 2) { en.y = flTop; en.vy = 0; en.onGround = true; }
              else if (en.vy > 0) { en.y = flBottom - en.h; en.vy = -100; }
            } else {
              en.x -= moveDir * spd;
              if (en.onGround) { en.vy = JUMP_V * 0.85; en.onGround = false; }
            }
          }
          if (en.onGround && py + PH < en.y - 20) { en.vy = JUMP_V * 0.85; en.onGround = false; }
        }
      } else if (!en.stuck) {
        if (!en.onGround) { en.vy -= GRAV * dt; if (en.vy < MAX_FALL) en.vy = MAX_FALL; }
        en.y += en.vy * dt; en.onGround = false;
        for (const fl of parsedLvl.floors.filter(f => !f.ghost)) {
          if (!hit(en.x, en.y, en.w, en.h, fl.x, fl.y, fl.w, fl.h)) continue;
          if (en.vy <= 0 && en.y < fl.y + fl.h) { en.y = fl.y + fl.h; en.vy = 0; en.onGround = true; }
        }
      }
      if (en.min !== null && en.x < en.min) en.x = en.min;
      if (en.max !== null && en.x + en.w > en.max) en.x = en.max - en.w;
    }

    for (const cp of parsedLvl.checkpoints) {
      if (!cp.activated && hit(px, py, PW, PH, cp.x, cp.y, FLAG_W, FLAG_H)) {
        cp.activated = true;
        checkpointHistory.push({
          x: cp.x,
          y: cp.y,
          coins: sessionCoins,
          elapsed,
          collectedSnapshot: captureCollectedSnapshot(),
          keySnapshot: captureKeySnapshot(),
          doorSnapshot: captureDoorSnapshot(),
          areaSnapshot: captureAreaSnapshot(),
          lavaSnapshot: captureLavaSnapshot(),
        });
      }
    }

    for (const co of parsedLvl.coins) {
      co.bobTimer += dt * 3;
      if (co.ghost || co.collected) continue;
      if (hit(px, py, PW, PH, co.x - co.r, co.y - co.r, co.r * 2, co.r * 2)) {
        co.collected = true;
        const val = co.blue ? 10 : 1;
        sessionCoins += val;
        coinPopups.push({ x: wx(co.x), y: wy(co.y, co.r * 2), life: 0.8, maxLife: 0.8, value: val, blue: co.blue });
      }
    }

    for (const k of parsedLvl.keys) {
      k.bobTimer += dt * 2.5;
      if (k.ghost || k.collected || k._swapLocked) continue;
      if (hit(px, py, PW, PH, k.x - k.r, k.y - k.r, k.r * 2, k.r * 2)) {
        k.collected = true;
        if (heldKey) {
          const droppedKey = parsedLvl.keys.find(kk => kk.keyId === heldKey.keyId);
          if (droppedKey) { droppedKey.collected = false; droppedKey.x = px + PW / 2; droppedKey.y = py; droppedKey._swapLocked = true; }
        }
        heldKey = { keyId: k.keyId, keyColor: k.keyColor };
      }
    }

    if (portalCooldownTimer <= 0) {
      for (const portal of parsedLvl.portals) {
        if (!hit(px, py, PW, PH, portal.x, portal.y, portal.w, portal.h)) continue;
        const dest = parsedLvl.portals.find(p => p.portalId === portal.toPortalId);
        if (!dest) continue;
        px = dest.x + (dest.w - PW) / 2; py = dest.y;
        portalCooldownTimer = PORTAL_COOLDOWN; snapCam = true; break;
      }
    }

    px += vx * dt;
    px = Math.max(0, Math.min(px, parsedLvl.worldWidth - PW));

    if (!noclip) for (const wl of parsedLvl.walls) {
      if (wl.ghost) continue;
      let wx2, wy2, ww, wh;
      if (wl.keyId) { const dr = getDoorEffectiveRect(wl); if (dr.h <= 1) continue; wx2 = dr.x; wy2 = dr.y; ww = dr.w; wh = dr.h; }
      else if (wl.closeOnAreaId) { const dr = getAreaCloseRect(wl); if (dr.h <= 1) continue; wx2 = dr.x; wy2 = dr.y; ww = dr.w; wh = dr.h; }
      else { wx2 = wl.x; wy2 = wl.y; ww = wl.w; wh = wl.h; }
      if (hit(px, py, PW, PH, wx2, wy2, ww, wh)) { px = vx >= 0 ? wx2 - PW : wx2 + ww; vx = 0; }
    }

    for (const wl of parsedLvl.walls) { if (wl.ghost) wl.playerOverlap = hit(px, py, PW, PH, wl.x, wl.y, wl.w, wl.h); }

    py += vy * dt;

    const solidWallEntries = parsedLvl.walls.filter(w => !w.ghost && !(w.keyId && w.doorSlide >= 1) && !(w.closeOnAreaId && w.areaCloseSlide >= 1)).map(w => {
      if (w.keyId) { const dr = getDoorEffectiveRect(w); return { x: dr.x, y: dr.y, w: dr.w, h: dr.h, oneWay: false, type: 'wall' }; }
      if (w.closeOnAreaId) { const dr = getAreaCloseRect(w); return { x: dr.x, y: dr.y, w: dr.w, h: dr.h, oneWay: false, type: 'wall' }; }
      return { x: w.x, y: w.y, w: w.w, h: w.h, oneWay: false, type: 'wall' };
    }).filter(e => e.h > 1);

    const solids = [
      ...parsedLvl.floors.filter(f => !f.ghost),
      ...parsedLvl.mpUp.filter(mp => !mp.ghost).map(mp => ({ x: mp.x, y: mp.cy, w: mp.w, h: mp.h, oneWay: mp.oneWay, type: 'mpUp', _mp: mp })),
      ...parsedLvl.mpRight.filter(mp => !mp.ghost).map(mp => ({ x: mp.cx, y: mp.y, w: mp.w, h: mp.h, oneWay: mp.oneWay, type: 'mpRight', _mp: mp })),
      ...solidWallEntries,
    ];

    onGround = false; standingOn = null;
    for (const fl of solids) {
      if (!hit(px, py, PW, PH, fl.x, fl.y, fl.w, fl.h)) continue;
      const playerBottom = py, playerTop = py + PH, flTop = fl.y + fl.h, flBottom = fl.y;
      const overlapY = Math.min(playerTop - flBottom, flTop - playerBottom);
      const overlapX = Math.min((px + PW) - fl.x, (fl.x + fl.w) - px);
      if (overlapY < overlapX) {
        if (vy <= 0 && playerBottom < flTop && playerTop > flTop - 0.5) {
          py = flTop; if (vy < -200 && !onGround) landAnim = 0.22; vy = 0; onGround = true; standingOn = fl;
        } else if (!fl.oneWay && vy > 0) { if (!noclip) { py = flBottom - PH; vy = -200; } }
      } else if (!fl.oneWay) { if (!noclip) { px = px + PW / 2 < fl.x + fl.w / 2 ? fl.x - PW : fl.x + fl.w; vx = 0; } }
    }

    if (!onGround) {
      for (const fl of solids) {
        if (Math.abs(py - (fl.y + fl.h)) < 2 && px + PW > fl.x && px < fl.x + fl.w) { onGround = true; standingOn = fl; break; }
      }
    }

    if (py + PH > parsedLvl.worldHeight) { py = parsedLvl.worldHeight - PH; vy = 0; }
    if (py <= 0) { py = 0; if (vy < -200 && !onGround) landAnim = 0.22; vy = 0; onGround = true; standingOn = { type: 'world_floor' }; }

    const DOOR_MARGIN = 6;
    for (const wl of parsedLvl.walls) {
      if (!wl.keyId || wl.doorOpen || wl.doorDir === 1) continue;
      const dr = getDoorEffectiveRect(wl);
      if (dr.h <= 1) continue;
      if (hit(px - DOOR_MARGIN, py - DOOR_MARGIN, PW + DOOR_MARGIN * 2, PH + DOOR_MARGIN * 2, dr.x, dr.y, dr.w, dr.h)) {
        if (heldKey && heldKey.keyId === wl.keyId) { wl.doorDir = 1; heldKey = null; }
        else if (!doorMsg || doorMsg.timer <= 0) doorMsg = { text: heldKey ? 'Wrong key!' : 'Need a key!', timer: 2.2, maxTimer: 2.2 };
      }
    }

    let dead = false;
    if (!noclip) {
      for (const lv of parsedLvl.lavas) { if (!lv.ghost && hit(px, py, PW, PH, lv.x, lv.y, lv.w, lv.flowUp ? lv.currentH : lv.h)) { dead = true; break; } }
      if (!dead) for (const en of parsedLvl.enemies) { if (!en.ghost && hit(px, py, PW, PH, en.x, en.y, en.w, en.h)) { dead = true; break; } }
    }
    if (dead) { createDeathSlices(); phase = 'dying'; deathTimer = DEATH_DUR; }

    for (const en of parsedLvl.ends) {
      if (hit(px, py, PW, PH, en.x, en.y, en.w, en.h)) { phase = 'won'; break; }
    }

    if (jumpAnim > 0) jumpAnim -= dt;
    if (landAnim > 0) landAnim -= dt;
    updateCam();
  }

  const PLAYER_PATH = new Path2D(
    'M44.6819 17.3781H43.3148C41.7353 17.3781 40.4606 16.1316 40.4606 14.5871V11.9045C40.4606 10.36 39.1859 9.11355 37.6064 9.11355H32.6184C31.0389 9.11355 29.7642 7.8671 29.7642 6.32258V2.79097C29.7642 1.24645 28.4895 0 26.91 0H22.153C20.5734 0 19.2987 1.24645 19.2987 2.79097V6.32258C19.2987 7.8671 18.024 9.11355 16.4445 9.11355H11.4566C9.87706 9.11355 8.60236 10.36 8.60236 11.9045V14.5871C8.60236 16.1316 7.32766 17.3781 5.74814 17.3781H4.38107C2.80155 17.3781 1.52686 18.6245 1.52686 20.169V28.5058C1.52686 30.0503 2.80155 31.2968 4.38107 31.2968H5.72967C7.30918 31.2968 8.58388 32.5432 8.58388 34.0877V37.1768C8.58388 38.7213 9.85858 39.9677 11.4381 39.9677C13.0176 39.9677 14.2923 41.2142 14.2923 42.7587V46.209C14.2923 47.7535 15.567 49 17.1465 49H20.2132C21.7927 49 23.0674 47.7535 23.0674 46.209V41.4039C23.0674 40.609 23.7232 39.9768 24.5269 39.9768C25.3305 39.9768 25.9863 40.6181 25.9863 41.4039V46.209C25.9863 47.7535 27.261 49 28.8405 49H31.9072C33.4867 49 34.7614 47.7535 34.7614 46.209V42.7587C34.7614 41.2142 36.0361 39.9677 37.6156 39.9677C39.1951 39.9677 40.4698 38.7213 40.4698 37.1768V34.0877C40.4698 32.5432 41.7445 31.2968 43.324 31.2968H44.6726C46.2522 31.2968 47.5269 30.0503 47.5269 28.5058V20.169C47.5269 18.6245 46.2522 17.3781 44.6726 17.3781H44.6819Z'
  );

  function drawPlayer() {
    const cx2 = wx(px) + PW / 2, cy2 = wy(py, PH) + PH / 2;
    ctx.save();
    ctx.translate(cx2, cy2);
    let sx = 1, sy = 1;
    if (jumpAnim > 0) { const t2 = jumpAnim / 0.3; sx = 1 - 0.28 * Math.sin(t2 * Math.PI); sy = 1 + 0.28 * Math.sin(t2 * Math.PI); }
    else if (landAnim > 0) { const t2 = landAnim / 0.22; sx = 1 + 0.22 * Math.sin(t2 * Math.PI); sy = 1 - 0.22 * Math.sin(t2 * Math.PI); }
    ctx.scale(sx, sy);
    ctx.shadowColor = 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 8;
    ctx.translate(-PW / 2, -PH / 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(PLAYER_PATH);
    ctx.restore();
  }

  function drawDeathSlices() {
    const alpha = Math.max(0, deathTimer / DEATH_DUR);
    for (const s of deathSlices) {
      const sx2 = wx(s.worldX), sy2 = wy(s.worldYBottom, s.h);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(sx2 + PW / 2, sy2 + s.h / 2); ctx.rotate(s.rot);
      ctx.beginPath(); ctx.rect(-PW / 2, -s.h / 2, PW, s.h); ctx.clip();
      ctx.translate(-PW / 2, -s.h / 2 - s.localY);
      ctx.fillStyle = '#ffffff'; ctx.fill(PLAYER_PATH);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function texFill(obj, x, y, w, h, fallback) {
    const cx2 = wx(x), cy2 = wy(y, h);
    if (obj.tex && obj.tex.img && obj.tex.img.complete && obj.tex.img.naturalWidth > 0) {
      const rot = (obj.rotation || 0) * Math.PI / 180;
      ctx.save();
      if (rot !== 0 || obj.invertX || obj.invertY) {
        ctx.translate(cx2 + w / 2, cy2 + h / 2);
        if (rot !== 0) ctx.rotate(rot);
        ctx.scale(obj.invertX ? -1 : 1, obj.invertY ? -1 : 1);
        ctx.translate(-w / 2, -h / 2);
        const lx = 0, ly = 0;
        drawTexContent(obj, lx, ly, w, h);
      } else {
        drawTexContent(obj, cx2, cy2, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = fallback;
      ctx.fillRect(cx2, cy2, w, h);
    }
  }

  function drawTexContent(obj, lx, ly, w, h) {
    if (obj.textureMode === 'stretch') {
      ctx.drawImage(obj.tex.img, lx, ly, w, h);
    } else if (obj.textureMode === 'cover') {
      const imgW = obj.tex.img.naturalWidth, imgH = obj.tex.img.naturalHeight;
      const scale = Math.max(w / imgW, h / imgH);
      const dw = imgW * scale, dh = imgH * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, w, h); ctx.clip();
      ctx.drawImage(obj.tex.img, lx + (w - dw) / 2, ly + (h - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, w, h); ctx.clip();
      if (obj.tex.pat) {
        const m = new DOMMatrix(); m.translateSelf(lx, ly);
        obj.tex.pat.setTransform(m); ctx.fillStyle = obj.tex.pat; ctx.fillRect(lx, ly, w, h);
      } else {
        for (let ty = ly; ty < ly + h; ty += obj.tex.img.naturalHeight)
          for (let tx = lx; tx < lx + w; tx += obj.tex.img.naturalWidth)
            ctx.drawImage(obj.tex.img, tx, ty);
      }
      ctx.restore();
    }
  }

  function drawCheckpoint(cp) {
    const fx = wx(cp.x), fy = wy(cp.y, FLAG_H);
    const poleCol = cp.activated ? '#4caf50' : '#888';
    const flagCol = cp.activated ? '#2e7d32' : '#555';
    ctx.save();
    if (cp.activated) { ctx.shadowColor = 'rgba(76,175,80,0.5)'; ctx.shadowBlur = 14; }
    ctx.fillStyle = poleCol;
    ctx.fillRect(fx, fy, 4, FLAG_H);
    ctx.fillStyle = flagCol;
    ctx.beginPath();
    ctx.moveTo(fx + 4, fy);
    ctx.lineTo(fx + 30, fy + 13);
    ctx.lineTo(fx + 4, fy + 26);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function bakeBg() {
    const w = canvas.width, h = canvas.height;
    if (parsedLvl._bgBaked && parsedLvl._bgBakedW === w && parsedLvl._bgBakedH === h) return parsedLvl._bgBaked;
    const oc = new OffscreenCanvas(w, h);
    const octx = oc.getContext('2d');
    const top = parsedLvl.bgColor || '#0f0f23';
    const bot = parsedLvl.bgColor2 || (parsedLvl.bgColor ? parsedLvl.bgColor : '#1a1a2e');
    const g = octx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    octx.fillStyle = g; octx.fillRect(0, 0, w, h);
    if (parsedLvl._bgTexEntry) {
      const entry = parsedLvl._bgTexEntry;
      if (entry.img.complete && entry.img.naturalWidth > 0) {
        octx.globalAlpha = parsedLvl.bgTextureAlpha != null ? parsedLvl.bgTextureAlpha : 1;
        if (parsedLvl.bgTextureMode === 'stretch') {
          octx.drawImage(entry.img, 0, 0, w, h);
        } else if (parsedLvl.bgTextureMode === 'cover') {
          const iw = entry.img.naturalWidth, ih = entry.img.naturalHeight;
          const scale = Math.max(w / iw, h / ih);
          octx.drawImage(entry.img, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale);
        } else {
          const pat = octx.createPattern(entry.img, 'repeat');
          if (pat) { octx.fillStyle = pat; octx.fillRect(0, 0, w, h); }
        }
        octx.globalAlpha = 1;
      }
    }
    parsedLvl._bgBaked = oc; parsedLvl._bgBakedW = w; parsedLvl._bgBakedH = h;
    return oc;
  }

  function drawObj2(o) {
    if (o.type === 'floor') {
      if (!o.tex) { ctx.fillStyle = COL.floor + '44'; ctx.fillRect(wx(o.x), wy(o.y, o.h), o.w, o.h); ctx.strokeStyle = COL.floor; ctx.lineWidth = 1; ctx.strokeRect(wx(o.x), wy(o.y, o.h), o.w, o.h); }
      else texFill(o, o.x, o.y, o.w, o.h, COL.floor);
    }
    else if (o.type === 'wall') {
      const drawY = o.riseWithId ? o.riseCurrentY : o.y;
      const drawH = o.riseWithId ? o.riseCurrentH : o.h;
      if (o.keyId) {
        if (o.doorSlide >= 1) return;
        const dr = getDoorEffectiveRect(o); if (dr.h <= 0) return;
        if (o.tex) { texFill(o, dr.x, dr.y, dr.w, dr.h, COL.wall); }
        else {
          ctx.fillStyle = o.keyColor + '44'; ctx.fillRect(wx(dr.x), wy(dr.y, dr.h), dr.w, dr.h);
          ctx.strokeStyle = o.keyColor; ctx.lineWidth = 2; ctx.strokeRect(wx(dr.x), wy(dr.y, dr.h), dr.w, dr.h);
        }
      } else if (o.closeOnAreaId) {
        const dr = getAreaCloseRect(o); if (dr.h <= 0) return;
        if (o.tex) texFill(o, dr.x, dr.y, dr.w, dr.h, COL.wall);
        else { ctx.fillStyle = COL.wall + '44'; ctx.fillRect(wx(dr.x), wy(dr.y, dr.h), dr.w, dr.h); ctx.strokeStyle = COL.wall; ctx.lineWidth = 1; ctx.strokeRect(wx(dr.x), wy(dr.y, dr.h), dr.w, dr.h); }
      } else if (o.ghost) {
        ctx.save(); ctx.globalAlpha = 0.2; texFill(o, o.x, drawY, o.w, drawH, COL.wall); ctx.restore();
      } else {
        if (o.tex) texFill(o, o.x, drawY, o.w, drawH, COL.wall);
        else { ctx.fillStyle = COL.wall + '44'; ctx.fillRect(wx(o.x), wy(drawY, drawH), o.w, drawH); ctx.strokeStyle = COL.wall; ctx.lineWidth = 1; ctx.strokeRect(wx(o.x), wy(drawY, drawH), o.w, drawH); }
      }
    }
    else if (o.type === 'lava') {
      const lh = o.flowUp ? o.currentH : o.h;
      if (o.tex) texFill(o, o.x, o.y, o.w, lh, COL.lava);
      else { ctx.fillStyle = COL.lava + '88'; ctx.fillRect(wx(o.x), wy(o.y, lh), o.w, lh); }
    }
    else if (o.type === 'trampoline') {
      if (o.tex) texFill(o, o.x, o.y, o.w, o.h, COL.tramp);
      else { ctx.fillStyle = COL.tramp + '66'; ctx.fillRect(wx(o.x), wy(o.y, o.h), o.w, o.h); ctx.strokeStyle = COL.tramp; ctx.lineWidth = 2; ctx.strokeRect(wx(o.x), wy(o.y, o.h), o.w, o.h); }
    }
    else if (o.type === 'mpUp') {
      if (o.tex) texFill(o, o.x, o.cy, o.w, o.h, COL.floor);
      else { ctx.fillStyle = '#9b9b9c44'; ctx.fillRect(wx(o.x), wy(o.cy, o.h), o.w, o.h); ctx.strokeStyle = '#9b9b9c'; ctx.lineWidth = 1; ctx.strokeRect(wx(o.x), wy(o.cy, o.h), o.w, o.h); }
    }
    else if (o.type === 'mpRight') {
      if (o.tex) texFill(o, o.cx, o.y, o.w, o.h, COL.floor);
      else { ctx.fillStyle = '#9b9b9c44'; ctx.fillRect(wx(o.cx), wy(o.y, o.h), o.w, o.h); ctx.strokeStyle = '#9b9b9c'; ctx.lineWidth = 1; ctx.strokeRect(wx(o.cx), wy(o.y, o.h), o.w, o.h); }
    }
    else if (o.type === 'enemy') {
      ctx.fillStyle = '#fc121240'; ctx.beginPath(); ctx.roundRect(wx(o.x), wy(o.y, o.h), o.w, o.h, 4); ctx.fill();
      ctx.strokeStyle = '#fc1212'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(wx(o.x), wy(o.y, o.h), o.w, o.h, 4); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label || 'E', wx(o.x + o.w / 2), wy(o.y + o.h / 2, 0));
    }
    else if (o.type === 'orb') {
      const cx2 = wx(o.x), cy2 = wy(o.y, o.r * 2) + o.r;
      const g = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, o.r);
      g.addColorStop(0, '#fce512ff'); g.addColorStop(1, '#fce51200');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx2, cy2, o.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#eaecd1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx2, cy2, o.r, 0, Math.PI * 2); ctx.stroke();
    }
    else if (o.type === 'coin') {
      if (o.collected) return;
      const bob = Math.sin(o.bobTimer) * 4;
      const cx2 = wx(o.x), cy2 = wy(o.y - o.r, o.r * 2) + o.r + bob;
      ctx.fillStyle = o.blue ? '#5b9cf6' : COL.coin; ctx.beginPath(); ctx.arc(cx2, cy2, o.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.blue ? '$10' : '$', cx2, cy2 + 1);
    }
    else if (o.type === 'key') {
      if (o.collected) return;
      const bob = Math.sin(o.bobTimer) * 3;
      const kc = o.keyColor || '#ffd700';
      const cx2 = wx(o.x), cy2 = wy(o.y, o.r * 2) + o.r + bob;
      ctx.save();
      ctx.shadowColor = kc; ctx.shadowBlur = 10;
      ctx.fillStyle = kc;
      ctx.beginPath(); ctx.arc(cx2 - o.r * 0.18, cy2, o.r * 0.58, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx2 - o.r * 0.18 + o.r * 0.58 * 0.85, cy2 - o.r * 0.14, o.r * 1.1, o.r * 0.28);
      ctx.restore();
    }
    else if (o.type === 'checkpoint') {
      drawCheckpoint(o);
    }
    else if (o.type === 'portal') {
      const t2 = performance.now() / 1000;
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
      ctx.shadowColor = '#a855f766'; ctx.shadowBlur = 10 * (0.7 + 0.3 * Math.sin(t2 * 3));
      ctx.beginPath(); ctx.roundRect(wx(o.x), wy(o.y, o.h), o.w, o.h, 4); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(120,60,255,0.2)'; ctx.beginPath(); ctx.roundRect(wx(o.x), wy(o.y, o.h), o.w, o.h, 4); ctx.fill();
    }
    else if (o.type === 'text') {
      const fam = o.fontFamily || 'sans-serif';
      const sz = o.fontSize || 20;
      const bold = o.bold ? 'bold ' : '';
      ctx.save();
      if (o.ghost) ctx.globalAlpha = 0.3;
      ctx.textBaseline = 'middle';
      if (o.segments && o.segments.length > 0) {
        ctx.textAlign = 'left';
        let totalW = 0;
        for (const seg of o.segments) { ctx.font = (seg.bold ? 'bold ' : '') + sz + 'px ' + fam; totalW += ctx.measureText(seg.text).width; }
        let curX = wx(o.x) - totalW / 2;
        for (const seg of o.segments) {
          ctx.font = (seg.bold ? 'bold ' : '') + sz + 'px ' + fam;
          ctx.fillStyle = seg.color || '#fff';
          ctx.fillText(seg.text, curX, wy(o.y, 0));
          curX += ctx.measureText(seg.text).width;
        }
      } else {
        ctx.font = bold + sz + 'px ' + fam;
        ctx.fillStyle = o.color || '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(o.content || '', wx(o.x), wy(o.y, 0));
      }
      ctx.restore();
    }
  }

  function render2() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bakeBg(), 0, 0);

    const floorCanvasY = wy(0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, floorCanvasY); ctx.clip();
    for (const o of parsedLvl.drawOrder) drawObj2(o);
    if (phase === 'dying') drawDeathSlices(); else drawPlayer();
    for (const popup of coinPopups) {
      ctx.save(); ctx.globalAlpha = popup.life / popup.maxLife;
      ctx.fillStyle = popup.blue ? '#5b9cf6' : COL.coin;
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + (popup.value || 1), popup.x, popup.y);
      ctx.restore();
    }
    ctx.restore();

    const totalCoins = parsedLvl.coins.filter(c => !c.ghost).reduce((t, c) => t + (c.blue ? 10 : 1), 0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, canvas.width, 36);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('⏱ ' + elapsed.toFixed(1) + 's', 12, 18);
    if (totalCoins > 0) { ctx.textAlign = 'center'; ctx.fillText('🪙 ' + sessionCoins + ' / ' + totalCoins, canvas.width / 2, 18); }

    const cpCount = checkpointHistory.length;
    if (cpCount > 0) {
      ctx.fillStyle = '#4caf50'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('✓ checkpoint ' + cpCount, canvas.width - 10, 18);
    }

    if (doorMsg && doorMsg.timer > 0) {
      const alpha = Math.min(1, doorMsg.timer / 0.4) * Math.min(1, doorMsg.timer);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px sans-serif';
      const tw = ctx.measureText(doorMsg.text).width;
      const bx = canvas.width / 2 - tw / 2 - 14, by = canvas.height * 0.62;
      ctx.fillStyle = 'rgba(20,5,5,0.82)'; ctx.beginPath(); ctx.roundRect(bx, by, tw + 28, 40, 8); ctx.fill();
      ctx.strokeStyle = '#fc4040'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffdddd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(doorMsg.text, canvas.width / 2, by + 20);
      ctx.restore();
    }

    if (phase === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fce512'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎉 Level Complete!', canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillStyle = '#9b9b9c'; ctx.font = '22px sans-serif';
      ctx.fillText('Time: ' + elapsed.toFixed(1) + 's  ·  Coins: ' + sessionCoins + ' / ' + totalCoins, canvas.width / 2, canvas.height / 2 + 24);
      ctx.fillStyle = '#64748b'; ctx.font = '15px sans-serif';
      ctx.fillText('ESC to stop', canvas.width / 2, canvas.height / 2 + 68);
    }

    if (noclip) {
      ctx.fillStyle = 'rgba(255,220,0,0.9)'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('NOCLIP ON', canvas.width - 10, 42);
    }
  }

  function loop(ts) {
    if (!_testAlive) return;
    const dt = lastTs === null ? 0.016 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    update(dt);
    render2();
    _testAnimId = requestAnimationFrame(loop);
  }

  _testAnimId = requestAnimationFrame(loop);
}