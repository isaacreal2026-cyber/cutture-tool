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

The preview root is the **public site** (search-engine pages). Open **Open studio** for the cutter. Desktop Electron still loads `app/studio.html` directly.

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
app/                 public site + studio
  index.html         crawlable home (Google / Bing / AI)
  studio.html        cutter app (Electron + Open studio)
  compare.html       vs Cricut / Silhouette / VinylMaster
  jersey.html        nameset millimetres
  sitemap.xml, robots.txt, llms.txt
  js/engine.js       units, nest, DXF, HPGL
electron/            Windows + Linux shell (loads studio.html)
tests/               readiness + engine + SEO
```

Type faces are shop-floor only (Tourney, Anton, Black Ops One, Share Tech Mono / Iceland digital watch…). Thin scripts that snap on cheap HTV were removed. Kit uses a **name font** and a **number font**.

Shop-floor extras (no subscription): plotter profiles (Graphtec / Roland / Chinese), vinyl roll widths, gang copies, autosave, today’s job queue. See `PRODUCTION.md`.
