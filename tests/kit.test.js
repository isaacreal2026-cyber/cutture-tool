#!/usr/bin/env node
const K = require('../app/js/kit-prod.js');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
  else console.log('PASS  ' + name);
}

const roster = K.parseRoster('# school XI\nOTIENO,10\n7 KAMAU\nWANJIKU 4\n;bad\nJuma;9\nOTIENO,10\n');
check('parses name,number CSV', roster.some((p) => p.name === 'OTIENO' && p.number === '10'));
check('parses number-first', roster.some((p) => p.name === 'KAMAU' && p.number === '7'));
check('parses space form', roster.some((p) => p.name === 'WANJIKU' && p.number === '4'));
check('parses semicolon', roster.some((p) => p.name === 'JUMA' && p.number === '9'));
check('dedupes repeat lines', roster.filter((p) => p.name === 'OTIENO').length === 1);
check('skips comments', roster.every((p) => p.name !== '# SCHOOL XI'));

const adult = K.PRESETS.football_adult;
check('adult back number is 250mm (10in)', adult.backNumMm === 250);
check('youth smaller than adult', K.PRESETS.football_youth.backNumMm < adult.backNumMm);
check('school PE smaller than youth', K.PRESETS.school_pe.backNumMm < K.PRESETS.football_youth.backNumMm);

const one = { name: 'OTIENO', number: '10' };
const all = K.kitPieces(one, 'football_adult', { name: true, front: true, back: true });
check('one player → name + front + back', all.length === 3);
check('back number height 250mm', all.filter((p) => p.kind === 'back')[0].heightMm === 250);
check('name is uppercase already', all.filter((p) => p.kind === 'name')[0].text === 'OTIENO');

const namesOnly = K.buildKit([one, { name: 'KAMAU', number: '7' }], 'school_pe', { name: true, front: false, back: false });
check('can emit names only', namesOnly.length === 2 && namesOnly.every((p) => p.kind === 'name'));

const area = K.vinylAreaCm2(all);
check('vinyl quote area is positive', area > 10);

const csv = K.parseRosterCsv('Name,Number\n"Otieno, Jr",10\nKamau,7\n');
check('CSV header maps name/number', csv.some((p) => p.name === 'OTIENO JR' && p.number === '10') && csv.length === 2);
check('CSV BOM + number-first header', K.parseRosterCsv('\uFEFFJersey,Player\n4,Wanjiku')[0].number === '4');

const jobs = K.splitJobsByColor([
  { fill: '#fff', kind: 'name' },
  { fill: '#ffffff', kind: 'name' },
  { fill: '#000', kind: 'back' },
  { fill: 'black', kind: 'front' },
]);
check('colour split collapses #fff/#ffffff and #000/black', jobs.length === 2);
check('normalize short hex', K.normalizeHex('#fff') === '#ffffff');

const q = K.quoteVinyl(10000, { pricePerM2: 450, wastePct: 15, currency: 'KES' });
check('quote applies 15% waste', Math.abs(q.usedCm2 - 11500) < 0.2);
check('quote 1.15m² × 450 = 517.5', Math.abs(q.total - 517.5) < 0.05);
check('quote text includes currency', q.text.indexOf('KES') === 0);

if (failed) { console.log('\nkit tests FAILED: ' + failed); process.exit(1); }
console.log('\nkit tests: all passed');
