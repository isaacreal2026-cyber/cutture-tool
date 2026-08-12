# Production plan — CutterStudio Pro (aisac)

Date: 2026-08-12. Lane stays African / school / jersey production on cheap Graphtec / Roland / Chinese plotters. **No studio chrome rebuild.** Zoom never changes plotter millimetres.

This is the shop-floor definition of “ready for production”: a kiosk can cut tomorrow’s PE list after a power cut, on a 300 mm roll, without Cricut.

## What “production ready” means here

A jersey shop in Nairobi or a school PE contractor can:

1. Pick a **shop type** (jersey / school / corporate) once.
2. Paste a **CSV roster**, place names and numbers at **real mm**.
3. **Mirror**, **weed box**, **reg marks**, **quote** vinyl, print a **job ticket**.
4. Pick a **plotter profile** (baud + VS speed + FS force) and send HPGL — or drop colour-split files on a USB stick.
5. **Gang copies** for staff tees, **queue** today’s jobs, **autosave** through a blackout.

It does **not** mean: native Graphtec USB driver, camera print+cut, hair-quality photo matting, or bundled `.woff2` outlines. Those are listed as later, honestly.

## Shipped this cycle (1.2.0)

| Feature | Where | Honest limit |
|---|---|---|
| Plotter profiles (Graphtec / Roland / Chinese / generic) | Kit → Plotter | Writes `VS` / `FS` into HPGL. Does not install a Windows `.inf` driver. |
| Speed + force fields | Kit → Speed / Force | Machine still has to understand HPGL `VS`/`FS`. Some clones ignore `FS`. |
| Vinyl roll widths 300 / 380 / 500 / 610 mm | Sheet → Roll + presets | Sets the **sheet**, not a live roll feed. |
| Shop type defaults | First-run modal + Sheet → Shop | Changes preset, price, currency, roll. Not a multi-user login. |
| Gang copies + nest | Kit copies + Sheet → Gang | Clones artwork N times (max 50), then existing nest. |
| Autosave / crash restore | localStorage, 20 s, ~1.4 MB cap | Huge logo data-URLs are skipped, not compressed. |
| Today’s job queue | Sheet → Queue job | Local list (name, pieces, quote). Not a second-PC shop server. |
| Project v3 | Save / Open | Roster + shop settings + quick shapes travel with the `.json`. |
| Delete custom quick shape | Right-click tile | Still browser/Electron localStorage. |
| Cut order left-to-right | `CutterEngine.sortEntitiesForCut` | Weed-friendly, not true shortest-path TSP. |
| Weld / contour / align / size-to-mm | Edit modal | Weld is a hull of overlapping boxes, not a boolean path union. |
| Test cut + weed tabs + overcut + tile check | Sheet + Kit | Tile reports how many sheets; it does not auto-split the canvas yet. |

## Later (still open-closed — new module or optional arg)

| # | Feature | Why it waits | How we add it |
|---|---|---|---|
| A | Native USB / `electron/serial.js` | No cutter on this machine to certify | IPC next to existing Web Serial + file fallback |
| B | Bundled `.woff2` jersey faces | Font files are large; offline fallback is already Impact / Arial Black / Consolas | `app/fonts/` + `@font-face` |
| C | OpenType glyph outlines | `opentype.js` is vendored; cut text still ImageTracer | `outlineGlyphs(text, font)` beside tracer |
| D | True-shape nest (any angle) | `nestTrue` is 0/90 only | New packer, `nest()` stays |
| E | Camera print+cut | Marks exist; no hardware | Align workflow on top of `reg-mark` |
| F | Photo / hair matting | Flood-from-border only | Separate model, never claimed 100% |
| G | Shared shop queue | Today’s queue is one PC | Optional folder-watch / LAN JSON |

## Shop day (happy path)

1. First launch → **Jersey shop** / **School PE** / **Staff tees**.
2. Sheet → roll width matching the vinyl on the plotter.
3. Kit → CSV → place → Mirror → Weed box → Quote.
4. Plotter profile → Export colour jobs **or** Send (Web Serial).
5. Job ticket for the press operator. Queue the next class list.

Accuracy rule is unchanged: **10 cm on the sheet = 100 mm on the plotter at any zoom.**

## Test gate

`npm test` now includes `tests/prod.test.js` (profiles, VS/FS, copies, autosave cap, queue, shape delete, HTML wiring).
