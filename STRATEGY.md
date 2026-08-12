# How CutterStudio beats the world’s cutter apps

Research date: 2026-08-12. Sources: VinylMaster / Silhouette / Cricut / SCAL comparisons and jersey-size practice.

## Who we serve (and why they leave the big apps)

| Customer | Job | Pain with Cricut / Silhouette / Flexi |
|---|---|---|
| Football / basketball jersey shops | 15–30 names + numbers, 2 colours, same sizes every week | Type each name by hand. No roster. Cloud dies mid-job. |
| School games / PE kits | Youth + adult mixed, cheap HTV, fast turnaround | Subscription fonts. No offline. No bulk numbers. |
| Custom t-shirt kiosks | Logo + name on cotton / polyester | Logo BG remove is junk. Mirror for HTV is a hidden checkbox. |
| Orgs / corporates | 50–500 staff tees, brand logo, one colour | Flexi is $thousands. VinylMaster ~$2.5k. Linux shops have nothing. |

## What the top apps actually do (2025–26)

| | Cricut Design Space | Silhouette Studio | SCAL | VinylMaster / Flexi | **CutterStudio (us)** |
|---|---|---|---|---|---|
| Offline | Weak / cloud | Yes | Yes | Yes | **Yes (Windows + Linux)** |
| Any cutter (HPGL/DXF) | Cricut only | Silhouette only | Multi | Multi | **Multi (SVG/DXF/HPGL)** |
| Subscription trap | Access $10/mo | Designer upsell | One-time | Expensive | **No lock-in** |
| mm-true zoom / rulers | Weak | OK | OK | Pro 0.01mm claims | **96dpi world = plotter mm** |
| Logo BG + silhouette cut | Weak | Pixel trace paid | Trace | AI/pro | **Flood + holes + cut path** |
| Team roster → jersey set | **No** | **No** | **No** | Manual | **Building now** |
| HTV mirror + weed box | Hidden / mat | Manual | Manual | Yes | **Building now** |
| Linux | No | No | No | No | **Yes** |

Cricut wins hobby templates. VinylMaster wins sign shops with money. **Nobody owns African / school / jersey production on a cheap plotter, offline.** That is our lane.

## Jersey sizes we encode (adult / youth)

| Piece | Adult | Youth | School PE |
|---|---|---|---|
| Back number | 250 mm (10") | 200 mm (8") | 150 mm (6") |
| Front / chest number | 125 mm (5") | 100 mm (4") | 75 mm (3") |
| Name on back | 65 mm (~2.5") | 50 mm (2") | 40 mm (1.6") |

Source: common kit practice (back 8–12", names 2–3", front 4–6").

## Roadmap to “shops prefer us”

### Now (this pass)
1. **Team Kit** — paste `NAME,NUMBER` → generate name + front + back at real mm.
2. **HTV prep** — Mirror all (heat-transfer), weed box around the job.
3. Auto-nest the batch on the vinyl sheet.

### Next
4. CSV roster upload (Excel from the coach).
5. Colour-split jobs (white names / black numbers as two cut files).
6. Vinyl cost: cm² × price/m → quote the school.
7. Press recipe card (temp / time / peel) per material.
8. USB/serial send (Graphtec / Roland / Chinese plotters).

### Later (still no UI rebuild)
9. True-shape nest with rotation.
10. Print+cut marks for DTF/printable HTV.
11. Shared job ticket for a second operator.

## Accuracy rule (non-negotiable)

Zoom is a magnifying glass. **10 cm on the sheet is 100 mm on the plotter at 50% or 400%.** Kit sizes are specified in millimetres, then converted with the same 96 dpi world as DXF/HPGL.
