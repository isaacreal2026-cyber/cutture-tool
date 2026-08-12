/**
 * Team Kit + HTV actions. Uses existing modal / button classes only.
 */
(function () {
  if (typeof KitProd === 'undefined') return;
  const K = KitProd;

  function $(id) { return document.getElementById(id); }
  function board() { return (typeof FC !== 'undefined' && FC) || window.FC; }

  function fillPresetSelect() {
    const sel = $('kit-preset');
    if (!sel || sel._filled) return;
    sel._filled = true;
    Object.keys(K.PRESETS).forEach(function (id) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = K.PRESETS[id].label;
      sel.appendChild(o);
    });
  }

  function currentParts() {
    return {
      name: !$('kit-skip-name') || $('kit-skip-name').checked,
      front: !$('kit-skip-front') || $('kit-skip-front').checked,
      back: !$('kit-skip-back') || $('kit-skip-back').checked,
    };
  }

  function previewCount() {
    const players = K.parseRoster(($('kit-roster') || {}).value || '');
    const pieces = K.buildKit(players, ($('kit-preset') || {}).value, currentParts());
    const el = $('kit-stat');
    if (!el) return;
    const cm2 = K.vinylAreaCm2(pieces);
    el.textContent = players.length + ' players · ' + pieces.length + ' cut pieces · ~' + cm2.toFixed(0) + ' cm² vinyl';
  }

  function placeKit() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') {
      showToast('Canvas not ready', 'w');
      return;
    }
    const players = K.parseRoster(($('kit-roster') || {}).value || '');
    if (!players.length) { showToast('Paste a roster first (NAME,NUMBER)', 'w'); return; }
    const preset = ($('kit-preset') || {}).value || 'football_adult';
    const pieces = K.buildKit(players, preset, currentParts());
    if (!pieces.length) { showToast('Nothing to place — tick name / front / back', 'w'); return; }

    const fill = (document.getElementById('fill-ci') || {}).value || '#111111';
    const font = (S && S.curFont && S.curFont.f) || 'Bebas Neue';
    const pxPerMm = (typeof CutterEngine !== 'undefined') ? CutterEngine.PX_PER_MM : 3.779527559;
    const created = [];

    pieces.forEach(function (p) {
      const t = new fabric.Text(p.text, {
        fontFamily: font,
        fontWeight: 'bold',
        fill: fill,
        originX: 'center',
        originY: 'center',
        objType: 'kit-' + p.kind,
        kitPlayer: p.player,
      });
      const targetH = Math.max(8, p.heightMm * pxPerMm);
      t.scaleToHeight(targetH);
      fc.add(t);
      created.push(t);
    });

    if (typeof autoNest === 'function') autoNest();
    else {
      created.forEach(function (o, i) {
        o.set({ left: 80 + (i % 4) * 80, top: 80 + Math.floor(i / 4) * 80 });
        o.setCoords();
      });
      fc.renderAll();
    }
    closeModal('kit-modal');
    showToast('Kit placed · ' + pieces.length + ' pieces at jersey millimetres', 's');
    if (typeof saveH === 'function') saveH();
  }

  window.mirrorForHtv = function mirrorForHtv() {
    const fc = board();
    if (!fc) return;
    const objs = fc.getObjects().filter(function (o) { return !o.isGuide; });
    if (!objs.length) { showToast('Nothing to mirror', 'w'); return; }
    const cx = fc.width / 2;
    objs.forEach(function (o) {
      o.set('flipX', !o.flipX);
      const c = o.getCenterPoint();
      o.setPositionByOrigin(new fabric.Point(cx * 2 - c.x, c.y), 'center', 'center');
      o.setCoords();
    });
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Mirrored for HTV (heat transfer)', 's');
  };

  window.addWeedBox = function addWeedBox() {
    const fc = board();
    if (!fc) return;
    let objs = [];
    const active = fc.getActiveObject();
    if (active && active.type === 'activeSelection') active.forEachObject(function (o) { objs.push(o); });
    else if (active && !active.isGuide) objs = [active];
    else objs = fc.getObjects().filter(function (o) { return !o.isGuide; });
    if (!objs.length) { showToast('Add artwork first', 'w'); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    });
    const m = (typeof CutterEngine !== 'undefined' ? CutterEngine.PX_PER_MM : 3.78) * 4;
    const rect = new fabric.Rect({
      left: minX - m, top: minY - m,
      width: (maxX - minX) + m * 2,
      height: (maxY - minY) + m * 2,
      fill: null, stroke: '#111111', strokeWidth: 1,
      rx: 0, objType: 'weed-box',
    });
    fc.add(rect);
    fc.setActiveObject(rect);
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Weed box added (4 mm margin)', 's');
  };

  window.showKitModal = function showKitModal() {
    fillPresetSelect();
    const m = $('kit-modal');
    if (m) m.classList.remove('h');
    previewCount();
  };

  document.addEventListener('DOMContentLoaded', function () {
    fillPresetSelect();
    const roster = $('kit-roster');
    if (roster) roster.addEventListener('input', previewCount);
    ['kit-preset', 'kit-skip-name', 'kit-skip-front', 'kit-skip-back'].forEach(function (id) {
      const el = $(id);
      if (el) el.addEventListener('change', previewCount);
    });
    const go = $('kit-place');
    if (go) go.addEventListener('click', placeKit);
  });
})();
