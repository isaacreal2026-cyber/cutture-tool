#!/usr/bin/env node
const T = require('../app/js/shop-tools.js');
const E = require('../app/js/engine.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

const hull = T.convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }]);
check('hull drops interior point', hull.length === 4 && !hull.some((p) => p.x === 5 && p.y === 5));

const a = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
const b = { points: [{ x: 8, y: 8 }, { x: 18, y: 8 }, { x: 18, y: 18 }, { x: 8, y: 18 }] };
const far = { points: [{ x: 40, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 40, y: 10 }] };
const welded = T.weldPolylines([a, b, far]);
check('overlapping boxes weld to one hull', welded.filter((w) => w.welded).length === 1);
check('distant box stays separate', welded.length === 2);

const off = T.offsetClosed(a.points, 2);
const box = T.boxOf(off);
check('offset grows a closed square', box.w > 10 && box.h > 10);

const oc = T.applyOvercut([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2, true);
check('overcut adds a point past the start', oc.length === 4 && oc[3].x > 0 && oc[3].y === 0);

const tabs = T.weedTabs({ left: 0, top: 0, right: 40, bottom: 20 }, { tabMm: 4, count: 4 });
check('four weed tabs', tabs.length === 4 && tabs.every((t) => t.objType === 'weed-tab' && t.points.length === 4));

const sq = T.testCutSquare(10);
check('test cut is 10 mm square', sq.sizeMm === 10 && sq.points[2].x === 10 && sq.points[2].y === 10);

const moved = T.alignBoxes([
  { i: 0, x: 10, y: 5, w: 8, h: 4 },
  { i: 1, x: 30, y: 20, w: 8, h: 4 },
], 'left');
check('align left matches min X', moved[0].x === 10 && moved[1].x === 10);

const dist = T.distributeBoxes([
  { i: 0, x: 0, y: 0, w: 4, h: 4 },
  { i: 1, x: 10, y: 0, w: 4, h: 4 },
  { i: 2, x: 40, y: 0, w: 4, h: 4 },
], 'x');
check('distribute spaces three centres', Math.abs((dist[1].x + 2) - (dist[0].x + 2) - ((dist[2].x + 2) - (dist[1].x + 2))) < 1e-6);

const tiles = T.tilePlan(700, 200, 300, 500, 0);
check('700 mm art on 300 mm roll needs 3 tiles', tiles.needed && tiles.cols === 3 && tiles.tiles.length === 3);
check('art that fits does not tile', T.tilePlan(100, 80, 300, 500, 5).needed === false);

const scaled = T.scaleToHeight({ w: 200, h: 100 }, 50);
check('size-to-mm scales height', scaled.h === 50 && Math.abs(scaled.scale - 0.5) < 1e-9);

const hp = E.hpgl([{ type: 'polyline', closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }], { overcutMm: 1, sort: false });
check('HPGL overcut extends past close', (hp.match(/PD/g) || []).length >= 1 && hp.includes('40,'));
check('weed-tab is a fixture', E.isShopFixture({ objType: 'weed-tab' }) && E.isShopFixture({ objType: 'test-cut' }));

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
check('edit has weld + offset + height mm', html.includes('weldSelection') && html.includes('id="edit-offset-mm"') && html.includes('applyHeightMm'));
check('sheet has test cut + tabs + tile', html.includes('addTestCut') && html.includes('addWeedTabs') && html.includes('tileOversized'));
check('kit overcut field', html.includes('id="kit-overcut"'));
check('shop-tools.js before map-zoom', html.indexOf('shop-tools.js') < html.lastIndexOf('map-zoom.js') && html.indexOf('shop-ready.js') < html.indexOf('shop-tools.js'));

if (failed) { console.log('\ntools tests FAILED: ' + failed); process.exit(1); }
console.log('\ntools tests: all passed');
