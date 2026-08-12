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

### Type (shop picker, not lifestyle fluff)
Jersey printers need **distance-readable, weedable** faces. We dropped thin scripts / hairline serifs (Allura, Gloria Hallelujah, Playfair, Cormorant, Cinzel, Comfortaa…) and stocked:

| Lane | Faces shops actually cut |
|---|---|
| Jersey names & numbers | Tourney, Anton, Bebas Neue, Oswald, Black Ops One, Russo One, Squada One, Teko |
| Long names | Barlow Condensed, League Gothic, Staatliches, Roboto Condensed |
| Digital watch / LCD / PE bibs | Share Tech Mono, Iceland, Orbitron, VT323, Michroma, Chakra Petch, Aldrich |
| School / house kits | Luckiest Guy, Fredoka, Graduate, Paytone One, Bangers |
| Corporate staff | Montserrat Black, Outfit, League Spartan, Space Grotesk |
| Thick scripts only | Pacifico, Lobster, Yellowtail, Kaushan Script |

Kit modal: **name font** (default Bebas Neue) and **number font** (default Anton) are separate. Digital-watch numbers are on the number list.

### Shipped
1. **Team Kit** — paste `NAME,NUMBER` → generate name + front + back at real mm.
2. **HTV prep** — Mirror all (heat-transfer), weed box around the job.
3. Auto-nest the batch on the vinyl sheet.
4. **CSV roster** (Excel / coach list, including `Name,Number` headers).
5. **Colour-split jobs** — names one vinyl, numbers another; HPGL+DXF per colour.
6. **Vinyl quote** — cm² × price/m² + waste % (KES/USD/EUR/GBP).
7. **Send to plotter** — Web Serial when the OS exposes the cutter; otherwise a colour-job folder.

### Next
8. ~~Press recipe card~~ **Shipped** — Kit → Press (PU / glitter / flock / printable / sign vinyl).
8b. ~~Reg marks / rotate nest / job ticket / CSV size~~ **Shipped**.
9. Native USB drivers for Graphtec / Roland / Chinese plotters where Web Serial is blocked.

### Production floor (1.2.0)
Plotter **VS/FS profiles**, vinyl **roll widths**, **shop type** defaults, **gang copies**, **autosave**, **job queue**. See `PRODUCTION.md`. Native USB and bundled fonts are still later.

### Later (still no UI rebuild)
9. True-shape nest with rotation.
10. Print+cut marks for DTF/printable HTV.
11. Shared job ticket for a second operator.

### Public web (how search engines understand us)
The studio canvas is invisible to crawlers. The **parallel site** (`index.html`, `compare.html`, `jersey.html`, `school.html`) is real HTML + JSON-LD + `sitemap.xml` + `llms.txt`. That is how we show up for “vinyl cutter software Linux” and “football jersey number size mm”. Ranking like YouTube still needs a live domain, backlinks, and time — the files only make the product *legible*.

## Accuracy rule (non-negotiable)

Zoom is a magnifying glass. **10 cm on the sheet is 100 mm on the plotter at 50% or 400%.** Kit sizes are specified in millimetres, then converted with the same 96 dpi world as DXF/HPGL.
