let LS_QUOTA = 10 * 1024 * 1024;

(async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) LS_QUOTA = Math.min(est.quota, 50 * 1024 * 1024);
    }
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
  saveSongs();
}

function saveTextures() {
  const texKeys = Object.keys(textures);
  if (texKeys.length === 0) return;
  const existing = Object.keys(localStorage).filter(k => k.startsWith('lb_tex_'));
  const currentKeys = new Set(texKeys.map(n => 'lb_tex_' + n));
  existing.forEach(k => { if (!currentKeys.has(k)) localStorage.removeItem(k); });
  texKeys.forEach(name => {
    try { localStorage.setItem('lb_tex_' + name, textures[name]); } catch (e) {
      console.warn('Could not save texture to localStorage (quota?):', name);
    }
  });
  try { localStorage.setItem('lb_tex_index', JSON.stringify(texKeys)); } catch (e) {}
}

function saveSongs() {
  const songKeys = Object.keys(songs);
  if (songKeys.length === 0) return;
  const existing = Object.keys(localStorage).filter(k => k.startsWith('lb_song_'));
  const currentKeys = new Set(songKeys.map(n => 'lb_song_' + n));
  existing.forEach(k => { if (!currentKeys.has(k)) localStorage.removeItem(k); });
  songKeys.forEach(name => {
    try { localStorage.setItem('lb_song_' + name, songs[name]); } catch (e) {
      console.warn('Could not save song to localStorage (quota?):', name);
    }
  });
  try { localStorage.setItem('lb_song_index', JSON.stringify(songKeys)); } catch (e) {}
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

function loadSongsFromStorage() {
  try {
    const idx = localStorage.getItem('lb_song_index');
    if (!idx) return;
    const names = JSON.parse(idx);
    names.forEach(name => {
      const data = localStorage.getItem('lb_song_' + name);
      if (data) songs[name] = data;
    });
  } catch (e) {}
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
    Object.keys(songs).forEach(n => { s += (n.length + songs[n].length) * 2; });
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

function texDrop(e) { e.preventDefault(); clsRm('tex-drop', 'over'); loadAssetFiles([...e.dataTransfer.files]); }
function texFilePicked(e) { loadAssetFiles([...e.target.files]); e.target.value = ''; }

function loadAssetFiles(files) {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  const audios = files.filter(f => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|flac)$/i.test(f.name));
  let pending = imgs.length + audios.length;
  if (!pending) return;
  let autoMatched = 0;

  const done = () => {
    pending--;
    if (pending <= 0) {
      const m = autoAssignAll();
      autoMatched += m;
      buildTexPanel();
      buildSongPanel();
      saveTextures();
      saveSongs();
      const total = imgs.length + audios.length;
      toast('Loaded ' + total + ' file' + (total > 1 ? 's' : '') + (autoMatched ? ' - auto-matched ' + autoMatched : ''));
      buildProps();
    }
  };

  imgs.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      textures[f.name] = ev.target.result;
      delete texImgCache[f.name];
      done();
    };
    reader.readAsDataURL(f);
  });

  audios.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      songs[f.name] = ev.target.result;
      done();
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
  try { localStorage.removeItem('lb_tex_' + name); } catch(_) {}
  try { localStorage.setItem('lb_tex_index', JSON.stringify(Object.keys(textures))); } catch(_) {}
  buildTexPanel();
  updateStorageBar();
}

function deleteSong(name, e) {
  e.stopPropagation();
  delete songs[name];
  try { localStorage.removeItem('lb_song_' + name); } catch(_) {}
  try { localStorage.setItem('lb_song_index', JSON.stringify(Object.keys(songs))); } catch(_) {}
  buildSongPanel();
  updateStorageBar();
}

function buildTexPanel() {
  updateStorageBar();
  const grid = document.getElementById('tex-grid');
  if (!grid) return;
  const names = Object.keys(textures);
  if (!names.length) { grid.innerHTML = '<div class="tex-none">No textures loaded</div>'; return; }
  grid.innerHTML = '';
  names.forEach(name => {
    const card = document.createElement('div');
    card.className = 'tex-card';
    card.title = name;
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    card.innerHTML = '<img src="' + textures[name] + '" alt="' + name + '"><div class="tex-card-name">' + name + '</div><div class="tex-card-del" onclick="deleteTex(\'' + safeName + '\',event)">×</div>';
    card.addEventListener('click', () => {
      const p = primarySel();
      if (p && 'texture' in p) { p.texture = name; p._resolvedTex = name; buildProps(); render(); }
    });
    grid.appendChild(card);
  });
}

function buildSongPanel() {
  updateStorageBar();
  const list = document.getElementById('song-grid');
  if (!list) return;
  const names = Object.keys(songs);
  if (!names.length) { list.innerHTML = '<div class="tex-none">No songs loaded</div>'; return; }
  list.innerHTML = '';
  names.forEach(name => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.title = name;
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    card.innerHTML = `
      <div class="song-card-icon">♪</div>
      <div class="song-card-name">${name}</div>
      <button class="song-card-play" onclick="previewSong('${safeName}',event)" title="Preview">▶</button>
      <div class="tex-card-del" onclick="deleteSong('${safeName}',event)" style="position:relative;width:14px;height:14px">×</div>
    `;
    card.addEventListener('click', e => {
      if (e.target.closest('.song-card-play') || e.target.closest('.tex-card-del')) return;
      const p = primarySel();
      if (p && 'song' in p) { p.song = name; buildProps(); debouncedSave(); }
      const songSel = document.getElementById('lvl-song-sel');
      if (songSel) { level.song = name; songSel.value = name; debouncedSave(); }
    });
    list.appendChild(card);
  });
}

let _previewAudio = null;
function previewSong(name, e) {
  e.stopPropagation();
  if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; }
  if (!songs[name]) return;
  _previewAudio = new Audio(songs[name]);
  _previewAudio.volume = 0.4;
  _previewAudio.play().catch(() => {});
  setTimeout(() => { if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; } }, 5000);
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
  const songFolder = folder.folder('sounds');
  Object.keys(songs).forEach(name => {
    const data = songs[name];
    const b64 = data.split(',')[1];
    if (b64) songFolder.file(name, b64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safe + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('ZIP exported');
}