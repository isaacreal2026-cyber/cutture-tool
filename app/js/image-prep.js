/**
 * Logo / image prep — crop, quality, background removal, cut silhouette.
 * Pure pixel functions (no DOM). Browser + Node.
 *
 * Auto BG is Lab flood-from-border + fringe grow + edge lock.
 * Flat / white / cream shop logos go near-clean. Hair, glass, and
 * same-colour subjects still need Pick BG — never claimed as 100%.
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

  function srgbToLin(c) {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function rgbToLab(r, g, b) {
    const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
    let x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    let y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
    let z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787037 * t + 16 / 116); }
    const fx = f(x), fy = f(y), fz = f(z);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const A = rgbToLab(r1, g1, b1), B = rgbToLab(r2, g2, b2);
    const dL = A.L - B.L, da = A.a - B.a, db = A.b - B.b;
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  function sat(r, g, b) {
    return Math.max(r, g, b) - Math.min(r, g, b);
  }

  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort(function (a, b) { return a - b; });
    return s[s.length >> 1];
  }

  function clustersOf(samples, maxK) {
    const kMax = maxK || 3;
    const clusters = [];
    samples.forEach(function (s) {
      let best = -1, bestD = 14;
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        const d = colorDist(s.r, s.g, s.b, c.r, c.g, c.b);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        const c = clusters[best];
        const n = c.n + 1;
        c.r = (c.r * c.n + s.r) / n;
        c.g = (c.g * c.n + s.g) / n;
        c.b = (c.b * c.n + s.b) / n;
        c.n = n;
      } else if (clusters.length < kMax) {
        clusters.push({ r: s.r, g: s.g, b: s.b, n: 1 });
      }
    });
    clusters.sort(function (a, b) { return b.n - a.n; });
    return clusters.map(function (c) {
      return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), n: c.n };
    });
  }

  function minDistToBg(r, g, b, bg) {
    let d = colorDist(r, g, b, bg.r, bg.g, bg.b);
    const list = bg.clusters || [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const cd = colorDist(r, g, b, c.r, c.g, c.b);
      if (cd < d) d = cd;
    }
    return d;
  }

  function isLikelySubject(r, g, b, bg, tolerance) {
    const d = minDistToBg(r, g, b, bg);
    if (d > tolerance * 1.05) return true;
    const bgSat = sat(bg.r, bg.g, bg.b);
    if (sat(r, g, b) > bgSat + 22 && d > 7) return true;
    const lab = rgbToLab(r, g, b);
    const bgL = rgbToLab(bg.r, bg.g, bg.b).L;
    if (lab.L < bgL - 10 && d > 6) return true;
    return false;
  }

  function suggestTolerance(bg) {
    const v = Number(bg && bg.spread) || 0;
    return clamp(Math.round(11 + v * 2.2), 12, 42);
  }

  function sampleBorderBackground(data, w, h) {
    const samples = [];
    function take(x, y, weight) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 12) return;
      const s = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const n = weight || 1;
      for (let k = 0; k < n; k++) samples.push(s);
    }
    const band = Math.max(1, Math.min(8, Math.floor(Math.min(w, h) / 32)));
    for (let t = 0; t < band; t++) {
      for (let x = 0; x < w; x++) { take(x, t, 1); take(x, h - 1 - t, 1); }
      for (let y = 0; y < h; y++) { take(t, y, 1); take(w - 1 - t, y, 1); }
    }
    const corner = Math.max(2, Math.min(10, Math.floor(Math.min(w, h) / 12)));
    for (let y = 0; y < corner; y++) {
      for (let x = 0; x < corner; x++) {
        take(x, y, 2); take(w - 1 - x, y, 2);
        take(x, h - 1 - y, 2); take(w - 1 - x, h - 1 - y, 2);
      }
    }
    const rs = samples.map(function (s) { return s.r; });
    const gs = samples.map(function (s) { return s.g; });
    const bs = samples.map(function (s) { return s.b; });
    const bg = {
      r: median(rs),
      g: median(gs),
      b: median(bs),
      samples: samples.length,
      clusters: clustersOf(samples, 3),
    };
    const spreads = samples.map(function (s) { return minDistToBg(s.r, s.g, s.b, bg); });
    bg.spread = median(spreads);
    bg.suggestedTolerance = suggestTolerance(bg);
    return bg;
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
      if (data[i + 3] < 12) {
        mark[p] = 1;
        q[qe++] = p;
        return;
      }
      if (isLikelySubject(data[i], data[i + 1], data[i + 2], bg, tolerance)) return;
      if (minDistToBg(data[i], data[i + 1], data[i + 2], bg) <= tolerance) {
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
      enqueue(x + 1, y + 1); enqueue(x - 1, y - 1); enqueue(x + 1, y - 1); enqueue(x - 1, y + 1);
    }
    return mark;
  }

  function growThroughFringe(data, w, h, mark, bg, tolerance) {
    const extra = Math.max(3, tolerance * 0.18);
    const bgL = rgbToLab(bg.r, bg.g, bg.b).L;
    for (let pass = 0; pass < 4; pass++) {
      const add = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (mark[p]) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              if (mark[ny * w + nx]) near = true;
            }
          }
          if (!near) continue;
          const i = p * 4;
          if (data[i + 3] < 12) { add.push(p); continue; }
          if (isLikelySubject(data[i], data[i + 1], data[i + 2], bg, tolerance)) continue;
          const d = minDistToBg(data[i], data[i + 1], data[i + 2], bg);
          const L = rgbToLab(data[i], data[i + 1], data[i + 2]).L;
          if (d <= tolerance || (d <= tolerance + extra && L >= bgL - 6)) add.push(p);
        }
      }
      if (!add.length) break;
      for (let k = 0; k < add.length; k++) mark[add[k]] = 1;
    }
    return mark;
  }

  function protectHardEdges(data, w, h, mark, bg, tolerance) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (!mark[p]) continue;
        const i = p * 4;
        if (data[i + 3] < 12) continue;
        if (isLikelySubject(data[i], data[i + 1], data[i + 2], bg, tolerance)) mark[p] = 0;
      }
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
        const near =
          (x > 0 && mark[p - 1]) ||
          (x + 1 < w && mark[p + 1]) ||
          (y > 0 && mark[p - w]) ||
          (y + 1 < h && mark[p + w]);
        if (!near) continue;
        const d = minDistToBg(data[i], data[i + 1], data[i + 2], bg);
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

  function resolveTolerance(opts, bg) {
    const user = opts.tolerance == null ? 30 : Number(opts.tolerance);
    if (!opts.auto) return user;
    const suggested = (bg && bg.suggestedTolerance) || suggestTolerance(bg || {});
    const scale = user / 30;
    return clamp(Math.round(suggested * (Number.isFinite(scale) ? scale : 1)), 10, 56);
  }

  function removeBackground(src, w, h, options) {
    const opts = options || {};
    const data = copyRgba(src);
    const preserved = !opts.force && hasExistingAlpha(data);
    const sampled = sampleBorderBackground(data, w, h);
    const bg = opts.bg
      ? {
        r: opts.bg.r, g: opts.bg.g, b: opts.bg.b,
        clusters: opts.bg.clusters || [{ r: opts.bg.r, g: opts.bg.g, b: opts.bg.b, n: 1 }],
        spread: opts.bg.spread != null ? opts.bg.spread : sampled.spread,
        suggestedTolerance: opts.bg.suggestedTolerance || sampled.suggestedTolerance,
        samples: opts.bg.samples || sampled.samples,
      }
      : sampled;
    const tolerance = resolveTolerance(opts, bg);

    if (preserved) {
      if (opts.decontaminate !== false) decontaminate(data, w, h, bg);
      return {
        data: data, width: w, height: h, bg: bg, preserved: true,
        remaining: countOpaque(data), tolerance: tolerance,
      };
    }

    let mark = floodMask(data, w, h, bg, tolerance, true);
    growThroughFringe(data, w, h, mark, bg, tolerance);
    if (opts.punchHoles) {
      const holes = floodMask(data, w, h, bg, tolerance, false);
      for (let i = 0; i < mark.length; i++) if (holes[i]) mark[i] = 1;
    }
    protectHardEdges(data, w, h, mark, bg, tolerance);
    applyMask(data, w, h, mark, bg, tolerance);
    if (opts.decontaminate !== false) decontaminate(data, w, h, bg);
    if (opts.despeckle) despeckle(data, w, h, opts.despeckle === true ? 8 : opts.despeckle);

    return {
      data: data, width: w, height: h, bg: bg, preserved: false,
      remaining: countOpaque(data), tolerance: tolerance,
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
    const rings = silhouetteRings(data, w, h, 14);
    const ox = -w / 2, oy = -h / 2;
    const simplified = rings.map(function (ring) {
      if (typeof CutterEngine !== 'undefined' && CutterEngine.simplify) {
        return CutterEngine.simplify(ring, simplifyPx == null ? 0.8 : simplifyPx);
      }
      return ring;
    });
    return ringsToCommands(simplified, ox, oy);
  }

  function samplePixelMedian(data, w, h, x, y, radius) {
    const r = radius == null ? 1 : radius;
    const rs = [], gs = [], bs = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = (ny * w + nx) * 4;
        if (data[i + 3] < 12) continue;
        rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
      }
    }
    return { r: median(rs), g: median(gs), b: median(bs) };
  }

  function imageDataLike(data, w, h) {
    return { data: data, width: w, height: h };
  }

  return {
    hasExistingAlpha: hasExistingAlpha,
    sampleBorderBackground: sampleBorderBackground,
    colorDist: colorDist,
    suggestTolerance: suggestTolerance,
    minDistToBg: minDistToBg,
    removeBackground: removeBackground,
    trimTransparent: trimTransparent,
    crop: crop,
    resizeBilinear: resizeBilinear,
    qualitySize: qualitySize,
    featherAlpha: featherAlpha,
    countOpaque: countOpaque,
    silhouetteRings: silhouetteRings,
    localCutCommands: localCutCommands,
    samplePixelMedian: samplePixelMedian,
    imageDataLike: imageDataLike,
    copyRgba: copyRgba,
  };
});
