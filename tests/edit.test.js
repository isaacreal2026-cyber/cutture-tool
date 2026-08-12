#!/usr/bin/env node
const E = require('../app/js/edit-bar.js');
const F = require('../app/js/fonts.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

const flat = E.curveLayout('AB', 'none', 50, 40);
check('flat layout is on a line', flat.length === 2 && flat[0].y === 0 && flat[1].y === 0 && flat[1].x > flat[0].x);

const up = E.curveLayout('OTIENO', 'arc-up', 80, 48);
check('arc-up lifts the middle', up.length === 6 && up[2].y < up[0].y);
const down = E.curveLayout('OTIENO', 'arc-down', 80, 48);
check('arc-down drops the middle', down[2].y > down[0].y);
const circ = E.curveLayout('1234', 'circle', 50, 40);
check('circle returns 4 glyphs with angles', circ.length === 4 && circ.some((g) => g.angle !== 0));
const wave = E.curveLayout('WAVE', 'wave', 100, 40);
check('wave varies Y', wave.some((g) => g.y !== 0));
check('more bend is tighter (smaller |y| span? or larger)', (function () {
  const a = E.curveLayout('NAME', 'arc-up', 20, 40);
  const b = E.curveLayout('NAME', 'arc-up', 90, 40);
  const span = function (arr) { return Math.max.apply(null, arr.map(function (g) { return Math.abs(g.y); })); };
  return span(b) > span(a);
})());

check('Bebas pairs with Anton numbers', F.numberFontFor('Bebas Neue') === 'Anton');
check('Oswald pairs with Tourney', F.numberFontFor('Oswald') === 'Tourney');
check('unknown face falls back to Anton', F.numberFontFor('NoSuchFont') === 'Anton');

const mem = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); } };
E.saveShapes([{ name: 'crest', svg: '<svg/>' }], mem);
const loaded = E.loadShapes(mem);
check('custom shapes persist', loaded.length === 1 && loaded[0].name === 'crest');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
check('Edit opens modal not toast', html.includes('showEditModal()') && html.includes('id="edit-modal"'));
check('text vs image panes', html.includes('id="edit-text"') && html.includes('id="edit-image"'));
check('image edit has BG remove shortcut', html.includes('openImageEditorFromObject'));
check('curve bend slider present', html.includes('id="tc-curve-amt"') && html.includes('id="edit-curve"'));
check('quick shapes add + save', html.includes('importCustomShape') && html.includes('saveSelectionToQuickShapes') && html.includes('id="custom-shapes"'));
check('edit-bar.js before map-zoom', html.indexOf('edit-bar.js') < html.lastIndexOf('map-zoom.js'));

if (failed) { console.log('\nedit tests FAILED: ' + failed); process.exit(1); }
console.log('\nedit tests: all passed');
