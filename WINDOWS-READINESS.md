# CutterStudio Pro — frontend test & Windows / Linux readiness

**Status (2026-08-12):** Windows **and Linux** desktop targets are in place (`package.json` 1.2.0). Ship `app/` + `electron/`. Electron loads **`app/studio.html`**. The public site is `app/index.html`.

Original `htlm` is still the prototype dump.

---

## What a packaged app actually does

```bash
npm install
npm test
npm start            # this machine
npm run pack:win     # NSIS + portable (build on Windows or CI)
npm run pack:linux   # AppImage + .deb
```

The packaged app:

- Loads `app/studio.html` from disk (no server, no CDN Fabric)
- Vendored Fabric **5.3.0**, ImageTracer, opentype.js
- Native Save dialog (base64) for SVG / DXF / HPGL / PNG / project JSON
- Web Serial enabled **only** for `serial` permission
- Colour-split jobs can be written to a folder when Serial is missing

---

## Honest remaining factory gaps

| Item | Status |
|---|---|
| HPGL / DXF / Cut-SVG | Shipped (mm, Y-up DXF, 40 units/mm HPGL, VS/FS from plotter profile) |
| Send to plotter | Web Serial + file fallback. **No native Graphtec/Roland `.inf` in this tree.** |
| Text → cut outlines | ImageTracer snapshot for export, then canvas restored. Not OpenType glyphs yet. Offline fonts fall back to Impact / Arial Black / Consolas. |
| Logo BG remove | Flood from border + holes. Not hair matting. White-on-white needs Pick BG. |
| Nest | Shelf packer; 90° only when “Rotate 90° when nesting” is on. |
| Autosave | localStorage, skipped if the project is huge (logo data-URLs). |
| Print+cut | L-marks exist. No camera. |

---

## Efficiency on Windows

| Concern | Status |
|---|---|
| Offline start | Local Fabric, no CDN block |
| Undo memory | Cap 40 snapshots; skip identical states |
| Zoom | Map zoom around cursor; plotter mm unchanged |
| HiDPI | Fabric retina scaling |
| Background tab | `backgroundThrottling: false` |
| Context isolation | Preload bridge only — no `nodeIntegration` |

Large raster imports still bloat undo JSON (data URLs). That is the main RAM risk on low-end PCs.

---

## How to try the UI now

```bash
python3 -m http.server 8080 --bind 0.0.0.0 --directory app
```

Open **studio.html** for the cutter (or the landing page → Open studio).
