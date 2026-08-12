# CutterStudio Pro — frontend test & Windows readiness

**Status (2026-08-12):** Windows **and Linux** desktop targets are in place. The studio now uses a shared millimetre engine (DXF / HPGL / units / nest) and ImageTracer for closed contours + text outlines.

Original `htlm` is still the prototype dump. Ship `app/` + `electron/`.

---

## What was tested

| Area | Original `htlm` | Fixed `app/index.html` |
|---|---|---|
| Canvas engine | Fabric **5.3.1 from cdnjs** — that version is not a real npm release; needs internet | Local **Fabric 5.3.0** in `app/vendor/fabric.min.js` |
| Offline Windows | Blank window if CDN/fonts blocked | App loads offline; fonts fall back to Impact / Georgia / Segoe UI |
| Text curve | `new fabric.TextPath()` — **crashes Fabric 5** | `fabric.Text({ path })` (correct 5.x API) |
| Zoom + scroll | CSS scale, layout size unscaled — **cannot scroll a zoomed sheet** | Layout size = `W*zoom` / `H*zoom` |
| DXF | Bounding-box rectangles only (useless for vinyl) | Circles + path vertices + Y-up cm units |
| PNG / file save | `<a download>` click, no DOM attach — flaky in WebView/Electron | Blob download + native Save dialog on desktop |
| Project files | None (File menu just cleared the canvas) | Save / Open `.json`, Ctrl+N / Ctrl+O / Ctrl+Shift+S |
| Undo | `loadFromJSON` polluted history | `histBusy` guard, 40-step cap |
| Icon search | Any query hid **all** icons | Filters by glyph text |
| New document | Confirm, then `clearCanvas()` confirmed **again** | Single confirm |
| HiDPI (Windows 125–200%) | No retina flag | `enableRetinaScaling: true` |
| Desktop shell | None | Electron main + preload + NSIS/portable targets |

Automated gate: `npm test` → **33 checks, all passing.**

---

## Will a Windows `.exe` work?

**Yes, as a design studio**, if you build from `app/` + `electron/`:

```bash
npm install
npm start          # run on this machine
npm run pack:win   # NSIS installer + portable exe (run on Windows or CI)
```

The packaged app:

- Loads `app/index.html` from disk (no server, no CDN)
- Uses Chromium (same engine as Edge) so Fabric canvas, file drag-drop, and SVG/PNG export work
- Opens a native Save dialog for exports
- Groups correctly on the Windows taskbar (`com.aisac.cutterstudio`)

**It will not be 100% of a factory cutter stack** until these remaining items are done:

1. **Text → cut outlines.** Exported SVG still contains `<text>`. A vinyl plotter needs glyph outlines (OpenType / opentype.js). Without that, “Cut-SVG” of text is not plotter-true.
2. **Vectorize is a preview, not a tracer.** It walks Sobel edge pixels into a zigzag path. Logos will not weed cleanly. Need Potrace / imagetracerjs.
3. **No HPGL / USB plotter driver.** Export is SVG / DXF / PNG. Sending jobs to a Graphtec / Roland / Chinese cutter needs a separate backend (serial/USB).
4. **Auto-nest is a shelf packer.** No rotation, no true-shape nesting.
5. **Google Fonts (optional).** Offline Windows uses system fallbacks; letter-spacing/kerning of Bebas/Anton will differ until fonts are bundled as `.woff2`.

---

## Efficiency on Windows

| Concern | Status |
|---|---|
| Offline start | Local Fabric, no CDN block |
| Undo memory | Cap 40 snapshots; skip identical states |
| Zoom | CSS transform (GPU) + correct scroll extents |
| HiDPI | Fabric retina scaling |
| Background tab | `backgroundThrottling: false` so the canvas does not freeze |
| Context isolation | Preload bridge only — no `nodeIntegration` |

Large raster imports still bloat undo JSON (data URLs). That is the main RAM risk on low-end PCs.

---

## How to try the UI now

The preview server is serving `app/` (the fixed frontend). Use the live preview, or:

```bash
python3 -m http.server 8080 --directory app
```

Then: add text, shapes, zoom, Export → Cut-SVG / DXF, Save project.
