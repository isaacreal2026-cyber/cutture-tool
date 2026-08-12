# Deep scan (UI not redesigned)

Updated 2026-08-12.

## Fixed

1. Imported logos no longer cut as rectangles — `cutCommands` silhouette.
2. Trace no longer paints a white page under transparent logos.
3. Project JSON keeps `cutCommands` / `bgRemoved`.
4. **Export outline is non-destructive** — text is outlined only for the cut file, then the live canvas is restored.
5. **Sheet resize rebuilds the t-shirt guide** to the new size.
6. **Rulers use the active unit** (mm / cm / in), not a hard-coded `cm`.
7. **Cut Preview draws real cut entities** (logo outline, triangles), not AABBs.
8. **Triangles and rotated rects export true vertices**, not a bounding box.
9. Raster fallback tracer uses **alpha as the mask**.
10. Opening a project no longer toasts a fake “canvas resized” every time.

## Background-remove guarantee

| Input | Result |
|---|---|
| PNG already transparent | Alpha kept; not re-keyed |
| Logo on flat white/colour | Auto remove + trim + silhouette |
| Letters O / A | Punch holes opens counters |
| White paint inside a badge | Leave punch off |
| White logo on white | Need Pick BG or a transparent PNG |

11. **Map zoom** — wheel / + / − zoom the whole sheet (text, logo, grid) around the cursor like a map. Rulers lock to the same world centimetres. Zoom never changes plotter millimetres (10 cm on the sheet is still 100 mm in DXF/HPGL at 200% or 50%).
12. Transform X/Y/W/H use the same mm/cm/in as the rulers.
13. Ctrl+D / Ctrl+G shortcuts restored. Broken export-option markup cleaned.

## Still later

- USB / serial send to a physical plotter (files: DXF / HPGL / Cut-SVG).
- Photo / hair matting is not a cloud portrait model.
