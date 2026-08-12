/**
 * Team kit / HTV production — roster → names & numbers at real jersey mm.
 * Browser + Node. Does not depend on Fabric.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KitProd = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRESETS = {
    football_adult: {
      id: 'football_adult', label: 'Football / rugby — adult',
      backNumMm: 250, frontNumMm: 125, nameMm: 65,
    },
    football_youth: {
      id: 'football_youth', label: 'Football / rugby — youth',
      backNumMm: 200, frontNumMm: 100, nameMm: 50,
    },
    soccer_adult: {
      id: 'soccer_adult', label: 'Soccer / basketball — adult',
      backNumMm: 230, frontNumMm: 100, nameMm: 60,
    },
    school_pe: {
      id: 'school_pe', label: 'School PE / house kits',
      backNumMm: 150, frontNumMm: 75, nameMm: 40,
    },
    corporate_tee: {
      id: 'corporate_tee', label: 'Corporate / staff tee',
      backNumMm: 80, frontNumMm: 40, nameMm: 25,
    },
  };

  function parseRoster(text) {
    const players = [];
    const seen = Object.create(null);
    String(text || '').split(/\r?\n/).forEach(function (raw, idx) {
      const line = raw.replace(/^\s+|\s+$/g, '');
      if (!line || line.charAt(0) === '#') return;
      let name = '', number = '', size = '';
      if (line.indexOf(',') >= 0 || line.indexOf('\t') >= 0 || line.indexOf(';') >= 0) {
        const parts = line.split(/[,;\t]/).map(function (s) { return s.replace(/^\s+|\s+$/g, ''); });
        if (/^\d+[A-Za-z]?$/.test(parts[0]) && parts[1]) {
          number = parts[0]; name = parts[1];
          size = parts[2] || '';
        } else {
          name = parts[0]; number = parts[1] || '';
          size = parts[2] || '';
        }
      } else {
        const m = line.match(/^(.*?)[\s]+(\d+[A-Za-z]?)$/);
        const m2 = line.match(/^(\d+[A-Za-z]?)[\s]+(.*)$/);
        if (m) { name = m[1]; number = m[2]; }
        else if (m2) { number = m2[1]; name = m2[2]; }
        else { name = line; }
      }
      name = String(name || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').toUpperCase();
      number = String(number || '').replace(/\s+/g, '');
      if (!name && !number) return;
      const key = (number || ('x' + idx)) + '|' + name;
      if (seen[key]) return;
      seen[key] = 1;
      const preset = presetFromSize(size);
      players.push({ name: name, number: number, line: idx + 1, size: size, preset: preset });
    });
    return players;
  }

  function presetFromSize(size) {
    const s = String(size || '').toLowerCase();
    if (!s) return '';
    if (/youth|junior|kids|u1[0-6]|ys|ym|yl/.test(s)) return 'football_youth';
    if (/school|pe\b|house/.test(s)) return 'school_pe';
    if (/adult|senior|men|women|^xs$|^s$|^m$|^l$|^xl$|^xxl$/.test(s)) return 'football_adult';
    return '';
  }

  function kitPieces(player, preset, parts) {
    const p = PRESETS[preset] || PRESETS.football_adult;
    const want = parts || { name: true, front: true, back: true };
    const out = [];
    if (want.back && player.number) {
      out.push({ kind: 'back', text: player.number, heightMm: p.backNumMm, player: player.name });
    }
    if (want.front && player.number) {
      out.push({ kind: 'front', text: player.number, heightMm: p.frontNumMm, player: player.name });
    }
    if (want.name && player.name) {
      out.push({ kind: 'name', text: player.name, heightMm: p.nameMm, player: player.name });
    }
    return out;
  }

  function buildKit(players, preset, parts) {
    const list = [];
    (players || []).forEach(function (pl) {
      kitPieces(pl, pl.preset || preset, parts).forEach(function (piece) { list.push(piece); });
    });
    return list;
  }

  function vinylAreaCm2(pieces) {
    let mm2 = 0;
    (pieces || []).forEach(function (p) {
      const glyphs = Math.max(1, String(p.text || '').length);
      const w = p.heightMm * 0.62 * glyphs;
      mm2 += w * p.heightMm;
    });
    return mm2 / 100;
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q = !q; continue; }
      if (!q && (c === ',' || c === ';' || c === '\t')) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(function (s) { return s.replace(/^\s+|\s+$/g, ''); });
  }

  function parseRosterCsv(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/).filter(function (l) { return l.replace(/^\s+|\s+$/g, '').length; });
    if (!lines.length) return [];
    const head = parseCsvLine(lines[0]).map(function (h) { return h.toLowerCase(); });
    const looksHeader = head.some(function (h) { return /name|player|jina/.test(h); })
      || head.some(function (h) { return /num|jersey|no\.?|#/.test(h); });
    let start = 0, ni = 0, numi = 1, si = -1;
    if (looksHeader) {
      start = 1;
      const nIdx = head.findIndex(function (h) { return /name|player|jina/.test(h); });
      const uIdx = head.findIndex(function (h) { return /num|jersey|no\.?|#/.test(h); });
      const sIdx = head.findIndex(function (h) { return /size|age|youth|adult/.test(h); });
      if (nIdx >= 0) ni = nIdx;
      if (uIdx >= 0) numi = uIdx;
      if (sIdx >= 0) si = sIdx;
    }
    const block = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.length) continue;
      const name = (cols[ni] || '').replace(/,/g, ' ');
      const number = cols[numi] || '';
      const size = si >= 0 ? (cols[si] || '') : (cols[2] || '');
      block.push(name + '\t' + number + '\t' + size);
    }
    return parseRoster(block.join('\n'));
  }

  function normalizeHex(color) {
    let c = String(color || '#000000').toLowerCase();
    if (c === 'black') return '#000000';
    if (c === 'white') return '#ffffff';
    if (/^#[0-9a-f]{3}$/.test(c)) {
      return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    const m = c.match(/^#([0-9a-f]{6})$/);
    return m ? '#' + m[1] : '#000000';
  }

  function splitJobsByColor(items) {
    const map = Object.create(null);
    (items || []).forEach(function (it) {
      const hex = normalizeHex(it.fill || it.color || '#000000');
      if (!map[hex]) map[hex] = { color: hex, items: [] };
      map[hex].items.push(it);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function quoteVinyl(cm2, opts) {
    const o = opts || {};
    const waste = Math.max(0, Number(o.wastePct) || 0);
    const price = Math.max(0, Number(o.pricePerM2) || 0);
    const design = Number(cm2) || 0;
    const used = design * (1 + waste / 100);
    const m2 = used / 10000;
    const total = m2 * price;
    const currency = o.currency || 'KES';
    return {
      designCm2: Math.round(design * 10) / 10,
      usedCm2: Math.round(used * 10) / 10,
      m2: Math.round(m2 * 10000) / 10000,
      pricePerM2: price,
      wastePct: waste,
      total: Math.round(total * 100) / 100,
      currency: currency,
      text: currency + ' ' + (Math.round(total * 100) / 100).toFixed(2) + ' · ' + (Math.round(used * 10) / 10) + ' cm² incl. ' + waste + '% waste',
    };
  }

  const PRESS = {
    htv_pu: {
      id: 'htv_pu', label: 'PU HTV (Siser-class)',
      tempC: 150, timeS: 15, peel: 'hot / warm',
      note: 'Mirror. Cotton and poly blend. Medium pressure.',
    },
    htv_glitter: {
      id: 'htv_glitter', label: 'Glitter HTV',
      tempC: 160, timeS: 20, peel: 'cold',
      note: 'Mirror. Extra pressure. Weed before press.',
    },
    flock: {
      id: 'flock', label: 'Flock',
      tempC: 160, timeS: 20, peel: 'warm',
      note: 'Mirror. Soft pile — do not over-press.',
    },
    printable: {
      id: 'printable', label: 'Printable HTV / DTF film',
      tempC: 160, timeS: 15, peel: 'cold',
      note: 'Do not mirror if the print already faces the shirt.',
    },
    sign: {
      id: 'sign', label: 'Sign vinyl (no press)',
      tempC: 0, timeS: 0, peel: 'n/a',
      note: 'Adhesive vinyl. No heat. Apply with squeegee.',
    },
  };

  function formatPress(id) {
    const p = PRESS[id] || PRESS.htv_pu;
    if (!p.tempC) return p.label + ' — ' + p.note;
    return p.tempC + '°C · ' + p.timeS + 's · peel ' + p.peel + ' · ' + p.note;
  }

  function buildTicket(opts) {
    const o = opts || {};
    const players = o.players || [];
    const pieces = o.pieces || [];
    const quote = o.quote || {};
    const press = formatPress(o.press);
    const preset = (PRESETS[o.preset] || PRESETS.football_adult).label;
    const colours = (o.colours || []).join(', ') || '—';
    const lines = [
      'CutterStudio Pro — job ticket',
      'Date: ' + (o.date || new Date().toISOString().slice(0, 10)),
      'Preset: ' + preset,
      'Press: ' + press,
      'Players: ' + players.length,
      'Pieces: ' + pieces.length,
      'Quote: ' + (quote.text || '—'),
      'Colours: ' + colours,
      '',
      'Cut operator: ______________',
      'Press operator: ______________',
      'Notes: ' + (o.notes || ''),
    ];
    return { text: lines.join('\n'), lines: lines, press: press, preset: preset };
  }

  return {
    PRESETS: PRESETS,
    PRESS: PRESS,
    formatPress: formatPress,
    presetFromSize: presetFromSize,
    buildTicket: buildTicket,
    parseRoster: parseRoster,
    parseRosterCsv: parseRosterCsv,
    parseCsvLine: parseCsvLine,
    kitPieces: kitPieces,
    buildKit: buildKit,
    vinylAreaCm2: vinylAreaCm2,
    normalizeHex: normalizeHex,
    splitJobsByColor: splitJobsByColor,
    quoteVinyl: quoteVinyl,
  };
});
