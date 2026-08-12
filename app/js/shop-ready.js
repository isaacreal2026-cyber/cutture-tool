/**
 * Production shop floor — plotter profiles, rolls, copies, autosave, job queue.
 * Browser + Node. No Fabric required. Does not restyle studio chrome.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ShopReady = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SETTINGS_KEY = 'cspro.shop.v1';
  const AUTOSAVE_KEY = 'cspro.autosave.v1';
  const QUEUE_KEY = 'cspro.jobs.v1';
  const MAX_AUTOSAVE = 1400000;
  const MAX_QUEUE = 24;

  const PLOTTERS = {
    graphtec: {
      id: 'graphtec', label: 'Graphtec CE / FC',
      baud: 9600, velocity: 20, force: 20, pen: 1,
      note: 'IN; VS; FS. USB-serial at 9600 is the usual CE6000 / FC9000 default.',
    },
    roland: {
      id: 'roland', label: 'Roland GX / GS',
      baud: 9600, velocity: 15, force: 30, pen: 1,
      note: 'Heavier force, slower feed. Common on GX-24 / GS-24.',
    },
    chinese: {
      id: 'chinese', label: 'Chinese SK / USCutter',
      baud: 9600, velocity: 25, force: 18, pen: 1,
      note: 'SK / LiYu / USCutter clones. Try 19200 if the blade crawls.',
    },
    generic: {
      id: 'generic', label: 'Generic HPGL',
      baud: 9600, velocity: 20, force: 20, pen: 1,
      note: 'Safe defaults when the box has no brand plate.',
    },
  };

  const ROLLS = {
    '300': { id: '300', label: '300 mm roll', widthMm: 300, heightMm: 500 },
    '380': { id: '380', label: '380 mm roll', widthMm: 380, heightMm: 500 },
    '500': { id: '500', label: '500 mm roll', widthMm: 500, heightMm: 700 },
    '610': { id: '610', label: '610 mm roll (24")', widthMm: 610, heightMm: 800 },
  };

  const SHOPS = {
    jersey: {
      id: 'jersey', label: 'Jersey / football shop',
      preset: 'football_adult', roll: '500', price: 450, currency: 'KES',
    },
    school: {
      id: 'school', label: 'School PE / house kits',
      preset: 'school_pe', roll: '300', price: 380, currency: 'KES',
    },
    corporate: {
      id: 'corporate', label: 'Corporate / staff tees',
      preset: 'corporate_tee', roll: '300', price: 520, currency: 'KES',
    },
  };

  function clampCopies(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v) || v < 1) return 1;
    return Math.min(50, v);
  }

  function plotter(id) {
    return PLOTTERS[id] || PLOTTERS.generic;
  }

  function shopType(id) {
    return SHOPS[id] || SHOPS.jersey;
  }

  function roll(id) {
    return ROLLS[String(id)] || null;
  }

  function hpglOpts(profileId, overrides) {
    const p = plotter(profileId);
    const o = overrides || {};
    const velocity = Number(o.velocity != null ? o.velocity : p.velocity) || 20;
    const force = Number(o.force != null ? o.force : p.force);
    const pen = Number(o.pen != null ? o.pen : p.pen) || 1;
    const baud = Number(o.baud != null ? o.baud : p.baud) || 9600;
    const overcutMm = Number(o.overcutMm) || 0;
    return { velocity: velocity, force: force, pen: pen, baud: baud, overcutMm: overcutMm, profile: p.id };
  }

  function expandCopies(items, copies) {
    const n = clampCopies(copies);
    const list = items || [];
    if (n <= 1) return list.slice();
    const out = [];
    for (let i = 0; i < n; i++) {
      list.forEach(function (it) { out.push(it); });
    }
    return out;
  }

  function readJson(store, key, fallback) {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s || !s.getItem) return fallback;
    try {
      const v = JSON.parse(s.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(store, key, value) {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s || !s.setItem) return false;
    try {
      s.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSettings(store) {
    const raw = readJson(store, SETTINGS_KEY, {}) || {};
    const shop = shopType(raw.shopType);
    return {
      shopType: shop.id,
      plotter: plotter(raw.plotter).id,
      roll: raw.roll || shop.roll,
      price: raw.price != null ? Number(raw.price) : shop.price,
      currency: raw.currency || shop.currency,
      seenShop: !!raw.seenShop,
    };
  }

  function saveSettings(next, store) {
    const cur = loadSettings(store);
    const merged = Object.assign({}, cur, next || {});
    merged.plotter = plotter(merged.plotter).id;
    merged.shopType = shopType(merged.shopType).id;
    writeJson(store, SETTINGS_KEY, merged);
    return merged;
  }

  function packAutosave(payload) {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    if (text.length > MAX_AUTOSAVE) {
      return { ok: false, reason: 'too-large', bytes: text.length };
    }
    return { ok: true, text: text, bytes: text.length, savedAt: Date.now() };
  }

  function writeAutosave(payload, store) {
    const packed = packAutosave(payload);
    if (!packed.ok) return packed;
    const ok = writeJson(store, AUTOSAVE_KEY, { text: packed.text, savedAt: packed.savedAt, bytes: packed.bytes });
    return Object.assign({}, packed, { written: ok });
  }

  function readAutosave(store) {
    const raw = readJson(store, AUTOSAVE_KEY, null);
    if (!raw || !raw.text) return null;
    return raw;
  }

  function clearAutosave(store) {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (s && s.removeItem) s.removeItem(AUTOSAVE_KEY);
  }

  function loadQueue(store) {
    const list = readJson(store, QUEUE_KEY, []);
    return Array.isArray(list) ? list.slice(0, MAX_QUEUE) : [];
  }

  function saveQueue(list, store) {
    writeJson(store, QUEUE_KEY, (list || []).slice(0, MAX_QUEUE));
    return loadQueue(store);
  }

  function queueJob(job, store) {
    const list = loadQueue(store);
    const item = {
      id: 'job-' + Date.now().toString(36),
      name: String((job && job.name) || 'Untitled job').slice(0, 80),
      players: Number((job && job.players) || 0),
      pieces: Number((job && job.pieces) || 0),
      colours: (job && job.colours) || [],
      quote: (job && job.quote) || '',
      press: (job && job.press) || '',
      plotter: (job && job.plotter) || 'generic',
      createdAt: (job && job.createdAt) || new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: (job && job.status) || 'queued',
    };
    list.unshift(item);
    saveQueue(list, store);
    return item;
  }

  function removeJob(id, store) {
    const next = loadQueue(store).filter(function (j) { return j.id !== id; });
    saveQueue(next, store);
    return next;
  }

  function markJob(id, status, store) {
    const list = loadQueue(store).map(function (j) {
      if (j.id !== id) return j;
      return Object.assign({}, j, { status: status || j.status });
    });
    saveQueue(list, store);
    return list;
  }

  function formatQueue(list) {
    const rows = list || [];
    if (!rows.length) return 'No jobs in today\'s queue.';
    return rows.map(function (j, i) {
      return (i + 1) + '. [' + (j.status || 'queued') + '] ' + j.name
        + ' · ' + j.players + ' players · ' + j.pieces + ' pcs'
        + (j.quote ? ' · ' + j.quote : '');
    }).join('\n');
  }

  function removeShapeAt(list, index) {
    const out = (list || []).slice();
    const i = Number(index);
    if (!Number.isFinite(i) || i < 0 || i >= out.length) return out;
    out.splice(i, 1);
    return out;
  }

  return {
    SETTINGS_KEY: SETTINGS_KEY,
    AUTOSAVE_KEY: AUTOSAVE_KEY,
    QUEUE_KEY: QUEUE_KEY,
    PLOTTERS: PLOTTERS,
    ROLLS: ROLLS,
    SHOPS: SHOPS,
    clampCopies: clampCopies,
    plotter: plotter,
    shopType: shopType,
    roll: roll,
    hpglOpts: hpglOpts,
    expandCopies: expandCopies,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    packAutosave: packAutosave,
    writeAutosave: writeAutosave,
    readAutosave: readAutosave,
    clearAutosave: clearAutosave,
    loadQueue: loadQueue,
    queueJob: queueJob,
    removeJob: removeJob,
    markJob: markJob,
    formatQueue: formatQueue,
    removeShapeAt: removeShapeAt,
  };
});

(function () {
  if (typeof window === 'undefined' || typeof ShopReady === 'undefined') return;
  const R = ShopReady;
  function $(id) { return document.getElementById(id); }
  function board() { return (typeof FC !== 'undefined' && FC) || window.FC; }

  function fillShopSelects() {
    const shop = $('shop-type');
    if (shop && !shop._filled) {
      shop._filled = true;
      Object.keys(R.SHOPS).forEach(function (id) {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = R.SHOPS[id].label;
        shop.appendChild(o);
      });
      shop.addEventListener('change', function () { applyShopType(shop.value, true); });
    }
    const roll = $('vinyl-roll');
    if (roll && !roll._filled) {
      roll._filled = true;
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Sheet only';
      roll.appendChild(blank);
      Object.keys(R.ROLLS).forEach(function (id) {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = R.ROLLS[id].label;
        roll.appendChild(o);
      });
      roll.addEventListener('change', function () { applyRoll(roll.value); });
    }
    const saved = R.loadSettings();
    if (shop) shop.value = saved.shopType;
    if (roll && saved.roll) roll.value = saved.roll;
    const first = $('first-shop');
    if (first && !first._filled) {
      first._filled = true;
      Object.keys(R.SHOPS).forEach(function (id) {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = R.SHOPS[id].label;
        first.appendChild(o);
      });
      first.value = saved.shopType;
    }
  }

  function applyShopType(id, persist) {
    const shop = R.shopType(id);
    const preset = $('kit-preset');
    if (preset) preset.value = shop.preset;
    const price = $('kit-price');
    if (price) price.value = shop.price;
    const ccy = $('kit-ccy');
    if (ccy) ccy.value = shop.currency;
    const roll = $('vinyl-roll');
    if (roll) roll.value = shop.roll;
    applyRoll(shop.roll);
    if (persist) R.saveSettings({ shopType: shop.id, roll: shop.roll, price: shop.price, currency: shop.currency, seenShop: true });
  }

  function applyRoll(id) {
    const spec = R.roll(id);
    if (!spec || typeof setUnit !== 'function') return;
    const unit = (typeof S !== 'undefined' && S.unit) || 'cm';
    const E = typeof CutterEngine !== 'undefined' ? CutterEngine : null;
    if (!E) return;
    const u = E.UNITS[unit] || E.UNITS.cm;
    const wEl = $('dw-in');
    const hEl = $('dh-in');
    if (wEl) wEl.value = E.fromMm(spec.widthMm, unit).toFixed(u.decimals);
    if (hEl) hEl.value = E.fromMm(spec.heightMm, unit).toFixed(u.decimals);
    if (typeof applyDocSize === 'function') applyDocSize();
    R.saveSettings({ roll: spec.id });
  }

  window.applyShopType = applyShopType;
  window.applyVinylRoll = applyRoll;

  window.gangCopiesOnSheet = function gangCopiesOnSheet() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined') { showToast('Canvas not ready', 'w'); return; }
    const n = R.clampCopies(($('sheet-copies') || $('kit-copies') || {}).value);
    if (n <= 1) { showToast('Set copies to 2 or more, then gang', 'w'); return; }
    const skip = function (o) {
      return o.isGuide || (typeof CutterEngine !== 'undefined' && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
    };
    const src = fc.getObjects().filter(function (o) { return !skip(o); });
    if (!src.length) { showToast('Add artwork first', 'w'); return; }
    let pending = src.length * (n - 1);
    if (!pending) return;
    src.forEach(function (o) {
      for (let i = 1; i < n; i++) {
        o.clone(function (cl) {
          cl.set({ left: (cl.left || 0) + 12 * i, top: (cl.top || 0) + 12 * i });
          fc.add(cl);
          pending -= 1;
          if (pending <= 0) {
            if (typeof autoNest === 'function') autoNest();
            else fc.renderAll();
            if (typeof saveH === 'function') saveH();
            showToast('Ganged ×' + n + ' and nested', 's');
          }
        });
      }
    });
  };

  function currentJobMeta() {
    const roster = (($('kit-roster') || {}).value) || '';
    const players = (typeof KitProd !== 'undefined') ? KitProd.parseRoster(roster) : [];
    const pieces = (typeof KitProd !== 'undefined')
      ? KitProd.buildKit(players, (($('kit-preset') || {}).value) || 'football_adult')
      : [];
    let quote = '';
    if (typeof KitProd !== 'undefined') {
      const q = KitProd.quoteVinyl(KitProd.vinylAreaCm2(pieces), {
        pricePerM2: parseFloat(($('kit-price') || {}).value) || 0,
        wastePct: parseFloat(($('kit-waste') || {}).value) || 15,
        currency: ($('kit-ccy') || {}).value || 'KES',
      });
      quote = q.text;
    }
    const colours = [];
    const fc = board();
    if (fc && typeof KitProd !== 'undefined') {
      const items = fc.getObjects().filter(function (o) {
        return !o.isGuide && !(typeof CutterEngine !== 'undefined' && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
      }).map(function (o) { return { fill: o.fill }; });
      KitProd.splitJobsByColor(items).forEach(function (j) { colours.push(j.color); });
    }
    return {
      name: (players[0] && players[0].name) ? (players[0].name + (players.length > 1 ? ' +' + (players.length - 1) : '')) : 'Sheet job',
      players: players.length,
      pieces: pieces.length,
      colours: colours,
      quote: quote,
      press: ($('kit-press') || {}).value || '',
      plotter: ($('kit-plotter') || {}).value || 'generic',
    };
  }

  window.queueCurrentJob = function queueCurrentJob() {
    const item = R.queueJob(currentJobMeta());
    showToast('Queued ' + item.name, 's');
    renderQueue();
  };

  window.showJobQueue = function showJobQueue() {
    renderQueue();
    const m = $('queue-modal');
    if (m) m.classList.remove('h');
  };

  function renderQueue() {
    const pre = $('queue-body');
    if (pre) pre.textContent = R.formatQueue(R.loadQueue());
  }

  window.clearJobQueue = function clearJobQueue() {
    R.loadQueue().slice().forEach(function (j) { R.removeJob(j.id); });
    renderQueue();
    showToast('Queue cleared', 's');
  };

  window.confirmShopType = function confirmShopType() {
    const id = (($('first-shop') || $('shop-type') || {}).value) || 'jersey';
    applyShopType(id, true);
    closeModal('shop-modal');
    showToast(R.shopType(id).label + ' defaults loaded', 's');
  };

  function maybeRestoreAutosave() {
    const snap = R.readAutosave();
    if (!snap || !snap.text) return;
    if (!window.confirm('Restore the last unsaved sheet? (crash / power cut)')) {
      return;
    }
    try {
      if (typeof loadProjectJSON === 'function') loadProjectJSON(snap.text);
      showToast('Autosave restored', 's');
    } catch (e) {
      showToast('Autosave was unreadable', 'w');
    }
  }

  function tickAutosave() {
    if (typeof projectDirty === 'undefined' || !projectDirty) return;
    if (typeof projectPayload !== 'function') return;
    try {
      const res = R.writeAutosave(projectPayload());
      const el = $('s-auto');
      if (el) el.textContent = res.ok ? 'Autosaved' : 'Autosave skipped (large logos)';
    } catch (e) { /* quota */ }
  }

  const prevSave = window.saveProject;
  if (typeof prevSave === 'function') {
    window.saveProject = function saveProjectWrapped() {
      prevSave();
      R.clearAutosave();
    };
  }
  const prevNew = window.newDocument;
  if (typeof prevNew === 'function') {
    window.newDocument = function newDocumentWrapped() {
      prevNew();
      R.clearAutosave();
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillShopSelects();
    const saved = R.loadSettings();
    if (!saved.seenShop && $('shop-modal')) {
      $('shop-modal').classList.remove('h');
    } else if (saved.shopType) {
      const shop = $('shop-type');
      if (shop) shop.value = saved.shopType;
      const price = $('kit-price');
      if (price && saved.price) price.value = saved.price;
      const ccy = $('kit-ccy');
      if (ccy && saved.currency) ccy.value = saved.currency;
    }
    setTimeout(maybeRestoreAutosave, 400);
    setInterval(tickAutosave, 20000);
    const q = $('queue-clear');
    if (q) q.addEventListener('click', clearJobQueue);
  });
})();
