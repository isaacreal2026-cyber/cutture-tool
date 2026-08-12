# CutterStudio Pro (aisac)

Vinyl cutter / plotter studio for **Windows** and **Linux**.

Accurate sheet units (mm / cm / in at 96 CSS dpi), contour tracing, and machine exports:

| Format | Use |
|---|---|
| Cut-SVG | Plotter paths, fills stripped, optional text outlines |
| DXF | CAD / cutters, millimetres, Y-up |
| HPGL / PLT | Vinyl plotters (40 units per mm) |
| PNG | Proof with watermark |
| `.json` project | Save / open designs |

## Run in a browser

```bash
npm test
npm run preview
```

Open the preview URL and use the studio immediately.

## Desktop (Windows + Linux)

```bash
npm install
npm start
```

### Build installers

```bash
npm run pack:win     # NSIS + portable .exe
npm run pack:linux   # AppImage + .deb
npm run pack         # both
```

Outputs land in `dist/`.

## Layout

```
app/                 studio UI (offline: local Fabric + ImageTracer)
  js/engine.js       units, nest, DXF, HPGL, path math
  js/cut-app.js      desktop cutter layer
electron/            Windows + Linux shell
tests/               readiness + engine accuracy
```
