const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mmCv = document.getElementById('minimap');
const mmCtx = mmCv.getContext('2d');
const wrap = document.getElementById('canvas-wrap');

const HCUR = { se: 'se-resize', sw: 'sw-resize', ne: 'ne-resize', nw: 'nw-resize', e: 'e-resize', w: 'w-resize', s: 's-resize', n: 'n-resize' };

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool-seg .btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tool-' + t);
  if (btn) btn.classList.add('active');
  setCursor();
}

function setCursor(handle) {
  if (handle) canvas.style.cursor = HCUR[handle] || 'default';
  else if (tool === 'pan') canvas.style.cursor = 'grab';
  else if (tool === 'place') canvas.style.cursor = 'crosshair';
  else canvas.style.cursor = 'default';
}

function changeZoom(d) {
  zoom = Math.max(0.05, Math.min(5, zoom + d));
  document.getElementById('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
  render();
}

function fitView() {
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  zoom = Math.min(cw / level.worldWidth, ch / level.worldHeight) * 0.9;
  pan.x = (cw - level.worldWidth * zoom) / 2;
  pan.y = (ch - level.worldHeight * zoom) / 2;
  document.getElementById('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
  render();
}

function focusSelected() {
  if (!selSet.size) return;
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  selSet.forEach(o => {
    const g = gameRect(o);
    x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y);
    x2 = Math.max(x2, g.x + g.w); y2 = Math.max(y2, g.y + g.h);
  });
  const gw = x2 - x1, gh = y2 - y1;
  const pad = 80;
  zoom = Math.min(5, Math.max(0.05, (cw - pad * 2) / Math.max(gw, 1), (ch - pad * 2) / Math.max(gh, 1)));
  zoom = Math.min(zoom, 4);
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  pan.x = cw / 2 - cx * zoom;
  pan.y = ch / 2 - (level.worldHeight - cy) * zoom;
  document.getElementById('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
  render();
}

function selectOnly(o) {
  selSet = new Set();
  if (o) selSet.add(o);
  const body = document.getElementById('props-body');
  if (body) body.dataset.objId = '';
  buildProps();
  buildHierarchy(document.getElementById('hier-search').value || '');
  updateSelStatus();
}

function updateSelStatus() {
  const p = primarySel();
  if (!selSet.size) document.getElementById('sb-sel').textContent = 'Nothing selected';
  else if (p) document.getElementById('sb-sel').textContent = p.type + (p.name ? ' [' + p.name + ']' : '') + ' @ (' + Math.round(p.x || 0) + ', ' + Math.round(p.y || 0) + ')';
  else document.getElementById('sb-sel').textContent = selSet.size + ' objects selected';
}

function findAt(sx, sy) {
  const gp = s2g(sx, sy);
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    const g = gameRect(o);
    if (gp.x >= g.x && gp.x <= g.x + g.w && gp.y >= g.y && gp.y <= g.y + g.h) return o;
  }
  return null;
}

function findInBox(gx1, gy1, gx2, gy2) {
  const x1 = Math.min(gx1, gx2), x2 = Math.max(gx1, gx2);
  const y1 = Math.min(gy1, gy2), y2 = Math.max(gy1, gy2);
  return objects.filter(o => { const g = gameRect(o); return g.x + g.w > x1 && g.x < x2 && g.y + g.h > y1 && g.y < y2; });
}

function getHandle(o, sx, sy) {
  if (!canResize(o)) return null;
  const r = scrRect(o);
  const hs = 7;
  const ex = r.x + r.w, ey = r.y + r.h;
  if (Math.abs(sx - ex) < hs && Math.abs(sy - ey) < hs) return 'se';
  if (Math.abs(sx - r.x) < hs && Math.abs(sy - ey) < hs) return 'sw';
  if (Math.abs(sx - ex) < hs && Math.abs(sy - r.y) < hs) return 'ne';
  if (Math.abs(sx - r.x) < hs && Math.abs(sy - r.y) < hs) return 'nw';
  if (Math.abs(sx - ex) < hs && sy > r.y + hs && sy < ey - hs) return 'e';
  if (Math.abs(sx - r.x) < hs && sy > r.y + hs && sy < ey - hs) return 'w';
  if (Math.abs(sy - ey) < hs && sx > r.x + hs && sx < ex - hs) return 's';
  if (Math.abs(sy - r.y) < hs && sx > r.x + hs && sx < ex - hs) return 'n';
  return null;
}

canvas.addEventListener('mousedown', e => {
  if (e.button === 2) return;
  const rc = canvas.getBoundingClientRect();
  const sx = e.clientX - rc.left, sy = e.clientY - rc.top;
  const gp = s2g(sx, sy);

  if (pickMode) {
    const hit = findAt(sx, sy);
    if (hit) {
      const { key, targetType } = pickMode;
      let val = '';
      if (targetType === 'portal') val = hit['portal-id'] || '';
      else if (targetType === 'key') val = hit.keyId || '';
      else if (targetType === 'area') val = hit.id || '';
      const p = primarySel();
      if (p && val) { p[key] = val; updatePropInputs(); buildProps(); }
    }
    pickMode = null;
    document.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('picking'));
    canvas.style.cursor = 'default';
    e.preventDefault();
    return;
  }

  if (e.button === 1 || (e.button === 0 && (tool === 'pan' || spaceHeld))) {
    dragging = true; dragType = 'pan';
    ds.panX = pan.x; ds.panY = pan.y; ds.cx = e.clientX; ds.cy = e.clientY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button === 0 && tool === 'place' && placeType) {
    pushUndo();
    const o = defaultObj(placeType);
    o._id = mkId();
    if (['orb', 'coin', 'key'].includes(o.type)) { o.x = sn(gp.x); o.y = sn(gp.y); }
    else if (o.type === 'movingPlatformUp') { o.x = sn(gp.x); o.startY = sn(gp.y); o.endY = sn(gp.y + 300); }
    else if (o.type === 'movingPlatformRight') { o.startX = sn(gp.x); o.y = sn(gp.y); o.endX = sn(gp.x + 300); }
    else { o.x = sn(gp.x); o.y = sn(gp.y); }
    autoAssignTexture(o);
    objects.push(o);
    selectOnly(o);
    refresh();
    return;
  }

  if (e.button === 0 && tool === 'select') {
    const p = primarySel();
    if (p && canResize(p)) {
      const h = getHandle(p, sx, sy);
      if (h) {
        pushUndo(); dragging = true; dragType = 'r-' + h;
        const g = gameRect(p);
        ds.ox = g.x; ds.oy = g.y; ds.ow = g.w; ds.oh = g.h;
        ds.cx = sx; ds.cy = sy;
        return;
      }
    }
    const hit = findAt(sx, sy);
    if (hit) {
      if (e.shiftKey) { if (selSet.has(hit)) selSet.delete(hit); else selSet.add(hit); buildProps(); buildHierarchy(); updateSelStatus(); }
      else if (!selSet.has(hit)) { selectOnly(hit); }
      if (selSet.has(hit)) {
        const g = gameRect(hit);
        dragging = true; dragType = 'move';
        ds.cx = sx; ds.cy = sy; ds.ox = g.x; ds.oy = g.y;
        ds._starts = new Map();
        selSet.forEach(o => { const gr = gameRect(o); ds._starts.set(o._id, { x: gr.x, y: gr.y, startX: o.startX, startY: o.startY, endX: o.endX, endY: o.endY }); });
      }
    } else {
      if (!e.shiftKey) selectOnly(null);
      dragging = true; dragType = 'box';
      ds.cx = sx; ds.cy = sy; ds.boxX = gp.x; ds.boxY = gp.y; ds._boxEndX = gp.x; ds._boxEndY = gp.y;
    }
    render();
  }
});

canvas.addEventListener('mousemove', e => {
  const rc = canvas.getBoundingClientRect();
  const sx = e.clientX - rc.left, sy = e.clientY - rc.top;
  const gp = s2g(sx, sy);
  mwx = gp.x; mwy = gp.y;
  document.getElementById('sb-coords').textContent = 'X: ' + Math.round(gp.x) + '  Y: ' + Math.round(gp.y);
  const p = primarySel();
  if (!dragging && tool === 'select' && p && canResize(p)) setCursor(getHandle(p, sx, sy));
  if (!dragging) { render(); return; }

  if (dragType === 'pan') {
    pan.x = ds.panX + (e.clientX - ds.cx);
    pan.y = ds.panY + (e.clientY - ds.cy);
    render(); return;
  }

  const dsx = sx - ds.cx;
  const dsy = sy - ds.cy;
  const dgx = dsx / zoom;
  const dgy = -dsy / zoom;

  if (dragType === 'move') {
    selSet.forEach(o => {
      const s = ds._starts && ds._starts.get(o._id);
      if (!s) return;
      if (o.type === 'movingPlatformUp') {
        const newSY = sn((s.startY !== undefined ? s.startY : s.y) + dgy);
        const diff = newSY - (o.startY || 0);
        o.x = sn(s.x + dgx); o.startY = newSY; o.endY = (s.endY !== undefined ? s.endY : o.endY) + diff;
      } else if (o.type === 'movingPlatformRight') {
        const newSX = sn((s.startX !== undefined ? s.startX : s.x) + dgx);
        const diff = newSX - (o.startX || 0);
        o.startX = newSX; o.endX = (s.endX !== undefined ? s.endX : o.endX) + diff; o.y = sn(s.y + dgy);
      } else {
        o.x = sn(s.x + dgx); o.y = sn(s.y + dgy);
      }
    });
    if (selSet.size === 1) updatePropInputs();
    render(); return;
  }

  if (dragType.startsWith('r-') && p) {
    const h = dragType.slice(2);
    let { ox, oy, ow, oh } = ds;
    let nx = ox, ny = oy, nw = ow, nh = oh;
    if (h.includes('e')) { nw = sn(ow + dgx); }
    if (h.includes('w')) { nx = sn(ox + dgx); nw = sn(ow - dgx); }
    if (h.includes('n')) { nh = sn(oh + dgy); }
    if (h.includes('s')) { ny = sn(oy + dgy); nh = sn(oh - dgy); }
    const moveX = h.includes('w');
    const moveY = h.includes('s');
    applyRect(p, nx, ny, nw, nh, moveX, moveY);
    updatePropInputs();
    render(); return;
  }

  if (dragType === 'box') {
    boxActive = true;
    ds._boxEndX = gp.x; ds._boxEndY = gp.y;
    render();
  }
});

canvas.addEventListener('mouseup', e => {
  if (dragging) {
    if (dragType === 'move' || (dragType && dragType.startsWith('r-'))) pushUndo();
    if (dragType === 'box' && boxActive) {
      const found = findInBox(ds.boxX, ds.boxY, ds._boxEndX, ds._boxEndY);
      if (e.shiftKey) found.forEach(o => selSet.add(o));
      else selSet = new Set(found);
      buildProps(); buildHierarchy(); updateSelStatus();
    }
  }
  dragging = false; dragType = null; boxActive = false;
  if (!spaceHeld) setCursor(); else canvas.style.cursor = 'grab';
  render();
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const rc = canvas.getBoundingClientRect();
  const hit = findAt(e.clientX - rc.left, e.clientY - rc.top);
  if (hit) { if (!selSet.has(hit)) selectOnly(hit); render(); showCtx(e.clientX, e.clientY); }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rc = canvas.getBoundingClientRect();
  const sx = e.clientX - rc.left, sy = e.clientY - rc.top;
  const wBefore = s2g(sx, sy);
  zoom = Math.max(0.05, Math.min(5, zoom + (e.deltaY < 0 ? 0.12 : -0.12)));
  document.getElementById('zoom-lbl').textContent = Math.round(zoom * 100) + '%';
  const wAfter = s2g(sx, sy);
  pan.x += (wAfter.x - wBefore.x) * zoom;
  pan.y -= (wAfter.y - wBefore.y) * zoom;
  render();
}, { passive: false });

document.addEventListener('keydown', e => {
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
  if (e.code === 'Space' && !inField) { e.preventDefault(); spaceHeld = true; canvas.style.cursor = 'grab'; return; }
  if (inField) return;

  const C = e.ctrlKey || e.metaKey;
  if (C && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (C && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
  if (C && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (C && e.key === 'c') { e.preventDefault(); ctxCopy(); return; }
  if (C && e.key === 'v') { e.preventDefault(); ctxPaste(); return; }
  if (C && e.key === '0') { e.preventDefault(); fitView(); return; }
  if (C && e.key === 'g') { e.preventDefault(); groupSelected(); return; }
  if (!C && e.key === 't') { e.preventDefault(); startTestPlay(); return; }

  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  if (e.key === 'Escape') {
    if (pickMode) {
      pickMode = null;
      document.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('picking'));
      canvas.style.cursor = 'default';
      return;
    }
    if (tool === 'place') {
      placeType = null;
      document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
      setTool('select');
    } else {
      selectOnly(null); render();
    }
  }
  if (e.key === 'f' || e.key === 'F') focusSelected();
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'p' || e.key === 'P') setTool('place');
  if (e.key === 'h' || e.key === 'H') setTool('pan');
  if (e.key === '?') openShortcuts();
  if (e.key === ']') ctxUp();
  if (e.key === '[') ctxDown();

  if (selSet.size > 0) {
    const N = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { selSet.forEach(o => { o.x = (o.x || 0) - N; if (o.startX !== undefined) { o.startX -= N; o.endX = (o.endX || 0) - N; } }); updatePropInputs(); render(); }
    if (e.key === 'ArrowRight') { selSet.forEach(o => { o.x = (o.x || 0) + N; if (o.startX !== undefined) { o.startX += N; o.endX = (o.endX || 0) + N; } }); updatePropInputs(); render(); }
    if (e.key === 'ArrowUp') { selSet.forEach(o => { o.y = (o.y || 0) + N; if (o.startY !== undefined) { o.startY += N; o.endY = (o.endY || 0) + N; } }); updatePropInputs(); render(); }
    if (e.key === 'ArrowDown') { selSet.forEach(o => { o.y = (o.y || 0) - N; if (o.startY !== undefined) { o.startY -= N; o.endY = (o.endY || 0) - N; } }); updatePropInputs(); render(); }
  }
});

document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceHeld = false; setCursor(); } });

window.addEventListener('resize', () => render());