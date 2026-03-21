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
  document.getElementById('sb-count').textContent = objects.length + ' objects';
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
  document.querySelectorAll('.floating-panel').forEach(panel => {
    const handle = panel.querySelector('.panel-drag-handle');
    if (!handle) return;

    const savedPos = localStorage.getItem('lb_panel_' + panel.id);
    if (savedPos) {
      const pos = JSON.parse(savedPos);
      panel.style.left = pos.left;
      panel.style.top = pos.top;
      panel.style.width = pos.width || panel.style.width;
      panel.style.height = pos.height || panel.style.height;
    }

    let startX, startY, startLeft, startTop;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      panel.classList.add('dragging-panel');
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
    });

    function onDrag(e) {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      let newLeft = startLeft + dx, newTop = startTop + dy;
      newLeft = Math.max(0, Math.min(window.innerWidth - 40, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 40, newTop));
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }

    function onDragEnd() {
      panel.classList.remove('dragging-panel');
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      localStorage.setItem('lb_panel_' + panel.id, JSON.stringify({
        left: panel.style.left, top: panel.style.top,
        width: panel.style.width, height: panel.style.height
      }));
    }

    const resizeHandle = panel.querySelector('.panel-resize-handle');
    if (resizeHandle) {
      let rStartX, rStartY, rStartW, rStartH;
      resizeHandle.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        rStartX = e.clientX; rStartY = e.clientY;
        rStartW = panel.offsetWidth; rStartH = panel.offsetHeight;
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd);
      });
      function onResize(e) {
        const nw = Math.max(160, rStartW + e.clientX - rStartX);
        const nh = Math.max(120, rStartH + e.clientY - rStartY);
        panel.style.width = nw + 'px';
        panel.style.height = nh + 'px';
      }
      function onResizeEnd() {
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', onResizeEnd);
        localStorage.setItem('lb_panel_' + panel.id, JSON.stringify({
          left: panel.style.left, top: panel.style.top,
          width: panel.style.width, height: panel.style.height
        }));
      }
    }
  });
}

function initDraggablePanels() {
  document.querySelectorAll('.floating-panel').forEach(panel => {
    const id = panel.id;
    const saved = localStorage.getItem('lb_panel_' + id);
    if (saved) {
      try {
        const { left, top, width, height } = JSON.parse(saved);
        if (left !== undefined) panel.style.left = left;
        if (top !== undefined) panel.style.top = top;
        if (width !== undefined) panel.style.width = width;
        if (height !== undefined) panel.style.height = height;
      } catch(e) {}
    }

    const handle = panel.querySelector('.panel-drag-handle');
    if (!handle) return;

    let ox = 0, oy = 0, startL = 0, startT = 0;
    let draggingPanel = false;

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      draggingPanel = true;
      const rect = panel.getBoundingClientRect();
      ox = e.clientX - rect.left;
      oy = e.clientY - rect.top;
      startL = rect.left;
      startT = rect.top;
      panel.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!draggingPanel) return;
      let nx = e.clientX - ox;
      let ny = e.clientY - oy;
      nx = Math.max(0, Math.min(nx, window.innerWidth - 60));
      ny = Math.max(0, Math.min(ny, window.innerHeight - 40));
      panel.style.left = nx + 'px';
      panel.style.top = ny + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!draggingPanel) return;
      draggingPanel = false;
      const rect = panel.getBoundingClientRect();
      localStorage.setItem('lb_panel_' + id, JSON.stringify({
        left: panel.style.left, top: panel.style.top,
        width: panel.style.width, height: panel.style.height,
      }));
    });

    const resizeHandle = panel.querySelector('.panel-resize-handle');
    if (resizeHandle) {
      let resizing = false, rox = 0, roy = 0, rw = 0, rh = 0;
      resizeHandle.addEventListener('mousedown', e => {
        resizing = true;
        const rect = panel.getBoundingClientRect();
        rox = e.clientX; roy = e.clientY;
        rw = rect.width; rh = rect.height;
        e.preventDefault(); e.stopPropagation();
      });
      document.addEventListener('mousemove', e => {
        if (!resizing) return;
        const nw = Math.max(180, rw + (e.clientX - rox));
        const nh = Math.max(120, rh + (e.clientY - roy));
        panel.style.width = nw + 'px';
        panel.style.height = nh + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (!resizing) return;
        resizing = false;
        localStorage.setItem('lb_panel_' + id, JSON.stringify({
          left: panel.style.left, top: panel.style.top,
          width: panel.style.width, height: panel.style.height,
        }));
      });
    }
  });
}