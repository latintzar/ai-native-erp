/* Rocoto — the face. One shared blink clock drives every face on the page (nav, favicon,
   hero, anywhere) so they blink as ONE being. Hard cut (no crossfade), ~200ms hold, human
   randomised gaps 3–7s, occasional double-blink. Tokenised: any element with
   data-rocoto-face="face|phone" (+ optional data-theme="light|dark") becomes a live face.
   Favicon: a <link data-rocoto-favicon data-open=… data-closed=…> blinks in the tab. */
(function () {
  var BASE = '/brand', HOLD = 200;

  // ── shared blink clock (one per page) ──
  if (!window.__rocotoClock) {
    window.__rocotoClock = 1;
    var fire = function () {
      try { document.dispatchEvent(new CustomEvent('rocoto-blink')); } catch (e) {}
      if (Math.random() < 0.15) setTimeout(function () {
        try { document.dispatchEvent(new CustomEvent('rocoto-blink')); } catch (e) {}
      }, HOLD + 170); // occasional double-blink
      setTimeout(fire, 3000 + Math.random() * 4000); // 3–7s
    };
    setTimeout(fire, 1600 + Math.random() * 1800);
  }

  function onBlink(fn) { document.addEventListener('rocoto-blink', fn); }

  // pick the highest-contrast face for the element's actual background (walk up to the first
  // opaque-enough bg). Returns 'dark' (→ cream/white face) on dark bgs, else 'light' (→ ink face).
  function autoTheme(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var m = (getComputedStyle(node).backgroundColor || '').match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(',').map(parseFloat), a = p[3] === undefined ? 1 : p[3];
        if (a > 0.25) { return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) < 140 ? 'dark' : 'light'; }
      }
      node = node.parentElement;
    }
    return 'light';
  }

  // ── vanilla face element ──
  function mount(el) {
    if (el.__rf) return; el.__rf = 1;
    var variant = el.getAttribute('data-rocoto-face') || 'face';
    var theme = el.getAttribute('data-theme') || 'auto';
    if (theme === 'auto') theme = autoTheme(el);
    var suf = theme === 'dark' ? '-dark' : '';
    el.classList.add('rf');
    var o = new Image(); o.className = 'rf-o'; o.src = BASE + '/' + variant + '-open' + suf + '.png'; o.alt = 'Rocoto';
    var c = new Image(); c.className = 'rf-c'; c.src = BASE + '/' + variant + '-closed' + suf + '.png'; c.alt = ''; c.setAttribute('aria-hidden', 'true');
    el.appendChild(o); el.appendChild(c);
    // show ONE frame at a time (both are transparent line art — overlaying double-exposes the eyes)
    onBlink(function () {
      o.style.opacity = 0; c.style.opacity = 1;
      setTimeout(function () { o.style.opacity = 1; c.style.opacity = 0; }, HOLD);
    });
  }

  // ── favicon blinker ──
  function favicon() {
    var link = document.querySelector('link[data-rocoto-favicon]'); if (!link) return;
    var open = link.getAttribute('data-open'), closed = link.getAttribute('data-closed');
    if (!open || !closed) return;
    var pre = new Image(); pre.src = closed; // preload
    onBlink(function () { link.href = closed; setTimeout(function () { link.href = open; }, HOLD); });
  }

  function init() {
    var els = document.querySelectorAll('[data-rocoto-face]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
    favicon();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  window.RocotoFace = { mount: mount, onBlink: onBlink, HOLD: HOLD };
})();
