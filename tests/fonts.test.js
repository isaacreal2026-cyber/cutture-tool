#!/usr/bin/env node
/** Shop-floor type library — jersey / HTV / digital-watch faces only. */
const F = require('../app/js/fonts.js');
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) {
    failed++;
    console.error('FAIL  ' + name + (extra ? ' — ' + extra : ''));
  } else console.log('PASS  ' + name);
}

const names = [];
F.FONT_CATS.forEach(function (cat) {
  cat.fonts.forEach(function (f) { names.push(f.f); });
});
const unique = Array.from(new Set(names));

check('library exposes FONT_CATS', Array.isArray(F.FONT_CATS) && F.FONT_CATS.length >= 8);
check('eight shop lanes', F.FONT_CATS.map(function (c) { return c.id; }).join(',') ===
  'jersey,block,condensed,digital,school,street,corporate,script');

const must = ['Tourney', 'Anton', 'Bebas Neue', 'Oswald', 'Black Ops One', 'Russo One',
  'Share Tech Mono', 'Iceland', 'Orbitron', 'VT323', 'Barlow Condensed', 'Luckiest Guy',
  'Montserrat Black', 'Impact'];
must.forEach(function (f) {
  check('has ' + f, unique.indexOf(f) >= 0);
});

F.BANNED_FOR_VINYL.forEach(function (bad) {
  check('banned thin face gone: ' + bad, unique.indexOf(bad) < 0);
});

check('jersey lane has Tourney + Anton + Black Ops One', (function () {
  const j = F.FONT_CATS.find(function (c) { return c.id === 'jersey'; }).fonts.map(function (f) { return f.f; });
  return j.indexOf('Tourney') >= 0 && j.indexOf('Anton') >= 0 && j.indexOf('Black Ops One') >= 0;
})());

check('digital lane is watch/LCD not generic UI', (function () {
  const d = F.FONT_CATS.find(function (c) { return c.id === 'digital'; }).fonts.map(function (f) { return f.f; });
  return d.indexOf('Share Tech Mono') >= 0 && d.indexOf('Iceland') >= 0 && d.indexOf('VT323') >= 0;
})());

check('kit name fonts default to condensed weeding faces', F.KIT_NAME_FONTS[0].f === 'Bebas Neue');
check('kit number fonts default to Anton', F.KIT_NUM_FONTS[0].f === 'Anton');
check('kit numbers include digital watch', F.KIT_NUM_FONTS.some(function (f) { return f.f === 'Share Tech Mono'; }) &&
  F.KIT_NUM_FONTS.some(function (f) { return f.f === 'Iceland'; }));

const href = F.googleFontsHref();
check('Google URL lists Tourney + Black Ops + LCD', href.indexOf('Tourney') >= 0 &&
  href.indexOf('Black+Ops+One') >= 0 && href.indexOf('Share+Tech+Mono') >= 0 &&
  href.indexOf('Iceland') >= 0);
check('Google URL does not pull thin scripts', href.indexOf('Allura') < 0 &&
  href.indexOf('Gloria') < 0 && href.indexOf('Dancing+Script') < 0 &&
  href.indexOf('Playfair') < 0 && href.indexOf('Cormorant') < 0);

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'studio.html'), 'utf8');
check('studio loads fonts.js before picker', html.indexOf('js/fonts.js') < html.indexOf('buildFontDropdown'));
check('studio Google link matches library families', html.indexOf('family=Tourney') >= 0 &&
  html.indexOf('family=Share+Tech+Mono') >= 0 && html.indexOf('family=Black+Ops+One') >= 0);
check('thin faces not in HTML picker', html.indexOf('Gloria Hallelujah') < 0 &&
  html.indexOf('Allura') < 0 && html.indexOf('Philosopher') < 0 &&
  html.indexOf('Comfortaa') < 0 && html.indexOf('Amatic SC') < 0);
check('kit has separate name + number fonts', html.indexOf('id="kit-name-font"') >= 0 &&
  html.indexOf('id="kit-num-font"') >= 0);

const kitUi = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'kit-ui.js'), 'utf8');
check('kit places names and numbers on their own faces', kitUi.indexOf('kit-name-font') >= 0 &&
  kitUi.indexOf('kit-num-font') >= 0 && kitUi.indexOf('isName ? nameFont : numFont') >= 0);
check('kit uses name/number vinyl colours', kitUi.indexOf('kit-name-col') >= 0 &&
  kitUi.indexOf('isName ? nameCol : numCol') >= 0);

if (failed) {
  console.log('\nfont tests FAILED: ' + failed);
  process.exit(1);
}
console.log('\nfont tests: all passed');
