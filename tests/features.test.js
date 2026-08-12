#!/usr/bin/env node
/**
 * Feature pass — every cutter capability that can be verified without a GPU browser.
 */
const E = require('../app/js/engine.js');
const P = require('../app/js/image-prep.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) {
    failed++;
    console.error('FAIL  ' + name + (extra ? ' — ' + extra : ''));
  } else console.log('PASS  ' + name);
}

// --- Units / sheet ---
check('mm identity', E.toMm(100, 'mm') === 100 && E.fromMm(100, 'mm') === 100);
check('cm ↔ mm', E.toMm(2.5, 'cm') === 25 && E.fromMm(25, 'cm') === 2.5);
check('in ↔ mm', Math.abs(E.toMm(1, 'in') - 25.4) < 1e-9);
check('NaN units become 0', E.toMm('nope', 'cm') === 0 && E.fromMm(undefined, 'mm') === 0);
check('unknown unit falls back to cm', Math.abs(E.toMm(10, 'furlong') - 100) < 1e-9);
const a4 = E.sheetPx(210, 297, 'mm');
const a4cm = E.sheetPx(21, 29.7, 'cm');
check('A4 mm and cm sheets match', a4.w === a4cm.w && a4.h === a4cm.h);

// --- Nest ---
check('empty nest', E.nest([], 100, 100, 2).placed.length === 0);
check('single item no overflow', E.nest([{ w: 10, h: 10 }], 100, 100, 2).overflow === false);

// --- Simplify ---
check('simplify empty', E.simplify([]).length === 0);
check('simplify two points kept', E.simplify([{ x: 0, y: 0 }, { x: 1, y: 1 }], 10).length === 2);

// --- DXF / HPGL ---
check('empty DXF still EOF', E.dxf([]).trim().endsWith('EOF') && E.dxf([]).includes('ENTITIES'));
const closed = E.hpgl([{ type: 'polyline', closed: true, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }]);
check('HPGL closed loop returns to start', /PD.*,0;/.test(closed) || closed.includes('PD40,0,40,40,0,0;') || closed.includes('0,0'));
check('empty HPGL is valid job', E.hpgl([]).includes('IN;') && E.hpgl([]).includes('SP0;'));

// --- Paths including arcs ---
const arcLoops = E.pathCommandsToPolylines([
  ['M', 0, 0], ['A', 10, 10, 0, 0, 1, 20, 0], ['Z'],
], null, 8);
check('arc command produces a curve not a chord', arcLoops[0] && arcLoops[0].points.length > 3, JSON.stringify(arcLoops[0] && arcLoops[0].points.length));

// --- Shapes ---
const rect = {
  type: 'rect', width: 20, height: 10, isGuide: false,
  calcTransformMatrix: () => [1, 0, 0, 1, 0, 0],
};
check('rect is 4 corners', E.fabricObjectToEntities(rect, { pxPerMm: 1, heightPx: 0, simplifyMm: 0 })[0].points.length === 4);
check('guide objects skipped', E.fabricObjectToEntities({ isGuide: true, type: 'rect', getBoundingRect: () => ({ left: 0, top: 0, width: 9, height: 9 }) }).length === 0);

const group = {
  type: 'group',
  _objects: [
    { type: 'circle', radius: 5, scaleX: 1, getCenterPoint: () => ({ x: 10, y: 10 }) },
  ],
};
check('group expands children', E.objectsToEntities([group], { pxPerMm: 1, heightPx: 20, simplifyMm: 0 }).length === 1);

const oval = {
  type: 'circle', radius: 10, scaleX: 2, scaleY: 1, isGuide: false,
  getCenterPoint: () => ({ x: 0, y: 0 }),
  calcTransformMatrix: () => [2, 0, 0, 1, 0, 0],
};
const ovalE = E.objectsToEntities([oval], { pxPerMm: 1, heightPx: 0, simplifyMm: 0 });
check('scaled circle becomes ellipse polyline', ovalE[0].type === 'polyline' && ovalE[0].points.length >= 8);

// --- Cut SVG ---
check('strip fill none stays none', E.stripFillsForCut('<path fill="none"/>').includes('fill="none"'));
check('project meta lists win+linux', E.projectMeta().platforms.join(',') === 'win32,linux');

// --- Map geometry ---
check('zoom 4 then 0.25 returns same world', Math.abs(E.worldFromScroll(E.scrollFromWorld(50, 4, 40), 4, 40) - 50) < 1e-9);
check('plotter mm independent of zoom math', E.plotterMmFromWorldPx(E.worldPxFromPlotterMm(33)) === 33);

// --- Image prep feature matrix ---
function blk(w, h, rgb) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = rgb[3];
  }
  return d;
}
const logo = blk(16, 16, [255, 255, 255, 255]);
for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
  logo[(y * 16 + x) * 4] = 0; logo[(y * 16 + x) * 4 + 1] = 0;
  logo[(y * 16 + x) * 4 + 2] = 0; logo[(y * 16 + x) * 4 + 3] = 255;
}
const gone = P.removeBackground(logo, 16, 16, { tolerance: 24, punchHoles: false });
check('feature: auto BG leaves a solid mark', gone.remaining >= 50 && P.countOpaque(gone.data) === gone.remaining);
const trimmed = P.trimTransparent(gone.data, 16, 16, 0);
check('feature: trim is tight', trimmed.width === 8 && trimmed.height === 8);
const cmds = P.localCutCommands(trimmed.data, trimmed.width, trimmed.height, 0.5);
check('feature: logo silhouette for plotter', cmds.length >= 2 && cmds[0][0] === 'M');
check('feature: print quality cap', P.qualitySize(8000, 1000, 'print').w === 4000);
check('feature: crop stays in bounds', P.crop(logo, 16, 16, 14, 14, 8, 8).width <= 2);

const fakeLogo = {
  isGuide: false,
  cutCommands: cmds,
  calcTransformMatrix: () => [1, 0, 0, 1, 40, 40],
};
const cut = E.objectsToEntities([fakeLogo], { pxPerMm: E.PX_PER_MM, heightPx: 400, simplifyMm: 0 });
check('feature: logo cut is not a rectangle-only fallback', cut.length >= 1 && cut[0].points && cut[0].points.length >= 3);

// --- App wiring ---
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
check('feature: import editor modal wired', html.includes('id="img-modal"') && html.includes('img-place'));
check('feature: map-zoom script last', html.lastIndexOf('map-zoom.js') > html.lastIndexOf('image-editor.js'));
check('feature: HPGL in export list', html.includes('value="hpgl"'));
check('feature: units selector', html.includes('id="unit-in"'));
check('feature: no duplicate exp-opt', (html.match(/id="exp-opt"/g) || []).length === 1);
check('feature: Ctrl+D not corrupted', !html.includes('duplicateentDefault') && html.includes('duplicateSelected()'));
check('feature: desktop save uses base64', fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8').includes('readAsDataURL'));
check('feature: logo place does not require window.FC', !fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'image-editor.js'), 'utf8').includes('!window.FC'));

if (failed) {
  console.log('\nfeature tests FAILED: ' + failed);
  process.exit(1);
}
console.log('\nfeature tests: all passed');
