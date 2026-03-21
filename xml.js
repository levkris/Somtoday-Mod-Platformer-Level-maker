function buildXML() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<level';
  [
    ['title', level.title], ['song', level.song],
    ['worldWidth', level.worldWidth], ['worldHeight', level.worldHeight],
    ['spawnX', level.spawnX], ['spawnY', level.spawnY],
    ['bgColor', level.bgColor], ['bgColor2', level.bgColor2],
    ['bgTexture', level.bgTexture],
  ].forEach(kv => { if (kv[1] !== '' && kv[1] != null) xml += ' ' + kv[0] + '="' + esc(kv[1]) + '"'; });
  xml += '>\n';

  if (level.description) xml += '  <description>' + esc(level.description) + '</description>\n';

  objects.forEach(o => {
    xml += '  <' + o.type;
    const written = new Set(['type', '_id', '_resolvedTex', '_rawContent']);
    xml += ' _id="' + o._id + '"';
    const all = Object.keys(o);
    const ordered = EXPORT_ORDER.filter(k => all.includes(k)).concat(all.filter(k => !EXPORT_ORDER.includes(k) && !written.has(k)));
    ordered.forEach(k => {
      if (written.has(k)) return;
      written.add(k);
      const v = o[k];
      if (v === '' || v === null || v === undefined || v === false) return;
      const xmlKey = k === 'w' ? 'width' : k === 'h' ? 'height' : k;
      if (typeof v === 'boolean') xml += ' ' + xmlKey + '="true"';
      else xml += ' ' + xmlKey + '="' + esc(v) + '"';
    });
    if (o.type === 'text' && o._rawContent) { xml += '>'; xml += o._rawContent; xml += '</text>\n'; }
    else xml += '/>\n';
  });

  Object.keys(groups).forEach(gid => {
    const ids = groups[gid];
    if (!ids || !ids.length) return;
    xml += '  <group name="' + esc(gid) + '" ids="' + ids.join(',') + '" />\n';
  });

  return xml + '</level>';
}

function copyXML() {
  navigator.clipboard.writeText(document.getElementById('export-xml').value).then(() => toast('Copied to clipboard'));
}

function downloadXML() {
  const b = new Blob([buildXML()], { type: 'text/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = (level.title || 'level').replace(/\s+/g, '-').toLowerCase() + '.xml';
  a.click(); URL.revokeObjectURL(a.href);
}

function xmlDropFile(e) { e.preventDefault(); clsRm('xml-drop', 'over'); const f = e.dataTransfer.files[0]; if (f) dispatchImportFile(f); }
function xmlFilePicked(e) { const f = e.target.files[0]; if (f) dispatchImportFile(f); e.target.value = ''; }

function dispatchImportFile(f) {
  if (f.name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') readZipFile(f);
  else readXMLFile(f);
}

function readXMLFile(f) { const r = new FileReader(); r.onload = ev => parseXML(ev.target.result); r.readAsText(f); }
function doImportText() { const xml = document.getElementById('import-xml').value.trim(); if (xml) parseXML(xml); }

async function readZipFile(f) {
  if (typeof JSZip === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(s);
    await new Promise(r => s.onload = r);
  }
  try {
    const zip = await JSZip.loadAsync(f);
    let xmlFile = null;
    const newTextures = {};
    const texPromises = [];
    zip.forEach((path, entry) => {
      if (entry.dir) return;
      const name = path.split('/').pop();
      if (!xmlFile && name.endsWith('.xml')) { xmlFile = entry; }
      else if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)) {
        texPromises.push(
          entry.async('base64').then(b64 => {
            const ext = name.split('.').pop().toLowerCase();
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
            newTextures[name] = 'data:' + mime + ';base64,' + b64;
          })
        );
      }
    });
    if (!xmlFile) { toast('No level.xml found in ZIP', true); return; }
    const [xmlText] = await Promise.all([xmlFile.async('text'), ...texPromises]);
    Object.assign(textures, newTextures);
    Object.keys(texImgCache).forEach(k => { if (newTextures[k]) delete texImgCache[k]; });
    parseXML(xmlText);
    buildTexPanel(); saveTextures();
    const tc = Object.keys(newTextures).length;
    toast('ZIP imported' + (tc ? ' - ' + tc + ' texture' + (tc > 1 ? 's' : '') : ''));
  } catch (err) { toast('ZIP error: ' + err.message, true); }
}

function parseXML(xml) {
  try {
    const p = new DOMParser();
    const doc = p.parseFromString(xml, 'text/xml');
    if (doc.querySelector('parseerror')) throw new Error('Invalid XML');
    const el = doc.querySelector('level');
    if (!el) throw new Error('No <level> element');
    pushUndo();
    level = {
      title: el.getAttribute('title') || 'Imported',
      description: (el.querySelector('description') && el.querySelector('description').textContent.trim()) || '',
      song: el.getAttribute('song') || '',
      worldWidth: parseFloat(el.getAttribute('worldWidth')) || 3000,
      worldHeight: parseFloat(el.getAttribute('worldHeight')) || 1400,
      spawnX: parseFloat(el.getAttribute('spawnX')) || 60,
      spawnY: parseFloat(el.getAttribute('spawnY')) || 120,
      bgColor: el.getAttribute('bgColor') || '#1a0806',
      bgColor2: el.getAttribute('bgColor2') || '#0e0302',
      bgTexture: el.getAttribute('bgTexture') || '',
      bgTextureMode: el.getAttribute('bgTextureMode') || 'tile',
      bgTextureAlpha: parseFloat(el.getAttribute('bgTextureAlpha') || '1'),
    };
    objects = []; groups = {};
    const idMap = {};
    const pendingGroups = [];

    Array.from(el.children).forEach(child => {
      if (child.tagName === 'description') return;
      if (child.tagName === 'group') {
        const gid = child.getAttribute('name');
        const ids = (child.getAttribute('ids') || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (gid && ids.length) pendingGroups.push({ gid, ids });
        return;
      }
      const newId = mkId();
      const o = { type: child.tagName, _id: newId };
      Array.from(child.attributes).forEach(a => {
        if (a.name === '_id') { idMap[parseInt(a.value)] = newId; return; }
        const key = a.name === 'width' ? 'w' : a.name === 'height' ? 'h' : a.name;
        const v = a.value;
        if (v === 'true') o[key] = true;
        else if (v === 'false') o[key] = false;
        else if (!isNaN(v) && v !== '') o[key] = parseFloat(v);
        else o[key] = v;
      });
      if (child.tagName === 'text') { o._rawContent = child.innerHTML.trim(); o.content = child.textContent.trim(); }
      objects.push(o);
    });

    pendingGroups.forEach(pg => {
      const remapped = pg.ids.map(id => idMap[id]).filter(Boolean);
      if (remapped.length) groups[pg.gid] = remapped;
    });

    autoAssignAll();
    selSet = new Set();
    refresh();
    closeModal('modal-import');
    document.getElementById('import-xml').value = '';
    saveToStorage();
    toast('Imported ' + objects.length + ' objects');
  } catch (err) { toast('Error: ' + err.message, true); }
}
