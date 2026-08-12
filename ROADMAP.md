# Architectural roadmap (open-closed)

Research date: 2026-08-12. Existing studio chrome, engine API, and Kit modal stay. New capability is added beside them.

## Invariants we do not break

- 96 CSS px = 1 in = 25.4 mm. Zoom never changes plotter millimetres.
- `CutterEngine` / `KitProd` / `ImagePrep` keep their current function names.
- Studio UI classes (`.mover`, `.modal`, `.btn`, `.prow`, `.pi`, `.tbtn`) stay.
- Electron loads `app/studio.html`. Public site stays on `app/index.html`.

## Shipped this cycle (additive)

1. Group cut paths compose the parent matrix when children are detached.
2. HTML escape on layer names and toasts.
3. Electron: Serial-only permissions, http(s)-only `openExternal`, sanitized job filenames.
4. DXF/HPGL skip NaN / non-finite entities.
5. Kit **press recipe** card (temp / time / peel) + baud field. Does not change place/export.

## Shipped (this advance)

6. **Rotate nest** — `CutterEngine.nestTrue` (90°) when the checkbox is on. `nest()` unchanged.
7. **Print+cut L-marks** — Sheet → Reg marks (8 mm corners). `objType: reg-mark`.
8. **Job ticket** — second-operator slip (press, quote, colours, sign-off).
9. **CSV Size column** — youth / adult / PE per row; `buildKit` uses `player.preset` when set.

## Next (still no chrome rebuild)

| # | Add | How (open-closed) |
|---|---|---|
| A | Native USB/serial backend | New `electron/serial.js` + IPC. `sendToPlotter` already falls back to files. |
| E | Bundle `.woff2` jersey faces | `app/fonts/` + `@font-face`. Google link stays as online upgrade. |
| F | OpenType text outlines | `outlineGlyphs(text, font)` beside ImageTracer raster outline. |

## Later

- CSV size column → youth/adult preset per row.
- Hair/photo matting (not claimed as 100%).
- Shared shop queue.

Each step is a new module or a new optional argument. No deprecations of current exports.
