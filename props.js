function buildProps() {
  const body = document.getElementById('props-body');
  const titleEl = document.getElementById('props-title');
  const typeEl = document.getElementById('props-type');
  const p = primarySel();

  if (!selSet.size) {
    titleEl.textContent = 'Level';
    typeEl.textContent = '';
    body.innerHTML = lvlPropsHTML();
    attachLvlPropListeners();
    return;
  }

  if (selSet.size > 1) {
    titleEl.textContent = 'Multi';
    typeEl.textContent = selSet.size + ' objects';
    body.innerHTML = '<div style="font-size:10px;color:var(--dim);padding:8px 0">' + selSet.size + ' objects selected.<br>Arrow keys to move, Del to delete, ' + MOD + '+G to group.</div>';
    return;
  }

  const ae = document.activeElement;
  const sameObj = body.dataset.objId === String(p._id);
  if (sameObj && body.contains(ae)) {
    updatePropInputs();
    titleEl.textContent = 'Object';
    typeEl.textContent = p.type;
    return;
  }

  body.dataset.objId = String(p._id);
  titleEl.textContent = 'Object';
  typeEl.textContent = p.type;

  const defs = FDEFS[p.type] || [['All', Object.keys(p).filter(k => k !== 'type' && k !== '_id' && k !== '_resolvedTex' && k !== '_rawContent').map(k => k + ':text').join(',')]];
  let html = '';

  for (let di = 0; di < defs.length; di++) {
    const gname = defs[di][0], fields = defs[di][1];
    html += '<div class="fg"><div class="fg-title">' + gname + '</div>';
    const pairs = fields.split(',').map(f => { const i = f.lastIndexOf(':'); return i === -1 ? [f, 'text'] : [f.slice(0, i), f.slice(i + 1)]; });
    let i = 0;
    while (i < pairs.length) {
      const k = pairs[i][0], t = pairs[i][1];
      if (t === 'num' && i + 1 < pairs.length && pairs[i + 1][1] === 'num') {
        html += '<div class="field-row">' + mkField(pairs[i][0], pairs[i][1], p) + mkField(pairs[i + 1][0], pairs[i + 1][1], p) + '</div>';
        i += 2;
      } else {
        html += mkField(k, t, p); i++;
      }
    }
    html += '</div>';
  }

  html += '<div style="display:flex;gap:5px;margin-top:4px"><button class="btn" style="flex:1" id="prop-dup-btn">Duplicate</button><button class="btn danger" style="flex:1" id="prop-del-btn">Delete</button></div>';
  body.innerHTML = html;

  document.getElementById('prop-dup-btn').addEventListener('click', () => duplicateSelected());
  document.getElementById('prop-del-btn').addEventListener('click', () => deleteSelected());

  attachPropListeners(p);
}

function attachPropListeners(p) {
  const body = document.getElementById('props-body');

  body.querySelectorAll('input[type="number"]').forEach(el => {
    const key = el.dataset.key;
    if (!key) return;
    el.addEventListener('input', () => {
      const str = el.value.trim();
      if (str === '' || str === '-' || str === '.') return;
      const n = parseFloat(str);
      if (!isNaN(n)) { p[key] = n; render(); debouncedSave(); }
    });
    el.addEventListener('change', () => {
      const n = parseFloat(el.value);
      if (!isNaN(n)) { p[key] = n; render(); debouncedSave(); }
    });
  });

  body.querySelectorAll('input[type="text"]').forEach(el => {
    const key = el.dataset.key;
    if (!key) return;
    el.addEventListener('input', () => { p[key] = el.value; render(); debouncedSave(); });
  });

  body.querySelectorAll('input[type="checkbox"]').forEach(el => {
    const key = el.dataset.key;
    if (!key) return;
    el.addEventListener('change', () => { p[key] = el.checked; render(); debouncedSave(); });
  });

  body.querySelectorAll('select[data-key]').forEach(el => {
    const key = el.dataset.key;
    el.addEventListener('change', () => {
      p[key] = el.value;
      if (key === 'texture' || key === 'textureGhost') p._resolvedTex = el.value;
      render(); debouncedSave();
      if (key === 'texture' || key === 'textureGhost') buildProps();
    });
  });

  const richEl = body.querySelector('textarea[data-richtext]');
  if (richEl) {
    richEl.addEventListener('input', () => {
      p._rawContent = richEl.value;
      p.content = richEl.value.replace(/<[^>]+>/g, '');
      render(); debouncedSave();
    });
  }
}

function mkField(key, type, o) {
  const val = o && o[key] !== undefined ? o[key] : '';
  const safeKey = key.replace(/-/g, '_').replace(/\./g, '_');

  if (type === 'bool') {
    return '<div class="field cb-row"><input type="checkbox" data-key="' + key + '" id="f_' + safeKey + '" ' + (val ? 'checked' : '') + '><label for="f_' + safeKey + '">' + key + '</label></div>';
  }

  if (type === 'tmode') {
    return '<div class="field"><label>' + key + '</label><select data-key="' + key + '" id="f_' + safeKey + '">' +
      ['tile','stretch','cover'].map(m => '<option value="' + m + '"' + (val === m ? ' selected' : '') + '>' + m + '</option>').join('') +
      '</select></div>';
  }

  if (type === 'khole') {
    return '<div class="field"><label>' + key + '</label><select data-key="' + key + '" id="f_' + safeKey + '">' +
      ['visible','invisible'].map(m => '<option value="' + m + '"' + ((val === m || (!val && m === 'visible')) ? ' selected' : '') + '>' + m + '</option>').join('') +
      '</select></div>';
  }

  if (type === 'num') {
    return '<div class="field"><label>' + key + '</label><input type="number" data-key="' + key + '" id="f_' + safeKey + '" value="' + (val !== '' ? val : '') + '"></div>';
  }

  if (type === 'richtext') {
    const display = o && o._rawContent ? o._rawContent : (o && o.content ? o.content : '');
    return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(supports &lt;b&gt;, &lt;y&gt;, &lt;r&gt;, &lt;g&gt; tags)</span></label><textarea data-richtext="1" rows="3" style="resize:vertical">' + eh(display) + '</textarea></div>';
  }

  if (type === 'fontsel') {
    const opts = BUILTIN_FONTS.map(f => '<option value="' + f + '"' + (val === f ? ' selected' : '') + '>' + f + '</option>').join('');
    return '<div class="field"><label>' + key + '</label><select data-key="' + key + '" id="f_' + safeKey + '" style="font-family:' + (val || 'sans-serif') + '">' + opts + '</select></div>';
  }

  if (type === 'songsel') {
    const songNames = Object.keys(songs);
    const opts = '<option value="">- none -</option>' + songNames.map(n => '<option value="' + n + '"' + (val === n ? ' selected' : '') + '>' + n + '</option>').join('');
    return '<div class="field"><label>' + key + '</label><select data-key="' + key + '" id="f_' + safeKey + '">' + opts + '</select></div>';
  }

  if (type === 'tex') {
    const names = Object.keys(textures);
    const res = o && o._resolvedTex;
    const opts = '<option value="">- none -</option>' + names.map(n => '<option value="' + n + '"' + ((val === n || res === n) ? ' selected' : '') + '>' + n + '</option>').join('');
    const dv = res || val;
    const thumb = textures[dv] ? '<img class="tex-thumb" src="' + textures[dv] + '">' : '<div class="tex-thumb-empty">?</div>';
    const autoTag = res && res !== val ? '<span class="auto-badge" title="Auto: ' + val + '">auto</span>' : '';
    return '<div class="field"><label>' + key + autoTag + '</label><div class="tex-select-row"><select data-key="' + key + '" id="f_' + safeKey + '">' + opts + '</select>' + thumb + '</div></div>';
  }

  if (type === 'pid') {
    return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this portal\'s ID)</span></label><input type="text" data-key="' + key + '" id="f_' + safeKey + '" value="' + eh(String(val)) + '"></div>';
  }

  if (type === 'pref') {
    const portals = objects.filter(obj => obj.type === 'portal' && obj['portal-id']);
    const opts = '<option value="">- pick -</option>' + portals.map(obj => '<option value="' + eh(obj['portal-id']) + '"' + (val === obj['portal-id'] ? ' selected' : '') + '>' + obj['portal-id'] + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select data-key="' + key + '" id="f_' + safeKey + '">' + opts + '</select><button class="pick-btn" data-pickkey="' + key + '" data-picktype="portal" title="Click a portal on canvas">+</button></div></div>';
  }

  if (type === 'kid') {
    return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this key\'s ID)</span></label><input type="text" data-key="' + key + '" id="f_' + safeKey + '" value="' + eh(String(val)) + '"></div>';
  }

  if (type === 'kref') {
    const keys = objects.filter(obj => obj.type === 'key' && obj.keyId);
    const opts = '<option value="">- none -</option>' + keys.map(obj => '<option value="' + eh(obj.keyId) + '"' + (val === obj.keyId ? ' selected' : '') + '>' + obj.keyId + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select data-key="' + key + '" id="f_' + safeKey + '">' + opts + '</select><button class="pick-btn" data-pickkey="' + key + '" data-picktype="key" title="Click a key on canvas">+</button></div></div>';
  }

  if (type === 'aid') {
    return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this area\'s ID)</span></label><input type="text" data-key="' + key + '" id="f_' + safeKey + '" value="' + eh(String(val)) + '"></div>';
  }

  if (type === 'aref') {
    const areas = objects.filter(obj => obj.type === 'area' && obj.id);
    const opts = '<option value="">- none -</option>' + areas.map(obj => '<option value="' + eh(obj.id) + '"' + (val === obj.id ? ' selected' : '') + '>' + obj.id + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select data-key="' + key + '" id="f_' + safeKey + '">' + opts + '</select><button class="pick-btn" data-pickkey="' + key + '" data-picktype="area" title="Click an area on canvas">+</button></div></div>';
  }

  return '<div class="field"><label>' + key + '</label><input type="text" data-key="' + key + '" id="f_' + safeKey + '" value="' + eh(String(val)) + '"></div>';
}

function attachLvlPropListeners() {
  const body = document.getElementById('props-body');
  if (!body) return;

  body.querySelectorAll('input[data-lvlkey], textarea[data-lvlkey]').forEach(el => {
    const key = el.dataset.lvlkey;
    const handler = () => {
      const v = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
      level[key] = v;
      if (['worldWidth','worldHeight','spawnX','spawnY','bgColor','bgColor2'].includes(key)) render();
      debouncedSave();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  body.querySelectorAll('select[data-lvlkey]').forEach(el => {
    const key = el.dataset.lvlkey;
    el.addEventListener('change', () => {
      level[key] = el.value;
      debouncedSave();
    });
  });
}

function lvlPropsHTML() {
  const songNames = Object.keys(songs);
  const texNames = Object.keys(textures);

  const songOpts = '<option value="">- none -</option>' + songNames.map(n => '<option value="' + eh(n) + '"' + (level.song === n ? ' selected' : '') + '>' + n + '</option>').join('');
  const texOpts = '<option value="">- none -</option>' + texNames.map(n => '<option value="' + eh(n) + '"' + (level.bgTexture === n ? ' selected' : '') + '>' + n + '</option>').join('');

  return `
    <div class="fg"><div class="fg-title">Identity</div>
      <div class="field"><label>title</label><input type="text" data-lvlkey="title" value="${eh(level.title)}"></div>
      <div class="field"><label>description</label><textarea data-lvlkey="description">${eh(level.description)}</textarea></div>
      <div class="field"><label>song</label>
        <select id="lvl-song-sel" data-lvlkey="song">${songOpts}</select>
      </div>
    </div>
    <div class="fg"><div class="fg-title">World Size</div>
      <div class="field-row">
        <div class="field"><label>width</label><input type="number" data-lvlkey="worldWidth" value="${level.worldWidth}"></div>
        <div class="field"><label>height</label><input type="number" data-lvlkey="worldHeight" value="${level.worldHeight}"></div>
      </div>
    </div>
    <div class="fg"><div class="fg-title">Spawn</div>
      <div class="field-row">
        <div class="field"><label>spawnX</label><input type="number" data-lvlkey="spawnX" value="${level.spawnX}"></div>
        <div class="field"><label>spawnY</label><input type="number" data-lvlkey="spawnY" value="${level.spawnY}"></div>
      </div>
    </div>
    <div class="fg"><div class="fg-title">Background</div>
      <div class="field-row">
        <div class="field"><label>bgColor</label><input type="text" data-lvlkey="bgColor" value="${eh(level.bgColor || '')}"></div>
        <div class="field"><label>bgColor2</label><input type="text" data-lvlkey="bgColor2" value="${eh(level.bgColor2 || '')}"></div>
      </div>
      <div class="field"><label>bgTexture</label><select data-lvlkey="bgTexture">${texOpts}</select></div>
      <div class="field"><label>bgTextureMode</label>
        <select data-lvlkey="bgTextureMode">
          ${['tile','stretch','cover'].map(m => '<option value="' + m + '"' + (level.bgTextureMode === m ? ' selected' : '') + '>' + m + '</option>').join('')}
        </select>
      </div>
      <div class="field"><label>bgTextureAlpha</label><input type="number" data-lvlkey="bgTextureAlpha" value="${level.bgTextureAlpha ?? 1}" min="0" max="1" step="0.1"></div>
    </div>
  `;
}

function eh(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function startPick(key, targetType, btn) {
  pickMode = { key, targetType };
  document.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('picking'));
  btn.classList.add('picking');
  canvas.style.cursor = 'crosshair';
  toast('Click a ' + targetType + ' on the canvas');
}

function updatePropInputs() {
  const p = primarySel();
  if (!p || selSet.size !== 1) return;
  const ae = document.activeElement;
  const body = document.getElementById('props-body');
  if (!body) return;

  body.querySelectorAll('[data-key]').forEach(el => {
    if (el === ae) return;
    const key = el.dataset.key;
    const val = p[key];
    if (val === undefined) return;
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val;
  });

  const richEl = body.querySelector('textarea[data-richtext]');
  if (richEl && richEl !== ae) richEl.value = p._rawContent || p.content || '';
  updateSelStatus();
}