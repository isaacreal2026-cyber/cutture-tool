/**
 * Shop tools that Cricut/Silhouette charge for: weld, contour offset,
 * align/distribute, test cut, weed tabs, overcut, tiling, size-to-mm.
 * Browser + Node. Does not restyle studio chrome.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ShopTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function convexHull(points) {
    const pts = (points || []).filter(function (p) {
      return p && Number.isFinite(p.x) && Number.isFinite(p.y);
    }).slice().sort(function (a, b) {
      return a.x === b.x ? a.y - b.y : a.x - b.x;
    });
    if (pts.length <= 2) return pts;
    function cross(o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    const lower = [];
    pts.forEach(function (p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    });
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function boxOf(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (points || []).forEach(function (p) {
      if (!p) return;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function boxesOverlap(a, b, pad) {
    const g = pad == null ? 0 : Number(pad);
    return !(a.x + a.w + g < b.x || b.x + b.w + g < a.x || a.y + a.h + g < b.y || b.y + b.h + g < a.y);
  }

  function weldPolylines(list, pad) {
    const items = (list || []).map(function (it, i) {
      const pts = it.points || it;
      return { i: i, points: pts, box: boxOf(pts) };
    });
    const parent = items.map(function (_, i) { return i; });
    function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
    function join(a, b) { parent[find(a)] = find(b); }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (boxesOverlap(items[i].box, items[j].box, pad == null ? 0.4 : pad)) join(i, j);
      }
    }
    const groups = Object.create(null);
    items.forEach(function (it, i) {
      const r = find(i);
      if (!groups[r]) groups[r] = [];
      groups[r].push(it);
    });
    return Object.keys(groups).map(function (k) {
      const g = groups[k];
      if (g.length === 1) {
        return { type: 'polyline', closed: true, points: g[0].points, welded: false };
      }
      const pts = [];
      g.forEach(function (it) { pts.push.apply(pts, it.points); });
      return { type: 'polyline', closed: true, points: convexHull(pts), welded: true, count: g.length };
    });
  }

  function offsetClosed(points, dist) {
    const d = Number(dist) || 0;
    const src = (points || []).slice();
    if (src.length < 3 || !d) return src.slice();
    if (src[0].x === src[src.length - 1].x && src[0].y === src[src.length - 1].y) src.pop();
    let area = 0;
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length];
      area += a.x * b.y - b.x * a.y;
    }
    const sign = area >= 0 ? 1 : -1;
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const prev = src[(i - 1 + src.length) % src.length];
      const cur = src[i];
      const next = src[(i + 1) % src.length];
      const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
      const e2x = next.x - cur.x, e2y = next.y - cur.y;
      const l1 = Math.hypot(e1x, e1y) || 1;
      const l2 = Math.hypot(e2x, e2y) || 1;
      const n1x = sign * e1y / l1, n1y = -sign * e1x / l1;
      const n2x = sign * e2y / l2, n2y = -sign * e2x / l2;
      let nx = n1x + n2x, ny = n1y + n2y;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const miter = clamp(1 / Math.max(0.2, nx * n1x + ny * n1y), 1, 4);
      out.push({ x: cur.x + nx * d * miter, y: cur.y + ny * d * miter });
    }
    return out;
  }

  function applyOvercut(points, mm, closed) {
    const list = (points || []).slice();
    const d = Number(mm) || 0;
    if (!closed || d <= 0 || list.length < 2) return list;
    const a = list[0], b = list[1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    list.push({ x: a.x + ((b.x - a.x) / len) * d, y: a.y + ((b.y - a.y) / len) * d });
    return list;
  }

  function weedTabs(bbox, opts) {
    const o = opts || {};
    const tab = Math.max(1, Number(o.tabMm) || 4);
    const count = o.count === 8 ? 8 : 4;
    const x0 = Number(bbox.left), y0 = Number(bbox.top);
    const x1 = Number(bbox.right), y1 = Number(bbox.bottom);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const spots = [
      { x: cx, y: y0, dx: 0, dy: 1 },
      { x: cx, y: y1, dx: 0, dy: -1 },
      { x: x0, y: cy, dx: 1, dy: 0 },
      { x: x1, y: cy, dx: -1, dy: 0 },
    ];
    if (count === 8) {
      spots.push(
        { x: x0, y: y0, dx: 1, dy: 1 },
        { x: x1, y: y0, dx: -1, dy: 1 },
        { x: x0, y: y1, dx: 1, dy: -1 },
        { x: x1, y: y1, dx: -1, dy: -1 }
      );
    }
    return spots.map(function (s) {
      const hx = Math.abs(s.dx) ? tab : tab * 0.45;
      const hy = Math.abs(s.dy) ? tab : tab * 0.45;
      const ox = s.dx * tab * 0.35;
      const oy = s.dy * tab * 0.35;
      return {
        type: 'polyline',
        closed: true,
        objType: 'weed-tab',
        points: [
          { x: s.x - hx + ox, y: s.y - hy + oy },
          { x: s.x + hx + ox, y: s.y - hy + oy },
          { x: s.x + hx + ox, y: s.y + hy + oy },
          { x: s.x - hx + ox, y: s.y + hy + oy },
        ],
      };
    });
  }

  function testCutSquare(mm) {
    const s = Math.max(4, Number(mm) || 10);
    return {
      type: 'polyline',
      closed: true,
      objType: 'test-cut',
      points: [
        { x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s },
      ],
      sizeMm: s,
    };
  }

  function alignBoxes(boxes, mode, frame) {
    const list = boxes || [];
    if (!list.length) return [];
    const fr = frame || {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach(function (b) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });
    return list.map(function (b) {
      const n = { x: b.x, y: b.y, w: b.w, h: b.h, i: b.i };
      if (mode === 'left') n.x = minX;
      else if (mode === 'right') n.x = maxX - b.w;
      else if (mode === 'top') n.y = minY;
      else if (mode === 'bottom') n.y = maxY - b.h;
      else if (mode === 'centerH') n.x = (minX + maxX) / 2 - b.w / 2;
      else if (mode === 'centerV') n.y = (minY + maxY) / 2 - b.h / 2;
      else if (mode === 'sheetH' && fr.w) n.x = fr.w / 2 - b.w / 2;
      else if (mode === 'sheetV' && fr.h) n.y = fr.h / 2 - b.h / 2;
      return n;
    });
  }

  function distributeBoxes(boxes, axis) {
    const list = (boxes || []).slice().sort(function (a, b) {
      return axis === 'y' ? a.y - b.y : a.x - b.x;
    });
    if (list.length < 3) return list.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h, i: b.i }; });
    const first = list[0], last = list[list.length - 1];
    const span = axis === 'y'
      ? (last.y + last.h / 2) - (first.y + first.h / 2)
      : (last.x + last.w / 2) - (first.x + first.w / 2);
    const step = span / (list.length - 1);
    return list.map(function (b, i) {
      const n = { x: b.x, y: b.y, w: b.w, h: b.h, i: b.i };
      if (axis === 'y') n.y = first.y + first.h / 2 + step * i - b.h / 2;
      else n.x = first.x + first.w / 2 + step * i - b.w / 2;
      return n;
    });
  }

  function tilePlan(artW, artH, sheetW, sheetH, overlapMm) {
    const ov = Math.max(0, Number(overlapMm) || 0);
    const aw = Number(artW) || 0, ah = Number(artH) || 0;
    const sw = Number(sheetW) || 1, sh = Number(sheetH) || 1;
    if (aw <= 0 || ah <= 0) return { cols: 0, rows: 0, tiles: [], needed: false };
    const stepW = Math.max(1, sw - ov);
    const stepH = Math.max(1, sh - ov);
    const cols = Math.max(1, Math.ceil((aw - ov) / stepW));
    const rows = Math.max(1, Math.ceil((ah - ov) / stepH));
    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * stepW;
        const y = r * stepH;
        tiles.push({
          col: c, row: r,
          x: x, y: y,
          w: Math.min(sw, aw - x),
          h: Math.min(sh, ah - y),
          name: 'tile-' + (r + 1) + 'x' + (c + 1),
        });
      }
    }
    return { cols: cols, rows: rows, tiles: tiles, needed: cols * rows > 1, overlapMm: ov };
  }

  function scaleToHeight(box, heightMm) {
    const h = Number(heightMm);
    const bh = Number(box && box.h) || 0;
    if (!h || h <= 0 || !bh) return { scale: 1, w: box && box.w, h: bh };
    const s = h / bh;
    return { scale: s, w: (box.w || 0) * s, h: h };
  }

  return {
    convexHull: convexHull,
    boxOf: boxOf,
    boxesOverlap: boxesOverlap,
    weldPolylines: weldPolylines,
    offsetClosed: offsetClosed,
    applyOvercut: applyOvercut,
    weedTabs: weedTabs,
    testCutSquare: testCutSquare,
    alignBoxes: alignBoxes,
    distributeBoxes: distributeBoxes,
    tilePlan: tilePlan,
    scaleToHeight: scaleToHeight,
  };
});

(function () {
  if (typeof window === 'undefined' || typeof ShopTools === 'undefined') return;
  const T = ShopTools;
  function $(id) { return document.getElementById(id); }
  function board() { return (typeof FC !== 'undefined' && FC) || window.FC; }
  function px() { return (typeof CutterEngine !== 'undefined') ? CutterEngine.PX_PER_MM : 3.779527559; }

  function selectedObjects() {
    const fc = board();
    if (!fc) return [];
    const act = fc.getActiveObject();
    const skip = function (o) {
      return !o || o.isGuide || (typeof CutterEngine !== 'undefined' && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
    };
    if (act && act.type === 'activeSelection') {
      const out = [];
      act.forEachObject(function (o) { if (!skip(o)) out.push(o); });
      return out;
    }
    if (act && !skip(act)) return [act];
    return fc.getObjects().filter(function (o) { return !skip(o); });
  }

  function boxesFrom(objs) {
    return objs.map(function (o, i) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      return { i: i, x: b.left, y: b.top, w: b.width, h: b.height, ref: o };
    });
  }

  function applyBoxMoves(moved, objs) {
    const fc = board();
    moved.forEach(function (m) {
      const o = objs[m.i];
      if (!o) return;
      o.setPositionByOrigin(new fabric.Point(m.x + m.w / 2, m.y + m.h / 2), 'center', 'center');
      o.setCoords();
    });
    fc.discardActiveObject();
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
  }

  window.alignSelection = function alignSelection(mode) {
    const objs = selectedObjects();
    if (objs.length < 2 && mode !== 'sheetH' && mode !== 'sheetV') {
      showToast('Select two or more pieces', 'w');
      return;
    }
    const fc = board();
    const moved = T.alignBoxes(boxesFrom(objs), mode, { w: fc.width, h: fc.height });
    applyBoxMoves(moved, objs);
    showToast('Aligned ' + mode, 's');
  };

  window.distributeSelection = function distributeSelection(axis) {
    const objs = selectedObjects();
    if (objs.length < 3) { showToast('Select three or more to distribute', 'w'); return; }
    applyBoxMoves(T.distributeBoxes(boxesFrom(objs), axis), objs);
    showToast('Distributed ' + (axis === 'y' ? 'vertically' : 'horizontally'), 's');
  };

  window.weldSelection = function weldSelection() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') return;
    const objs = selectedObjects();
    if (objs.length < 2) { showToast('Select overlapping pieces to weld', 'w'); return; }
    const loops = [];
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      loops.push({
        points: [
          { x: b.left, y: b.top }, { x: b.left + b.width, y: b.top },
          { x: b.left + b.width, y: b.top + b.height }, { x: b.left, y: b.top + b.height },
        ],
      });
    });
    const welded = T.weldPolylines(loops, 2);
    const fill = (objs[0].fill && String(objs[0].fill).indexOf('#') === 0) ? objs[0].fill : '#111111';
    objs.forEach(function (o) { fc.remove(o); });
    welded.forEach(function (w) {
      const pts = w.points;
      const d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ' ' + p.y; }).join(' ') + ' Z';
      const path = new fabric.Path(d, {
        fill: fill, stroke: '#111111', strokeWidth: 0.6,
        objType: w.welded ? 'welded' : 'shape',
      });
      fc.add(path);
    });
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast(welded.some(function (w) { return w.welded; }) ? 'Welded overlapping pieces' : 'Nothing overlapped — kept separate', welded.some(function (w) { return w.welded; }) ? 's' : 'w');
  };

  window.offsetSelection = function offsetSelection() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') return;
    const objs = selectedObjects();
    if (!objs.length) { showToast('Select a logo or name first', 'w'); return; }
    const mm = parseFloat(($('edit-offset-mm') || $('sheet-offset-mm') || {}).value) || 3;
    const d = mm * px();
    let n = 0;
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      const box = [
        { x: b.left, y: b.top }, { x: b.left + b.width, y: b.top },
        { x: b.left + b.width, y: b.top + b.height }, { x: b.left, y: b.top + b.height },
      ];
      const off = T.offsetClosed(box, d);
      const path = off.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ' ' + p.y; }).join(' ') + ' Z';
      const obj = new fabric.Path(path, {
        fill: null, stroke: o.fill || '#111111', strokeWidth: 1,
        objType: 'contour',
      });
      fc.add(obj);
      n++;
    });
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Contour +' + mm + ' mm on ' + n + ' piece(s)', 's');
  };

  window.applyHeightMm = function applyHeightMm() {
    const objs = selectedObjects();
    if (!objs.length) { showToast('Select a piece', 'w'); return; }
    const mm = parseFloat(($('edit-height-mm') || {}).value);
    if (!mm || mm <= 0) { showToast('Enter a height in mm', 'w'); return; }
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      const next = T.scaleToHeight({ w: b.width, h: b.height }, mm * px());
      o.scaleX = (o.scaleX || 1) * next.scale;
      o.scaleY = (o.scaleY || 1) * next.scale;
      o.setCoords();
    });
    board().renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Height set to ' + mm + ' mm', 's');
  };

  window.addTestCut = function addTestCut() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') return;
    const mm = parseFloat(($('sheet-test-mm') || {}).value) || 10;
    const sq = T.testCutSquare(mm);
    const s = mm * px();
    const rect = new fabric.Rect({
      left: 20, top: 20, width: s, height: s,
      fill: null, stroke: '#111111', strokeWidth: 1,
      objType: 'test-cut',
    });
    fc.add(rect);
    fc.setActiveObject(rect);
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Test square ' + mm + ' mm — send this first to check force', 's');
    return sq;
  };

  window.addWeedTabs = function addWeedTabs() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined' || typeof CutterEngine === 'undefined') return;
    const objs = selectedObjects();
    if (!objs.length) { showToast('Add artwork first', 'w'); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    });
    const p = px();
    const tabs = T.weedTabs({
      left: minX / p, top: minY / p, right: maxX / p, bottom: maxY / p,
    }, { tabMm: 4, count: 4 });
    tabs.forEach(function (tb) {
      const pts = tb.points;
      const path = pts.map(function (pt, i) { return (i ? 'L' : 'M') + (pt.x * p) + ' ' + (pt.y * p); }).join(' ') + ' Z';
      fc.add(new fabric.Path(path, {
        fill: null, stroke: '#111111', strokeWidth: 1, objType: 'weed-tab',
      }));
    });
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Weed tabs added (4 mm bridges)', 's');
  };

  window.tileOversized = function tileOversized() {
    const fc = board();
    if (!fc || typeof CutterEngine === 'undefined') return;
    const E = CutterEngine;
    const objs = selectedObjects();
    if (!objs.length) { showToast('Add artwork first', 'w'); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height);
    });
    const p = E.PX_PER_MM;
    const plan = T.tilePlan(
      (maxX - minX) / p,
      (maxY - minY) / p,
      E.toMm(S.docW, S.unit || 'cm'),
      E.toMm(S.docH, S.unit || 'cm'),
      parseFloat(($('sheet-tile-ov') || {}).value) || 5
    );
    const el = $('tile-out');
    if (el) {
      el.textContent = plan.needed
        ? plan.rows + ' × ' + plan.cols + ' tiles (' + plan.tiles.length + ') · ' + plan.overlapMm + ' mm overlap'
        : 'Fits on one sheet — no tile needed';
    }
    showToast(plan.needed ? ('Needs ' + plan.tiles.length + ' sheets') : 'Fits on this sheet', plan.needed ? 'w' : 's');
    return plan;
  };

  window.currentOvercutMm = function currentOvercutMm() {
    return parseFloat(($('kit-overcut') || $('sheet-overcut') || {}).value) || 0;
  };
})();
