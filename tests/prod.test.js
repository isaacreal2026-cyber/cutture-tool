#!/usr/bin/env node
const E = require('../app/js/engine.js');
const R = require('../app/js/shop-ready.js');
const C = require('../app/js/edit-bar.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

check('graphtec baud 9600 / VS 20', R.plotter('graphtec').baud === 9600 && R.plotter('graphtec').velocity === 20);
check('roland is slower and heavier', R.plotter('roland').velocity === 15 && R.plotter('roland').force === 30);
check('unknown plotter is generic', R.plotter('nope').id === 'generic');
const opts = R.hpglOpts('chinese', { velocity: 30 });
check('hpglOpts keeps chinese force', opts.force === 18 && opts.velocity === 30 && opts.baud === 9600);

const hp = E.hpgl([{ type: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }], { velocity: 12, force: 22 });
check('HPGL writes VS and FS', hp.includes('VS12;') && hp.includes('FS22;'));
check('HPGL without force has no FS', !E.hpgl([{ type: 'polyline', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }]).includes('FS'));

const ordered = E.sortEntitiesForCut([
  { type: 'polyline', points: [{ x: 40, y: 1 }, { x: 41, y: 1 }] },
  { type: 'polyline', points: [{ x: 2, y: 9 }, { x: 3, y: 9 }] },
]);
check('cut order is left-to-right', ordered[0].points[0].x === 2 && ordered[1].points[0].x === 40);

check('copies clamp 0→1 and 99→50', R.clampCopies(0) === 1 && R.clampCopies(99) === 50);
check('expandCopies triples a roster piece', R.expandCopies(['a', 'b'], 3).length === 6);
check('expandCopies 1 is a copy', R.expandCopies(['a'], 1).length === 1);

check('school shop uses PE preset + 300mm roll', R.shopType('school').preset === 'school_pe' && R.shopType('school').roll === '300');
check('610 roll is 24 inch', R.ROLLS['610'].widthMm === 610);

const mem = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
R.saveSettings({ shopType: 'school', plotter: 'roland' }, mem);
const loaded = R.loadSettings(mem);
check('settings persist shop + plotter', loaded.shopType === 'school' && loaded.plotter === 'roland');

const packed = R.packAutosave({ ok: 1 });
check('small autosave packs', packed.ok && packed.bytes > 2);
const huge = R.packAutosave({ blob: new Array(2000000).join('x') });
check('huge autosave refused', huge.ok === false && huge.reason === 'too-large');
R.writeAutosave('{"app":"CutterStudio Pro"}', mem);
check('autosave round-trip', R.readAutosave(mem).text.indexOf('CutterStudio') >= 0);
R.clearAutosave(mem);
check('autosave clear', R.readAutosave(mem) == null);

const job = R.queueJob({ name: 'Gor Mahia 10', players: 12, pieces: 36, quote: 'KES 1.00' }, mem);
check('queue adds a job', job.id && R.loadQueue(mem).length === 1);
check('queue text lists the team', R.formatQueue(R.loadQueue(mem)).indexOf('Gor Mahia') >= 0);
R.markJob(job.id, 'cut', mem);
check('queue status updates', R.loadQueue(mem)[0].status === 'cut');
R.removeJob(job.id, mem);
check('queue remove', R.loadQueue(mem).length === 0);
check('empty queue copy', R.formatQueue([]).indexOf('No jobs') >= 0);

const shapes = C.removeShape ? C.removeShape(0, mem) : null;
C.saveShapes([{ name: 'crest' }, { name: 'badge' }], mem);
check('removeShape drops index 0', C.removeShape(0, mem).length === 1 && C.loadShapes(mem)[0].name === 'badge');
check('removeShapeAt helper', R.removeShapeAt(['a', 'b', 'c'], 1).join(',') === 'a,c');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
check('plotter + copies in kit modal', html.includes('id="kit-plotter"') && html.includes('id="kit-copies"') && html.includes('id="kit-vs"'));
check('shop type + roll + queue wired', html.includes('id="shop-type"') && html.includes('id="vinyl-roll"') && html.includes('id="queue-modal"'));
check('first-run shop modal', html.includes('id="shop-modal"') && html.includes('confirmShopType'));
check('shop-ready.js before map-zoom', html.indexOf('shop-ready.js') < html.lastIndexOf('map-zoom.js') && html.indexOf('shop-floor.js') < html.indexOf('shop-ready.js'));
check('roll presets in sheet list', html.includes('roll300') && html.includes('roll610'));

if (failed) { console.log('\nprod tests FAILED: ' + failed); process.exit(1); }
console.log('\nprod tests: all passed');
