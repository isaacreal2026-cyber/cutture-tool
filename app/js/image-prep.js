/**
 * Logo / image prep — crop, quality, background removal, cut silhouette.
 * Pure pixel functions (no DOM). Browser + Node.
 *
 * Background removal is flood-from-border + optional hole punch.
 * Already-transparent PNGs are preserved (not re-keyed).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ImagePrep = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

  function copyRgba(src) {
    return new Uint8ClampedArray(src);
  }

  function hasExistingAlpha(data, minRatio) {
    const n = data.length / 4;
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 8) clear++;
    }
    return clear > n * (minRatio == null ? 0.008 : minRatio);
  }

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    const y = 0.299 * dr + 0.587 * dg + 0.114 * db;
    const cr = dr - y, cg = dg - y, cb = db - y;
    return Math.sqrt(y * y + 1.35 * (cr * cr + cg * cg + cb * cb));
  }

  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort(function (a, b) { return a - b; });
    return s[s.length >> 1];
  }

  function sampleBorderBackground(data, w, h) {
    const rs = [], gs = [], bs = [];
    function take(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 12) return;
      rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
    }
    const band = Math.max(1, Math.min(6, Math.floor(Math.min(w, h) / 40)));
    for (let t = 0; t < band; t++) {
      for (let x = 0; x < w; x++) { take(x, t); take(x, h - 1 - t); }
      for (let y = 0; y < h; y++) { take(t, y); take(w - 1 - t, y); }
    }
    return {
      r: median(rs),
      g: median(gs),
      b: median(bs),
      samples: rs.length,
    };
  }

  function floodMask(data, w, h, bg, tolerance, fromBorderOnly) {
    const mark = new Uint8Array(w * h);
    const q = new Int32Array(w * h);
    let qs = 0, qe = 0;
    function enqueue(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (mark[p]) return;
      const i = p * 4;
      if (data[i + 3] < 12 || colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) <= tolerance) {
        mark[p] = 1;
        q[qe++] = p;
      }
    }
    if (fromBorderOnly) {
      for (let x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1); }
      for (let y = 0; y < h; y++) { enqueue(0, y); enqueue(w - 1, y); }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) enqueue(x, y);
      }
    }
    while (qs < qe) {
      const p = q[qs++];
      const x = p % w, y = (p - x) / w;
      enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
    }
    return mark;
  }

  function applyMask(data, w, h, mark, bg, tolerance) {
    const soft = Math.max(6, tolerance * 0.85);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        if (mark[p]) {
          data[i + 3] = 0;
          continue;
        }
        // Soft fringe only next to removed background — never punch enclosed logo paint.
        const near =
          (x > 0 && mark[p - 1]) ||
          (x + 1 < w && mark[p + 1]) ||
          (y > 0 && mark[p - w]) ||
          (y + 1 < h && mark[p + w]);
        if (!near) continue;
        const d = colorDist(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
        if (d < tolerance + soft) {
          const a = clamp(Math.round(((d - tolerance * 0.45) / soft) * 255), 0, data[i + 3]);
          data[i + 3] = a;
        }
      }
    }
  }

  function decontaminate(data, w, h, bg) {
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0 || a === 255) continue;
      const af = a / 255, ia = 1 - af;
      if (af < 0.02) { data[i + 3] = 0; continue; }
      data[i] = clamp(Math.round((data[i] - ia * bg.r) / af), 0, 255);
      data[i + 1] = clamp(Math.round((data[i + 1] - ia * bg.g) / af), 0, 255);
      data[i + 2] = clamp(Math.round((data[i + 2] - ia * bg.b) / af), 0, 255);
    }
  }

  function despeckle(data, w, h, maxBlob) {
    const seen = new Uint8Array(w * h);
    const q = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (seen[p] || data[p * 4 + 3] < 16) continue;
        q.length = 0;
        q.push(p);
        seen[p] = 1;
        const blob = [p];
        for (let s = 0; s < q.length; s++) {
          const cur = q[s];
          const cx = cur % w, cy = (cur - cx) / w;
          const nb = [cur + 1, cur - 1, cur + w, cur - w];
          for (let k = 0; k < 4; k++) {
            const n = nb[k];
            const nx = n % w, ny = (n - nx) / w;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
            if (seen[n] || data[n * 4 + 3] < 16) continue;
            seen[n] = 1;
            q.push(n);
            blob.push(n);
          }
        }
        if (blob.length <= maxBlob) {
          for (let b = 0; b < blob.length; b++) data[blob[b] * 4 + 3] = 0;
        }
      }
    }
  }

  function removeBackground(src, w, h, options) {
    const opts = options || {};
    const data = copyRgba(src);
    const preserved = !opts.force && hasExistingAlpha(data);
    const bg = opts.bg || sampleBorderBackground(data, w, h);
    const tolerance = opts.tolerance == null ? 30 : Number(opts.tolerance);

    if (preserved) {
      if (opts.decontaminate !== false) decontaminate(data, w, h, bg);
      return {
        data: data, width: w, height: h, bg: bg, preserved: true,
        remaining: countOpaque(data),
      };
    }

    const border = floodMask(data, w, h, bg, tolerance, true);
    let mark = border;
    if (opts.punchHoles) {
      const holes = floodMask(data, w, h, bg, tolerance, false);
      mark = new Uint8Array(w * h);
      for (let i = 0; i < mark.length; i++) mark[i] = border[i] || holes[i] ? 1 : 0;
    }
    applyMask(data, w, h, mark, bg, tolerance);
    if (opts.decontaminate !== false) decontaminate(data, w, h, bg);
    if (opts.despeckle) despeckle(data, w, h, opts.despeckle === true ? 8 : opts.despeckle);

    return {
      data: data, width: w, height: h, bg: bg, preserved: false,
      remaining: countOpaque(data),
    };
  }

  function countOpaque(data, minA) {
    const a0 = minA == null ? 16 : minA;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] >= a0) n++;
    return n;
  }

  function trimTransparent(data, w, h, pad) {
    const p = pad || 0;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] < 10) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) {
      return { data: new Uint8ClampedArray(4), width: 1, height: 1, empty: true };
    }
    minX = Math.max(0, minX - p);
    minY = Math.max(0, minY - p);
    maxX = Math.min(w - 1, maxX + p);
    maxY = Math.min(h - 1, maxY + p);
    const nw = maxX - minX + 1, nh = maxY - minY + 1;
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      const src = ((minY + y) * w + minX) * 4;
      out.set(data.subarray(src, src + nw * 4), y * nw * 4);
    }
    return { data: out, width: nw, height: nh, empty: false, box: { x: minX, y: minY, w: nw, h: nh } };
  }

  function crop(data, w, h, x, y, cw, ch) {
    const sx = clamp(Math.round(x), 0, w - 1);
    const sy = clamp(Math.round(y), 0, h - 1);
    const nw = clamp(Math.round(cw), 1, w - sx);
    const nh = clamp(Math.round(ch), 1, h - sy);
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let row = 0; row < nh; row++) {
      const src = ((sy + row) * w + sx) * 4;
      out.set(data.subarray(src, src + nw * 4), row * nw * 4);
    }
    return { data: out, width: nw, height: nh };
  }

  function resizeBilinear(data, sw, sh, dw, dh) {
    dw = Math.max(1, Math.round(dw));
    dh = Math.max(1, Math.round(dh));
    if (dw === sw && dh === sh) return { data: copyRgba(data), width: dw, height: dh };
    const out = new Uint8ClampedArray(dw * dh * 4);
    const xRatio = (sw - 1) / Math.max(1, dw - 1);
    const yRatio = (sh - 1) / Math.max(1, dh - 1);
    for (let y = 0; y < dh; y++) {
      const fy = y * yRatio;
      const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), wy = fy - y0;
      for (let x = 0; x < dw; x++) {
        const fx = x * xRatio;
        const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), wx = fx - x0;
        const o = (y * dw + x) * 4;
        for (let c = 0; c < 4; c++) {
          const p00 = data[(y0 * sw + x0) * 4 + c];
          const p10 = data[(y0 * sw + x1) * 4 + c];
          const p01 = data[(y1 * sw + x0) * 4 + c];
          const p11 = data[(y1 * sw + x1) * 4 + c];
          out[o + c] = p00 * (1 - wx) * (1 - wy) + p10 * wx * (1 - wy) + p01 * (1 - wx) * wy + p11 * wx * wy;
        }
      }
    }
    return { data: out, width: dw, height: dh };
  }

  function qualitySize(w, h, quality) {
    const max = quality === 'web' ? 1200 : quality === 'high' ? 2400 : quality === 'print' ? 4000 : 0;
    if (!max || Math.max(w, h) <= max) return { w: w, h: h, scale: 1 };
    const scale = max / Math.max(w, h);
    return { w: Math.round(w * scale), h: Math.round(h * scale), scale: scale };
  }

  function featherAlpha(data, w, h, radius) {
    const r = Math.max(0, Math.round(radius || 0));
    if (!r) return data;
    const src = new Uint8Array(w * h);
    for (let i = 0; i < src.length; i++) src[i] = data[i * 4 + 3];
    const out = new Uint8Array(src);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let minA = 255;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) { minA = 0; continue; }
            const a = src[ny * w + nx];
            if (a < minA) minA = a;
          }
        }
        out[y * w + x] = Math.min(src[y * w + x], Math.round((src[y * w + x] + minA) / 2));
      }
    }
    for (let i = 0; i < out.length; i++) data[i * 4 + 3] = out[i];
    return data;
  }

  // Marching squares → closed rings in pixel space (top-left origin).
  function silhouetteRings(data, w, h, alphaMin) {
    const t = alphaMin == null ? 20 : alphaMin;
    const m = w + 1;
    const grid = new Uint8Array((h + 2) * m);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] >= t) grid[(y + 1) * m + (x + 1)] = 1;
      }
    }
    const edges = [];
    function addEdge(ax, ay, bx, by) { edges.push(ax, ay, bx, by); }
    for (let y = 0; y < h + 1; y++) {
      for (let x = 0; x < w + 1; x++) {
        const tl = grid[y * m + x];
        const tr = grid[y * m + x + 1];
        const bl = grid[(y + 1) * m + x];
        const br = grid[(y + 1) * m + x + 1];
        const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
        const fx = x - 0.5, fy = y - 0.5;
        switch (code) {
          case 1: case 14: addEdge(fx, fy + 0.5, fx + 0.5, fy + 1); break;
          case 2: case 13: addEdge(fx + 0.5, fy + 1, fx + 1, fy + 0.5); break;
          case 3: case 12: addEdge(fx, fy + 0.5, fx + 1, fy + 0.5); break;
          case 4: case 11: addEdge(fx + 0.5, fy, fx + 1, fy + 0.5); break;
          case 5:
            addEdge(fx, fy + 0.5, fx + 0.5, fy);
            addEdge(fx + 0.5, fy + 1, fx + 1, fy + 0.5);
            break;
          case 6: case 9: addEdge(fx + 0.5, fy, fx + 0.5, fy + 1); break;
          case 7: case 8: addEdge(fx, fy + 0.5, fx + 0.5, fy); break;
          case 10:
            addEdge(fx + 0.5, fy, fx + 1, fy + 0.5);
            addEdge(fx, fy + 0.5, fx + 0.5, fy + 1);
            break;
          default: break;
        }
      }
    }
    return stitchEdges(edges);
  }

  function key(x, y) { return (Math.round(x * 2) + 4096) + ',' + (Math.round(y * 2) + 4096); }

  function stitchEdges(edges) {
    const adj = Object.create(null);
    function link(ax, ay, bx, by) {
      const ka = key(ax, ay), kb = key(bx, by);
      if (!adj[ka]) adj[ka] = { x: ax, y: ay, n: [] };
      if (!adj[kb]) adj[kb] = { x: bx, y: by, n: [] };
      adj[ka].n.push(kb);
      adj[kb].n.push(ka);
    }
    for (let i = 0; i < edges.length; i += 4) link(edges[i], edges[i + 1], edges[i + 2], edges[i + 3]);
    const used = Object.create(null);
    const rings = [];
    Object.keys(adj).forEach(function (start) {
      adj[start].n.forEach(function (second) {
        const ek = start < second ? start + '>' + second : second + '>' + start;
        if (used[ek]) return;
        const ring = [{ x: adj[start].x, y: adj[start].y }];
        let prev = start, cur = second;
        used[ek] = 1;
        while (cur && cur !== start) {
          ring.push({ x: adj[cur].x, y: adj[cur].y });
          const node = adj[cur];
          let next = null;
          for (let i = 0; i < node.n.length; i++) {
            const cand = node.n[i];
            const ck = cur < cand ? cur + '>' + cand : cand + '>' + cur;
            if (!used[ck] && cand !== prev) { next = cand; break; }
          }
          if (!next) break;
          used[cur < next ? cur + '>' + next : next + '>' + cur] = 1;
          prev = cur;
          cur = next;
        }
        if (ring.length >= 4) rings.push(ring);
      });
    });
    return rings;
  }

  function ringsToCommands(rings, ox, oy) {
    const cmds = [];
    rings.forEach(function (ring) {
      if (ring.length < 3) return;
      cmds.push(['M', ring[0].x + ox, ring[0].y + oy]);
      for (let i = 1; i < ring.length; i++) cmds.push(['L', ring[i].x + ox, ring[i].y + oy]);
      cmds.push(['Z']);
    });
    return cmds;
  }

  function localCutCommands(data, w, h, simplifyPx) {
    const rings = silhouetteRings(data, w, h, 20);
    const ox = -w / 2, oy = -h / 2;
    const simplified = rings.map(function (ring) {
      if (typeof CutterEngine !== 'undefined' && CutterEngine.simplify) {
        return CutterEngine.simplify(ring, simplifyPx == null ? 0.8 : simplifyPx);
      }
      return ring;
    });
    return ringsToCommands(simplified, ox, oy);
  }

  function imageDataLike(data, w, h) {
    return { data: data, width: w, height: h };
  }

  return {
    hasExistingAlpha,
    sampleBorderBackground,
    colorDist,
    removeBackground,
    trimTransparent,
    crop,
    resizeBilinear,
    qualitySize,
    featherAlpha,
    countOpaque,
    silhouetteRings,
    localCutCommands,
    imageDataLike,
    copyRgba,
  };
});
