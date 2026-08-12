#!/usr/bin/env node
const assert = require('assert');
const E = require('../app/js/engine.js');

function check(name, cond, detail) {
  if (!cond) {
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
    process.exitCode = 1;
    return;
  }
  console.log('PASS  ' + name);
}

check('96px = 1 inch = 25.4mm', Math.abs(E.PX_PER_IN - 96) < 1e-9 && Math.abs(E.PX_PER_MM * 25.4 - 96) < 1e-9);
check('30cm sheet is 300mm', Math.abs(E.toMm(30, 'cm') - 300) < 1e-9);
check('300mm displays as 30cm', Math.abs(E.fromMm(300, 'cm') - 30) < 1e-9);
check('11in ≈ 279.4mm', Math.abs(E.toMm(11, 'in') - 279.4) < 0.01);
check('A4 21×29.7cm → px uses CSS dpi', (() => {
  const s = E.sheetPx(21, 29.7, 'cm');
  return s.w === Math.round(210 * E.PX_PER_MM) && s.h === Math.round(297 * E.PX_PER_MM);
})(), JSON.stringify(E.sheetPx(21, 29.7, 'cm')));

const packed = E.nest(
  [{ w: 80, h: 40 }, { w: 80, h: 40 }, { w: 80, h: 40 }],
  220, 200, 10
);
check('nest places two on first row', packed.placed[1].left > packed.placed[0].left && packed.placed[1].top === packed.placed[0].top);
check('nest wraps third item', packed.placed[2].top > packed.placed[0].top);
check('oversized item flags overflow', E.nest([{ w: 500, h: 40 }], 200, 200, 10).overflow === true);

const line = E.simplify([{ x: 0, y: 0 }, { x: 1, y: 0.01 }, { x: 2, y: 0 }], 0.1);
check('simplify drops colinear points', line.length === 2, JSON.stringify(line));

const dxf = E.dxf([
  { type: 'circle', cx: 10, cy: 20, r: 5 },
  { type: 'polyline', closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
]);
check('DXF real newlines + EOF', dxf.includes('\nCIRCLE\n') && dxf.trim().endsWith('EOF'));
check('DXF units are millimetres ($INSUNITS 4)', dxf.includes('$INSUNITS\n70\n4'));
check('DXF has vertices not only boxes', (dxf.match(/VERTEX/g) || []).length >= 4);

const plt = E.hpgl([
  { type: 'polyline', closed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
]);
check('HPGL starts IN; and uses 40 units/mm', plt.startsWith('IN;') && plt.includes('PD' + (10 * 40) + ',0;'));
check('HPGL parks pen', plt.includes('SP0;'));

const loops = E.pathCommandsToPolylines([
  ['M', 0, 0], ['L', 10, 0], ['L', 10, 10], ['Z'],
], null, 4);
check('path M/L/Z becomes one closed loop', loops.length === 1 && loops[0].closed && loops[0].points.length === 3);

const fakeCircle = {
  type: 'circle', isGuide: false, radius: 37.79527559, scaleX: 1,
  getCenterPoint: () => ({ x: 100, y: 50 }),
};
const ents = E.fabricObjectToEntities(fakeCircle, { pxPerMm: E.PX_PER_MM, heightPx: 400 });
check('fabric circle → mm entity ~1cm radius', ents[0].type === 'circle' && Math.abs(ents[0].r - 10) < 0.02, JSON.stringify(ents[0]));

const svg = E.stripFillsForCut('<svg><path fill="#ff00aa" stroke="red"/></svg>');
check('cut SVG strips fills', svg.includes('fill="none"') && svg.includes('stroke="#000000"'));

const opt = E.traceOptions(128, 8);
check('trace options are 2-color vinyl palette', opt.numberofcolors === 2 && opt.pal.length === 2);

if (process.exitCode) {
  console.log('\nengine tests FAILED');
  process.exit(1);
}
console.log('\nengine tests: all passed');
