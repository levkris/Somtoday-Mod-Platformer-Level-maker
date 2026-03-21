function buildProps() {
  const body = document.getElementById('props-body');
  const titleEl = document.getElementById('props-title');
  const typeEl = document.getElementById('props-type');
  const p = primarySel();

  if (!selSet.size) {
    titleEl.textContent = 'Level';
    typeEl.textContent = '';
    body.innerHTML = lvlPropsHTML();
    return;
  }

  if (selSet.size > 1) {
    titleEl.textContent = 'Multi';
    typeEl.textContent = selSet.size + ' objects';
    body.innerHTML = '<div style="font-size:10px;color:var(--dim);padding:8px 0">' + selSet.size + ' objects selected.<br>Arrow keys to move, Del to delete, Ctrl+G to group.</div>';
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

  html += '<div style="display:flex;gap:5px;margin-top:4px"><button class="btn" style="flex:1" onclick="duplicateSelected()">Duplicate</button><button class="btn danger" style="flex:1" onclick="deleteSelected()">Delete</button></div>';
  body.innerHTML = html;
}

function mkField(key, type, o) {
  const val = o && o[key] !== undefined ? o[key] : '';
  const id = 'f_' + key.replace(/-/g, '_').replace(/\./g, '_');
  const sv = '"' + key + '"';

  if (type === 'bool') return '<div class="field cb-row"><input type="checkbox" id="' + id + '" ' + (val ? 'checked' : '') + ' onchange="setProp(' + sv + ',this.checked)"><label for="' + id + '">' + key + '</label></div>';

  if (type === 'tmode') return '<div class="field"><label>' + key + '</label><select id="' + id + '" onchange="setProp(' + sv + ',this.value)"><option ' + (val === 'tile' ? 'selected' : '') + '>tile</option><option ' + (val === 'stretch' ? 'selected' : '') + '>stretch</option><option ' + (val === 'cover' ? 'selected' : '') + '>cover</option></select></div>';

  if (type === 'khole') return '<div class="field"><label>' + key + '</label><select id="' + id + '" onchange="setProp(' + sv + ',this.value)"><option ' + (val === 'visible' || !val ? 'selected' : '') + '>visible</option><option ' + (val === 'invisible' ? 'selected' : '') + '>invisible</option></select></div>';

  if (type === 'num') return '<div class="field"><label>' + key + '</label><input type="number" id="' + id + '" value="' + val + '" oninput="setPropNum(' + sv + ',this.value)"></div>';

  if (type === 'richtext') {
    const display = o && o._rawContent ? o._rawContent : (o && o.content ? o.content : '');
    return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(supports &lt;b&gt;, &lt;y&gt;, &lt;r&gt;, &lt;g&gt; tags)</span></label><textarea id="' + id + '" rows="3" style="resize:vertical;user-select:text" oninput="setRichText(this.value)">' + eh(display) + '</textarea></div>';
  }

  if (type === 'tex') {
    const names = Object.keys(textures);
    const res = o && o._resolvedTex;
    const opts = '<option value="">- none -</option>' + names.map(n => '<option value="' + n + '" ' + (val === n || res === n ? 'selected' : '') + '>' + n + '</option>').join('');
    const dv = res || val;
    const thumb = textures[dv] ? '<img class="tex-thumb" src="' + textures[dv] + '">' : '<div class="tex-thumb-empty">?</div>';
    const autoTag = res && res !== val ? '<span class="auto-badge" title="Auto: ' + val + '">auto</span>' : '';
    return '<div class="field"><label>' + key + autoTag + '</label><div class="tex-select-row"><select id="' + id + '" onchange="setProp(' + sv + ',this.value);var p=primarySel();if(p)p._resolvedTex=this.value;buildProps()">' + opts + '</select>' + thumb + '</div></div>';
  }

  if (type === 'pid') return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this portal\'s ID)</span></label><input type="text" id="' + id + '" value="' + eh(String(val)) + '" oninput="setProp(' + sv + ',this.value)"></div>';

  if (type === 'pref') {
    const portals = objects.filter(obj => obj.type === 'portal' && obj['portal-id']);
    const opts = '<option value="">- pick -</option>' + portals.map(obj => '<option value="' + eh(obj['portal-id']) + '" ' + (val === obj['portal-id'] ? 'selected' : '') + '>' + obj['portal-id'] + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select id="' + id + '" onchange="setProp(' + sv + ',this.value)">' + opts + '</select><button class="pick-btn" onclick="startPick(' + sv + ',\'portal\',this)" title="Click a portal on canvas">+</button></div></div>';
  }

  if (type === 'kid') return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this key\'s ID)</span></label><input type="text" id="' + id + '" value="' + eh(String(val)) + '" oninput="setProp(' + sv + ',this.value)"></div>';

  if (type === 'kref') {
    const keys = objects.filter(obj => obj.type === 'key' && obj.keyId);
    const opts = '<option value="">- none -</option>' + keys.map(obj => '<option value="' + eh(obj.keyId) + '" ' + (val === obj.keyId ? 'selected' : '') + '>' + obj.keyId + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select id="' + id + '" onchange="setProp(' + sv + ',this.value)">' + opts + '</select><button class="pick-btn" onclick="startPick(' + sv + ',\'key\',this)" title="Click a key on canvas">+</button></div></div>';
  }

  if (type === 'aid') return '<div class="field"><label>' + key + ' <span style="font-size:8px;color:var(--muted)">(this area\'s ID)</span></label><input type="text" id="' + id + '" value="' + eh(String(val)) + '" oninput="setProp(' + sv + ',this.value)"></div>';

  if (type === 'aref') {
    const areas = objects.filter(obj => obj.type === 'area' && obj.id);
    const opts = '<option value="">- none -</option>' + areas.map(obj => '<option value="' + eh(obj.id) + '" ' + (val === obj.id ? 'selected' : '') + '>' + obj.id + (obj.name ? ' (' + obj.name + ')' : '') + ' @ (' + Math.round(obj.x) + ',' + Math.round(obj.y) + ')</option>').join('');
    return '<div class="field"><label>' + key + '</label><div class="id-row"><select id="' + id + '" onchange="setProp(' + sv + ',this.value)">' + opts + '</select><button class="pick-btn" onclick="startPick(' + sv + ',\'area\',this)" title="Click an area on canvas">+</button></div></div>';
  }

  return '<div class="field"><label>' + key + '</label><input type="text" id="' + id + '" value="' + eh(String(val)) + '" oninput="setProp(' + sv + ',this.value)" style="user-select:text"></div>';
}

function lvlPropsHTML() {
  return '<div class="fg"><div class="fg-title">Identity</div>' +
    '<div class="field"><label>title</label><input type="text" value="' + eh(level.title) + '" oninput="level.title=this.value;debouncedSave()" style="user-select:text"></div>' +
    '<div class="field"><label>description</label><textarea oninput="level.description=this.value;debouncedSave()" style="user-select:text">' + eh(level.description) + '</textarea></div>' +
    '<div class="field"><label>song</label><input type="text" value="' + eh(level.song || '') + '" oninput="level.song=this.value;debouncedSave()" style="user-select:text"></div>' +
    '</div>' +
    '<div class="fg"><div class="fg-title">World Size</div>' +
    '<div class="field-row">' +
    '<div class="field"><label>width</label><input type="number" value="' + level.worldWidth + '" oninput="level.worldWidth=parseFloat(this.value)||3000;render();debouncedSave()"></div>' +
    '<div class="field"><label>height</label><input type="number" value="' + level.worldHeight + '" oninput="level.worldHeight=parseFloat(this.value)||1400;render();debouncedSave()"></div>' +
    '</div></div>' +
    '<div class="fg"><div class="fg-title">Spawn</div>' +
    '<div class="field-row">' +
    '<div class="field"><label>spawnX</label><input type="number" value="' + level.spawnX + '" oninput="level.spawnX=parseFloat(this.value)||0;render();debouncedSave()"></div>' +
    '<div class="field"><label>spawnY</label><input type="number" value="' + level.spawnY + '" oninput="level.spawnY=parseFloat(this.value)||0;render();debouncedSave()"></div>' +
    '</div></div>' +
    '<div class="fg"><div class="fg-title">Background</div>' +
    '<div class="field"><label>bgColor</label><input type="text" value="' + eh(level.bgColor || '') + '" oninput="level.bgColor=this.value;render();debouncedSave()" style="user-select:text"></div>' +
    '<div class="field"><label>bgColor2</label><input type="text" value="' + eh(level.bgColor2 || '') + '" oninput="level.bgColor2=this.value;render();debouncedSave()" style="user-select:text"></div>' +
    '<div class="field"><label>bgTexture</label><input type="text" value="' + eh(level.bgTexture || '') + '" oninput="level.bgTexture=this.value;debouncedSave()" style="user-select:text"></div>' +
    '</div>';
}

function eh(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function setProp(k, v) {
  const p = primarySel();
  if (p) { p[k] = v; render(); debouncedSave(); }
}

function setPropNum(k, v) {
  const p = primarySel();
  if (!p) return;
  const str = String(v).trim();
  if (str === '' || str === '-' || str === '.' || str === '-.') return;
  const n = parseFloat(str);
  if (isNaN(n)) return;
  p[k] = n; render(); debouncedSave();
}

function setRichText(val) {
  const p = primarySel();
  if (!p) return;
  p._rawContent = val;
  p.content = val.replace(/<[^>]+>/g, '');
  render(); debouncedSave();
}

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
  Object.keys(p).forEach(k => {
    const el = document.getElementById('f_' + k.replace(/-/g, '_').replace(/\./g, '_'));
    if (!el || el === ae) return;
    if (el.type === 'checkbox') el.checked = !!p[k];
    else el.value = p[k] !== undefined ? p[k] : '';
  });
  const richEl = document.getElementById('f_content');
  if (richEl && richEl !== ae) richEl.value = p._rawContent || p.content || '';
  updateSelStatus();
}
