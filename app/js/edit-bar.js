/**
 * Edit bar, working text curve, font pairs, custom quick shapes.
 * Does not restyle studio chrome — modal + existing .btn / .prow classes.
 */
(function (root) {
  'use strict';

  function curveLayout(text, mode, amount, fontSize) {
    const chars = Array.from(String(text || ''));
    const fs = Math.max(8, Number(fontSize) || 60);
    const k = Math.max(0, Math.min(100, Number(amount) || 50)) / 100;
    const step = fs * 0.62;
    const mid = (chars.length - 1) / 2;
    const out = [];
    if (!chars.length || mode === 'none' || k < 0.02) {
      chars.forEach(function (ch, i) {
        out.push({ ch: ch, x: (i - mid) * step, y: 0, angle: 0 });
      });
      return out;
    }
    if (mode === 'wave') {
      chars.forEach(function (ch, i) {
        out.push({
          ch: ch,
          x: (i - mid) * step,
          y: Math.sin(i * 0.9) * fs * 0.38 * k,
          angle: 0,
        });
      });
      return out;
    }
    if (mode === 'circle') {
      const r = Math.max(fs * 1.15, (chars.length * step) / (Math.PI * 2));
      chars.forEach(function (ch, i) {
        const a = (i / Math.max(1, chars.length)) * Math.PI * 2 - Math.PI / 2;
        out.push({
          ch: ch,
          x: r * Math.cos(a),
          y: r * Math.sin(a),
          angle: (a * 180) / Math.PI + 90,
        });
      });
      return out;
    }
    const totalW = Math.max(step, chars.length * step);
    const r = totalW / (0.55 + 1.7 * k);
    const span = totalW / r;
    const sign = mode === 'arc-down' ? -1 : 1;
    chars.forEach(function (ch, i) {
      const t = chars.length === 1 ? 0.5 : i / (chars.length - 1);
      const a = -span / 2 + t * span;
      const ang = mode === 'arc-down' ? a : -a;
      out.push({
        ch: ch,
        x: r * Math.sin(ang),
        y: sign * r * (1 - Math.cos(ang)),
        angle: (ang * 180) / Math.PI,
      });
    });
    return out;
  }

  function $(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
  function board() { return (typeof FC !== 'undefined' && FC) || (typeof window !== 'undefined' && window.FC) || null; }

  const SHAPE_KEY = 'cspro.quickShapes.v1';

  function loadShapes(store) {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    try {
      const list = JSON.parse(s.getItem(SHAPE_KEY) || '[]');
      return Array.isArray(list) ? list.slice(0, 24) : [];
    } catch (e) { return []; }
  }

  function saveShapes(list, store) {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return list;
    s.setItem(SHAPE_KEY, JSON.stringify((list || []).slice(0, 24)));
    return list;
  }

  function isTextObj(o) {
    return o && (o.type === 'text' || o.type === 'i-text' || o.objType === 'text' || o.objType === 'text-curve' || o.objType === 'kit-name' || o.objType === 'kit-back' || o.objType === 'kit-front');
  }

  function isImageObj(o) {
    return o && (o.type === 'image' || o.objType === 'logo' || o.objType === 'image');
  }

  function showPane(kind) {
    const text = $('edit-text');
    const img = $('edit-image');
    const none = $('edit-none');
    if (text) text.style.display = kind === 'text' ? 'block' : 'none';
    if (img) img.style.display = kind === 'image' ? 'block' : 'none';
    if (none) none.style.display = kind === 'none' ? 'block' : 'none';
    const sub = $('edit-sub');
    if (sub) {
      sub.textContent = kind === 'text' ? 'Text tools' : kind === 'image' ? 'Image / logo tools' : 'Select an object on the sheet';
    }
  }

  function syncEditModal() {
    const o = board() && board().getActiveObject();
    if (isTextObj(o) && o.type !== 'activeSelection') {
      showPane('text');
      const tin = $('edit-text-in');
      if (tin) tin.value = o.text || (o._objects && o._objects.map(function (c) { return c.text || ''; }).join('')) || '';
      const cv = $('edit-curve');
      if (cv) cv.value = o.curveMode || 'none';
      const am = $('edit-curve-amt');
      if (am) am.value = o.curveAmount == null ? 50 : o.curveAmount;
      const av = $('edit-curve-amt-v');
      if (av) av.textContent = (o.curveAmount == null ? 50 : o.curveAmount) + '%';
    } else if (isImageObj(o)) {
      showPane('image');
    } else {
      showPane('none');
    }
  }

  if (typeof window === 'undefined') {
    root.CutterEdit = { curveLayout: curveLayout, loadShapes: loadShapes, saveShapes: saveShapes, SHAPE_KEY: SHAPE_KEY };
    if (typeof module === 'object' && module.exports) module.exports = root.CutterEdit;
    return;
  }

  window.showEditModal = function showEditModal() {
    const m = $('edit-modal');
    if (m) m.classList.remove('h');
    syncEditModal();
  };

  window.flipV = function flipV() {
    const fc = board();
    const o = fc && fc.getActiveObject();
    if (!o) { showToast('Select an object first', 'w'); return; }
    o.set('flipY', !o.flipY);
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
  };

  function glyphProps(src) {
    const font = (src && src.fontFamily) || (S && S.curFont && S.curFont.f) || 'Bebas Neue';
    return {
      fontFamily: font,
      fontWeight: (src && src.fontWeight) || (S && S.curFont && S.curFont.weight) || 700,
      fontSize: (src && src.fontSize) || parseInt(($('fs-in') || {}).value, 10) || 60,
      fill: (src && src.fill) || (($('fill-ci') || {}).value) || '#111111',
    };
  }

  function buildCurvedGroup(text, mode, amount, style, left, top) {
    const layout = curveLayout(text, mode, amount, style.fontSize);
    const letters = layout.map(function (g) {
      return new fabric.Text(g.ch, {
        left: g.x, top: g.y, angle: g.angle,
        originX: 'center', originY: 'center',
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.fill,
      });
    });
    const g = new fabric.Group(letters, {
      left: left, top: top, originX: 'center', originY: 'center',
    });
    g.objType = 'text-curve';
    g.curveMode = mode;
    g.curveAmount = amount;
    g.curveSource = text;
    return g;
  }

  window.applyCurve = function applyCurve() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') { showToast('Canvas not ready', 'w'); return; }
    const editOpen = $('edit-modal') && !$('edit-modal').classList.contains('h');
    const modeEl = editOpen ? ($('edit-curve') || $('tc-curve')) : ($('tc-curve') || $('edit-curve'));
    const amtEl = editOpen ? ($('edit-curve-amt') || $('tc-curve-amt')) : ($('tc-curve-amt') || $('edit-curve-amt'));
    const mode = (modeEl && modeEl.value) || 'none';
    const amount = amtEl ? parseInt(amtEl.value, 10) : 50;
    let obj = fc.getActiveObject();
    if (!obj || (!isTextObj(obj) && obj.type !== 'group')) {
      showToast('Select text first, then pick a curve', 'w');
      return;
    }
    const text = obj.curveSource || obj.text || (obj._objects && obj._objects.map(function (c) { return c.text || ''; }).join('')) || (($('tc-in') || {}).value) || 'TEXT';
    const style = glyphProps(obj.type === 'text' || obj.type === 'i-text' ? obj : (obj._objects && obj._objects[0]));
    const left = obj.left, top = obj.top;
    fc.remove(obj);
    if (mode === 'none') {
      const flat = new fabric.Text(text, {
        left: left, top: top, originX: 'center', originY: 'center',
        fontFamily: style.fontFamily, fontWeight: style.fontWeight,
        fontSize: style.fontSize, fill: style.fill, objType: 'text',
      });
      fc.add(flat); fc.setActiveObject(flat);
    } else {
      const g = buildCurvedGroup(text, mode, amount, style, left, top);
      fc.add(g); fc.setActiveObject(g);
    }
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast(mode === 'none' ? 'Curve removed' : 'Text curved — ' + mode + ' ' + amount + '%', 's');
  };

  window.addPairedKitText = function addPairedKitText() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') return;
    const raw = (($('edit-text-in') || $('tc-in') || {}).value) || 'OTIENO 10';
    const m = String(raw).match(/^(.*?)[\s,]+(\d+[A-Za-z]?)$/);
    const name = ((m && m[1]) || raw.replace(/\d+/g, '') || 'NAME').toUpperCase().trim();
    const num = (m && m[2]) || (raw.match(/\d+/) || ['10'])[0];
    const nameFont = (S && S.curFont && S.curFont.f) || 'Bebas Neue';
    const numFont = (typeof CutterFonts !== 'undefined' && CutterFonts.numberFontFor)
      ? CutterFonts.numberFontFor(nameFont) : 'Anton';
    const fill = (($('fill-ci') || {}).value) || '#111111';
    const n = new fabric.Text(name, {
      left: fc.width / 2, top: fc.height / 3, originX: 'center', originY: 'center',
      fontFamily: nameFont, fontWeight: '700', fontSize: 48, fill: fill, objType: 'text',
    });
    const d = new fabric.Text(num, {
      left: fc.width / 2, top: fc.height / 3 + 70, originX: 'center', originY: 'center',
      fontFamily: numFont, fontWeight: '700', fontSize: 96, fill: fill, objType: 'text',
    });
    fc.add(n); fc.add(d); fc.setActiveObject(d); fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Name ' + nameFont + ' + numbers ' + numFont, 's');
  };

  function renderCustomShapes() {
    const host = $('custom-shapes');
    if (!host) return;
    host.innerHTML = '';
    loadShapes().forEach(function (sh, i) {
      const d = document.createElement('div');
      d.className = 'sshape';
      d.title = sh.name || ('Custom ' + (i + 1));
      if (sh.thumb) {
        d.style.backgroundImage = 'url(' + sh.thumb + ')';
        d.style.backgroundSize = 'cover';
        d.textContent = '';
      } else d.textContent = sh.icon || '★';
      d.addEventListener('click', function () { placeCustomShape(sh); });
      host.appendChild(d);
    });
  }

  function placeCustomShape(sh) {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') return;
    if (sh.svg) {
      fabric.loadSVGFromString(sh.svg, function (objs, opts) {
        if (!objs || !objs.length) { showToast('Saved shape empty', 'w'); return; }
        const g = fabric.util.groupSVGElements(objs, opts || {});
        g.scaleToWidth(Math.min(160, fc.width * 0.3));
        g.set({ left: fc.width / 2, top: fc.height / 2, originX: 'center', originY: 'center', objType: 'custom-shape' });
        fc.add(g); fc.setActiveObject(g); fc.renderAll();
        if (typeof saveH === 'function') saveH();
      });
      return;
    }
    if (sh.dataUrl) {
      fabric.Image.fromURL(sh.dataUrl, function (img) {
        img.scaleToWidth(Math.min(160, fc.width * 0.3));
        img.set({ left: fc.width / 2, top: fc.height / 2, originX: 'center', originY: 'center', objType: 'custom-shape' });
        fc.add(img); fc.setActiveObject(img); fc.renderAll();
        if (typeof saveH === 'function') saveH();
      });
    }
  }

  window.importCustomShape = function importCustomShape() {
    const inp = $('shape-up');
    if (inp) inp.click();
  };

  window.saveSelectionToQuickShapes = function saveSelectionToQuickShapes() {
    const fc = board();
    const o = fc && fc.getActiveObject();
    if (!o || o.isGuide) { showToast('Select the edited shape on the sheet first', 'w'); return; }
    const name = window.prompt('Name this quick shape', 'My shape') || 'My shape';
    let svg = '';
    try { svg = o.toSVG ? o.toSVG() : ''; } catch (e) { svg = ''; }
    const thumb = (o.toDataURL) ? o.toDataURL({ format: 'png', multiplier: 0.4 }) : '';
    const list = loadShapes();
    list.unshift({ name: name, svg: svg ? '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>' : '', dataUrl: thumb, thumb: thumb, icon: '★' });
    saveShapes(list);
    renderCustomShapes();
    showToast('Saved to Quick Shapes', 's');
  };

  function onShapeFile(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (/\.svg$/i.test(f.name) || f.type === 'image/svg+xml') {
      const r = new FileReader();
      r.onload = function () {
        fabric.loadSVGFromString(String(r.result || ''), function (objs, opts) {
          const fc = board();
          if (!fc || !objs || !objs.length) { showToast('SVG had no paths', 'w'); return; }
          const g = fabric.util.groupSVGElements(objs, opts || {});
          g.scaleToWidth(Math.min(180, fc.width * 0.35));
          g.set({ left: fc.width / 2, top: fc.height / 2, originX: 'center', originY: 'center', objType: 'custom-shape' });
          fc.add(g); fc.setActiveObject(g); fc.renderAll();
          if (typeof saveH === 'function') saveH();
          showToast('Shape on playground — edit, then Save to Quick Shapes', 's');
        });
      };
      r.readAsText(f);
      return;
    }
    const r = new FileReader();
    r.onload = function () {
      const fc = board();
      fabric.Image.fromURL(String(r.result || ''), function (img) {
        img.scaleToWidth(Math.min(180, fc.width * 0.35));
        img.set({ left: fc.width / 2, top: fc.height / 2, originX: 'center', originY: 'center', objType: 'custom-shape' });
        fc.add(img); fc.setActiveObject(img); fc.renderAll();
        if (typeof saveH === 'function') saveH();
        showToast('Shape on playground — edit, then Save to Quick Shapes', 's');
      });
    };
    r.readAsDataURL(f);
  }

  const prevSelectFont = typeof selectFont === 'function' ? selectFont : null;
  window.selectFont = function selectFontWrapped(font, cat) {
    if (prevSelectFont) prevSelectFont(font, cat);
    const pair = (typeof CutterFonts !== 'undefined' && CutterFonts.numberFontFor) ? CutterFonts.numberFontFor(font.f) : 'Anton';
    const sub = $('fpsub');
    if (sub) sub.textContent = (cat && cat.label ? cat.label + ' · ' : '') + 'Numbers: ' + pair;
    const kn = $('kit-num-font');
    if (kn) kn.value = pair;
    const hint = $('edit-pair-hint');
    if (hint) hint.textContent = font.f + ' names · ' + pair + ' numbers';
  };

  const prevAddTextAt = typeof addTextAt === 'function' ? addTextAt : null;
  window.addTextAt = function addTextAtWrapped(x, y) {
    const raw = (($('tc-in') || {}).value) || 'MY TEXT';
    if (/^\d+[A-Za-z]?$/.test(String(raw).trim()) && typeof CutterFonts !== 'undefined') {
      const pair = CutterFonts.numberFontFor((S && S.curFont && S.curFont.f) || 'Bebas Neue');
      const prev = S.curFont && S.curFont.f;
      if (S.curFont) S.curFont.f = pair;
      if (prevAddTextAt) prevAddTextAt(x, y);
      if (S.curFont) S.curFont.f = prev;
      return;
    }
    if (prevAddTextAt) prevAddTextAt(x, y);
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderCustomShapes();
    const up = $('shape-up');
    if (up) up.addEventListener('change', onShapeFile);
    const amt = $('edit-curve-amt') || $('tc-curve-amt');
    function syncAmt() {
      const el = $('edit-curve-amt') || $('tc-curve-amt');
      const v = $('edit-curve-amt-v') || $('tc-curve-amt-v');
      if (el && v) v.textContent = el.value + '%';
    }
    if ($('edit-curve-amt')) $('edit-curve-amt').addEventListener('input', syncAmt);
    if ($('tc-curve-amt')) $('tc-curve-amt').addEventListener('input', syncAmt);
    const tin = $('edit-text-in');
    if (tin) tin.addEventListener('input', function () {
      const o = board() && board().getActiveObject();
      if (o && o.type === 'text') { o.set('text', tin.value); board().renderAll(); }
    });
  });

  const api = {
    curveLayout: curveLayout,
    loadShapes: loadShapes,
    saveShapes: saveShapes,
    SHAPE_KEY: SHAPE_KEY,
  };
  root.CutterEdit = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
