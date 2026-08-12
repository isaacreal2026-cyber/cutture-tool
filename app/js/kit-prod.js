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
      let name = '', number = '';
      if (line.indexOf(',') >= 0 || line.indexOf('\t') >= 0 || line.indexOf(';') >= 0) {
        const parts = line.split(/[,;\t]/).map(function (s) { return s.replace(/^\s+|\s+$/g, ''); });
        if (/^\d+[A-Za-z]?$/.test(parts[0]) && parts[1]) {
          number = parts[0]; name = parts[1];
        } else {
          name = parts[0]; number = parts[1] || '';
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
      players.push({ name: name, number: number, line: idx + 1 });
    });
    return players;
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
      kitPieces(pl, preset, parts).forEach(function (piece) { list.push(piece); });
    });
    return list;
  }

  function vinylAreaCm2(pieces) {
    // Conservative: height × 0.7 width factor per glyph, for quoting.
    let mm2 = 0;
    (pieces || []).forEach(function (p) {
      const glyphs = Math.max(1, String(p.text || '').length);
      const w = p.heightMm * 0.62 * glyphs;
      mm2 += w * p.heightMm;
    });
    return mm2 / 100;
  }

  return {
    PRESETS: PRESETS,
    parseRoster: parseRoster,
    kitPieces: kitPieces,
    buildKit: buildKit,
    vinylAreaCm2: vinylAreaCm2,
  };
});
