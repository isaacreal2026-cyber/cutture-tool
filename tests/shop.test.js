#!/usr/bin/env node
const E = require('../app/js/engine.js');
const K = require('../app/js/kit-prod.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

const wide = E.nestTrue([{ w: 80, h: 20 }], 50, 200, 2);
check('nestTrue rotates a piece that is wider than the sheet', wide.placed[0].rotated === true && wide.placed[0].w === 20);
check('nestTrue rotation then fits', wide.overflow === false);

const same = E.nestTrue([{ w: 20, h: 20 }, { w: 20, h: 20 }], 80, 80, 2);
check('nestTrue does not rotate squares that already fit', same.placed.every((p) => !p.rotated));

const plain = E.nest([{ w: 30, h: 10 }], 100, 40, 2);
const tru = E.nestTrue([{ w: 30, h: 10 }], 100, 40, 2);
check('nestTrue matches nest when no rotate needed', Math.abs(plain.placed[0].left - tru.placed[0].left) < 1e-6);

const marks = E.regMarks({ left: 10, top: 10, right: 50, bottom: 40 }, { markMm: 8, gapMm: 4 });
check('four L-corner reg marks', marks.length === 4 && marks.every((m) => m.points.length === 3));
check('reg marks sit outside the art', marks[0].points[1].x === 6 && marks[0].points[1].y === 6);

check('weed-box is a shop fixture', E.isShopFixture({ objType: 'weed-box' }));
check('kit text is not a fixture', !E.isShopFixture({ objType: 'kit-name' }));

check('youth size maps to youth preset', K.presetFromSize('youth') === 'football_youth');
check('XL maps to adult', K.presetFromSize('XL') === 'football_adult');
check('blank size is empty', K.presetFromSize('') === '');

const mixed = K.parseRosterCsv('Name,Number,Size\nOtieno,10,youth\nKamau,7,adult\n');
check('CSV size column is kept', mixed[0].size.toLowerCase() === 'youth' && mixed[1].preset === 'football_adult');
const pieces = K.buildKit(mixed, 'football_adult', { name: false, front: false, back: true });
const otieno = pieces.find((p) => p.player === 'OTIENO');
check('youth row uses 200mm back number', otieno && otieno.heightMm === 200);

const ticket = K.buildTicket({
  players: mixed, pieces: pieces, preset: 'football_adult', press: 'htv_pu',
  quote: { text: 'KES 10.00' }, colours: ['#ffffff'], date: '2026-08-12',
});
check('ticket has press and operators', ticket.text.indexOf('150') >= 0 && ticket.text.indexOf('Cut operator') >= 0);

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
check('reg marks + nest rotate + ticket wired', html.includes('addRegMarks') && html.includes('id="nest-rotate"') && html.includes('id="ticket-modal"'));
check('shop-floor.js before map-zoom', html.indexOf('shop-floor.js') < html.lastIndexOf('map-zoom.js'));

if (failed) { console.log('\nshop tests FAILED: ' + failed); process.exit(1); }
console.log('\nshop tests: all passed');
