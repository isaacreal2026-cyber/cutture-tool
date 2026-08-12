/**
 * Map-style zoom + cm geometry.
 * The sheet is a fixed millimetre world. Zoom scales the whole map
 * (text, logos, grid) around the cursor. Rulers lock to the same world.
 * Plotter mm = world px / 3.779527559 (96dpi). Zoom never changes that.
 */
(function () {
  if (typeof CutterEngine === 'undefined') return;
  const E = CutterEngine;
  const PAD = 40; // must match #zoom-root top/left

  function sheetPx() {
    if (typeof sheetPxSize === 'function') return sheetPxSize();
    return { w: Math.round(S.docW * S.PPC), h: Math.round(S.docH * S.PPC) };
  }

  function scroller() { return document.getElementById('cscroll'); }

  function worldFromScroll(scroll, zoom) {
    return (scroll - PAD) / (zoom || 1);
  }

  function unitLabel() {
    return (E.UNITS[S.unit] || E.UNITS.cm).label;
  }

  function niceStep(pxPerUnit) {
    // Maps-style: denser ticks when zoomed in, never crowd labels.
    const minPx = 48;
    const raw = minPx / Math.max(1e-6, pxPerUnit);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * pow;
  }

  window.applyZoom = function applyZoom() {
    S.zoom = Math.min(8, Math.max(0.08, S.zoom));
    const pct = Math.round(S.zoom * 100);
    const zl = document.getElementById('zlevel');
    const zs = document.getElementById('s-zoom');
    if (zl) zl.textContent = pct + '%';
    if (zs) zs.textContent = 'Zoom: ' + pct + '%';
    const dim = sheetPx();
    const zr = document.getElementById('zoom-root');
    if (zr) {
      zr.style.transformOrigin = '0 0';
      zr.style.transform = 'scale(' + S.zoom + ')';
      zr.style.top = PAD + 'px';
      zr.style.left = PAD + 'px';
      // Layout box = visual map size so scroll range === what you see
      zr.style.width = dim.w + 'px';
      zr.style.height = dim.h + 'px';
    }
    const cc = document.getElementById('ccontainer');
    if (cc) {
      cc.style.width = dim.w + 'px';
      cc.style.height = dim.h + 'px';
    }
    const sc = scroller();
    if (sc) {
      // Spacer so the scaled visual (dim * zoom) is fully reachable
      sc.style.setProperty('--map-w', (dim.w * S.zoom + PAD * 2) + 'px');
      sc.style.setProperty('--map-h', (dim.h * S.zoom + PAD * 2) + 'px');
      if (!sc.querySelector('#map-spacer')) {
        const sp = document.createElement('div');
        sp.id = 'map-spacer';
        sp.style.position = 'absolute';
        sp.style.left = '0';
        sp.style.top = '0';
        sp.style.pointerEvents = 'none';
        sc.appendChild(sp);
      }
      const sp = sc.querySelector('#map-spacer');
      sp.style.width = (dim.w * S.zoom + PAD * 2) + 'px';
      sp.style.height = (dim.h * S.zoom + PAD * 2) + 'px';
    }
    syncRulers();
  };

  function syncRulers() {
    const sc = scroller();
    if (!sc) return;
    drawMapRulers(worldFromScroll(sc.scrollLeft, S.zoom), worldFromScroll(sc.scrollTop, S.zoom));
  }

  window.drawRulers = function drawRulers(scrollX, scrollY) {
    // scrollX/Y here are WORLD pixels (unscaled sheet)
    drawMapRulers(scrollX, scrollY);
  };

  function drawMapRulers(worldLeft, worldTop) {
    const wrap = document.getElementById('cwrap');
    if (!wrap) return;
    const rw = wrap.clientWidth, rh = wrap.clientHeight;
    const label = unitLabel();
    const pxPerUnit = S.PPC * S.zoom;
    const stepU = niceStep(pxPerUnit);
    const dim = sheetPx();

    function theme(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = S.light ? '#e4e4f0' : '#13131a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = S.light ? '#c0c0dd' : '#363650';
      ctx.fillStyle = S.light ? '#555570' : '#9090b0';
      ctx.font = '8px monospace';
    }

    // ruler-h is flush with cscroll (not the 22px corner)
    const rhc = document.getElementById('rh-c');
    rhc.width = rw; rhc.height = 22;
    const rhx = rhc.getContext('2d');
    theme(rhx, rw, 22);
    const startU = worldLeft / S.PPC;
    const endU = (worldLeft + rw / S.zoom) / S.PPC + stepU;
    const first = Math.floor(startU / stepU) * stepU;
    for (let u = first; u <= endU; u += stepU) {
      if (u < -stepU || u > dim.w / S.PPC + stepU) continue;
      const px = (u * S.PPC - worldLeft) * S.zoom;
      if (px < -20 || px > rw) continue;
      const major = Math.abs((u / stepU) % 2) < 1e-6;
      rhx.beginPath();
      rhx.moveTo(px + 0.5, major ? 10 : 15);
      rhx.lineTo(px + 0.5, 22);
      rhx.lineWidth = 0.6;
      rhx.stroke();
      if (major) {
        const txt = Math.abs(u) < 1e-9 ? '0' : (Math.round(u * 1000) / 1000) + label;
        rhx.fillText(txt, px + 3, 10);
      }
    }

    const rvc = document.getElementById('rv-c');
    rvc.width = 22; rvc.height = rh;
    const rvx = rvc.getContext('2d');
    theme(rvx, 22, rh);
    const startUV = worldTop / S.PPC;
    const endUV = (worldTop + rh / S.zoom) / S.PPC + stepU;
    const firstV = Math.floor(startUV / stepU) * stepU;
    for (let u = firstV; u <= endUV; u += stepU) {
      if (u < -stepU || u > dim.h / S.PPC + stepU) continue;
      const py = (u * S.PPC - worldTop) * S.zoom;
      if (py < -20 || py > rh) continue;
      const major = Math.abs((u / stepU) % 2) < 1e-6;
      rvx.beginPath();
      rvx.moveTo(major ? 10 : 15, py + 0.5);
      rvx.lineTo(22, py + 0.5);
      rvx.lineWidth = 0.6;
      rvx.stroke();
      if (major) {
        rvx.save();
        rvx.translate(10, py - 2);
        rvx.rotate(-Math.PI / 2);
        const txt = Math.abs(u) < 1e-9 ? '0' : (Math.round(u * 1000) / 1000) + label;
        rvx.fillText(txt, 0, 0);
        rvx.restore();
      }
    }
  }

  window.zoomAt = function zoomAt(nextZoom, clientX, clientY) {
    const sc = scroller();
    const z0 = S.zoom;
    const z1 = Math.min(8, Math.max(0.08, nextZoom));
    if (!sc) { S.zoom = z1; applyZoom(); return; }
    const rect = sc.getBoundingClientRect();
    const hasPt = clientX != null && clientY != null;
    const vx = hasPt ? clientX - rect.left : rect.width / 2;
    const vy = hasPt ? clientY - rect.top : rect.height / 2;
    const worldX = worldFromScroll(sc.scrollLeft + vx, z0);
    const worldY = worldFromScroll(sc.scrollTop + vy, z0);
    S.zoom = z1;
    applyZoom();
    sc.scrollLeft = worldX * z1 + PAD - vx;
    sc.scrollTop = worldY * z1 + PAD - vy;
    syncRulers();
  };

  window.zoomBy = function zoomBy(delta, ev) {
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    if (ev && ev.clientX != null) zoomAt(S.zoom * factor, ev.clientX, ev.clientY);
    else {
      const sc = scroller();
      const r = sc ? sc.getBoundingClientRect() : { left: 0, top: 0, width: 400, height: 300 };
      zoomAt(S.zoom * factor, r.left + r.width / 2, r.top + r.height / 2);
    }
  };

  window.zoomFit = function zoomFit() {
    const wrap = document.getElementById('cwrap');
    const dim = sheetPx();
    const fit = Math.min((wrap.clientWidth - 80) / dim.w, (wrap.clientHeight - 80) / dim.h, 1);
    S.zoom = Math.max(0.08, fit);
    applyZoom();
    const sc = scroller();
    if (sc) { sc.scrollLeft = 0; sc.scrollTop = 0; }
    syncRulers();
  };

  window.onMW = function onMW(opt) {
    const e = opt && opt.e;
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    const dir = e.deltaY > 0 ? -1 : 1;
    zoomBy(dir * 0.15, e);
  };

  window.onScroll = function onScroll() {
    syncRulers();
  };

  // Transform panel talks in the same units as the rulers / plotter
  const prevOnSel = window.onSel;
  window.onSel = function onSel() {
    if (typeof prevOnSel === 'function') prevOnSel();
    const o = FC && FC.getActiveObject();
    if (!o) return;
    const dec = (E.UNITS[S.unit] || E.UNITS.cm).decimals;
    const toU = (px) => E.fromMm(px / E.PX_PER_MM, S.unit).toFixed(dec);
    document.getElementById('ox').value = toU(o.left);
    document.getElementById('oy').value = toU(o.top);
    document.getElementById('ow').value = toU(o.width * o.scaleX);
    document.getElementById('oh').value = toU(o.height * o.scaleY);
  };

  const prevUpdatePos = window.updatePos;
  window.updatePos = function updatePos() {
    const o = FC && FC.getActiveObject();
    if (!o) return;
    const toPx = (v) => E.toMm(v, S.unit) * E.PX_PER_MM;
    const x = parseFloat(document.getElementById('ox').value);
    const y = parseFloat(document.getElementById('oy').value);
    if (!isNaN(x)) o.set('left', toPx(x));
    if (!isNaN(y)) o.set('top', toPx(y));
    o.setCoords(); FC.renderAll();
  };

  const prevUpdateSize = window.updateSize;
  window.updateSize = function updateSize() {
    const o = FC && FC.getActiveObject();
    if (!o) return;
    const toPx = (v) => E.toMm(v, S.unit) * E.PX_PER_MM;
    const w = parseFloat(document.getElementById('ow').value);
    const h = parseFloat(document.getElementById('oh').value);
    if (!isNaN(w) && o.width) o.set('scaleX', toPx(w) / o.width);
    if (!isNaN(h) && o.height) o.set('scaleY', toPx(h) / o.height);
    o.setCoords(); FC.renderAll();
  };

  function bindMapWheel() {
    const sc = scroller();
    if (!sc || sc._mapWheel) return;
    sc._mapWheel = true;
    sc.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -0.15 : 0.15, e);
    }, { passive: false });
  }

  window.MapZoom = {
    PAD: PAD,
    worldFromScroll: worldFromScroll,
    niceStep: niceStep,
    sheetPx: sheetPx,
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindMapWheel();
    applyZoom();
  });
})();
