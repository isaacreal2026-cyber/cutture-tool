/**
 * Shop-floor type library for CutterStudio Pro.
 *
 * Picked for football/rugby jerseys, school PE kits, custom HTV tees,
 * and staff shirts — not for editorial posters. A face must:
 *   1. Read at 8–12 m (numbers) or on a 40–65 mm name bar.
 *   2. Weed on cheap HTV (no hairline serifs, no thin scripts).
 *   3. Be on Google Fonts (or a Windows/Linux system face) so shops
 *      are not locked into Cricut Access / Silhouette Designer.
 *
 * Research (2025–26): Tourney, Anton, Oswald, Bebas Neue, Varsity-style
 * blocks, Black Ops One, Russo One, and condensed sans for long names
 * are the faces jersey printers actually use. Digital-watch / LCD faces
 * (Share Tech Mono, Iceland, Orbitron, VT323) cover scoreboard & PE bibs.
 */
(function (root) {
  'use strict';

  function face(f, css, note, weight) {
    return { f: f, css: css, note: note, weight: weight || 700 };
  }

  const IMPACT = 'Impact,Arial Black,sans-serif';
  const NARROW = 'Arial Narrow,Impact,sans-serif';
  const BLACK = 'Arial Black,Impact,sans-serif';
  const SCRIPT = 'cursive,Segoe Script,sans-serif';
  const MONO = 'Consolas,Courier New,monospace';

  const FONT_CATS = [
    {
      id: 'jersey', label: '⚽ Jersey / Kit — names & numbers', color: '#b09cff',
      fonts: [
        face('Tourney', 'Tourney,Impact,sans-serif', 'Tourney — modern kit (Google sports)'),
        face('Anton', 'Anton,' + IMPACT, 'Anton — classic back numbers'),
        face('Bebas Neue', 'Bebas Neue,' + IMPACT, 'Bebas Neue — clean name bar'),
        face('Oswald', 'Oswald,' + NARROW, 'Oswald — long names, still bold'),
        face('Black Ops One', 'Black Ops One,' + IMPACT, 'Black Ops One — stencil athletic'),
        face('Russo One', 'Russo One,' + BLACK, 'Russo One — fat match numbers'),
        face('Squada One', 'Squada One,' + IMPACT, 'Squada One — block squad numbers'),
        face('Teko', 'Teko,' + NARROW, 'Teko — condensed football nameset'),
      ],
    },
    {
      id: 'block', label: '💥 Block / Varsity / Force', color: '#f87171',
      fonts: [
        face('Archivo Black', 'Archivo Black,' + BLACK, 'Archivo Black — modern varsity'),
        face('Impact', IMPACT, 'Impact — system force (works offline)'),
        face('Titan One', 'Titan One,' + BLACK, 'Titan One — heavyweight numbers'),
        face('Alfa Slab One', 'Alfa Slab One,Rockwell,serif', 'Alfa Slab One — athletic slab'),
        face('Bungee', 'Bungee,' + IMPACT, 'Bungee — urban sports block'),
        face('Montserrat', 'Montserrat,' + BLACK, 'Montserrat Black — staff + kit', 900),
        face('Changa One', 'Changa One,' + IMPACT, 'Changa One — thick sports display'),
        face('Righteous', 'Righteous,Trebuchet MS,sans-serif', 'Righteous — retro athletic'),
      ],
    },
    {
      id: 'condensed', label: '↔ Condensed — long names', color: '#fb923c',
      fonts: [
        face('League Gothic', 'League Gothic,' + NARROW, 'League Gothic — maximum height'),
        face('Barlow Condensed', 'Barlow Condensed,' + NARROW, 'Barlow Condensed — long African names'),
        face('Staatliches', 'Staatliches,' + NARROW, 'Staatliches — tight athletic'),
        face('Roboto Condensed', 'Roboto Condensed,' + NARROW, 'Roboto Condensed — readable nameset'),
        face('Oswald', 'Oswald,' + NARROW, 'Oswald — World Cup / club names'),
        face('Rajdhani', 'Rajdhani,' + NARROW, 'Rajdhani — scoreboard condensed'),
      ],
    },
    {
      id: 'digital', label: '⌚ Digital watch / scoreboard / LCD', color: '#38bdf8',
      fonts: [
        face('Share Tech Mono', 'Share Tech Mono,' + MONO, 'Share Tech Mono — LCD / digital watch'),
        face('Iceland', 'Iceland,' + MONO, 'Iceland — LED sports display'),
        face('Orbitron', 'Orbitron,' + MONO, 'Orbitron — HUD / kit tech'),
        face('Chakra Petch', 'Chakra Petch,Tahoma,sans-serif', 'Chakra Petch — tech sports'),
        face('Wallpoet', 'Wallpoet,' + IMPACT, 'Wallpoet — stencil digital'),
        face('VT323', 'VT323,' + MONO, 'VT323 — retro LED clock'),
        face('Michroma', 'Michroma,' + MONO, 'Michroma — instrument / watch'),
        face('Audiowide', 'Audiowide,Tahoma,sans-serif', 'Audiowide — techwear numbers'),
        face('Oxanium', 'Oxanium,Tahoma,sans-serif', 'Oxanium — esports jersey'),
        face('Aldrich', 'Aldrich,Tahoma,sans-serif', 'Aldrich — square digital watch'),
      ],
    },
    {
      id: 'school', label: '🏫 School / PE / house kits', color: '#4ade80',
      fonts: [
        face('Luckiest Guy', 'Luckiest Guy,' + IMPACT, 'Luckiest Guy — PE / fun day'),
        face('Fredoka', 'Fredoka,Trebuchet MS,sans-serif', 'Fredoka — house-colour tees'),
        face('Graduate', 'Graduate,Georgia,serif', 'Graduate — collegiate / school'),
        face('Paytone One', 'Paytone One,' + BLACK, 'Paytone One — bold school block'),
        face('Bangers', 'Bangers,' + IMPACT, 'Bangers — sports day / comic'),
        face('Anton', 'Anton,' + IMPACT, 'Anton — PE bib numbers'),
      ],
    },
    {
      id: 'street', label: '🔥 Street / custom tees', color: '#ff8fa3',
      fonts: [
        face('Bangers', 'Bangers,' + IMPACT, 'Bangers — comic graffiti'),
        face('Permanent Marker', 'Permanent Marker,' + SCRIPT, 'Permanent Marker — hand tag'),
        face('Shrikhand', 'Shrikhand,' + SCRIPT, 'Shrikhand — fat display'),
        face('Lilita One', 'Lilita One,' + IMPACT, 'Lilita One — kiosk tee'),
        face('Righteous', 'Righteous,Trebuchet MS,sans-serif', 'Righteous — retro street'),
        face('Luckiest Guy', 'Luckiest Guy,' + IMPACT, 'Luckiest Guy — carnival tee'),
      ],
    },
    {
      id: 'corporate', label: '💼 Corporate / staff tees', color: '#fbbf24',
      fonts: [
        face('Montserrat', 'Montserrat,' + BLACK, 'Montserrat Black — org lockup', 900),
        face('Oswald', 'Oswald,' + NARROW, 'Oswald — staff name + dept'),
        face('Space Grotesk', 'Space Grotesk,Segoe UI,sans-serif', 'Space Grotesk — modern brand'),
        face('Outfit', 'Outfit,Segoe UI,sans-serif', 'Outfit — clean staff tee'),
        face('League Spartan', 'League Spartan,Arial,sans-serif', 'League Spartan — geometric brand'),
        face('Roboto Condensed', 'Roboto Condensed,' + NARROW, 'Roboto Condensed — long job titles'),
      ],
    },
    {
      id: 'script', label: '🖊 Script / fashion tees (thick only)', color: '#f9a8d4',
      fonts: [
        face('Pacifico', 'Pacifico,' + SCRIPT, 'Pacifico — thick script (weeds)'),
        face('Lobster', 'Lobster,' + SCRIPT, 'Lobster — shop / café tee'),
        face('Yellowtail', 'Yellowtail,' + SCRIPT, 'Yellowtail — retro script'),
        face('Kaushan Script', 'Kaushan Script,' + SCRIPT, 'Kaushan Script — fashion name'),
      ],
    },
  ];

  const FONT_MAP = {};
  FONT_CATS.forEach(function (cat) {
    cat.fonts.forEach(function (f) { FONT_MAP[f.f] = f.css; });
  });

  /** Faces we refuse: hairline, thin script, fake-luxury serifs that snap on HTV. */
  const BANNED_FOR_VINYL = [
    'Gloria Hallelujah', 'Shadows Into Light', 'Allura', 'Dancing Script',
    'Comfortaa', 'Philosopher', 'Cormorant', 'Quicksand', 'Amatic SC',
    'Cinzel', 'Playfair Display', 'Ubuntu', 'Georgia',
  ];

  const KIT_NAME_FONTS = [
    face('Bebas Neue', 'Bebas Neue,' + IMPACT, 'clean name bar'),
    face('Oswald', 'Oswald,' + NARROW, 'long names'),
    face('Barlow Condensed', 'Barlow Condensed,' + NARROW, 'long African names'),
    face('Teko', 'Teko,' + NARROW, 'football nameset'),
    face('Staatliches', 'Staatliches,' + NARROW, 'tight athletic'),
    face('League Gothic', 'League Gothic,' + NARROW, 'maximum height'),
    face('Tourney', 'Tourney,Impact,sans-serif', 'modern kit'),
    face('Roboto Condensed', 'Roboto Condensed,' + NARROW, 'readable nameset'),
    face('Anton', 'Anton,' + IMPACT, 'impact names'),
    face('Russo One', 'Russo One,' + BLACK, 'fat names'),
  ];

  const KIT_NUM_FONTS = [
    face('Anton', 'Anton,' + IMPACT, 'classic numbers'),
    face('Tourney', 'Tourney,Impact,sans-serif', 'modern kit numbers'),
    face('Black Ops One', 'Black Ops One,' + IMPACT, 'stencil numbers'),
    face('Russo One', 'Russo One,' + BLACK, 'fat match numbers'),
    face('Squada One', 'Squada One,' + IMPACT, 'block squad'),
    face('Bebas Neue', 'Bebas Neue,' + IMPACT, 'clean blocks'),
    face('Titan One', 'Titan One,' + BLACK, 'heavyweight'),
    face('Impact', IMPACT, 'offline system'),
    face('Archivo Black', 'Archivo Black,' + BLACK, 'modern varsity'),
    face('Iceland', 'Iceland,' + MONO, 'digital watch / LED'),
    face('Share Tech Mono', 'Share Tech Mono,' + MONO, 'LCD / digital watch'),
    face('Orbitron', 'Orbitron,' + MONO, 'HUD numbers'),
  ];

  const GOOGLE_FAMILIES = [
    'Anton', 'Oswald:wght@700', 'Archivo+Black', 'League+Gothic',
    'Pacifico', 'Lobster', 'Shrikhand', 'Orbitron:wght@700', 'Audiowide',
    'Space+Grotesk:wght@700', 'Permanent+Marker', 'Yellowtail', 'Bebas+Neue',
    'Montserrat:wght@900', 'Righteous', 'Bangers', 'Rajdhani:wght@700',
    'Roboto+Condensed:wght@700', 'Tourney:wght@700;900', 'Black+Ops+One',
    'Russo+One', 'Squada+One', 'Teko:wght@700', 'Barlow+Condensed:wght@700',
    'Staatliches', 'Titan+One', 'Changa+One', 'Alfa+Slab+One', 'Bungee',
    'Luckiest+Guy', 'Fredoka:wght@700', 'Graduate', 'Share+Tech+Mono',
    'Iceland', 'Chakra+Petch:wght@700', 'Wallpoet', 'VT323', 'Michroma',
    'Oxanium:wght@700', 'Outfit:wght@700;800', 'League+Spartan:wght@700',
    'Kaushan+Script', 'Paytone+One', 'Lilita+One', 'Aldrich',
  ];

  function googleFontsHref() {
    return 'https://fonts.googleapis.com/css2?' +
      GOOGLE_FAMILIES.map(function (f) { return 'family=' + f; }).join('&') +
      '&display=swap';
  }

  function fillSelect(sel, list, fallback) {
    if (!sel || sel.options.length) return;
    list.forEach(function (f) {
      const o = document.createElement('option');
      o.value = f.f;
      o.textContent = f.note ? (f.f + ' — ' + f.note) : f.f;
      if (f.f === fallback) o.selected = true;
      sel.appendChild(o);
    });
  }

  function fillKitFontSelects() {
    if (typeof document === 'undefined') return;
    fillSelect(document.getElementById('kit-name-font'), KIT_NAME_FONTS, 'Bebas Neue');
    fillSelect(document.getElementById('kit-num-font'), KIT_NUM_FONTS, 'Anton');
  }

  const SYSTEM_FACES = { Impact: 1 };

  function googleFamilyNames() {
    return GOOGLE_FAMILIES.map(function (s) {
      return s.split(':')[0].replace(/\+/g, ' ');
    });
  }

  function findFace(name) {
    let hit = null;
    function scan(list) {
      (list || []).forEach(function (f) { if (f.f === name) hit = f; });
    }
    FONT_CATS.forEach(function (cat) { scan(cat.fonts); });
    scan(KIT_NAME_FONTS);
    scan(KIT_NUM_FONTS);
    return hit;
  }

  /** Props Fabric must set so the loaded Google file actually paints. */
  function fabricProps(name) {
    const face = findFace(name);
    return {
      fontFamily: (face && face.f) || name || 'Bebas Neue',
      fontWeight: String((face && face.weight) || 700),
    };
  }

  const api = {
    FONT_CATS: FONT_CATS,
    FONT_MAP: FONT_MAP,
    BANNED_FOR_VINYL: BANNED_FOR_VINYL,
    KIT_NAME_FONTS: KIT_NAME_FONTS,
    KIT_NUM_FONTS: KIT_NUM_FONTS,
    GOOGLE_FAMILIES: GOOGLE_FAMILIES,
    googleFontsHref: googleFontsHref,
    fillKitFontSelects: fillKitFontSelects,
    SYSTEM_FACES: SYSTEM_FACES,
    googleFamilyNames: googleFamilyNames,
    findFace: findFace,
    fabricProps: fabricProps,
  };

  root.CutterFonts = api;
  root.FONT_CATS = FONT_CATS;
  root.FONT_MAP = FONT_MAP;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
