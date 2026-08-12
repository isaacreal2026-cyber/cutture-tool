/**
 * Desktop cutter layer — accurate units, ImageTracer, HPGL/DXF, text outlines.
 * Loaded after the main studio script so it can upgrade behaviour in place.
 */
(function () {
  if (typeof CutterEngine === 'undefined') {
    console.error('CutterEngine missing');
    return;
  }
  const E = CutterEngine;
  S.unit = S.unit || 'cm';
  S.PPC = E.pxPerUnit(S.unit);

  function unitLabel() {
    return (E.UNITS[S.unit] || E.UNITS.cm).label;
  }

  function setUnitBadges() {
    document.querySelectorAll('[data-unit-badge]').forEach((el) => {
      el.textContent = unitLabel();
    });
  }

  window.setUnit = function setUnit(next) {
    if (!E.UNITS[next] || next === S.unit) {
      S.unit = next || S.unit;
      S.PPC = E.pxPerUnit(S.unit);
      setUnitBadges();
      return;
    }
    const wEl = document.getElementById('dw-in');
    const hEl = document.getElementById('dh-in');
    const wMm = E.toMm(parseFloat(wEl.value) || 0, S.unit);
    const hMm = E.toMm(parseFloat(hEl.value) || 0, S.unit);
    S.unit = next;
    S.PPC = E.pxPerUnit(S.unit);
    const u = E.UNITS[S.unit];
    wEl.value = E.fromMm(wMm, S.unit).toFixed(u.decimals);
    hEl.value = E.fromMm(hMm, S.unit).toFixed(u.decimals);
    wEl.step = u.step; hEl.step = u.step;
    S.docW = parseFloat(wEl.value);
    S.docH = parseFloat(hEl.value);
    setUnitBadges();
    drawGrid();
    const sc = document.getElementById('cscroll');
    drawRulers(sc.scrollLeft / S.zoom, sc.scrollTop / S.zoom);
    updateStats();
  };

  window.sheetPxSize = function sheetPxSize() {
    return E.sheetPx(S.docW, S.docH, S.unit);
  };

  window.collectCutEntities = function collectCutEntities() {
    const opt = document.getElementById('exp-opt');
    return E.objectsToEntities(FC.getObjects().filter((o) => !o.isGuide), {
      pxPerMm: E.PX_PER_MM,
      heightPx: FC.height,
      simplifyMm: opt && opt.checked ? 0.08 : 0,
    });
  };

  window.genDXF = function genDXF() {
    return E.dxf(collectCutEntities());
  };

  window.genHPGL = function genHPGL() {
    const opts = (typeof ShopReady !== 'undefined')
      ? ShopReady.hpglOpts((document.getElementById('kit-plotter') || {}).value, {
        velocity: parseInt((document.getElementById('kit-vs') || {}).value, 10),
        force: parseInt((document.getElementById('kit-fs') || {}).value, 10),
        overcutMm: parseFloat((document.getElementById('kit-overcut') || document.getElementById('sheet-overcut') || {}).value) || 0,
      })
      : { velocity: 20 };
    return E.hpgl(collectCutEntities(), opts);
  };

  window.setPreset = function setPreset(p) {
    const cm = { tshirt: [30, 40], a4: [21, 29.7], a3: [29.7, 42], a5: [14.8, 21], sticker: [25, 30], roll300: [30, 50], roll500: [50, 70], roll610: [61, 80] };
    if (!cm[p]) return;
    const u = E.UNITS[S.unit];
    document.getElementById('dw-in').value = E.fromMm(cm[p][0] * 10, S.unit).toFixed(u.decimals);
    document.getElementById('dh-in').value = E.fromMm(cm[p][1] * 10, S.unit).toFixed(u.decimals);
    applyDocSize();
  };

  window.applyDocSize = function applyDocSize() {
    const w = parseFloat(document.getElementById('dw-in').value);
    const h = parseFloat(document.getElementById('dh-in').value);
    if (!w || !h || w <= 0 || h <= 0) {
      showToast('Enter a valid sheet size', 'w');
      return;
    }
    S.docW = w; S.docH = h;
    S.PPC = E.pxPerUnit(S.unit);
    const dim = E.sheetPx(w, h, S.unit);
    FC.setDimensions({ width: dim.w, height: dim.h });
    ['grid-c', 'wire-c'].forEach((id) => {
      const c = document.getElementById(id);
      c.width = dim.w; c.height = dim.h;
    });
    document.getElementById('ccontainer').style.width = dim.w + 'px';
    document.getElementById('ccontainer').style.height = dim.h + 'px';
    applyZoom();
    if (typeof addTshirtGuide === 'function') {
      FC.getObjects().filter((o) => o.isGuide).forEach((o) => FC.remove(o));
      addTshirtGuide();
    }
    FC.renderAll();
    drawGrid();
    updateStats();
    if (!S._skipSizeToast) showToast('Canvas → ' + w + '×' + h + ' ' + unitLabel(), 's');
  };

  window.autoNest = function autoNest() {
    const skip = function (o) { return o.isGuide || (E.isShopFixture && E.isShopFixture(o)); };
    const objs = FC.getObjects().filter((o) => !skip(o));
    if (!objs.length) { showToast('Add objects first', 'w'); return; }
    const marginMm = parseFloat(document.getElementById('nm-in').value) || 3;
    const marginPx = marginMm * E.PX_PER_MM;
    const rotate = !!(document.getElementById('nest-rotate') && document.getElementById('nest-rotate').checked);
    const boxes = objs.map((o) => {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      return { w: b.width, h: b.height };
    });
    const result = (rotate && E.nestTrue) ? E.nestTrue(boxes, FC.width, FC.height, marginPx) : E.nest(boxes, FC.width, FC.height, marginPx);
    result.placed.forEach((p) => {
      const o = objs[p.i];
      if (p.rotated) {
        o.set('angle', (o.angle || 0) + 90);
        o.setCoords();
      }
      o.setPositionByOrigin(new fabric.Point(p.left, p.top), 'center', 'center');
      o.setCoords();
    });
    FC.renderAll(); saveH(); updateStats();
    const nRot = result.placed.filter((p) => p.rotated).length;
    showToast(result.overflow ? 'Nest overflow — enlarge the sheet' : ('Auto-nest complete' + (nRot ? ' · ' + nRot + ' rotated 90°' : '')), result.overflow ? 'w' : 's');
  };

  window.updateStats = function updateStats() {
    const objs = FC.getObjects().filter((o) => !o.isGuide);
    document.getElementById('oc').textContent = objs.length;
    const ents = E.objectsToEntities(objs, { pxPerMm: E.PX_PER_MM, heightPx: FC.height, simplifyMm: 0.15 });
    let nodes = 0;
    ents.forEach((e) => { nodes += e.type === 'circle' ? 1 : (e.points || []).length; });
    document.getElementById('nc').textContent = nodes;
    const sheetMm2 = E.toMm(S.docW, S.unit) * E.toMm(S.docH, S.unit);
    let usedMm2 = 0;
    objs.forEach((o) => {
      const b = o.getBoundingRect();
      usedMm2 += (b.width / E.PX_PER_MM) * (b.height / E.PX_PER_MM);
    });
    const pct = Math.min(100, Math.round((usedMm2 / sheetMm2) * 100));
    document.getElementById('mu').textContent = pct + '%';
    document.getElementById('ma').textContent =
      'Used ' + usedMm2.toFixed(0) + ' mm² of ' + sheetMm2.toFixed(0) + ' mm²';
    document.getElementById('mb').style.width = pct + '%';
  };

  window.onMM = function onMM(opt) {
    const p = FC.getPointer(opt.e);
    const xmm = p.x / E.PX_PER_MM;
    const ymm = p.y / E.PX_PER_MM;
    const u = E.UNITS[S.unit];
    const x = E.fromMm(xmm, S.unit).toFixed(u.decimals);
    const y = E.fromMm(ymm, S.unit).toFixed(u.decimals);
    document.getElementById('s-cur').textContent = 'X: ' + x + u.label + '  Y: ' + y + u.label;
  };

  function rasterToSvg(imgEl, threshold, smooth) {
    const max = 900;
    const scale = Math.min(1, max / Math.max(imgEl.width, imgEl.height));
    const w = Math.max(1, Math.round(imgEl.width * scale));
    const h = Math.max(1, Math.round(imgEl.height * scale));
    const oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    const ctx = oc.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgEl, 0, 0, w, h);
    const imgd = ctx.getImageData(0, 0, w, h);
    // Trace the alpha silhouette — never invent a white page behind a logo.
    for (let i = 0; i < imgd.data.length; i += 4) {
      const on = imgd.data[i + 3] >= 16;
      imgd.data[i] = imgd.data[i + 1] = imgd.data[i + 2] = on ? 0 : 255;
      imgd.data[i + 3] = 255;
    }
    if (typeof ImageTracer === 'undefined') throw new Error('ImageTracer not loaded');
    return ImageTracer.imagedataToSVG(imgd, E.traceOptions(threshold, smooth));
  }

  window.applyVect = function applyVect() {
    if (!lastImg) { showToast('No raster image to vectorize', 'w'); return; }
    showToast('Tracing closed contours…', 's');
    const im = new Image();
    im.onload = function () {
      try {
        const svg = rasterToSvg(
          im,
          parseInt(document.getElementById('vt-sl').value, 10),
          parseInt(document.getElementById('vs-sl').value, 10)
        );
        fabric.loadSVGFromString(svg, (objs, opts) => {
          const keep = (objs || []).filter((o) => {
            const fill = (o.fill || '').toString().toLowerCase();
            return fill && fill !== '#ffffff' && fill !== 'rgb(255,255,255)' && fill !== 'white';
          });
          if (!keep.length) { showToast('No cut paths found — lower threshold', 'w'); return; }
          const g = fabric.util.groupSVGElements(keep, opts);
          g.set({
            left: FC.width / 2,
            top: FC.height / 2,
            originX: 'center',
            originY: 'center',
            objType: 'vector',
            fill: document.getElementById('fill-ci').value,
            stroke: '#000000',
            strokeWidth: 0.5,
          });
          g.scaleToWidth(Math.min(260, FC.width * 0.45));
          FC.add(g); FC.setActiveObject(g); FC.renderAll(); saveH();
          showToast('Contour trace complete', 's');
        });
      } catch (err) {
        showToast('Trace failed: ' + (err.message || err), 'e');
      }
    };
    im.src = lastImg;
  };

  function outlineObject(obj) {
    return new Promise((resolve) => {
      const pad = 8;
      const w = Math.max(8, Math.ceil(obj.getScaledWidth()) + pad * 2);
      const h = Math.max(8, Math.ceil(obj.getScaledHeight()) + pad * 2);
      const el = document.createElement('canvas');
      const tmp = new fabric.StaticCanvas(el, {
        width: w, height: h, backgroundColor: '#ffffff', enableRetinaScaling: false, renderOnAddRemove: false,
      });
      obj.clone((cl) => {
        cl.set({
          left: w / 2, top: h / 2, originX: 'center', originY: 'center',
          shadow: null, opacity: 1, angle: 0, flipX: false, flipY: false,
        });
        if (cl.fill == null || cl.fill === '') cl.set('fill', '#000000');
        tmp.add(cl);
        tmp.renderAll();
        const svg = ImageTracer.imagedataToSVG(
          tmp.getContext().getImageData(0, 0, w, h),
          E.traceOptions(140, 4)
        );
        tmp.dispose();
        fabric.loadSVGFromString(svg, (objs, opts) => {
          const keep = (objs || []).filter((o) => {
            const fill = (o.fill || '').toString().toLowerCase();
            return fill && fill !== '#ffffff' && fill !== 'rgb(255,255,255)' && fill !== 'white';
          });
          if (!keep.length) { resolve(null); return; }
          const g = fabric.util.groupSVGElements(keep, opts);
          const c = obj.getCenterPoint();
          g.set({
            left: c.x, top: c.y, originX: 'center', originY: 'center',
            angle: obj.angle || 0, flipX: obj.flipX, flipY: obj.flipY,
            fill: obj.fill || '#000000', stroke: '#000000', strokeWidth: 0.4,
            objType: 'outlined-text',
          });
          g.scaleToWidth(obj.getScaledWidth());
          resolve(g);
        });
      });
    });
  }

  window.outlineTextForCut = async function outlineTextForCut(opts) {
    const o = opts || {};
    const texts = FC.getObjects().filter((obj) => !obj.isGuide && (obj.type === 'text' || obj.type === 'i-text' || obj.objType === 'emoji'));
    if (!texts.length) return 0;
    if (typeof ImageTracer === 'undefined') {
      showToast('Tracer unavailable — text left as live type', 'w');
      return 0;
    }
    for (const t of texts) {
      const outlined = await outlineObject(t);
      if (outlined) {
        FC.remove(t);
        FC.add(outlined);
      }
    }
    FC.discardActiveObject();
    FC.renderAll();
    if (!o.skipSave) saveH();
    return texts.length;
  };

  function snapshotCanvas() {
    return FC.toJSON(['objType', 'isGuide', 'cutCommands', 'bgRemoved', 'curveMode', 'curveAmount', 'curveSource', 'kitPlayer']);
  }

  function restoreCanvas(snap) {
    return new Promise((resolve) => {
      histBusy = true;
      FC.loadFromJSON(snap, () => {
        histBusy = false;
        FC.renderAll();
        updateLayers();
        updateStats();
        resolve();
      });
    });
  }

  async function withTemporaryOutlines(fn) {
    const snap = snapshotCanvas();
    try {
      await outlineTextForCut({ skipSave: true });
      return await fn();
    } finally {
      await restoreCanvas(snap);
    }
  }

  const prevDoExport = window.doExport;
  window.doExport = async function doExport() {
    const fmt = document.getElementById('exp-fmt').value;
    const outline = document.getElementById('exp-outline');
    const needOutline = (fmt === 'cut-svg' || fmt === 'dxf' || fmt === 'hpgl') && outline && outline.checked;
    const run = async function () {
      if (fmt === 'hpgl') {
        dlBlob(new Blob([genHPGL()], { type: 'application/vnd.hp-hpgl' }), 'aisac-cut-plotter.plt');
        showToast('Exported HPGL / PLT', 's');
        return;
      }
      if (fmt === 'dxf') {
        dlBlob(new Blob([genDXF()], { type: 'application/dxf' }), 'aisac-cut-plotter.dxf');
        showToast('Exported DXF (mm, Y-up)', 's');
        return;
      }
      if (fmt === 'cut-svg') {
        let svg = FC.toSVG({
          width: E.toMm(S.docW, S.unit) + 'mm',
          height: E.toMm(S.docH, S.unit) + 'mm',
          viewBox: { x: 0, y: 0, width: FC.width, height: FC.height },
        });
        svg = E.stripFillsForCut(svg);
        const addScale = document.getElementById('exp-scale').checked;
        svg = svg.replace('</svg>', buildSVGWatermark(FC.width, FC.height, addScale, S.docW, S.docH) + '</svg>');
        svg = '<!-- aisac CutterStudio Pro · ' + E.toMm(S.docW, S.unit) + 'mm × ' + E.toMm(S.docH, S.unit) + 'mm · ' + new Date().toISOString() + ' -->\n' + svg;
        dlBlob(new Blob([svg], { type: 'image/svg+xml' }), 'aisac-cut-plotter.svg');
        showToast('Exported Cut-SVG', 's');
        return;
      }
      prevDoExport();
    };
    closeModal('exp-modal');
    if (needOutline) {
      showToast('Outlining text for cut (canvas restored after)…', 's');
      await withTemporaryOutlines(run);
    } else {
      await run();
    }
  };

  const prevPayload = window.projectPayload;
  window.projectPayload = function projectPayload() {
    const base = JSON.parse(prevPayload());
    const extra = { unit: S.unit, docW: S.docW, docH: S.docH, version: 3 };
    extra.roster = (document.getElementById('kit-roster') || {}).value || '';
    if (typeof ShopReady !== 'undefined') extra.shop = ShopReady.loadSettings();
    if (typeof CutterEdit !== 'undefined' && CutterEdit.loadShapes) extra.quickShapes = CutterEdit.loadShapes();
    return JSON.stringify(Object.assign(base, E.projectMeta(), extra));
  };

  const prevLoad = window.loadProjectJSON;
  window.loadProjectJSON = function loadProjectJSON(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.unit) S.unit = data.unit;
    S.PPC = E.pxPerUnit(S.unit);
    const sel = document.getElementById('unit-in');
    if (sel) sel.value = S.unit;
    setUnitBadges();
    if (data.roster && document.getElementById('kit-roster')) {
      document.getElementById('kit-roster').value = data.roster;
    }
    if (data.shop && typeof ShopReady !== 'undefined') ShopReady.saveSettings(data.shop);
    if (data.quickShapes && typeof CutterEdit !== 'undefined' && CutterEdit.saveShapes) {
      CutterEdit.saveShapes(data.quickShapes);
      if (CutterEdit.renderCustomShapes) CutterEdit.renderCustomShapes();
    }
    prevLoad(JSON.stringify(data));
  };

  window.platformName = function platformName() {
    if (window.desktop && window.desktop.platform === 'linux') return 'Linux desktop';
    if (window.desktop && window.desktop.platform === 'win32') return 'Windows desktop';
    if (window.desktop && window.desktop.isDesktop) return 'Desktop';
    return 'browser';
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof FC !== 'undefined') window.FC = FC;
    setUnitBadges();
    const readyEl = document.getElementById('s-plat');
    if (readyEl) readyEl.textContent = platformName();
  });
})();
