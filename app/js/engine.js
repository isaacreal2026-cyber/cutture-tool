/**
 * CutterStudio Pro — shared geometry / export engine.
 * Works in the browser (window.CutterEngine) and in Node (module.exports).
 * Units follow CSS/canvas: 96px = 1in = 25.4mm. All machine output is millimetres.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CutterEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PX_PER_IN = 96;
  const MM_PER_IN = 25.4;
  const PX_PER_MM = PX_PER_IN / MM_PER_IN; // 3.779527559055118
  const HPGL_PER_MM = 40; // 1 plotter unit = 0.025mm

  const UNITS = {
    mm: { label: 'mm', perMm: 1, step: 1, decimals: 1 },
    cm: { label: 'cm', perMm: 0.1, step: 0.1, decimals: 2 },
    in: { label: 'in', perMm: 1 / MM_PER_IN, step: 0.01, decimals: 3 },
  };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function pxPerMm() { return PX_PER_MM; }
  function pxPerUnit(unit) {
    const u = UNITS[unit] || UNITS.cm;
    return PX_PER_MM / u.perMm;
  }

  function toMm(value, unit) {
    const u = UNITS[unit] || UNITS.cm;
    const n = Number(value);
    return Number.isFinite(n) ? n / u.perMm : 0;
  }
  function fromMm(mm, unit) {
    const u = UNITS[unit] || UNITS.cm;
    const n = Number(mm);
    return Number.isFinite(n) ? n * u.perMm : 0;
  }
  function sheetPx(width, height, unit) {
    return {
      w: Math.round(toMm(width, unit) * PX_PER_MM),
      h: Math.round(toMm(height, unit) * PX_PER_MM),
    };
  }
  function formatMeasure(mm, unit) {
    const u = UNITS[unit] || UNITS.cm;
    return fromMm(mm, unit).toFixed(u.decimals) + u.label;
  }

  function nest(boxes, sheetW, sheetH, margin) {
    const m = Math.max(0, Number(margin) || 0);
    let cx = m, cy = m, rowH = 0, overflow = false;
    const placed = boxes.map((b, i) => {
      const w = b.w + m * 2;
      const h = b.h + m * 2;
      if (w > sheetW - m * 2 || h > sheetH - m * 2) overflow = true;
      if (cx + w > sheetW - m && cx > m) {
        cx = m;
        cy += rowH + m;
        rowH = 0;
      }
      if (cy + h > sheetH - m) overflow = true;
      const pos = {
        i,
        left: cx + w / 2 - m,
        top: cy + h / 2 - m,
        w: b.w,
        h: b.h,
      };
      cx += w;
      rowH = Math.max(rowH, h);
      return pos;
    });
    return { placed, overflow };
  }

  function nestTrue(boxes, sheetW, sheetH, margin) {
    const m = Math.max(0, Number(margin) || 0);
    const list = boxes || [];
    let cx = m, cy = m, rowH = 0, overflow = false;
    const placed = list.map(function (b, i) {
      const w0 = Number(b.w) || 0, h0 = Number(b.h) || 0;
      function trial(w, h, rot) {
        let x = cx, y = cy, rh = rowH;
        const W = w + m * 2, H = h + m * 2;
        if (x + W > sheetW - m && x > m) {
          x = m;
          y += rh + m;
          rh = 0;
        }
        const ov = (W > sheetW - m * 2) || (H > sheetH - m * 2) || (y + H > sheetH - m);
        return { x: x, y: y, W: W, H: H, w: w, h: h, rh: rh, overflow: ov, rotated: rot };
      }
      const a = trial(w0, h0, false);
      const b90 = trial(h0, w0, true);
      let pick = a;
      if (a.overflow && !b90.overflow) pick = b90;
      else if (!a.overflow && b90.overflow) pick = a;
      else if (!a.overflow && !b90.overflow) {
        const aWraps = a.x < cx && cx > m;
        const bWraps = b90.x < cx && cx > m;
        if (aWraps && !bWraps) pick = b90;
        else if (!aWraps && bWraps) pick = a;
        else pick = a.H <= b90.H ? a : b90;
      } else {
        pick = a.H <= b90.H ? a : b90;
      }
      if (pick.overflow) overflow = true;
      cx = pick.x + pick.W;
      cy = pick.y;
      rowH = Math.max(pick.rh, pick.H);
      return {
        i: i,
        left: pick.x + pick.W / 2 - m,
        top: pick.y + pick.H / 2 - m,
        w: pick.w,
        h: pick.h,
        rotated: pick.rotated,
      };
    });
    return { placed: placed, overflow: overflow };
  }

  function regMarks(bbox, opts) {
    const o = opts || {};
    const L = Math.max(2, Number(o.markMm) || 8);
    const g = Math.max(0, Number(o.gapMm) || 3);
    const x0 = Number(bbox.left) - g;
    const y0 = Number(bbox.top) - g;
    const x1 = Number(bbox.right) + g;
    const y1 = Number(bbox.bottom) + g;
    return [
      { type: 'polyline', closed: false, points: [{ x: x0, y: y0 + L }, { x: x0, y: y0 }, { x: x0 + L, y: y0 }] },
      { type: 'polyline', closed: false, points: [{ x: x1 - L, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y0 + L }] },
      { type: 'polyline', closed: false, points: [{ x: x1, y: y1 - L }, { x: x1, y: y1 }, { x: x1 - L, y: y1 }] },
      { type: 'polyline', closed: false, points: [{ x: x0 + L, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y1 - L }] },
    ];
  }

  function isShopFixture(obj) {
    const t = obj && obj.objType;
    return t === 'weed-box' || t === 'reg-mark';
  }

  function simplify(points, epsilon) {
    if (!points || points.length <= 2) return points ? points.slice() : [];
    const eps = Math.max(0, epsilon || 0);
    if (eps === 0) return points.slice();
    const first = 0, last = points.length - 1;
    const keep = new Array(points.length).fill(false);
    keep[first] = keep[last] = true;
    const stack = [[first, last]];
    while (stack.length) {
      const [s, e] = stack.pop();
      const a = points[s], b = points[e];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let maxD = -1, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const p = points[i];
        let d;
        if (len2 === 0) {
          const ex = p.x - a.x, ey = p.y - a.y;
          d = Math.sqrt(ex * ex + ey * ey);
        } else {
          const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
          const qx = a.x + t * dx, qy = a.y + t * dy;
          d = Math.hypot(p.x - qx, p.y - qy);
        }
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx > 0) {
        keep[idx] = true;
        stack.push([s, idx], [idx, e]);
      }
    }
    return points.filter((_, i) => keep[i]);
  }

  function nlJoin(lines) { return lines.join('\n') + '\n'; }

  function dxf(entities) {
    const list = entities || [];
    let out = nlJoin([
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', '4',
      '9', '$ACADVER', '1', 'AC1014',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
    ]);
    list.filter(entityIsFinite).forEach((ent) => {
      if (ent.type === 'circle') {
        out += nlJoin([
          '0', 'CIRCLE', '8', 'CUT_LAYER',
          '10', Number(ent.cx).toFixed(4),
          '20', Number(ent.cy).toFixed(4),
          '30', '0',
          '40', Number(ent.r).toFixed(4),
        ]);
        return;
      }
      const pts = ent.points || [];
      if (!pts.length) return;
      out += nlJoin(['0', 'POLYLINE', '8', 'CUT_LAYER', '66', '1', '70', ent.closed ? '1' : '0']);
      pts.forEach((p) => {
        out += nlJoin([
          '0', 'VERTEX', '8', 'CUT_LAYER',
          '10', Number(p.x).toFixed(4),
          '20', Number(p.y).toFixed(4),
        ]);
      });
      out += nlJoin(['0', 'SEQEND']);
    });
    out += ['0', 'ENDSEC', '0', 'EOF'].join('\n');
    return out;
  }

  function hpgl(entities, opts) {
    const o = opts || {};
    const list = entities || [];
    const lines = [
      'IN;',
      'SP1;',
      'PU;',
      'VS' + (o.velocity || 20) + ';',
    ];
    function u(mm) { return Math.round(Number(mm) * HPGL_PER_MM); }
    list.filter(entityIsFinite).forEach((ent) => {
      if (ent.type === 'circle') {
        const steps = Math.max(24, Math.round((ent.r * 2 * Math.PI) / 0.4));
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          pts.push({ x: ent.cx + ent.r * Math.cos(a), y: ent.cy + ent.r * Math.sin(a) });
        }
        lines.push('PU' + u(pts[0].x) + ',' + u(pts[0].y) + ';');
        lines.push('PD' + pts.slice(1).map((p) => u(p.x) + ',' + u(p.y)).join(',') + ';');
        return;
      }
      const pts = ent.points || [];
      if (pts.length < 2) return;
      lines.push('PU' + u(pts[0].x) + ',' + u(pts[0].y) + ';');
      const rest = pts.slice(1);
      if (ent.closed) rest.push(pts[0]);
      lines.push('PD' + rest.map((p) => u(p.x) + ',' + u(p.y)).join(',') + ';');
    });
    lines.push('PU;', 'SP0;', 'IN;');
    return lines.join('\n') + '\n';
  }

  function transformPoint(x, y, m) {
    return {
      x: m[0] * x + m[2] * y + m[4],
      y: m[1] * x + m[3] * y + m[5],
    };
  }

  function multiplyMatrices(a, b) {
    const A = a && a.length === 6 ? a : [1, 0, 0, 1, 0, 0];
    const B = b && b.length === 6 ? b : [1, 0, 0, 1, 0, 0];
    return [
      A[0] * B[0] + A[2] * B[1],
      A[1] * B[0] + A[3] * B[1],
      A[0] * B[2] + A[2] * B[3],
      A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4],
      A[1] * B[4] + A[3] * B[5] + A[5],
    ];
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function safeJobName(name) {
    let n = String(name == null ? '' : name).replace(/[^A-Za-z0-9._-]+/g, '_');
    n = n.replace(/^\.+/, '').replace(/^_+/, '');
    if (!n || n === '.' || n === '..') n = 'job';
    if (!/\.(plt|hpgl|dxf|svg|json|png|txt|bin)$/i.test(n)) n += '.bin';
    return n.slice(0, 96);
  }

  function finiteNum(n) { return typeof n === 'number' && Number.isFinite(n); }

  function entityIsFinite(ent) {
    if (!ent) return false;
    if (ent.type === 'circle') return finiteNum(ent.cx) && finiteNum(ent.cy) && finiteNum(ent.r) && ent.r > 0;
    const pts = ent.points || [];
    return pts.length >= 2 && pts.every(function (p) { return p && finiteNum(p.x) && finiteNum(p.y); });
  }

  function objectMatrix(obj, parentMatrix) {
    if (parentMatrix && !obj.group) {
      const own = obj.calcOwnMatrix
        ? obj.calcOwnMatrix()
        : (obj.calcTransformMatrix ? obj.calcTransformMatrix() : [1, 0, 0, 1, 0, 0]);
      return multiplyMatrices(parentMatrix, own);
    }
    if (obj.calcTransformMatrix) return obj.calcTransformMatrix();
    return [1, 0, 0, 1, 0, 0];
  }

  function sampleQuad(a, c, b, n) {
    const pts = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, it = 1 - t;
      pts.push({
        x: it * it * a.x + 2 * it * t * c.x + t * t * b.x,
        y: it * it * a.y + 2 * it * t * c.y + t * t * b.y,
      });
    }
    return pts;
  }

  function sampleCubic(a, c1, c2, b, n) {
    const pts = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, it = 1 - t;
      pts.push({
        x: it * it * it * a.x + 3 * it * it * t * c1.x + 3 * it * t * t * c2.x + t * t * t * b.x,
        y: it * it * it * a.y + 3 * it * it * t * c1.y + 3 * it * t * t * c2.y + t * t * t * b.y,
      });
    }
    return pts;
  }

  function sampleArc(from, to, rx, ry, xrotDeg, large, sweep, n) {
    rx = Math.abs(rx || 0); ry = Math.abs(ry || 0);
    if (rx < 1e-6 || ry < 1e-6) return [to];
    const phi = ((xrotDeg || 0) * Math.PI) / 180;
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const dx = (from.x - to.x) / 2, dy = (from.y - to.y) / 2;
    const x1 = cosP * dx + sinP * dy;
    const y1 = -sinP * dx + cosP * dy;
    let rx2 = rx * rx, ry2 = ry * ry;
    const x12 = x1 * x1, y12 = y1 * y1;
    const lam = x12 / rx2 + y12 / ry2;
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; rx2 = rx * rx; ry2 = ry * ry; }
    const sign = (large === sweep) ? -1 : 1;
    let sq = (rx2 * ry2 - rx2 * y12 - ry2 * x12) / (rx2 * y12 + ry2 * x12);
    sq = Math.max(0, sq);
    const coef = sign * Math.sqrt(sq);
    const cx1 = coef * (rx * y1) / ry;
    const cy1 = coef * -(ry * x1) / rx;
    const cx = cosP * cx1 - sinP * cy1 + (from.x + to.x) / 2;
    const cy = sinP * cx1 + cosP * cy1 + (from.y + to.y) / 2;
    function angle(ux, uy, vx, vy) {
      const dot = ux * vx + uy * vy;
      const len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
      let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    }
    const ux = (x1 - cx1) / rx, uy = (y1 - cy1) / ry;
    const vx = (-x1 - cx1) / rx, vy = (-y1 - cy1) / ry;
    const t1 = angle(1, 0, ux, uy);
    let dt = angle(ux, uy, vx, vy);
    if (!sweep && dt > 0) dt -= Math.PI * 2;
    if (sweep && dt < 0) dt += Math.PI * 2;
    const steps = Math.max(4, n || 12);
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      const t = t1 + (dt * i) / steps;
      const x = rx * Math.cos(t), y = ry * Math.sin(t);
      pts.push({
        x: cosP * x - sinP * y + cx,
        y: sinP * x + cosP * y + cy,
      });
    }
    return pts;
  }

  function pathCommandsToPolylines(commands, matrix, samples) {
    const n = samples || 8;
    const loops = [];
    let cur = [];
    let pen = { x: 0, y: 0 };
    const xf = (x, y) => (matrix ? transformPoint(x, y, matrix) : { x, y });
    (commands || []).forEach((cmd) => {
      const k = cmd[0];
      if (k === 'M') {
        if (cur.length) loops.push({ points: cur, closed: false });
        pen = xf(cmd[1], cmd[2]);
        cur = [pen];
      } else if (k === 'L') {
        pen = xf(cmd[1], cmd[2]);
        cur.push(pen);
      } else if (k === 'Q') {
        const c = xf(cmd[1], cmd[2]);
        const e = xf(cmd[3], cmd[4]);
        cur.push.apply(cur, sampleQuad(pen, c, e, n));
        pen = e;
      } else if (k === 'C') {
        const c1 = xf(cmd[1], cmd[2]);
        const c2 = xf(cmd[3], cmd[4]);
        const e = xf(cmd[5], cmd[6]);
        cur.push.apply(cur, sampleCubic(pen, c1, c2, e, n));
        pen = e;
      } else if (k === 'A' || k === 'a') {
        const end = xf(cmd[6], cmd[7]);
        cur.push.apply(cur, sampleArc(pen, end, cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], 16));
        pen = end;
      } else if (k === 'Z') {
        if (cur.length) loops.push({ points: cur, closed: true });
        cur = [];
      }
    });
    if (cur.length) loops.push({ points: cur, closed: false });
    return loops;
  }

  function localShapePoints(obj) {
    const w = obj.width || 0, h = obj.height || 0;
    if (!w || !h) return null;
    if (obj.type === 'rect' || obj.type === 'image') {
      return [
        { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
      ];
    }
    if (obj.type === 'triangle') {
      return [
        { x: -w / 2, y: h / 2 }, { x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 },
      ];
    }
    return null;
  }

  function fabricObjectToEntities(obj, opts) {
    const o = opts || {};
    const pxPerMmLocal = o.pxPerMm || PX_PER_MM;
    const heightPx = o.heightPx || 0;
    const eps = o.simplifyMm != null ? o.simplifyMm : 0.15;
    const toMmX = (x) => x / pxPerMmLocal;
    const toMmY = (y) => (heightPx - y) / pxPerMmLocal;
    const mapPts = (pts) => simplify(pts, eps * pxPerMmLocal).map((p) => ({ x: toMmX(p.x), y: toMmY(p.y) }));

    if (obj.isGuide) return [];
    const m = objectMatrix(obj, o.parentMatrix);

    if (obj.cutCommands && obj.cutCommands.length) {
      return pathCommandsToPolylines(obj.cutCommands, m, 6).map((loop) => ({
        type: 'polyline',
        closed: loop.closed,
        points: mapPts(loop.points),
      })).filter((e) => e.points.length >= 2);
    }
    if (obj.type === 'circle') {
      const c0 = obj.getCenterPoint ? obj.getCenterPoint() : { x: obj.left || 0, y: obj.top || 0 };
      const c = o.parentMatrix && !obj.group ? transformPoint(c0.x, c0.y, o.parentMatrix) : c0;
      const sx = obj.scaleX || 1, sy = obj.scaleY || 1;
      if (Math.abs(sx - sy) > 0.02) {
        const pts = [];
        const steps = 32;
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          pts.push(transformPoint((obj.radius || 0) * Math.cos(a), (obj.radius || 0) * Math.sin(a), m));
        }
        return [{ type: 'polyline', closed: true, points: mapPts(pts) }];
      }
      const r = (obj.radius || 0) * sx;
      return [{ type: 'circle', cx: toMmX(c.x), cy: toMmY(c.y), r: r / pxPerMmLocal }];
    }
    if (obj.path && Array.isArray(obj.path)) {
      return pathCommandsToPolylines(obj.path, m, 8).map((loop) => ({
        type: 'polyline',
        closed: loop.closed,
        points: mapPts(loop.points),
      })).filter((e) => e.points.length >= 2);
    }
    if (obj.type === 'line' && obj.x1 != null) {
      const a = transformPoint(obj.x1, obj.y1, m);
      const b = transformPoint(obj.x2, obj.y2, m);
      return [{ type: 'polyline', closed: false, points: [{ x: toMmX(a.x), y: toMmY(a.y) }, { x: toMmX(b.x), y: toMmY(b.y) }] }];
    }
    const local = localShapePoints(obj);
    if (local && local.length) {
      const pts = local.map((p) => transformPoint(p.x, p.y, m));
      return [{ type: 'polyline', closed: true, points: mapPts(pts) }];
    }
    if (obj.getBoundingRect) {
      const b = obj.getBoundingRect(true, true);
      const pts = [
        { x: b.left, y: b.top },
        { x: b.left + b.width, y: b.top },
        { x: b.left + b.width, y: b.top + b.height },
        { x: b.left, y: b.top + b.height },
      ];
      return [{ type: 'polyline', closed: true, points: mapPts(pts) }];
    }
    return [];
  }

  function objectsToEntities(objects, opts) {
    const out = [];
    (objects || []).forEach((obj) => {
      if (obj.type === 'group' && obj._objects) {
        const gm = obj.calcTransformMatrix ? obj.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
        obj._objects.forEach((child) => {
          const childOpts = Object.assign({}, opts);
          if (!child.group) childOpts.parentMatrix = gm;
          out.push.apply(out, fabricObjectToEntities(child, childOpts));
        });
        return;
      }
      out.push.apply(out, fabricObjectToEntities(obj, opts));
    });
    return out;
  }

  function traceOptions(threshold, smooth) {
    const sm = clamp(Number(smooth) || 0, 0, 10);
    const th = clamp(Number(threshold) || 128, 1, 254);
    return {
      ltres: Math.max(0.4, (11 - sm) / 4),
      qtres: Math.max(0.4, (11 - sm) / 4),
      pathomit: sm >= 7 ? 16 : 8,
      rightangleenhance: true,
      colorsampling: 0,
      numberofcolors: 2,
      colorquantcycles: 2,
      pal: [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 },
      ],
      linefilter: true,
      strokewidth: 0,
      viewbox: true,
      roundcoords: 2,
      blurradius: sm >= 6 ? 2 : 0,
      blurdelta: th,
    };
  }

  function stripFillsForCut(svg) {
    return String(svg)
      .replace(/fill="(?!none)[^"]*"/g, 'fill="none"')
      .replace(/fill:[^;";]+(?=[;"])/g, 'fill:none')
      .replace(/stroke="[^"]*"/g, 'stroke="#000000"');
  }

  function projectMeta() {
    return { app: 'CutterStudio Pro', version: 2, platforms: ['win32', 'linux'] };
  }

  function worldFromScroll(scroll, zoom, pad) {
    return (Number(scroll) - (pad == null ? 40 : pad)) / (zoom || 1);
  }
  function scrollFromWorld(world, zoom, pad) {
    return Number(world) * (zoom || 1) + (pad == null ? 40 : pad);
  }
  function screenPerUnit(pxPerUnit, zoom) {
    return Number(pxPerUnit) * (zoom || 1);
  }
  function plotterMmFromWorldPx(px) {
    return Number(px) / PX_PER_MM;
  }
  function worldPxFromPlotterMm(mm) {
    return Number(mm) * PX_PER_MM;
  }

  return {
    PX_PER_IN,
    PX_PER_MM,
    HPGL_PER_MM,
    UNITS,
    pxPerMm,
    pxPerUnit,
    toMm,
    fromMm,
    sheetPx,
    formatMeasure,
    nest,
    nestTrue,
    regMarks,
    isShopFixture,
    simplify,
    dxf,
    hpgl,
    pathCommandsToPolylines,
    fabricObjectToEntities,
    objectsToEntities,
    traceOptions,
    stripFillsForCut,
    plotterMmFromWorldPx,
    worldPxFromPlotterMm,
    worldFromScroll,
    scrollFromWorld,
    screenPerUnit,
    projectMeta,
    multiplyMatrices,
    escapeHtml,
    safeJobName,
    entityIsFinite,
    objectMatrix,
  };
});
