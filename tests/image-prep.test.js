#!/usr/bin/env node
const P = require('../app/js/image-prep.js');
const E = require('../app/js/engine.js');
global.CutterEngine = E;

function make(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = fill[0]; d[i * 4 + 1] = fill[1]; d[i * 4 + 2] = fill[2]; d[i * 4 + 3] = fill[3];
  }
  return d;
}

function setPx(d, w, x, y, r, g, b, a) {
  const i = (y * w + x) * 4;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
}

function getA(d, w, x, y) { return d[(y * w + x) * 4 + 3]; }

let failed = 0;
function check(name, cond, extra) {
  if (!cond) {
    failed++;
    console.error('FAIL  ' + name + (extra ? ' — ' + extra : ''));
  } else console.log('PASS  ' + name);
}

// 32x32 white field, red 10x10 block in the middle
const W = 32, H = 32;
const img = make(W, H, [255, 255, 255, 255]);
for (let y = 11; y <= 20; y++) {
  for (let x = 11; x <= 20; x++) setPx(img, W, x, y, 200, 20, 20, 255);
}

const removed = P.removeBackground(img, W, H, { tolerance: 28, punchHoles: false, despeckle: 4 });
check('auto BG clears a corner', getA(removed.data, W, 0, 0) === 0);
check('auto BG keeps logo core opaque', getA(removed.data, W, 15, 15) > 200, 'a=' + getA(removed.data, W, 15, 15));
check('remaining pixels are the logo block (~100)', removed.remaining >= 90 && removed.remaining <= 130, 'remaining=' + removed.remaining);

const trimmed = P.trimTransparent(removed.data, W, H, 0);
check('trim hugs the logo', trimmed.width === 10 && trimmed.height === 10, trimmed.width + 'x' + trimmed.height);

// already-transparent PNG must not be re-keyed
const png = make(16, 16, [0, 0, 0, 0]);
for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) setPx(png, 16, x, y, 10, 10, 180, 255);
const keep = P.removeBackground(png, 16, 16, { tolerance: 40 });
check('existing alpha is preserved', keep.preserved === true);
check('transparent PNG subject stays', getA(keep.data, 16, 8, 8) === 255);
check('transparent PNG empty stays empty', getA(keep.data, 16, 0, 0) === 0);

// donut: red ring, white hole — punchHoles should open the hole
const donut = make(24, 24, [255, 255, 255, 255]);
for (let y = 4; y < 20; y++) {
  for (let x = 4; x < 20; x++) {
    const cx = x - 11.5, cy = y - 11.5, r = Math.hypot(cx, cy);
    if (r <= 8 && r >= 4) setPx(donut, 24, x, y, 180, 20, 20, 255);
  }
}
const punched = P.removeBackground(donut, 24, 24, { tolerance: 28, punchHoles: true });
check('hole punch clears interior white', getA(punched.data, 24, 12, 12) < 20, 'a=' + getA(punched.data, 24, 12, 12));
check('ring stays after punch', getA(punched.data, 24, 12, 5) > 180, 'a=' + getA(punched.data, 24, 12, 5));

const noPunch = P.removeBackground(donut, 24, 24, { tolerance: 28, punchHoles: false });
check('without punch, enclosed white stays (print+cut)', getA(noPunch.data, 24, 12, 12) > 200);

// crop
const c = P.crop(img, W, H, 11, 11, 10, 10);
check('crop size', c.width === 10 && c.height === 10);
check('crop pixel is red', c.data[0] === 200 && c.data[3] === 255);

const rs = P.resizeBilinear(c.data, 10, 10, 20, 20);
check('resize 10→20', rs.width === 20 && rs.height === 20);
check('quality original does not downscale', P.qualitySize(800, 600, 'original').w === 800);
check('quality web caps long edge', P.qualitySize(4000, 2000, 'web').w === 1200);

// cream / off-white paper — typical phone photo of a crest
const cream = make(28, 28, [248, 242, 230, 255]);
for (let y = 8; y <= 19; y++) {
  for (let x = 8; x <= 19; x++) setPx(cream, 28, x, y, 18, 42, 140, 255);
}
const creamOut = P.removeBackground(cream, 28, 28, { auto: true, punchHoles: false });
check('cream paper corner is gone', getA(creamOut.data, 28, 0, 0) === 0);
check('navy crest survives cream paper', getA(creamOut.data, 28, 14, 14) > 200);

// light-grey mark on white — must not eat the subject
const grey = make(24, 24, [255, 255, 255, 255]);
for (let y = 7; y <= 16; y++) {
  for (let x = 7; x <= 16; x++) setPx(grey, 24, x, y, 196, 196, 196, 255);
}
const greyOut = P.removeBackground(grey, 24, 24, { auto: true, punchHoles: false });
check('white desk around grey mark is gone', getA(greyOut.data, 24, 0, 0) === 0);
check('light grey mark is kept (not keyed as paper)', getA(greyOut.data, 24, 12, 12) > 180, 'a=' + getA(greyOut.data, 24, 12, 12));

const sampled = P.sampleBorderBackground(img, W, H);
check('uniform white border suggests a tight tolerance', sampled.suggestedTolerance >= 12 && sampled.suggestedTolerance <= 22, 'tol=' + sampled.suggestedTolerance);
check('Lab white vs red is a large gap', P.colorDist(255, 255, 255, 200, 20, 20) > 40);
const pick = P.samplePixelMedian(img, W, H, 0, 0, 2);
check('3×3 pick on white is near white', pick.r > 250 && pick.b > 250);

// 1px diagonal paper pocket (8-connect should reach it)
const pocket = make(16, 16, [255, 255, 255, 255]);
for (let y = 4; y <= 11; y++) {
  for (let x = 4; x <= 11; x++) setPx(pocket, 16, x, y, 20, 20, 20, 255);
}
setPx(pocket, 16, 2, 2, 255, 255, 255, 255);
const pocketOut = P.removeBackground(pocket, 16, 16, { tolerance: 20, punchHoles: false });
check('diagonal paper near the border is keyed', getA(pocketOut.data, 16, 1, 1) === 0);
check('black block next to pocket stays', getA(pocketOut.data, 16, 6, 6) > 200);

const rings = P.silhouetteRings(trimmed.data, trimmed.width, trimmed.height, 20);
check('silhouette has at least one ring', rings.length >= 1, 'rings=' + rings.length);
const cmds = P.localCutCommands(trimmed.data, trimmed.width, trimmed.height, 0.6);
check('cut commands start with M and close with Z', cmds[0][0] === 'M' && cmds.some((c) => c[0] === 'Z'));

const fakeImg = {
  isGuide: false,
  cutCommands: [['M', -5, -5], ['L', 5, -5], ['L', 5, 5], ['L', -5, 5], ['Z']],
  calcTransformMatrix: () => [1, 0, 0, 1, 100, 80],
};
const ents = E.fabricObjectToEntities(fakeImg, { pxPerMm: E.PX_PER_MM, heightPx: 400, simplifyMm: 0 });
check('engine prefers cutCommands over bounding box', ents.length === 1 && ents[0].points.length >= 4);
const xs = ents[0].points.map((p) => p.x);
check('cut path is not a sheet-sized box', Math.max.apply(null, xs) - Math.min.apply(null, xs) < 20);

if (failed) {
  console.log('\nimage-prep tests FAILED: ' + failed);
  process.exit(1);
}
console.log('\nimage-prep tests: all passed');
