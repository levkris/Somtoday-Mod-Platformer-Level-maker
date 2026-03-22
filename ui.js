function switchLeft(id, btn) {
  document.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ltab-' + id).classList.add('active');
  if (id === 'hierarchy') buildHierarchy();
}

function switchRight(id, btn) {
  document.querySelectorAll('.right-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.right-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rtab-' + id).classList.add('active');
  if (id === 'textures') { buildTexPanel(); updateStorageBar(); }
  if (id === 'songs') { buildSongPanel(); updateStorageBar(); }
}

function clsAdd(e, id, cls) { e.preventDefault(); document.getElementById(id).classList.add(cls); }
function clsRm(id, cls) { document.getElementById(id).classList.remove(cls); }

function openImport() { document.getElementById('modal-import').classList.add('open'); }
function openExport() { document.getElementById('export-xml').value = buildXML(); document.getElementById('modal-export').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openShortcuts() {
  const grid = document.getElementById('sc-grid');
  grid.innerHTML = SHORTCUTS.map(s =>
    '<div class="sc-row"><span class="sc-desc">' + s[0] + '</span><span class="sc-keys">' +
    s[1].split('+').map(k => '<span class="kbd">' + k.trim() + '</span>').join('') +
    '</span></div>'
  ).join('');
  document.getElementById('modal-keys').classList.add('open');
}

function showCtx(x, y) {
  const m = document.getElementById('ctx-menu');
  m.style.left = Math.min(x, window.innerWidth - 170) + 'px';
  m.style.top = Math.min(y, window.innerHeight - 240) + 'px';
  m.classList.add('open');
}
function hideCtx() { document.getElementById('ctx-menu').classList.remove('open'); }
document.addEventListener('mousedown', e => { if (!e.target.closest('#ctx-menu')) hideCtx(); });

let _tt = null;
function toast(msg, err) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = err ? 'rgba(252,64,64,0.5)' : 'rgba(76,175,80,0.5)';
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2800);
}

function deleteSelected() {
  if (!selSet.size) return;
  pushUndo();
  const ids = new Set([...selSet].map(o => o._id));
  objects = objects.filter(o => !ids.has(o._id));
  Object.keys(groups).forEach(gid => {
    groups[gid] = groups[gid].filter(id => !ids.has(id));
    if (!groups[gid].length) delete groups[gid];
  });
  selSet = new Set();
  const body = document.getElementById('props-body');
  if (body) body.dataset.objId = '';
  refresh();
}

function duplicateSelected() {
  if (!selSet.size) return;
  if (!checkLimit(selSet.size)) return;
  pushUndo();
  const news = [];
  selSet.forEach(o => {
    const c = JSON.parse(JSON.stringify(o));
    c._id = mkId();
    c.x = (c.x || 0) + snapSize * 2; c.y = (c.y || 0) - snapSize * 2;
    if (c.startY !== undefined) { c.startY -= snapSize * 2; c.endY -= snapSize * 2; }
    if (c.startX !== undefined) { c.startX += snapSize * 2; c.endX += snapSize * 2; }
    news.push(c); objects.push(c);
  });
  selSet = new Set(news);
  refresh();
}

function ctxCopy() { clipboard = [...selSet].map(o => JSON.parse(JSON.stringify(o))); hideCtx(); }
function ctxPaste() {
  if (!clipboard || !clipboard.length) return;
  if (!checkLimit(clipboard.length)) return;
  pushUndo();
  const news = clipboard.map(o => {
    const c = JSON.parse(JSON.stringify(o)); c._id = mkId();
    c.x = (c.x || 0) + snapSize * 2; c.y = (c.y || 0) - snapSize * 2;
    if (c.startY !== undefined) c.startY -= snapSize * 2;
    if (c.startX !== undefined) c.startX += snapSize * 2;
    return c;
  });
  news.forEach(o => objects.push(o));
  selSet = new Set(news);
  refresh(); hideCtx();
}
function ctxDupe() { duplicateSelected(); hideCtx(); }

function ctxUp() {
  const p = primarySel(); if (!p) return;
  const i = objects.indexOf(p);
  if (i < objects.length - 1) { pushUndo(); [objects[i], objects[i + 1]] = [objects[i + 1], objects[i]]; refresh(); }
  hideCtx();
}
function ctxDown() {
  const p = primarySel(); if (!p) return;
  const i = objects.indexOf(p);
  if (i > 0) { pushUndo(); [objects[i], objects[i - 1]] = [objects[i - 1], objects[i]]; refresh(); }
  hideCtx();
}

function groupSelected() {
  if (selSet.size < 2) { toast('Select 2+ objects to group', true); return; }
  pushUndo();
  const gid = 'group_' + mkId();
  groups[gid] = [...selSet].map(o => o._id);
  toast('Grouped ' + selSet.size + ' objects as ' + gid);
  refresh();
}

function ungroupSelected() {
  const toRm = new Set();
  Object.keys(groups).forEach(gid => {
    const members = groups[gid].map(id => objects.find(o => o._id === id)).filter(Boolean);
    if (members.some(o => selSet.has(o))) toRm.add(gid);
  });
  if (!toRm.size) { toast('Nothing to ungroup', true); return; }
  pushUndo(); toRm.forEach(gid => delete groups[gid]);
  toast('Ungrouped'); refresh();
}

function openRenameGroup(gid) {
  renamingGroupId = gid;
  document.getElementById('rename-group-input').value = gid;
  document.getElementById('modal-rename-group').classList.add('open');
  setTimeout(() => document.getElementById('rename-group-input').select(), 50);
}

function doRenameGroup() {
  const newName = document.getElementById('rename-group-input').value.trim();
  if (!newName || !renamingGroupId) return;
  if (newName === renamingGroupId) { closeModal('modal-rename-group'); return; }
  if (groups[newName]) { toast('Name already exists', true); return; }
  pushUndo();
  groups[newName] = groups[renamingGroupId];
  delete groups[renamingGroupId];
  renamingGroupId = null;
  closeModal('modal-rename-group');
  refresh(); toast('Renamed to ' + newName);
}

document.getElementById('rename-group-input').addEventListener('keydown', e => { if (e.key === 'Enter') doRenameGroup(); });

function buildHierarchy(filter) {
  filter = filter || '';
  const list = document.getElementById('hier-list');
  list.innerHTML = '';
  const q = filter.toLowerCase();
  const processed = new Set();
  let hierDragId = null;

  function makeItem(o, inGrp) {
    const col = CMAP[o.type] || '#9b9b9c';
    const div = document.createElement('div');
    div.className = 'hier-item' + (inGrp ? ' in-group' : '') + (selSet.has(o) ? ' sel' : '');
    div.draggable = true;
    div.dataset.oid = o._id;
    div.innerHTML = '<span class="hdot" style="background:' + col + '"></span><span class="hname">' + (o.name || o.type) + '</span><span class="htype">' + o.type + '</span>';
    div.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) { if (selSet.has(o)) selSet.delete(o); else selSet.add(o); }
      else selSet = new Set([o]);
      buildProps(); buildHierarchy(filter); updateSelStatus(); render();
    });
    div.addEventListener('dragstart', e => {
      hierDragId = o._id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(o._id));
      setTimeout(() => div.classList.add('dragging'), 0);
    });
    div.addEventListener('dragend', () => { hierDragId = null; div.classList.remove('dragging'); });
    return div;
  }

  function dropIntoGroup(gid, draggedId) {
    if (!gid || !draggedId) return;
    if (!objects.find(o => o._id === draggedId)) return;
    if (groups[gid] && groups[gid].includes(draggedId)) return;
    const alreadyInOther = Object.keys(groups).some(g => g !== gid && groups[g].includes(draggedId));
    if (alreadyInOther) { toast('Remove from its current group first', true); return; }
    pushUndo();
    if (groups[gid]) groups[gid].push(draggedId);
    else groups[gid] = [draggedId];
    refresh();
  }

  function dropToRoot(draggedId) {
    if (!draggedId) return;
    const inAny = Object.keys(groups).some(g => groups[g].includes(draggedId));
    if (!inAny) return;
    pushUndo();
    Object.keys(groups).forEach(g => { groups[g] = groups[g].filter(id => id !== draggedId); if (!groups[g].length) delete groups[g]; });
    refresh();
  }

  Object.keys(groups).forEach(gid => {
    const members = groups[gid].map(id => objects.find(o => o._id === id)).filter(Boolean);
    if (!members.length) return;
    const vis = members.filter(o => !q || (o.type + ' ' + (o.name || '')).toLowerCase().includes(q));
    if (!vis.length) return;

    const grpEl = document.createElement('div'); grpEl.className = 'hier-group';
    const hdr = document.createElement('div'); hdr.className = 'hier-group-hdr';
    const anySel = members.some(o => selSet.has(o));
    const selIcon = document.createElement('span'); selIcon.style.fontSize = '9px'; selIcon.textContent = anySel ? '■' : '□';
    const nameSpan = document.createElement('span'); nameSpan.style.flex = '1'; nameSpan.textContent = gid;
    const countSpan = document.createElement('span'); countSpan.style.cssText = 'font-size:8px;color:var(--dim)'; countSpan.textContent = members.length;
    const renameBtn = document.createElement('span'); renameBtn.style.cssText = 'font-size:9px;cursor:pointer;padding:0 4px;opacity:0.6'; renameBtn.title = 'Rename'; renameBtn.textContent = '✎';
    renameBtn.addEventListener('click', e => { e.stopPropagation(); openRenameGroup(gid); });
    hdr.append(selIcon, nameSpan, countSpan, renameBtn);
    hdr.addEventListener('click', () => { selSet = new Set(members); buildProps(); buildHierarchy(filter); updateSelStatus(); render(); });
    grpEl.addEventListener('dragover', e => { const id = +(e.dataTransfer.getData('text/plain') || hierDragId || 0); if (!id) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; grpEl.classList.add('drag-over'); });
    grpEl.addEventListener('dragleave', e => { if (!grpEl.contains(e.relatedTarget)) grpEl.classList.remove('drag-over'); });
    grpEl.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); grpEl.classList.remove('drag-over'); const id = +(e.dataTransfer.getData('text/plain') || hierDragId || 0); dropIntoGroup(gid, id); });
    grpEl.appendChild(hdr);
    vis.forEach(o => { processed.add(o._id); grpEl.appendChild(makeItem(o, true)); });
    list.appendChild(grpEl);
  });

  const rootDrop = document.createElement('div');
  rootDrop.className = 'hier-root-drop';
  rootDrop.textContent = 'drop here to remove from group';
  rootDrop.addEventListener('dragover', e => { const id = +(e.dataTransfer.getData('text/plain') || hierDragId || 0); if (!id) return; const inAny = Object.keys(groups).some(g => groups[g].includes(id)); if (!inAny) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; rootDrop.classList.add('drag-over'); });
  rootDrop.addEventListener('dragleave', () => rootDrop.classList.remove('drag-over'));
  rootDrop.addEventListener('drop', e => { e.preventDefault(); rootDrop.classList.remove('drag-over'); const id = +(e.dataTransfer.getData('text/plain') || hierDragId || 0); dropToRoot(id); });
  list.appendChild(rootDrop);

  [...objects].reverse().forEach(o => {
    if (processed.has(o._id)) return;
    if (q && !(o.type + ' ' + (o.name || '') + ' ' + (o.id || '')).toLowerCase().includes(q)) return;
    list.appendChild(makeItem(o, false));
  });
}

function refresh() {
  render();
  buildHierarchy(document.getElementById('hier-search').value || '');
  buildProps();
  const el = document.getElementById('sb-count');
  el.textContent = objects.length + ' / ' + MAX_OBJECTS + ' objects';
  el.style.color = objects.length >= MAX_OBJECTS ? 'var(--red)' : objects.length >= MAX_OBJECTS * 0.9 ? 'var(--yellow)' : '';
}

function buildPalette() {
  const el = document.getElementById('obj-type-list');
  OBJ_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'obj-btn'; btn.id = 'objbtn_' + t.id;
    btn.innerHTML = '<span class="dot" style="background:' + t.color + '"></span>' + t.label;
    btn.addEventListener('click', () => {
      placeType = t.id; setTool('place');
      document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    el.appendChild(btn);
  });
}

function initDraggablePanels() {
  const leftPanel = document.getElementById('panel-left');
  const rightPanel = document.getElementById('panel-right');

  function loadWidth(id, fallback) {
    try {
      const saved = localStorage.getItem('lb_panel_w_' + id);
      if (saved) return Math.max(160, parseInt(saved));
    } catch(e) {}
    return fallback;
  }

  function saveWidth(id, w) {
    try { localStorage.setItem('lb_panel_w_' + id, w); } catch(e) {}
  }

  leftPanel.style.width = loadWidth('left', 192) + 'px';
  rightPanel.style.width = loadWidth('right', 252) + 'px';

  function makeResizer(panel, side) {
    const handle = document.createElement('div');
    handle.className = 'panel-edge-resize panel-edge-resize-' + side;
    panel.appendChild(handle);

    let resizing = false;
    let startX = 0;
    let startW = 0;
    const id = side === 'right' ? 'left' : 'right';

    const onMove = e => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const nw = Math.max(160, Math.min(600, side === 'right' ? startW + dx : startW - dx));
      panel.style.width = nw + 'px';
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      saveWidth(id, parseInt(panel.style.width));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      resizing = true;
      startX = e.clientX;
      startW = panel.offsetWidth;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });
  }

  makeResizer(leftPanel, 'right');
  makeResizer(rightPanel, 'left');
}