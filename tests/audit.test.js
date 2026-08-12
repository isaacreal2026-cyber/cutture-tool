#!/usr/bin/env node
/** Audit lock: group transforms, XSS helpers, NaN cut jobs, press cards. */
const E = require('../app/js/engine.js');
const K = require('../app/js/kit-prod.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

const I = E.multiplyMatrices([1, 0, 0, 1, 100, 20], [1, 0, 0, 1, 5, 0]);
check('matrix multiply translates', Math.abs(I[4] - 105) < 1e-9 && Math.abs(I[5] - 20) < 1e-9);

const child = {
  type: 'rect', width: 20, height: 10,
  calcOwnMatrix: () => [1, 0, 0, 1, 0, 0],
  calcTransformMatrix: () => [1, 0, 0, 1, 0, 0],
};
const group = {
  type: 'group',
  calcTransformMatrix: () => [1, 0, 0, 1, 100, 0],
  _objects: [child],
};
const ents = E.objectsToEntities([group], { pxPerMm: 1, heightPx: 0, simplifyMm: 0 });
const xs = (ents[0] && ents[0].points || []).map((p) => p.x).sort((a, b) => a - b);
check('grouped rect is shifted by group matrix', ents.length === 1 && xs[0] >= 89 && xs[xs.length - 1] <= 111, JSON.stringify(xs));

const ungrouped = {
  type: 'group',
  _objects: [{
    type: 'circle', radius: 5, scaleX: 1,
    getCenterPoint: () => ({ x: 10, y: 10 }),
  }],
};
check('group without extra matrix still expands', E.objectsToEntities([ungrouped], { pxPerMm: 1, heightPx: 20, simplifyMm: 0 }).length === 1);

const dxf = E.dxf([{ type: 'circle', cx: NaN, cy: 1, r: 2 }, { type: 'circle', cx: 1, cy: 1, r: 2 }]);
check('NaN circle omitted from DXF', dxf.includes('CIRCLE') && !dxf.includes('NaN'));
const hp = E.hpgl([{ type: 'polyline', points: [{ x: 1, y: 1 }, { x: Infinity, y: 2 }] }]);
check('non-finite polyline omitted from HPGL', hp.includes('IN;') && !hp.includes('Infinity'));

check('escapeHtml blocks tags', E.escapeHtml('<img onerror=alert(1)>').indexOf('<img') < 0);
check('escapeHtml keeps text', E.escapeHtml('OTIENO 10').indexOf('OTIENO') >= 0);
check('safeJobName blocks ..', E.safeJobName('..') === 'job.bin' && E.safeJobName('../etc/passwd') === 'etc_passwd.bin');
check('safeJobName keeps plt', E.safeJobName('kit-ffffff.plt') === 'kit-ffffff.plt');
check('safeJobName empty becomes job.bin', E.safeJobName('') === 'job.bin');

check('press PU is 150C / 15s', K.PRESS.htv_pu.tempC === 150 && K.PRESS.htv_pu.timeS === 15);
check('formatPress mentions peel', K.formatPress('htv_glitter').indexOf('cold') >= 0);
check('unknown press falls back to PU', K.formatPress('nope').indexOf('150') >= 0);

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
check('studio is well-formed once', (html.match(/<\/html>/g) || []).length === 1 && !html.includes('10pvar'));
check('kit press + baud in modal', html.includes('id="kit-press"') && html.includes('id="kit-baud"'));
check('layers escape text', html.includes('CutterEngine.escapeHtml'));
check('toasts escape text', html.includes('CutterEngine.escapeHtml(msg)'));
check('Electron only grants serial', main.includes('return permission === \'serial\''));
check('Electron sanitizes job names', main.includes('safeJobName'));
check('openExternal requires http(s)', main.includes('/^https?:\\/\\//i.test(url)'));

if (failed) { console.log('\naudit tests FAILED: ' + failed); process.exit(1); }
console.log('\naudit tests: all passed');
