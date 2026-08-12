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
    return Number(value) / u.perMm;
  }
  function fromMm(mm, unit) {
    const u = UNITS[unit] || UNITS.cm;
    return Number(mm) * u.perMm;
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
    list.forEach((ent) => {
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
    list.forEach((ent) => {
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
      } else if (k === 'Z') {
        if (cur.length) loops.push({ points: cur, closed: true });
        cur = [];
      }
    });
    if (cur.length) loops.push({ points: cur, closed: false });
    return loops;
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
    if (obj.cutCommands && obj.cutCommands.length) {
      const m = obj.calcTransformMatrix ? obj.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
      return pathCommandsToPolylines(obj.cutCommands, m, 6).map((loop) => ({
        type: 'polyline',
        closed: loop.closed,
        points: mapPts(loop.points),
      })).filter((e) => e.points.length >= 2);
    }
    if (obj.type === 'circle') {
      const c = obj.getCenterPoint ? obj.getCenterPoint() : { x: obj.left, y: obj.top };
      const r = (obj.radius || 0) * (obj.scaleX || 1);
      return [{ type: 'circle', cx: toMmX(c.x), cy: toMmY(c.y), r: r / pxPerMmLocal }];
    }
    if (obj.path && Array.isArray(obj.path)) {
      const m = obj.calcTransformMatrix ? obj.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
      return pathCommandsToPolylines(obj.path, m, 8).map((loop) => ({
        type: 'polyline',
        closed: loop.closed,
        points: mapPts(loop.points),
      })).filter((e) => e.points.length >= 2);
    }
    if (obj.type === 'line' && obj.x1 != null) {
      const m = obj.calcTransformMatrix ? obj.calcTransformMatrix() : [1, 0, 0, 1, 0, 0];
      const a = transformPoint(obj.x1, obj.y1, m);
      const b = transformPoint(obj.x2, obj.y2, m);
      return [{ type: 'polyline', closed: false, points: [{ x: toMmX(a.x), y: toMmY(a.y) }, { x: toMmX(b.x), y: toMmY(b.y) }] }];
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
        obj._objects.forEach((child) => {
          out.push.apply(out, fabricObjectToEntities(child, opts));
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
    simplify,
    dxf,
    hpgl,
    pathCommandsToPolylines,
    fabricObjectToEntities,
    objectsToEntities,
    traceOptions,
    stripFillsForCut,
    projectMeta,
  };
});
