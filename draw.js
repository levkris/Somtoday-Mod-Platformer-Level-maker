function render() {
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  canvas.width = cw; canvas.height = ch;
  ctx.clearRect(0, 0, cw, ch);

  const wx0 = pan.x, wy0 = pan.y;
  const ww = level.worldWidth * zoom, wh = level.worldHeight * zoom;

  const bg = ctx.createLinearGradient(0, wy0, 0, wy0 + wh);
  bg.addColorStop(0, level.bgColor2 || level.bgColor || '#0e0302');
  bg.addColorStop(1, level.bgColor || '#1a0806');
  ctx.fillStyle = bg;
  ctx.fillRect(wx0, wy0, ww, wh);

  if (showGrid) {
    const gs = snapSize, major = gs * 5;
    ctx.lineWidth = 0.5;
    const gxS = Math.floor(-pan.x / zoom / gs) * gs, gxE = gxS + cw / zoom + gs * 2;
    const gyS = Math.floor(-pan.y / zoom / gs) * gs, gyE = gyS + ch / zoom + gs * 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    for (let gx = gxS; gx < gxE; gx += gs) {
      if (gx % major === 0) continue;
      const cx = pan.x + gx * zoom;
      ctx.beginPath(); ctx.moveTo(cx, wy0); ctx.lineTo(cx, wy0 + wh); ctx.stroke();
    }
    for (let gy = gyS; gy < gyE; gy += gs) {
      if (gy % major === 0) continue;
      const cy = wy0 + wh - gy * zoom;
      ctx.beginPath(); ctx.moveTo(wx0, cy); ctx.lineTo(wx0 + ww, cy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.065)';
    for (let gx = gxS; gx < gxE; gx += major) {
      const cx = pan.x + gx * zoom;
      ctx.beginPath(); ctx.moveTo(cx, wy0); ctx.lineTo(cx, wy0 + wh); ctx.stroke();
    }
    for (let gy = gyS; gy < gyE; gy += major) {
      const cy = wy0 + wh - gy * zoom;
      ctx.beginPath(); ctx.moveTo(wx0, cy); ctx.lineTo(wx0 + ww, cy); ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(wx0, wy0, ww, wh);

  const sc = g2c(level.spawnX, level.spawnY, 0);
  ctx.fillStyle = '#4caf50';
  ctx.beginPath(); ctx.arc(sc.x, sc.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('S', sc.x, sc.y);

  objects.forEach(o => drawObj(o));

  Object.keys(groups).forEach(gid => {
    const members = groups[gid].map(id => objects.find(o => o._id === id)).filter(Boolean);
    if (!members.length) return;
    let mx = Infinity, my = Infinity, mX = -Infinity, mY = -Infinity;
    members.forEach(o => {
      const r = scrRect(o);
      mx = Math.min(mx, r.x); my = Math.min(my, r.y);
      mX = Math.max(mX, r.x + r.w); mY = Math.max(mY, r.y + r.h);
    });
    ctx.strokeStyle = 'rgba(91,156,246,0.3)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.strokeRect(mx - 4, my - 4, mX - mx + 8, mY - my + 8);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(91,156,246,0.55)';
    ctx.font = '8px JetBrains Mono,monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(gid, mx, my - 6);
  });

  const inBox = dragType === 'box' && boxActive;

  if (selSet.size === 1 && !inBox) {
    const p = primarySel();
    const r = scrRect(p);
    ctx.strokeStyle = '#5b9cf6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); ctx.setLineDash([]);
    if (canResize(p)) {
      const hs = 5;
      ctx.fillStyle = '#5b9cf6';
      [
        [r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h],
        [r.x + r.w / 2, r.y], [r.x + r.w, r.y + r.h / 2], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h / 2],
      ].forEach(pt => ctx.fillRect(pt[0] - hs / 2, pt[1] - hs / 2, hs, hs));
    }
  } else if (selSet.size > 1 && !inBox) {
    selSet.forEach(o => {
      const r = scrRect(o);
      ctx.strokeStyle = 'rgba(91,156,246,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2]);
      ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); ctx.setLineDash([]);
    });
    const gb = selBounds();
    if (gb) {
      const c = g2c(gb.x, gb.y, gb.h);
      ctx.strokeStyle = '#5b9cf6'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
      ctx.strokeRect(c.x - 6, c.y - 6, gb.w * zoom + 12, gb.h * zoom + 12); ctx.setLineDash([]);
    }
  }

  if (inBox) {
    const bx1 = pan.x + ds.boxX * zoom, by1 = pan.y + (level.worldHeight - ds.boxY) * zoom;
    const bx2 = pan.x + ds._boxEndX * zoom, by2 = pan.y + (level.worldHeight - ds._boxEndY) * zoom;
    ctx.fillStyle = 'rgba(91,156,246,0.08)';
    ctx.strokeStyle = 'rgba(91,156,246,0.6)'; ctx.lineWidth = 1;
    ctx.fillRect(Math.min(bx1, bx2), Math.min(by1, by2), Math.abs(bx2 - bx1), Math.abs(by2 - by1));
    ctx.strokeRect(Math.min(bx1, bx2), Math.min(by1, by2), Math.abs(bx2 - bx1), Math.abs(by2 - by1));
  }

  if (pickMode) {
    objects.forEach(o => {
      const ok = (pickMode.targetType === 'portal' && o.type === 'portal') ||
                 (pickMode.targetType === 'key' && o.type === 'key') ||
                 (pickMode.targetType === 'area' && o.type === 'area');
      if (ok) {
        const r = scrRect(o);
        ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 3); ctx.stroke();
      }
    });
    ctx.fillStyle = 'rgba(168,85,247,0.9)';
    ctx.font = 'bold 12px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Click a ' + pickMode.targetType + ' to pick its ID  (Esc cancel)', cw / 2, 8);
  }

  if (tool === 'place' && placeType) {
    const o = defaultObj(placeType);
    if (['orb', 'coin', 'key'].includes(o.type)) { o.x = sn(mwx); o.y = sn(mwy); }
    else if (o.type === 'movingPlatformUp') { o.x = sn(mwx); o.startY = sn(mwy); o.endY = sn(mwy + 300); }
    else if (o.type === 'movingPlatformRight') { o.startX = sn(mwx); o.y = sn(mwy); o.endX = sn(mwx + 300); }
    else { o.x = sn(mwx); o.y = sn(mwy); }
    ctx.globalAlpha = 0.38; drawObj(o); ctx.globalAlpha = 1;
  }

  renderMM();
}

function drawObj(o) {
  const col = CMAP[o.type] || '#9b9b9c';
  const r = scrRect(o);
  const rot = (o.rotation || 0) * Math.PI / 180;
  const hasTex = !!(o._resolvedTex || o.texture);
  ctx.save();
  if (o.ghost && !hasTex) ctx.globalAlpha = 0.32;
  if (rot !== 0 && !['orb', 'coin', 'key', 'checkpoint', 'area', 'text'].includes(o.type)) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(rot);
    if (o.invertX || o.invertY) ctx.scale(o.invertX ? -1 : 1, o.invertY ? -1 : 1);
    ctx.translate(-r.w / 2, -r.h / 2);
    drawShape(o, col, 0, 0, r.w, r.h, true);
  } else if (o.invertX || o.invertY) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(o.invertX ? -1 : 1, o.invertY ? -1 : 1);
    ctx.translate(-r.w / 2, -r.h / 2);
    drawShape(o, col, 0, 0, r.w, r.h, true);
  } else {
    drawShape(o, col, r.x, r.y, r.w, r.h, false);
  }
  if (o.name) {
    ctx.restore(); ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '8px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(o.name, r.x + r.w / 2, r.y - 3);
  }
  ctx.restore();
}

function drawShape(o, col, lx, ly, lw, lh, inT) {
  const texImg = getTexImg(o);
  const vTex = texImg && texImg.complete && texImg.naturalWidth > 0;

  if (vTex && lw > 0 && lh > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, lw, lh); ctx.clip();
    if (o.textureMode === 'stretch') {
      ctx.drawImage(texImg, lx, ly, lw, lh);
    } else {
      const iw = texImg.naturalWidth * zoom, ih = texImg.naturalHeight * zoom;
      if (iw > 0 && ih > 0) for (let ty = ly; ty < ly + lh; ty += ih) for (let tx = lx; tx < lx + lw; tx += iw) ctx.drawImage(texImg, tx, ty, iw, ih);
    }
    ctx.restore();
    if (o.ghost) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([5, 3]); ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]); }
    return;
  }

  const ghost = o.ghost;

  if (o.type === 'floor') {
    ctx.fillStyle = col + (ghost ? '18' : '28'); ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    if (ghost) ctx.setLineDash([5, 3]);
    ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);

  } else if (o.type === 'wall') {
    if (o.keyId) {
      const dc = blendDoor(o.keyColor || '#ffd700');
      ctx.fillStyle = dc; ctx.fillRect(lx, ly, lw, lh);
      ctx.shadowColor = o.keyColor || '#ffd700'; ctx.shadowBlur = 6;
      ctx.strokeStyle = o.keyColor || '#ffd700'; ctx.lineWidth = 2;
      ctx.strokeRect(lx, ly, lw, lh); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = col + (ghost ? '18' : '28'); ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      if (ghost) ctx.setLineDash([5, 3]);
      ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);
    }

  } else if (o.type === 'lava') {
    ctx.fillStyle = col + (ghost ? '30' : '40'); ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = col + 'bb'; ctx.fillRect(lx, ly, lw, Math.min(4, lh));
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    if (ghost) ctx.setLineDash([5, 3]);
    ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);

  } else if (o.type === 'trampoline') {
    ctx.fillStyle = col + (ghost ? '30' : '44'); ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (ghost) ctx.setLineDash([5, 3]);
    ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);

  } else if (o.type === 'enemy') {
    ctx.fillStyle = col + (ghost ? '28' : '40');
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 3); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    if (ghost) ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 3); ctx.stroke(); ctx.setLineDash([]);
    if (!ghost) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('E', lx + lw / 2, ly + lh / 2);
    }

  } else if (o.type === 'orb') {
    const cc = inT ? { x: lx + lw / 2, y: ly + lh / 2 } : g2c(o.x, o.y, 0);
    const cr = (o.r || 20) * zoom;
    const gr = ctx.createRadialGradient(cc.x, cc.y, 0, cc.x, cc.y, cr);
    gr.addColorStop(0, col + 'ff'); gr.addColorStop(1, col + '00');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cc.x, cc.y, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    if (ghost) ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(cc.x, cc.y, cr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

  } else if (o.type === 'coin' || o.type === 'key') {
    const cc = inT ? { x: lx + lw / 2, y: ly + lh / 2 } : g2c(o.x, o.y, 0);
    const cr = (o.r || 14) * zoom;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cc.x, cc.y, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cc.x, cc.y, cr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.type === 'key' ? 'K' : '$', cc.x, cc.y);

  } else if (o.type === 'movingPlatformUp') {
    if (!inT) {
      const startC = g2c(o.x || 0, o.startY || 0, o.h || 20);
      const endC = g2c(o.x || 0, o.endY || 300, o.h || 20);
      const midX = startC.x + (o.w || 120) * zoom / 2;
      ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(midX, startC.y + startC.h / 2); ctx.lineTo(midX, endC.y + endC.h / 2); ctx.stroke();
      const arrSize = 8, arrY = endC.y + endC.h / 2, dir = endC.y < startC.y ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(midX, arrY); ctx.lineTo(midX - arrSize, arrY - dir * arrSize); ctx.lineTo(midX + arrSize, arrY - dir * arrSize); ctx.closePath();
      ctx.fillStyle = col + '99'; ctx.fill();
      ctx.strokeStyle = col + '44'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.strokeRect(endC.x, endC.y, (o.w || 120) * zoom, (o.h || 20) * zoom); ctx.setLineDash([]);
    }
    ctx.fillStyle = col + '44'; ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(lx, ly, lw, lh);
    ctx.fillStyle = col; ctx.font = 'bold 8px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MP', lx + lw / 2, ly + lh / 2);

  } else if (o.type === 'movingPlatformRight') {
    if (!inT) {
      const startC = g2c(o.startX || 0, o.y || 0, o.h || 20);
      const endC = g2c(o.endX || 300, o.y || 0, o.h || 20);
      const midY = startC.y + (o.h || 20) * zoom / 2;
      ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(startC.x + (o.w || 120) * zoom / 2, midY); ctx.lineTo(endC.x + (o.w || 120) * zoom / 2, midY); ctx.stroke();
      const arrSize = 8, arrX = endC.x + (o.w || 120) * zoom / 2, dir = endC.x > startC.x ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(arrX, midY); ctx.lineTo(arrX - dir * arrSize, midY - arrSize); ctx.lineTo(arrX - dir * arrSize, midY + arrSize); ctx.closePath();
      ctx.fillStyle = col + '99'; ctx.fill();
      ctx.strokeStyle = col + '44'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.strokeRect(endC.x, endC.y, (o.w || 120) * zoom, (o.h || 20) * zoom); ctx.setLineDash([]);
    }
    ctx.fillStyle = col + '44'; ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(lx, ly, lw, lh);
    ctx.fillStyle = col; ctx.font = 'bold 8px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MP', lx + lw / 2, ly + lh / 2);

  } else if (o.type === 'checkpoint') {
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly, 4 * zoom, 80 * zoom);
    ctx.beginPath(); ctx.moveTo(lx + 4 * zoom, ly); ctx.lineTo(lx + 30 * zoom, ly + 13 * zoom); ctx.lineTo(lx + 4 * zoom, ly + 26 * zoom); ctx.closePath(); ctx.fill();

  } else if (o.type === 'end') {
    ctx.fillStyle = col + '20'; ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([7, 4]);
    ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);
    ctx.fillStyle = col; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('END', lx + lw / 2, ly + lh / 2);

  } else if (o.type === 'text') {
    const tc = inT ? { x: lx + lw / 2, y: ly + lh / 2 } : g2c(o.x, o.y, 0);
    const fontStr = o.font || '20px sans-serif';
    const m = fontStr.match(/(\d+)px/);
    const bp = m ? Math.max(8, parseFloat(m[1]) * zoom * 0.7) : 14;
    const fr = fontStr.replace(/(?:bold\s*)?\d+px/, '').trim() || 'sans-serif';
    const raw = o._rawContent || o.content || 'Text';
    ctx.textBaseline = 'middle';
    if (raw.includes('<')) {
      const segs = parseSegs(raw, false, o.color || '#fff');
      ctx.textAlign = 'left';
      let tw = 0;
      segs.forEach(s => { ctx.font = (s.bold ? 'bold ' : '') + bp + 'px ' + fr; tw += ctx.measureText(s.t).width; });
      let cx = tc.x - tw / 2;
      segs.forEach(s => {
        ctx.font = (s.bold ? 'bold ' : '') + bp + 'px ' + fr;
        ctx.fillStyle = s.color;
        const sw = ctx.measureText(s.t).width;
        ctx.fillText(s.t, cx, tc.y);
        cx += sw;
      });
    } else {
      ctx.textAlign = 'center';
      ctx.font = bp + 'px ' + fr;
      ctx.fillStyle = o.color || '#fff';
      ctx.fillText(raw, tc.x, tc.y);
    }

  } else if (o.type === 'portal') {
    const pg = ctx.createLinearGradient(lx, ly, lx + lw, ly);
    pg.addColorStop(0, 'rgba(168,85,247,0.5)'); pg.addColorStop(1, 'rgba(168,85,247,0.08)');
    ctx.fillStyle = pg; ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 3); ctx.stroke();
    ctx.fillStyle = col; ctx.font = '7px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText((o['portal-id'] || '?') + ' -> ' + (o['to-portal-id'] || '?'), lx + lw / 2, ly + 3);

  } else if (o.type === 'area') {
    ctx.fillStyle = col + '14'; ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([6, 3]);
    ctx.strokeRect(lx, ly, lw, lh); ctx.setLineDash([]);
    ctx.fillStyle = col; ctx.font = 'bold 9px JetBrains Mono,monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('area:' + (o.id || '?'), lx + 3, ly + 3);

  } else {
    const cc = inT ? { x: lx + lw / 2, y: ly + lh / 2 } : g2c(o.x || 0, o.y || 0, 0);
    ctx.fillStyle = col + '30'; ctx.beginPath(); ctx.arc(cc.x, cc.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cc.x, cc.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 8px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.type.slice(0, 3).toUpperCase(), cc.x, cc.y);
  }
}

function renderMM() {
  const mw = 148, mh = 74;
  mmCtx.clearRect(0, 0, mw, mh);
  const scx = mw / level.worldWidth, scy = mh / level.worldHeight;
  const bg = mmCtx.createLinearGradient(0, 0, 0, mh);
  bg.addColorStop(0, level.bgColor2 || level.bgColor || '#0e0302');
  bg.addColorStop(1, level.bgColor || '#1a0806');
  mmCtx.fillStyle = bg; mmCtx.fillRect(0, 0, mw, mh);
  objects.forEach(o => {
    const g = gameRect(o);
    mmCtx.fillStyle = (CMAP[o.type] || '#9b9b9c') + (selSet.has(o) ? 'ee' : '88');
    mmCtx.fillRect(g.x * scx, mh - (g.y + g.h) * scy, Math.max(1, g.w * scx), Math.max(1, g.h * scy));
  });
  const vp = document.getElementById('minimap-vp');
  vp.style.left = Math.max(0, -pan.x / zoom * scx) + 'px';
  vp.style.top = Math.max(0, (mh - ((-pan.y / zoom + wrap.clientHeight / zoom) * scy))) + 'px';
  vp.style.width = Math.min(mw, wrap.clientWidth / zoom * scx) + 'px';
  vp.style.height = Math.min(mh, wrap.clientHeight / zoom * scy) + 'px';
}
