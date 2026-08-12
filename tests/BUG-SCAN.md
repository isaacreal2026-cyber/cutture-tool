# Deep scan (UI not redesigned)

Scanned 2026-08-12. Existing studio chrome left as-is.

## Critical (fixed in this pass)

1. **Imported logos cut as rectangles.** `fabricObjectToEntities` fell through to `getBoundingRect` for images. A machine would trim a box, not the logo. Logos now store `cutCommands` from the alpha silhouette.
2. **Trace painted white under the bitmap.** That destroyed PNG transparency and traced the page, not the mark. Apply Trace on a placed logo now rebuilds the cut path from alpha.
3. **Project JSON dropped cut paths.** `toJSON` only saved `objType` / `isGuide`. Cut silhouettes are now persisted.

## Still true (not UI, known limits)

4. Export “outline text” still replaces live text on the canvas (destructive).
5. Sheet resize does not rebuild the t-shirt guide path.
6. Ruler labels still say `cm` even if the sheet unit is mm/in (coordinates in the status bar are correct).
7. No USB/serial send yet — cut files are DXF / HPGL / Cut-SVG.
8. Background removal is **deterministic flood-from-border**, not a cloud portrait model. Solid/studio backgrounds and existing PNG alpha are the 100% cases. Busy photo backgrounds need Pick BG + tolerance.

## Background-remove guarantee

| Input | Result |
|---|---|
| PNG already transparent | Alpha kept; not re-keyed |
| Logo on flat white/colour | Auto remove + trim + silhouette |
| Letters O / A | “Punch interior holes” opens counters |
| White paint inside a badge | Leave punch off to keep the paint |
| White logo on white | Cannot invent contrast — pick another BG or use a transparent PNG |
