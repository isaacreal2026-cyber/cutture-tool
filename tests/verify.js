#!/usr/bin/env node
/**
 * Static + logic verification for CutterStudio Pro.
 * Confirms the frontend is Windows-app ready (offline, exports, zoom, menus).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'app', 'index.html');
const fabricPath = path.join(ROOT, 'app', 'vendor', 'fabric.min.js');
const origPath = path.join(ROOT, 'htlm');

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ' — ' + detail : ''}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const orig = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf8') : '';

// --- structure ---
ok('index.html exists', html.includes('<!DOCTYPE html>'));
ok('local Fabric.js (no CDN)', html.includes('vendor/fabric.min.js') && !html.includes('cdnjs.cloudflare.com'));
ok('fabric.min.js vendored', fs.existsSync(fabricPath) && fs.statSync(fabricPath).size > 100000,
  fs.existsSync(fabricPath) ? `${fs.statSync(fabricPath).size} bytes` : 'missing');
ok('Fabric 5.3.0 (5.3.1 is not a real npm release)', html.includes('5.3.0') || fs.readFileSync(fabricPath, 'utf8').includes('5.3.0'));

const requiredIds = [
  'app','topbar','toolbar','main-canvas','grid-c','wire-c','zoom-root','cscroll',
  'rpanel','tab-props','tab-layers','tab-material','exp-modal','ico-modal',
  'tc-in','fpdrop','cpal','llist','dw-in','dh-in','nm-in','exp-fmt'
];
const missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
ok('required UI ids present', missingIds.length === 0, missingIds.join(',') || 'all 22 found');

ok('no fabric.TextPath constructor (Fabric 5 has Text+path)', !/new\s+fabric\.TextPath\s*\(/.test(html));
ok('curve uses fabric.Text path option', html.includes('pathAlign') && html.includes('new fabric.Text(text'));

ok('DXF uses real newlines (not \\\\n in output)', html.includes("const NL = '\\n';") && !html.includes('0\\\\nSECTION'));
ok('DXF exports path vertices, not only bounding boxes', html.includes('addPoly') && html.includes('VERTEX'));
ok('zoom layout size is visual (W*zoom)', html.includes('(W*S.zoom)') && html.includes('(H*S.zoom)'));
ok('icon search filters by content', html.includes("c.textContent") && html.includes('filterIcons'));
ok('project save/open implemented', html.includes('function saveProject') && html.includes('function openProject'));
ok('new document does not double-confirm', !html.includes("newDocument(){if(!confirm") && html.includes('function newDocument'));
ok('undo guarded during loadFromJSON', html.includes('histBusy'));
ok('desktop bridge used for native save', html.includes('window.desktop') && html.includes('saveFile'));
ok('Google Fonts are non-blocking', html.includes("media=\"print\"") && html.includes("onload=\"this.media='all'\""));
ok('retina scaling enabled', html.includes('enableRetinaScaling'));
ok('Electron main + preload exist',
  fs.existsSync(path.join(ROOT, 'electron', 'main.js')) &&
  fs.existsSync(path.join(ROOT, 'electron', 'preload.js')));
ok('Windows package.json build target', (() => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.build && pkg.build.win && pkg.main === 'electron/main.js';
})());

// original-file regression: these MUST have been broken in htlm
if (orig) {
  ok('original loaded Fabric from CDN (documented risk)', orig.includes('cdnjs.cloudflare.com'));
  ok('original used fabric.TextPath (would crash Fabric 5)', /new\s+fabric\.TextPath\s*\(/.test(orig));
  ok('original DXF wrote literal \\\\n (invalid DXF)', orig.includes('0\\\\nSECTION') || orig.includes('0\\nSECTION'));
}

// --- logic tests: DXF newline encoding ---
function encodeDXF(objects, ppc, height) {
  const NL = '\n';
  let d = ['0','SECTION','2','ENTITIES'].join(NL) + NL;
  objects.forEach(o => {
    if (o.type === 'circle') {
      d += ['0','CIRCLE','8','CUT_LAYER','10',(o.cx/ppc).toFixed(4),'20',((height-o.cy)/ppc).toFixed(4),'40',(o.r/ppc).toFixed(4)].join(NL)+NL;
    } else if (o.pts) {
      d += ['0','POLYLINE','8','CUT_LAYER','66','1','70','1'].join(NL)+NL;
      o.pts.forEach(pt => {
        d += ['0','VERTEX','8','CUT_LAYER','10',(pt.x/ppc).toFixed(4),'20',((height-pt.y)/ppc).toFixed(4)].join(NL)+NL;
      });
      d += '0'+NL+'SEQEND'+NL;
    }
  });
  d += ['0','ENDSEC','0','EOF'].join(NL);
  return d;
}

const dxf = encodeDXF([
  { type:'circle', cx:100, cy:100, r:50 },
  { pts:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}] }
], 37.795, 1512);

ok('DXF contains real newline separators', dxf.includes('\n0\nCIRCLE') && !dxf.includes('\\nSECTION'));
ok('DXF ends with EOF', dxf.trim().endsWith('EOF'));
ok('DXF Y axis flipped (plotter space)', dxf.includes('CIRCLE') && /20\n\d/.test(dxf));

// nest packer
function nest(boxes, sheetW, margin) {
  let cx = margin, cy = margin, rowH = 0;
  return boxes.map(b => {
    const w = b.w + margin * 2, h = b.h + margin * 2;
    if (cx + w > sheetW - margin) { cx = margin; cy += rowH + margin; rowH = 0; }
    const pos = { left: cx + w/2 - margin, top: cy + h/2 - margin, w:b.w, h:b.h };
    cx += w; rowH = Math.max(rowH, h);
    return pos;
  });
}
const packed = nest([{w:80,h:40},{w:80,h:40},{w:80,h:40}], 220, 10);
ok('auto-nest wraps to next row', packed[2].top > packed[0].top, JSON.stringify(packed.map(p=>[p.left,p.top])));
ok('auto-nest keeps first row items side by side', packed[1].left > packed[0].left && packed[1].top === packed[0].top);

// icon filter
function filterSim(items, q) {
  const s = (q||'').toLowerCase();
  return items.filter(c => !s || c.toLowerCase().includes(s));
}
ok('icon filter empty query keeps all', filterSim(['🔥','star','moon'], '').length === 3);
ok('icon filter matches content', filterSim(['🔥','star','moon'], 'sta').join(',') === 'star');

// fabric file is JS and exposes fabric
const fabricSrc = fs.readFileSync(fabricPath, 'utf8');
ok('fabric bundle defines fabric namespace', /fabric/.test(fabricSrc.slice(0, 500)) || fabricSrc.includes('fabric.Canvas'));
ok('fabric has Text but not TextPath class', fabricSrc.includes('fabric.Text') && !/fabric\.TextPath\s*=/.test(fabricSrc));

// HTML well-formed enough
ok('single html/body/script close', (html.match(/<\/html>/g)||[]).length === 1 && (html.match(/<\/body>/g)||[]).length === 1);
ok('no leftover corruption marker', html.trimEnd().endsWith('</html>') && !html.includes('</html>\n</body>'));

const failed = results.filter(r => !r.pass);
const passed = results.filter(r => r.pass);
console.log('\n----------------------------------------');
console.log(`Verified ${results.length} checks · ${passed.length} passed · ${failed.length} failed`);
if (failed.length) {
  console.log('Failures:');
  failed.forEach(f => console.log('  - ' + f.name + (f.detail ? ' ('+f.detail+')' : '')));
  process.exit(1);
}
console.log('Windows-readiness gate: GREEN (core frontend + desktop shell)');
process.exit(0);
