/**
 * Print+cut marks and job tickets. Uses existing modal / button classes.
 */
(function () {
  function board() { return (typeof FC !== 'undefined' && FC) || window.FC; }
  function $(id) { return document.getElementById(id); }

  function artworkBounds(fc) {
    const objs = fc.getObjects().filter(function (o) {
      return !o.isGuide && !(typeof CutterEngine !== 'undefined' && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
    });
    if (!objs.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(function (o) {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });
    return { left: minX, top: minY, right: maxX, bottom: maxY };
  }

  window.addRegMarks = function addRegMarks() {
    const fc = board();
    if (!fc || typeof fabric === 'undefined' || typeof CutterEngine === 'undefined') {
      showToast('Canvas not ready', 'w');
      return;
    }
    const box = artworkBounds(fc);
    if (!box) { showToast('Add artwork first', 'w'); return; }
    const px = CutterEngine.PX_PER_MM;
    const marks = CutterEngine.regMarks({
      left: box.left / px,
      top: box.top / px,
      right: box.right / px,
      bottom: box.bottom / px,
    }, { markMm: 8, gapMm: 4 });
    marks.forEach(function (mk) {
      const pts = mk.points;
      const path = pts.map(function (p, i) {
        return (i ? 'L' : 'M') + (p.x * px) + ' ' + (p.y * px);
      }).join(' ');
      const obj = new fabric.Path(path, {
        fill: null, stroke: '#111111', strokeWidth: 1,
        selectable: true, objType: 'reg-mark',
      });
      fc.add(obj);
    });
    fc.renderAll();
    if (typeof saveH === 'function') saveH();
    showToast('Registration marks added (8 mm L-corners)', 's');
  };

  function currentTicket() {
    if (typeof KitProd === 'undefined') return { text: 'Kit module not loaded' };
    const K = KitProd;
    const players = K.parseRoster(($('kit-roster') || {}).value || '');
    const preset = ($('kit-preset') || {}).value || 'football_adult';
    const parts = {
      name: !$('kit-skip-name') || $('kit-skip-name').checked,
      front: !$('kit-skip-front') || $('kit-skip-front').checked,
      back: !$('kit-skip-back') || $('kit-skip-back').checked,
    };
    const pieces = K.buildKit(players, preset, parts);
    const quote = K.quoteVinyl(K.vinylAreaCm2(pieces), {
      pricePerM2: parseFloat(($('kit-price') || {}).value) || 0,
      wastePct: parseFloat(($('kit-waste') || {}).value) || 15,
      currency: ($('kit-ccy') || {}).value || 'KES',
    });
    const colours = [];
    const fc = board();
    if (fc && K.splitJobsByColor) {
      const items = fc.getObjects().filter(function (o) {
        return !o.isGuide && !(CutterEngine && CutterEngine.isShopFixture && CutterEngine.isShopFixture(o));
      }).map(function (o) { return { fill: o.fill }; });
      K.splitJobsByColor(items).forEach(function (j) { colours.push(j.color); });
    }
    return K.buildTicket({
      players: players,
      pieces: pieces,
      quote: quote,
      preset: preset,
      press: ($('kit-press') || {}).value || 'htv_pu',
      colours: colours,
    });
  }

  window.showJobTicket = function showJobTicket() {
    const ticket = currentTicket();
    const pre = $('ticket-body');
    if (pre) pre.textContent = ticket.text;
    const m = $('ticket-modal');
    if (m) m.classList.remove('h');
  };

  window.downloadJobTicket = function downloadJobTicket() {
    const ticket = currentTicket();
    if (typeof dlBlob === 'function') {
      dlBlob(new Blob([ticket.text], { type: 'text/plain' }), CutterEngine.safeJobName('job-ticket.txt'));
    }
    showToast('Job ticket saved', 's');
  };

  document.addEventListener('DOMContentLoaded', function () {
    const btn = $('ticket-download');
    if (btn) btn.addEventListener('click', downloadJobTicket);
  });
})();
