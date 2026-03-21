let LS_QUOTA = 10 * 1024 * 1024;

(async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) LS_QUOTA = Math.min(est.quota, 50 * 1024 * 1024);
    }
  } catch (e) {}
  try {
    let lo = 0, hi = 50 * 1024 * 1024;
    const probe = 'lb_quota_probe';
    const chunk = 'x'.repeat(1024);
    while (hi - lo > 1024) {
      const mid = Math.floor((lo + hi) / 2);
      try { localStorage.setItem(probe, chunk.repeat(mid / 1024)); lo = mid; }
      catch (e) { hi = mid; }
    }
    localStorage.removeItem(probe);
    const used = getStorageUsage();
    LS_QUOTA = lo + used;
  } catch (e) {}
  updateStorageBar();
})();

window.addEventListener('beforeunload', e => {
  const proj = getProjectSize();
  if (proj > LS_QUOTA * 0.9) { e.preventDefault(); e.returnValue = ''; }
});

function debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveToStorage, 600);
}

function saveToStorage() {
  try {
    const data = { level, objects: objects.map(o => { const c = Object.assign({}, o); delete c._resolvedTex; return c; }), groups, idCtr };
    localStorage.setItem('lb_save', JSON.stringify(data));
  } catch (e) {}
  saveTextures();
}

function saveTextures() {
  const existing = Object.keys(localStorage).filter(k => k.startsWith('lb_tex_'));
  const currentKeys = new Set(Object.keys(textures).map(n => 'lb_tex_' + n));
  existing.forEach(k => { if (!currentKeys.has(k)) localStorage.removeItem(k); });
  Object.keys(textures).forEach(name => {
    try { localStorage.setItem('lb_tex_' + name, textures[name]); } catch (e) {}
  });
  try { localStorage.setItem('lb_tex_index', JSON.stringify(Object.keys(textures))); } catch (e) {}
}

function loadTextures() {
  try {
    const idx = localStorage.getItem('lb_tex_index');
    if (!idx) return;
    const names = JSON.parse(idx);
    names.forEach(name => {
      const data = localStorage.getItem('lb_tex_' + name);
      if (data) { textures[name] = data; delete texImgCache[name]; }
    });
  } catch (e) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('lb_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.level) level = data.level;
    if (data.objects) objects = data.objects;
    if (data.groups) groups = data.groups || {};
    if (data.idCtr) idCtr = data.idCtr;
    selSet = new Set();
    return true;
  } catch (e) { return false; }
}

function getStorageUsage() {
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      used += (k.length + v.length) * 2;
    }
  } catch (e) {}
  return used;
}

function getProjectSize() {
  let s = 0;
  try {
    const data = { level, objects: objects.map(o => { const c = Object.assign({}, o); delete c._resolvedTex; return c; }), groups, idCtr };
    s += JSON.stringify(data).length * 2;
    Object.keys(textures).forEach(n => { s += (n.length + textures[n].length) * 2; });
  } catch (e) {}
  return s;
}

function updateStorageBar() {
  const used = getStorageUsage();
  const proj = getProjectSize();
  const lbl = document.getElementById('storage-lbl');
  const fill = document.getElementById('storage-bar-fill');
  if (!lbl || !fill) return;
  const pct = Math.min(100, Math.round(used / LS_QUOTA * 100));
  const projMB = (proj / 1024 / 1024).toFixed(2);
  const usedMB = (used / 1024 / 1024).toFixed(2);
  const quotaMB = (LS_QUOTA / 1024 / 1024).toFixed(0);
  lbl.textContent = usedMB + ' / ' + quotaMB + ' MB  (project: ' + projMB + ' MB)';
  fill.style.width = pct + '%';
  fill.style.background = pct > 90 ? 'var(--red)' : pct > 65 ? 'var(--yellow)' : 'var(--accent)';
}

// Texture helpers
function texDrop(e) { e.preventDefault(); clsRm('tex-drop', 'over'); loadTexFiles([...e.dataTransfer.files]); }
function texFilePicked(e) { loadTexFiles([...e.target.files]); e.target.value = ''; }

function loadTexFiles(files) {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return;
  let n = 0;
  imgs.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      textures[f.name] = ev.target.result;
      delete texImgCache[f.name];
      n++;
      if (n === imgs.length) {
        const m = autoAssignAll();
        buildTexPanel();
        saveTextures();
        toast('Loaded ' + n + ' texture' + (n > 1 ? 's' : '') + (m ? ' - auto-matched ' + m : ''));
      }
    };
    reader.readAsDataURL(f);
  });
}

function texScore(path, name) {
  if (!path || !name) return 0;
  const norm = s => s.toLowerCase().replace(/\\/g, '/');
  const p = norm(path), n = norm(name), ne = n.replace(/\.[^.]+$/, '');
  if (p === n || p.endsWith('/' + n)) return 100;
  if (p.endsWith(ne) || p.endsWith('/' + ne)) return 90;
  let score = 0;
  const pp = p.split('/'), np = ne.split('/');
  for (let i = 1; i <= Math.min(pp.length, np.length); i++) {
    if (pp[pp.length - i] === np[np.length - i]) score += 10;
    else break;
  }
  if (p.includes(ne.split('/').pop())) score += 5;
  return score;
}

function bestMatch(path) {
  if (!path) return null;
  let best = null, bestScore = 0;
  Object.keys(textures).forEach(n => { const s = texScore(path, n); if (s > bestScore) { bestScore = s; best = n; } });
  return bestScore >= 5 ? best : null;
}

function autoAssignTexture(o) {
  if (!o.texture || !Object.keys(textures).length) return false;
  const m = bestMatch(o.texture);
  if (m && m !== o.texture) { o._resolvedTex = m; return true; }
  if (textures[o.texture]) { o._resolvedTex = o.texture; return false; }
  return false;
}

function autoAssignAll() {
  let c = 0;
  objects.forEach(o => { if (autoAssignTexture(o)) c++; });
  if (c) render();
  return c;
}

function getTexImg(o) {
  const k = o._resolvedTex || o.texture;
  if (!k || !textures[k]) return null;
  if (texImgCache[k]) return texImgCache[k];
  const img = new Image();
  img.src = textures[k];
  texImgCache[k] = img;
  return img;
}

function deleteTex(name, e) {
  e.stopPropagation();
  delete textures[name];
  delete texImgCache[name];
  buildTexPanel();
  saveTextures();
}

function buildTexPanel() {
  updateStorageBar();
  const grid = document.getElementById('tex-grid');
  const names = Object.keys(textures);
  if (!names.length) { grid.innerHTML = '<div class="tex-none">No textures loaded</div>'; return; }
  grid.innerHTML = '';
  names.forEach(name => {
    const card = document.createElement('div');
    card.className = 'tex-card';
    card.title = name;
    card.innerHTML = '<img src="' + textures[name] + '" alt="' + name + '"><div class="tex-card-name">' + name + '</div><div class="tex-card-del" onclick="deleteTex(\'' + name.replace(/'/g, "\\'") + '\',event)">x</div>';
    card.addEventListener('click', () => {
      const p = primarySel();
      if (p && 'texture' in p) { p.texture = name; p._resolvedTex = name; buildProps(); render(); }
    });
    grid.appendChild(card);
  });
}

async function exportZip() {
  if (typeof JSZip === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(s);
    await new Promise(r => s.onload = r);
  }
  const zip = new JSZip();
  const safe = (level.title || 'level').replace(/[\x00-\x1f\x7f\/\\:*?"<>|]/g, '-').toLowerCase();
  const folder = zip.folder(safe);
  folder.file('level.xml', buildXML());
  const texFolder = folder.folder('textures');
  Object.keys(textures).forEach(name => {
    const data = textures[name];
    const b64 = data.split(',')[1];
    if (b64) texFolder.file(name, b64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safe + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('ZIP exported');
}
