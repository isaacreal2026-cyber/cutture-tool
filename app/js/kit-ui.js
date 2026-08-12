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

  function fillPressSelect() {
    const sel = $('kit-press');
    if (!sel || sel._filled || !K.PRESS) return;
    sel._filled = true;
    Object.keys(K.PRESS).forEach(function (id) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = K.PRESS[id].label;
      sel.appendChild(o);
    });
    sel.addEventListener('change', showPress);
    showPress();
  }

  function fillPlotterSelect() {
    const sel = $('kit-plotter');
    if (!sel || sel._filled || typeof ShopReady === 'undefined') return;
    sel._filled = true;
    Object.keys(ShopReady.PLOTTERS).forEach(function (id) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = ShopReady.PLOTTERS[id].label;
      sel.appendChild(o);
    });
    const saved = ShopReady.loadSettings();
    sel.value = saved.plotter || 'generic';
    applyPlotterProfile(sel.value, false);
    sel.addEventListener('change', function () {
      applyPlotterProfile(sel.value, true);
    });
  }

  function applyPlotterProfile(id, persist) {
    if (typeof ShopReady === 'undefined') return;
    const p = ShopReady.plotter(id);
    const baud = $('kit-baud');
    const vs = $('kit-vs');
    const fs = $('kit-fs');
    if (baud) baud.value = p.baud;
    if (vs) vs.value = p.velocity;
    if (fs) fs.value = p.force;
    if (persist) ShopReady.saveSettings({ plotter: p.id });
  }

  function currentHpglOpts() {
    const id = (($('kit-plotter') || {}).value) || 'generic';
    if (typeof ShopReady === 'undefined') {
      return { velocity: parseInt(($('kit-vs') || {}).value, 10) || 20 };
    }
    return ShopReady.hpglOpts(id, {
      velocity: parseInt(($('kit-vs') || {}).value, 10),
      force: parseInt(($('kit-fs') || {}).value, 10),
      baud: parseInt(($('kit-baud') || {}).value, 10),
      overcutMm: parseFloat(($('kit-overcut') || $('sheet-overcut') || {}).value) || 0,
    });
  }

  function showPress() {
    const el = $('kit-press-out');
    if (!el || !K.formatPress) return;
    const id = ($('kit-press') || {}).value || 'htv_pu';
    el.textContent = K.formatPress(id);
  }

  function currentParts() {
    return {
      name: !$('kit-skip-name') || $('kit-skip-name').checked,
      front: !$('kit-skip-front') || $('kit-skip-front').checked,
      back: !$('kit-skip-back') || $('kit-skip-back').checked,
    };
  }

  function currentQuote() {
    const players = K.parseRoster(($('kit-roster') || {}).value || '');
    let pieces = K.buildKit(players, ($('kit-preset') || {}).value, currentParts());
    const copies = (typeof ShopReady !== 'undefined')
      ? ShopReady.clampCopies(($('kit-copies') || $('sheet-copies') || {}).value)
      : 1;
    if (copies > 1 && typeof ShopReady !== 'undefined') pieces = ShopReady.expandCopies(pieces, copies);
    const cm2 = K.vinylAreaCm2(pieces);
    const q = K.quoteVinyl(cm2, {
      pricePerM2: parseFloat(($('kit-price') || {}).value) || 0,
      wastePct: parseFloat(($('kit-waste') || {}).value) || 15,
      currency: ($('kit-ccy') || {}).value || 'KES',
    });
    return { players: players, pieces: pieces, cm2: cm2, quote: q };
  }

  function previewCount() {
    const el = $('kit-stat');
    if (!el) return;
    const cur = currentQuote();
    el.textContent = cur.players.length + ' players · ' + cur.pieces.length + ' pieces · ' + cur.quote.text;
    const qel = $('quote-out');
    if (qel) qel.textContent = cur.quote.total ? cur.quote.currency + ' ' + cur.quote.total.toFixed(2) : '—';
    const qsub = $('quote-sub');
    if (qsub) qsub.textContent = cur.quote.usedCm2 + ' cm² incl. waste';
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
    let pieces = K.buildKit(players, preset, currentParts());
    const copies = (typeof ShopReady !== 'undefined')
      ? ShopReady.clampCopies(($('kit-copies') || $('sheet-copies') || {}).value)
      : 1;
    if (copies > 1 && typeof ShopReady !== 'undefined') pieces = ShopReady.expandCopies(pieces, copies);
    if (!pieces.length) { showToast('Nothing to place — tick name / front / back', 'w'); return; }

    const nameFont = (($('kit-name-font') || {}).value) || (S && S.curFont && S.curFont.f) || 'Bebas Neue';
    const numFont = (($('kit-num-font') || {}).value) || 'Anton';
    const nameCol = (($('kit-name-col') || {}).value) || '#ffffff';
    const numCol = (($('kit-num-col') || {}).value) || '#111111';
    const pxPerMm = (typeof CutterEngine !== 'undefined') ? CutterEngine.PX_PER_MM : 3.779527559;
    const created = [];

    pieces.forEach(function (p) {
      const isName = p.kind === 'name';
      const type = (typeof CutterFonts !== 'undefined' && CutterFonts.fabricProps)
        ? CutterFonts.fabricProps(isName ? nameFont : numFont)
        : { fontFamily: isName ? nameFont : numFont, fontWeight: '700' };
      const t = new fabric.Text(p.text, {
        fontFamily: type.fontFamily,
        fontWeight: type.fontWeight,
        fill: isName ? nameCol : numCol,
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
    fillPressSelect();
    fillPlotterSelect();
    if (typeof CutterFonts !== 'undefined' && CutterFonts.fillKitFontSelects) {
      CutterFonts.fillKitFontSelects();
    }
    const m = $('kit-modal');
    if (m) m.classList.remove('h');
    previewCount();
  };

  window.loadRosterCsv = function loadRosterCsv(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = function () {
      const players = K.parseRosterCsv(String(r.result || ''));
      const ta = $('kit-roster');
      if (ta) {
        ta.value = players.map(function (p) { return p.name + ',' + p.number; }).join('\n');
      }
      previewCount();
      showToast(players.length + ' players loaded from CSV', players.length ? 's' : 'w');
    };
    r.readAsText(file);
  };

  function collectColorJobs() {
    const fc = board();
    if (!fc || typeof CutterEngine === 'undefined') return [];
    const E = CutterEngine;
    const items = fc.getObjects().filter(function (o) {
      return !o.isGuide && !(typeof CutterEngine !== 'undefined' && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
    }).map(function (o) {
      return { fill: o.fill, objType: o.objType, ref: o };
    });
    return K.splitJobsByColor(items).map(function (job) {
      const objs = job.items.map(function (it) { return it.ref; });
      const ents = E.objectsToEntities(objs, {
        pxPerMm: E.PX_PER_MM,
        heightPx: fc.height,
        simplifyMm: 0.08,
      });
      const slug = job.color.replace('#', '');
      return {
        color: job.color,
        count: objs.length,
        hpgl: E.hpgl(ents, currentHpglOpts()),
        dxf: E.dxf(ents),
        nameHpgl: 'kit-' + slug + '.plt',
        nameDxf: 'kit-' + slug + '.dxf',
      };
    });
  }

  window.exportColorJobs = function exportColorJobs() {
    const jobs = collectColorJobs();
    if (!jobs.length) { showToast('Place a kit first', 'w'); return; }
    const files = [];
    jobs.forEach(function (j) {
      files.push({ name: j.nameHpgl, text: j.hpgl });
      files.push({ name: j.nameDxf, text: j.dxf });
    });
    if (window.desktop && window.desktop.saveJobs) {
      const packed = files.map(function (f) {
        return { name: f.name, b64: btoa(unescape(encodeURIComponent(f.text))) };
      });
      window.desktop.saveJobs(packed).then(function (res) {
        if (res && res.ok) showToast(jobs.length + ' colour jobs written', 's');
      });
      return;
    }
    files.forEach(function (f) {
      dlBlob(new Blob([f.text], { type: 'application/octet-stream' }), f.name);
    });
    showToast(jobs.length + ' colour jobs exported (load vinyl per colour)', 's');
  };

  window.sendToPlotter = async function sendToPlotter() {
    const jobs = collectColorJobs();
    if (!jobs.length) { showToast('Nothing to send — place a kit or artwork', 'w'); return; }
    if (navigator.serial && navigator.serial.requestPort) {
      try {
        const port = await navigator.serial.requestPort();
        const opts = currentHpglOpts();
        await port.open({ baudRate: opts.baud || parseInt(($('kit-baud') || {}).value, 10) || 9600 });
        const writer = port.writable.getWriter();
        const enc = new TextEncoder();
        for (let i = 0; i < jobs.length; i++) {
          showToast('Sending ' + jobs[i].color + ' (' + (i + 1) + '/' + jobs.length + ') — load that vinyl', 's');
          await writer.write(enc.encode(jobs[i].hpgl));
          if (i < jobs.length - 1 && !confirm('Colour ' + jobs[i].color + ' sent. Load next vinyl (' + jobs[i + 1].color + ') then OK.')) break;
        }
        writer.releaseLock();
        await port.close();
        showToast('Plotter send finished', 's');
        return;
      } catch (err) {
        showToast('Serial send failed — exporting files instead', 'w');
      }
    }
    exportColorJobs();
  };

  document.addEventListener('DOMContentLoaded', function () {
    fillPresetSelect();
    fillPressSelect();
    fillPlotterSelect();
    if (typeof CutterFonts !== 'undefined' && CutterFonts.fillKitFontSelects) {
      CutterFonts.fillKitFontSelects();
    }
    const roster = $('kit-roster');
    if (roster) roster.addEventListener('input', previewCount);
    ['kit-preset', 'kit-skip-name', 'kit-skip-front', 'kit-skip-back', 'kit-price', 'kit-waste', 'kit-ccy', 'kit-copies'].forEach(function (id) {
      const el = $(id);
      if (el) el.addEventListener('input', previewCount);
      if (el) el.addEventListener('change', previewCount);
    });
    const go = $('kit-place');
    if (go) go.addEventListener('click', placeKit);
    const csv = $('kit-csv');
    if (csv) csv.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) loadRosterCsv(f);
      e.target.value = '';
    });
    const exp = $('kit-export-colors');
    if (exp) exp.addEventListener('click', exportColorJobs);
    const send = $('kit-send');
    if (send) send.addEventListener('click', function () { sendToPlotter(); });
  });
})();
