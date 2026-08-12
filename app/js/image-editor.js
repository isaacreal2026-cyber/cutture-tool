/**
 * Import editor — opens on raster import. Does not restyle the studio.
 * Flow: file → edit (quality / crop / BG) → place on playground with cut silhouette.
 */
(function () {
  if (typeof ImagePrep === 'undefined') return;

  const P = ImagePrep;
  const state = {
    src: null,
    w: 0,
    h: 0,
    work: null,
    ww: 0,
    wh: 0,
    crop: null,
    cropping: false,
    drag: null,
    pickBg: false,
    customBg: null,
    name: 'logo',
  };

  function $(id) { return document.getElementById(id); }

  function checkerFill(ctx, w, h) {
    const s = 8;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = ((x / s + y / s) & 1) ? '#d8d8e4' : '#f4f4f8';
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  function drawPreview() {
    const c = $('img-prev');
    if (!c || !state.work) return;
    const max = 420;
    const scale = Math.min(max / state.ww, max / state.wh, 1);
    const dw = Math.max(1, Math.round(state.ww * scale));
    const dh = Math.max(1, Math.round(state.wh * scale));
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d');
    checkerFill(ctx, dw, dh);
    const tmp = document.createElement('canvas');
    tmp.width = state.ww; tmp.height = state.wh;
    tmp.getContext('2d').putImageData(new ImageData(state.work, state.ww, state.wh), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, dw, dh);
    if (state.crop) {
      const r = state.crop;
      ctx.save();
      ctx.fillStyle = 'rgba(12,12,16,.45)';
      ctx.fillRect(0, 0, dw, dh);
      ctx.clearRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
      ctx.drawImage(tmp, r.x, r.y, r.w, r.h, r.x * scale, r.y * scale, r.w * scale, r.h * scale);
      ctx.strokeStyle = '#7c5cfc';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5, r.w * scale, r.h * scale);
      ctx.restore();
    }
    c._viewScale = scale;
  }

  function setStatus(msg) {
    const el = $('img-stat');
    if (el) el.textContent = msg;
  }

  function loadPixelsFromImage(im, quality) {
    const q = P.qualitySize(im.naturalWidth || im.width, im.naturalHeight || im.height, quality);
    const c = document.createElement('canvas');
    c.width = q.w; c.height = q.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0, q.w, q.h);
    const id = ctx.getImageData(0, 0, q.w, q.h);
    state.src = new Uint8ClampedArray(id.data);
    state.w = q.w; state.h = q.h;
    state.work = new Uint8ClampedArray(id.data);
    state.ww = q.w; state.wh = q.h;
    state.crop = null;
    state.customBg = null;
  }

  function resetWork() {
    if (!state.src) return;
    state.work = new Uint8ClampedArray(state.src);
    state.ww = state.w; state.wh = state.h;
    state.crop = null;
  }

  function currentTolerance() {
    return parseInt(($('img-tol') || {}).value || '30', 10);
  }

  function runAutoBg() {
    if (!state.work) return;
    const opts = {
      tolerance: currentTolerance(),
      punchHoles: $('img-holes') && $('img-holes').checked,
      despeckle: $('img-speck') && $('img-speck').checked ? 10 : 0,
      force: $('img-force') && $('img-force').checked,
      bg: state.customBg || undefined,
    };
    const out = P.removeBackground(state.work, state.ww, state.wh, opts);
    state.work = out.data;
    const feather = parseInt(($('img-feather') || {}).value || '0', 10);
    if (feather) P.featherAlpha(state.work, state.ww, state.wh, feather);
    const trim = P.trimTransparent(state.work, state.ww, state.wh, 1);
    if (!trim.empty) {
      state.work = trim.data;
      state.ww = trim.width;
      state.wh = trim.height;
      state.crop = null;
    }
    const pct = Math.round((out.remaining / (state.w * state.h)) * 100);
    if (out.preserved) setStatus('Existing transparency kept (PNG). Ready to place.');
    else if (out.remaining < 12) setStatus('Almost nothing left — raise tolerance or pick the true background.');
    else setStatus('Background removed · ' + state.ww + '×' + state.wh + ' · ~' + pct + '% subject');
    drawPreview();
  }

  function applyCrop() {
    if (!state.crop || !state.work) return;
    const c = P.crop(state.work, state.ww, state.wh, state.crop.x, state.crop.y, state.crop.w, state.crop.h);
    state.work = c.data; state.ww = c.width; state.wh = c.height;
    state.crop = null;
    state.cropping = false;
    setStatus('Cropped to ' + state.ww + '×' + state.wh);
    drawPreview();
  }

  function toDataURL() {
    const c = document.createElement('canvas');
    c.width = state.ww; c.height = state.wh;
    c.getContext('2d').putImageData(new ImageData(state.work, state.ww, state.wh), 0, 0);
    return c.toDataURL('image/png');
  }

  function placeOnCanvas() {
    if (!state.work || !window.FC) return;
    if (state.crop) applyCrop();
    const url = toDataURL();
    const cmds = P.localCutCommands(state.work, state.ww, state.wh, 0.7);
    if (!cmds.length) {
      showToast('No silhouette — remove background or check contrast', 'w');
      return;
    }
    lastImg = url;
    fabric.Image.fromURL(url, function (img) {
      img.set({
        left: FC.width / 2,
        top: FC.height / 2,
        originX: 'center',
        originY: 'center',
        objType: 'logo',
        cutCommands: cmds,
        bgRemoved: true,
      });
      img.scaleToWidth(Math.min(280, FC.width * 0.45));
      FC.add(img);
      FC.setActiveObject(img);
      FC.renderAll();
      saveH();
      const vsec = $('vsec');
      if (vsec) vsec.style.display = 'block';
      closeModal('img-modal');
      showToast('Logo placed · cut path follows the silhouette', 's');
    });
  }

  function openEditorFromFile(file) {
    const r = new FileReader();
    r.onload = function (e) {
      const im = new Image();
      im.onload = function () {
        state.name = (file.name || 'logo').replace(/\.[^.]+$/, '');
        state.fullUrl = e.target.result;
        const qsel = $('img-qual');
        loadPixelsFromImage(im, qsel ? qsel.value : 'original');
        const modal = $('img-modal');
        if (modal) modal.classList.remove('h');
        if (P.hasExistingAlpha(state.src)) {
          $('img-holes').checked = false;
          setStatus('Transparent PNG detected — transparency will be kept. Crop or treat, then place.');
        } else {
          $('img-holes').checked = true;
          setStatus(state.w + '×' + state.h + ' · Auto-remove background, then Place on canvas');
        }
        drawPreview();
      };
      im.src = e.target.result;
    };
    r.readAsDataURL(file);
  }

  function importSvgFile(file) {
    const r = new FileReader();
    r.onload = function (e) {
      fabric.loadSVGFromString(e.target.result, function (objs, opts) {
        const g = fabric.util.groupSVGElements(objs, opts);
        g.scaleToWidth(Math.min(200, FC.width * 0.4));
        g.set({ left: FC.width / 2, top: FC.height / 2, originX: 'center', originY: 'center', objType: 'svg' });
        FC.add(g); FC.setActiveObject(g); FC.renderAll(); saveH();
        showToast('SVG imported', 's');
      });
    };
    r.readAsText(file);
  }

  window.handleUpload = function handleUpload(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (/\.svg$/i.test(f.name) || f.type === 'image/svg+xml') importSvgFile(f);
    else openEditorFromFile(f);
    ev.target.value = '';
  };

  function bindPreview() {
    const c = $('img-prev');
    if (!c || c._bound) return;
    c._bound = true;
    c.addEventListener('mousedown', function (e) {
      const sc = c._viewScale || 1;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / sc;
      const y = (e.clientY - r.top) / sc;
      if (state.pickBg && state.work) {
        const px = clamp(Math.floor(x), 0, state.ww - 1);
        const py = clamp(Math.floor(y), 0, state.wh - 1);
        const i = (py * state.ww + px) * 4;
        state.customBg = { r: state.work[i], g: state.work[i + 1], b: state.work[i + 2] };
        state.pickBg = false;
        c.style.cursor = 'crosshair';
        setStatus('Sampled background rgb(' + state.customBg.r + ',' + state.customBg.g + ',' + state.customBg.b + ')');
        return;
      }
      if (!state.cropping) return;
      state.drag = { x: x, y: y };
      state.crop = { x: x, y: y, w: 1, h: 1 };
    });
    window.addEventListener('mousemove', function (e) {
      if (!state.drag) return;
      const sc = c._viewScale || 1;
      const r = c.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / sc, 0, state.ww);
      const y = clamp((e.clientY - r.top) / sc, 0, state.wh);
      state.crop = {
        x: Math.min(state.drag.x, x),
        y: Math.min(state.drag.y, y),
        w: Math.max(1, Math.abs(x - state.drag.x)),
        h: Math.max(1, Math.abs(y - state.drag.y)),
      };
      drawPreview();
    });
    window.addEventListener('mouseup', function () { state.drag = null; });
  }

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

  const prevSaveH = window.saveH;
  window.saveH = function saveH() {
    if (!FC || histBusy) return;
    const j = JSON.stringify(FC.toJSON(['objType', 'isGuide', 'cutCommands', 'bgRemoved']));
    if (undoStack.length && undoStack[undoStack.length - 1] === j) return;
    undoStack.push(j);
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
    projectDirty = true;
    updateLayers(); updateStats();
    if (S.wire) renderWire();
  };

  const prevApplyVect = window.applyVect;
  window.applyVect = function applyVect() {
    const o = FC && FC.getActiveObject();
    if (o && (o.type === 'image' || o.objType === 'logo') && o.getElement) {
      const el = o.getElement();
      const c = document.createElement('canvas');
      c.width = el.naturalWidth || el.width;
      c.height = el.naturalHeight || el.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(el, 0, 0);
      const id = ctx.getImageData(0, 0, c.width, c.height);
      o.cutCommands = P.localCutCommands(id.data, c.width, c.height, 0.7);
      FC.renderAll(); saveH();
      showToast('Cut path rebuilt from logo silhouette', 's');
      return;
    }
    if (typeof prevApplyVect === 'function') prevApplyVect();
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindPreview();
    const auto = $('img-auto');
    if (auto) auto.addEventListener('click', runAutoBg);
    const cropBtn = $('img-crop');
    if (cropBtn) cropBtn.addEventListener('click', function () {
      state.cropping = !state.cropping;
      cropBtn.classList.toggle('on', state.cropping);
      setStatus(state.cropping ? 'Drag on the preview to crop' : 'Crop cancelled');
    });
    const cropOk = $('img-crop-ok');
    if (cropOk) cropOk.addEventListener('click', applyCrop);
    const pick = $('img-pick');
    if (pick) pick.addEventListener('click', function () {
      state.pickBg = true;
      const c = $('img-prev');
      if (c) c.style.cursor = 'copy';
      setStatus('Click the background colour on the preview');
    });
    const reset = $('img-reset');
    if (reset) reset.addEventListener('click', function () {
      resetWork();
      setStatus('Reset to imported pixels');
      drawPreview();
    });
    const place = $('img-place');
    if (place) place.addEventListener('click', placeOnCanvas);
    const qual = $('img-qual');
    if (qual) qual.addEventListener('change', function () {
      if (!state.fullUrl) return;
      const im = new Image();
      im.onload = function () {
        loadPixelsFromImage(im, qual.value);
        setStatus('Quality → ' + qual.value + ' · ' + state.w + '×' + state.h);
        drawPreview();
      };
      im.src = state.fullUrl;
    });
  });
})();
