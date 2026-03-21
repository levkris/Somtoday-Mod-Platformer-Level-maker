function doRestore() {
  closeModal('modal-restore');
  if (pendingRestore) {
    level = pendingRestore.level;
    objects = pendingRestore.objects;
    groups = pendingRestore.groups || {};
    idCtr = pendingRestore.idCtr || 1;
    selSet = new Set();
    pendingRestore = null;
    loadTextures();
    autoAssignAll();
    refresh();
    buildTexPanel();
    setTimeout(fitView, 60);
    toast('Session restored');
  }
}

buildPalette();
buildProps();

try {
  const raw = localStorage.getItem('lb_save');
  if (raw) {
    const data = JSON.parse(raw);
    if (data && data.objects && data.objects.length > 0) {
      pendingRestore = data;
      document.getElementById('modal-restore').classList.add('open');
      setTimeout(fitView, 60);
    } else {
      loadTextures(); buildTexPanel();
      setTimeout(fitView, 60);
    }
  } else {
    setTimeout(fitView, 60);
  }
} catch (e) { setTimeout(fitView, 60); }
