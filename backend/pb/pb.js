/* pb.js — the sales playbook. SESSION-GATED: app.py serves this file only to a live control-room
   session, because everything below the fold of this comment is Peter's negotiating position —
   the pricing model, the floor, the questions he asks about budget, and what he says when a
   prospect pushes back. A prospect who could read it would arrive at the call already knowing
   the number Peter settles for. Never move any of it into the public shell (pb/index.html).

   A TOOL, NOT A DOCUMENT. Four screens: the accounts due next · the calculator that produces the
   quote · the Spanish lines that get said out loud, with this account's numbers already in them ·
   MEDDPICC and the mutual action plan. The measure of the build is that Peter can open an
   account and read its monthly quote aloud inside ten seconds, on a phone, with one hand.

   LANGUAGE: the chrome is English (it is a thinking surface, and English is where the work gets
   designed); the talk track is Spanish, because it is spoken to a Spanish distributor. The two
   never mix inside one block.

   THE OUTPUTS ARE NEVER STORED. `calc()` below is the single derivation. The server keeps the
   nine inputs and nothing else — a persisted quote is a second truth that goes stale the first
   time a rate moves, and the sales conversation would quote the stale one. */
(function () {
'use strict';

// ── state ────────────────────────────────────────────────────────────────────────────────────────
var ME = null, SB = null;
var ACCOUNTS = [], ACCT = null, TAB = 'calc';
var saveTimer = null, savePending = {};

var STAGE_LABEL = {
  contacted: 'Contacted', demo_used: 'Demo used', qualifying: 'Qualifying',
  scope_proposed: 'Scope proposed', scope_running: 'Scope running',
  implementation: 'Implementation', live: 'Live',
};
var STAGES = ['contacted', 'demo_used', 'qualifying', 'scope_proposed', 'scope_running',
              'implementation', 'live'];

var MEDD = [
  ['metrics', 'Metrics', 'The number they would move, in their words.'],
  ['economicBuyer', 'Economic buyer', 'Who signs. Name, title, met or not.'],
  ['decisionCriteria', 'Decision criteria', 'What they will compare on.'],
  ['decisionProcess', 'Decision process', 'Steps, committees, dates.'],
  ['paperProcess', 'Paper process', 'Legal, procurement, security review.'],
  ['identifiedPain', 'Identified pain', 'What it costs them today, admitted out loud.'],
  ['champion', 'Champion', 'Who sells this when you are out of the room.'],
  ['competition', 'Competition', 'Including doing nothing, and their own IT.'],
];

var CALC_FIELDS = [
  ['ordersPerDay', 'Orders a day', 0],
  ['workingDaysPerMonth', 'Working days a month', 0],
  ['avgOrderValue', 'Average order value (€)', 0],
  ['peopleKeying', 'People keying orders', 0],
  ['hoursPerDayEach', 'Hours a day each', 1],
  ['loadedCostPerPerson', 'Loaded cost per person (€/yr)', 0],
  ['errorRate', 'Error rate (0–1)', 3],
  ['costPerError', 'Cost per error (€)', 0],
  ['captureRate', 'Capture rate (0–1)', 2],
];

var SCOPE_FEE = { quote: 9000, floor: 6000 };

var IC = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  calc: '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h4"/></svg>',
  say: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  qual: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
};

// ── tiny helpers ─────────────────────────────────────────────────────────────────────────────────
var $ = function (id) { return document.getElementById(id); };
function esc(s) {
  return (s == null ? '' : String(s)).replace(/[<>&"]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
  });
}
function toast(m, err) {
  var t = $('toast'); if (!t) return;
  t.textContent = m; t.className = 'toast on' + (err ? ' err' : '');
  setTimeout(function () { t.className = 'toast'; }, 2400);
}

// Money and figures are Spanish-formatted everywhere, including the English chrome: they are the
// numbers that get read out loud to a Spanish buyer, and a comma that changes between the screen
// and the sentence is a mistake waiting to be made on a call.
var _eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
var _eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
var _num0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
function eur0(v) { return isFinite(v) ? _eur0.format(Math.round(v)) : '—'; }
function eur2(v) { return isFinite(v) ? _eur2.format(v) : '—'; }
function num0(v) { return isFinite(v) ? _num0.format(Math.round(v)) : '—'; }
function mult(v) { return isFinite(v) ? v.toFixed(1).replace('.', ',') + '×' : '—'; }
function pct(v) { return isFinite(v) ? (v * 100).toFixed(2).replace('.', ',') + ' %' : '—'; }

function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function dmy(iso) {
  if (!iso) return '';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); }
  catch (e) { return iso; }
}
function ago(iso) {
  if (!iso) return 'never';
  var d = (Date.now() - new Date(iso)) / 1000;
  if (d < 3600) return Math.max(1, Math.floor(d / 60)) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

function copy(text, label) {
  function done() { toast((label || 'Copied') + ' · copied'); }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else { fallback(); }
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed', true); }
    document.body.removeChild(ta);
  }
}

// ── api ──────────────────────────────────────────────────────────────────────────────────────────
function api(path, opts) {
  opts = opts || {};
  var h = { 'Content-Type': 'application/json' };
  if (opts.method && opts.method !== 'GET' && ME && ME.csrf) h['X-CSRF-Token'] = ME.csrf;
  return fetch(path, {
    method: opts.method || 'GET', credentials: 'include', headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(function (r) {
    if (r.status === 401) { location.reload(); throw { handled: true }; }
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) {
      throw new Error(j.detail || ('HTTP ' + r.status));
    });
    return r.json();
  });
}

// ── THE CALCULATOR — the one derivation, exactly as briefed ──────────────────────────────────────
function calc(v) {
  var ordersPerMonth = v.ordersPerDay * v.workingDaysPerMonth;
  var volumePerMonth = ordersPerMonth * v.avgOrderValue;
  var labourCostYear = v.peopleKeying * v.loadedCostPerPerson * (v.hoursPerDayEach / 8);
  var errorCostYear = ordersPerMonth * 12 * v.errorRate * v.costPerError;
  var statusQuoYear = labourCostYear + errorCostYear;
  var annualPrice = statusQuoYear * v.captureRate;
  var monthlyQuote = Math.round(annualPrice / 12 / 100) * 100;
  var floor = Math.round(monthlyQuote * 0.5 / 100) * 100;
  return {
    ordersPerMonth: ordersPerMonth, volumePerMonth: volumePerMonth,
    labourCostYear: labourCostYear, errorCostYear: errorCostYear,
    statusQuoYear: statusQuoYear, annualPrice: annualPrice,
    monthlyQuote: monthlyQuote, floor: floor,
    customerSaving: statusQuoYear - annualPrice,
    returnMultiple: annualPrice > 0 ? statusQuoYear / annualPrice : Infinity,
    costPerOrder: ordersPerMonth > 0 ? annualPrice / (ordersPerMonth * 12) : Infinity,
    pctOfVolume: volumePerMonth > 0 ? annualPrice / (volumePerMonth * 12) : Infinity,
  };
}

// ── autosave. No save button anywhere: a field that needs saving is a field that gets lost. ──────
function queueSave(patch) {
  Object.keys(patch).forEach(function (k) { savePending[k] = patch[k]; });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 450);
}
function flushSave() {
  if (!ACCT || !Object.keys(savePending).length) return;
  var body = savePending; savePending = {}; saveTimer = null;
  api('/api/crm/playbook/accounts/' + ACCT.id, { method: 'PATCH', body: body })
    .then(function (r) {
      // keep the local record in step WITHOUT re-rendering: a re-render mid-keystroke would move
      // the caret, and this tool is used while somebody is talking.
      Object.keys(r.account).forEach(function (k) {
        if (k !== 'volumes' && k !== 'meddpicc' && k !== 'map_rows') ACCT[k] = r.account[k];
      });
      var s = $('pb-saved'); if (s) { s.className = 'pb-saved on'; setTimeout(function () { s.className = 'pb-saved'; }, 1200); }
    })
    .catch(function (e) { if (!(e && e.handled)) toast('Not saved: ' + e.message, true); });
}
window.addEventListener('beforeunload', function () { if (saveTimer) { clearTimeout(saveTimer); flushSave(); } });

// ── screen 1 · accounts ──────────────────────────────────────────────────────────────────────────
function showList() {
  ACCT = null;
  document.body.innerHTML = '';
  var root = document.createElement('div');
  root.innerHTML =
    '<div class="pb-top"><h1>Playbook</h1><span class="pb-who">' + esc((ME.email || '').split('@')[0]) + '</span></div>' +
    '<div class="pb-main">' +
      '<div class="pb-listhead"><h2>Sorted by what is due next</h2>' +
      '<button class="pb-btn small solid" id="pb-new">New account</button></div>' +
      '<div id="pb-accts"><div class="pb-empty">…</div></div>' +
    '</div>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(root);
  $('pb-new').onclick = newAccount;
  api('/api/crm/playbook/accounts').then(function (r) {
    ACCOUNTS = r.accounts || []; renderList();
  }).catch(function (e) { if (!(e && e.handled)) $('pb-accts').innerHTML = '<div class="pb-empty">' + esc(e.message) + '</div>'; });
}

function renderList() {
  var box = $('pb-accts');
  if (!ACCOUNTS.length) {
    box.innerHTML = '<div class="pb-empty">No accounts yet. The first one is a name and a phone call.</div>';
    return;
  }
  var t = today();
  box.innerHTML = ACCOUNTS.map(function (a) {
    var due = a.next_date && a.next_date <= t;
    return '<button class="pb-acct" data-id="' + a.id + '">' +
      '<div class="pb-acct-row1"><span class="pb-acct-name">' + esc(a.name) + '</span>' +
      '<span class="pb-acct-when' + (due ? ' due' : '') + '">' + (a.next_date ? esc(dmy(a.next_date)) : '—') + '</span></div>' +
      '<div class="pb-acct-row2">' +
      '<span class="pb-stage' + (a.stage === 'live' ? ' live' : '') + '">' + esc(STAGE_LABEL[a.stage] || a.stage) + '</span>' +
      '<span class="pb-acct-next">' + esc(a.next_action || 'No next action') + '</span>' +
      '<span class="pb-acct-touch">' + esc(ago(a.last_touch)) + '</span></div></button>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('.pb-acct'), function (el) {
    el.onclick = function () { openAccount(el.getAttribute('data-id')); };
  });
}

function newAccount() {
  var name = window.prompt('Company name');
  if (!name || !name.trim()) return;
  api('/api/crm/playbook/accounts', { method: 'POST', body: { name: name.trim() } })
    .then(function (r) { openAccount(r.account.id); })
    .catch(function (e) { if (!(e && e.handled)) toast(e.message, true); });
}

// ── the account view ─────────────────────────────────────────────────────────────────────────────
function openAccount(id) {
  api('/api/crm/playbook/accounts/' + id).then(function (r) {
    ACCT = r.account; TAB = 'calc'; renderAccount();
  }).catch(function (e) { if (!(e && e.handled)) toast(e.message, true); });
}

function renderAccount() {
  document.body.innerHTML = '';
  var root = document.createElement('div');
  root.innerHTML =
    '<div class="pb-top">' +
      '<button class="pb-back" id="pb-back" aria-label="Back to accounts">' + IC.back + '</button>' +
      '<h1>' + esc(ACCT.name) + '</h1><span class="pb-saved" id="pb-saved">saved</span>' +
    '</div>' +
    '<div class="pb-main"><div id="pb-hero"></div><div id="pb-screen"></div></div>' +
    '<nav class="pb-tabs" id="pb-tabs"></nav>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(root);
  $('pb-back').onclick = function () { flushSave(); showList(); };
  renderHero(); renderTabs(); renderScreen();
}

function renderTabs() {
  var tabs = [['list', 'Accounts', IC.list], ['calc', 'Numbers', IC.calc],
              ['say', 'Script', IC.say], ['qual', 'Qualify', IC.qual]];
  $('pb-tabs').innerHTML = tabs.map(function (t) {
    return '<button data-t="' + t[0] + '" class="' + (TAB === t[0] ? 'on' : '') + '">' + t[2] + '<span>' + t[1] + '</span></button>';
  }).join('');
  Array.prototype.forEach.call($('pb-tabs').querySelectorAll('button'), function (b) {
    b.onclick = function () {
      var t = b.getAttribute('data-t');
      flushSave();
      if (t === 'list') return showList();
      TAB = t; renderTabs(); renderScreen(); window.scrollTo(0, 0);
    };
  });
}

// The hero is on every tab, and the quote is the first thing in it. That is criterion 5: opening
// an account and reading the monthly figure out loud has to take under ten seconds.
function renderHero() {
  var o = calc(ACCT.volumes);
  $('pb-hero').innerHTML =
    '<div class="pb-hero">' +
      '<div class="pb-hero-q"><span class="pb-quote">' + eur0(o.monthlyQuote) + '</span>' +
      '<span class="pb-quote-u">a month · floor ' + eur0(o.floor) + '</span></div>' +
      '<div class="pb-hero-sub">' + num0(o.ordersPerMonth) + ' orders a month · ' +
        eur2(Math.ceil(o.costPerOrder * 100) / 100) + ' per order · ' + mult(o.returnMultiple) + ' return</div>' +
      '<div class="pb-stages" id="pb-stages">' + STAGES.map(function (s) {
        return '<button data-s="' + s + '" class="' + (ACCT.stage === s ? 'on' : '') + '">' + STAGE_LABEL[s] + '</button>';
      }).join('') + '</div>' +
      '<details class="pb-obj" style="margin-top:14px"><summary>Contact, next step and notes</summary>' +
        '<div style="padding:0 15px 14px">' + detailsForm() + '</div></details>' +
    '</div>';
  Array.prototype.forEach.call($('pb-stages').querySelectorAll('button'), function (b) {
    b.onclick = function () {
      ACCT.stage = b.getAttribute('data-s'); queueSave({ stage: ACCT.stage }); renderHero();
    };
  });
  wireDetails();
}

function detailsForm() {
  var notes = (ACCT.notes || []).map(function (n) {
    return '<div style="padding:9px 0;border-top:1px solid var(--pb-line-soft)">' +
      '<div class="pb-acct-touch">' + esc(ago(n.created_at)) + '</div>' +
      '<div style="font-size:15px;line-height:1.5;white-space:pre-wrap">' + esc(n.body) + '</div></div>';
  }).join('');
  return '<div class="pb-grid2">' +
      field('contact', 'Contact', ACCT.contact) + field('role', 'Their role', ACCT.role) +
      field('next_action', 'Next action', ACCT.next_action) +
      field('next_date', 'Next date', ACCT.next_date, 'date') +
    '</div>' +
    '<button class="pb-btn small" id="pb-touch">Just spoke to them</button>' +
    '<div class="pb-f" style="margin-top:14px"><label for="pb-note">Note</label>' +
      '<textarea class="pb-in" id="pb-note" placeholder="What was said."></textarea>' +
      '<button class="pb-btn small" id="pb-note-add" style="margin-top:8px">Add note</button></div>' +
    notes;
}

function field(key, label, value, type) {
  return '<div class="pb-f"><label for="pb-f-' + key + '">' + label + '</label>' +
    '<input class="pb-in" id="pb-f-' + key + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"></div>';
}

function wireDetails() {
  ['contact', 'role', 'next_action', 'next_date'].forEach(function (k) {
    var el = $('pb-f-' + k); if (!el) return;
    el.oninput = function () { ACCT[k] = el.value; var p = {}; p[k] = el.value; queueSave(p); };
  });
  var touch = $('pb-touch');
  if (touch) touch.onclick = function () {
    api('/api/crm/playbook/accounts/' + ACCT.id + '/touch', { method: 'POST' })
      .then(function () { ACCT.last_touch = new Date().toISOString(); toast('Touched'); })
      .catch(function (e) { if (!(e && e.handled)) toast(e.message, true); });
  };
  var add = $('pb-note-add');
  if (add) add.onclick = function () {
    var body = $('pb-note').value.trim();
    if (!body) return;
    api('/api/crm/playbook/accounts/' + ACCT.id + '/notes', { method: 'POST', body: { body: body } })
      .then(function (r) {
        ACCT.notes = [r.note].concat(ACCT.notes || []);
        renderHero();
        var d = document.querySelector('.pb-hero details'); if (d) d.open = true;
        toast('Note added');
      })
      .catch(function (e) { if (!(e && e.handled)) toast(e.message, true); });
  };
}

function renderScreen() {
  if (TAB === 'calc') return screenCalc();
  if (TAB === 'say') return screenSay();
  return screenQual();
}

// ── screen 2 · the calculator ────────────────────────────────────────────────────────────────────
function screenCalc() {
  var inputs = CALC_FIELDS.map(function (f) {
    return '<div class="pb-f"><label for="pb-v-' + f[0] + '">' + f[1] + '</label>' +
      '<input class="pb-in num" id="pb-v-' + f[0] + '" data-k="' + f[0] + '" type="text" ' +
      'inputmode="decimal" value="' + esc(String(ACCT.volumes[f[0]])) + '"></div>';
  }).join('');
  $('pb-screen').innerHTML =
    '<div class="pb-calc">' +
      '<div class="pb-card"><h3>What they told you</h3><div class="pb-grid2">' + inputs + '</div></div>' +
      '<div class="pb-calc-out">' +
        '<dl class="pb-out" id="pb-outs"></dl>' +
        '<div id="pb-guards"></div>' +
        '<div class="pb-card" style="margin-top:14px"><h3>Scope fee</h3>' +
          '<div class="pb-fee"><div><b>' + eur0(SCOPE_FEE.quote) + '</b><span>quote this</span></div>' +
          '<div class="flr"><b>' + eur0(SCOPE_FEE.floor) + '</b><span>floor</span></div></div>' +
          '<p class="pb-floor-note">Quote the number that is uncomfortable, expect to be negotiated ' +
          'toward the floor, and never open at the floor.</p></div>' +
      '</div>' +
    '</div>';
  Array.prototype.forEach.call($('pb-screen').querySelectorAll('.pb-in.num'), function (el) {
    el.oninput = function () {
      var k = el.getAttribute('data-k');
      var n = parseFloat(String(el.value).replace(',', '.'));
      // an unparseable or negative keystroke leaves the STORED value alone rather than becoming
      // NaN — every output on the screen reads from this object at once
      if (isFinite(n) && n >= 0) { ACCT.volumes[k] = n; queueSave({ volumes: ACCT.volumes }); }
      paintOuts(); renderHero();
    };
  });
  paintOuts();
}

function paintOuts() {
  var o = calc(ACCT.volumes);
  var rows = [
    ['Costing them now', eur0(o.statusQuoYear) + ' / yr', 'big'],
    ['Monthly quote', eur0(o.monthlyQuote), 'big'],
    ['Floor', eur0(o.floor), 'muted'],
    ['Per order', eur2(Math.ceil(o.costPerOrder * 100) / 100), ''],
    ['Return', mult(o.returnMultiple), ''],
    ['Of their volume', pct(o.pctOfVolume), 'muted'],
    ['They save', eur0(o.customerSaving) + ' / yr', 'muted'],
  ];
  var outs = $('pb-outs'); if (!outs) return;
  outs.innerHTML = rows.map(function (r) {
    return '<div class="' + r[2] + '"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
  }).join('');

  var g = [];
  if (o.returnMultiple < 3) g.push('Hard to sell. Either the volumes are wrong or this account is too small.');
  if (o.costPerOrder > 1) g.push('Above a euro per order reads expensive. Check the volume figures.');
  g.push('Floor: do not go below without removing something from scope.');
  $('pb-guards').innerHTML = g.map(function (t, i) {
    return '<div class="pb-guard"' + (i === g.length - 1 ? ' style="background:transparent;color:var(--pb-faint);padding-left:0"' : '') + '>' + esc(t) + '</div>';
  }).join('');
}

// ── screen 3 · the talk track. Spanish, because it is spoken. ────────────────────────────────────
function sayBlocks() {
  var o = calc(ACCT.volumes), v = ACCT.volumes;
  return [
    { k: 'The number', lead: true, t:
      'Procesáis unos ' + num0(v.ordersPerDay) + ' pedidos al día. Entre horas de administración e ' +
      'incidencias, eso os está costando unos ' + eur0(o.statusQuoYear) + ' al año. Lo que propongo son ' +
      eur0(o.monthlyQuote) + ' al mes — menos de ' + eur2(Math.ceil(o.costPerOrder * 100) / 100) + ' por pedido.' },
    { k: 'Budget source', t: '¿De qué partida saldría esto?' },
    { k: 'Approval threshold', t: '¿Hasta qué importe puedes aprobar tú directamente, sin comité?' },
    { k: 'Budget cycle', t: '¿Cuándo cerráis el presupuesto del año que viene?' },
    { k: 'Pre-empt the internal review', t:
      'Lo normal es que me digáis que lo tenéis que ver internamente. ¿Qué necesitáis de mí para que ' +
      'esa conversación salga bien?' },
    { k: 'Next date', t: '¿Cuándo lo veis? Bloqueo el jueves para que me contéis.' },
  ];
}

var OBJECTIONS = [
  ['«Sois una persona»',
   'El número y la cuenta de Meta están a vuestro nombre desde el primer día, así que siguen ' +
   'funcionando pase lo que pase. Los datos salen enteros cuando los pidáis. Y si la empresa cesara ' +
   'sin venderse ni traspasarse, el código se transfiere: está en el contrato. Lo máximo que podéis ' +
   'perder es lo pagado del trimestre en curso.'],
  ['«Ya pagamos a Seidor»',
   'Hacen otro trabajo. Seidor lleva el ERP: lo que ya está dentro. Esto se ocupa de lo que llega ' +
   'antes del ERP — el WhatsApp, la nota de voz, el correo — y lo deja dentro en el formato que ' +
   'Seidor ya mantiene. Se suman, no se sustituyen.'],
  ['«Esto lo montamos nosotros»',
   'Construirlo hoy es barato y lo sabéis. Lo que cuesta es operarlo: quién responde a las seis de la ' +
   'mañana cuando un pedido se lee mal, quién lo corrige antes de que salga el camión y quién ' +
   'responde de ello. Eso es lo que estáis comprando.'],
  ['«Mándanos una propuesta»',
   'Os mando una página, y reservamos quince minutos para verla juntos. Una propuesta sin fecha ' +
   'detrás se queda en un correo sin abrir; con la fecha, la conversación existe.'],
  ['«Lo vemos internamente»',
   '¿Qué se va a discutir exactamente? ¿Quién estará en la sala? ¿Qué es lo más difícil de justificar? ' +
   'Con eso, el mismo día le mando por escrito a quien defiende esto lo que necesita para defenderlo.'],
];

function screenSay() {
  var blocks = sayBlocks();
  $('pb-screen').innerHTML =
    blocks.map(function (b, i) {
      return '<div class="pb-say' + (b.lead ? ' lead' : '') + '">' +
        '<div class="pb-say-k">' + esc(b.k) + '</div>' +
        '<div class="pb-say-t">' + esc(b.t) + '</div>' +
        '<button class="pb-btn small" data-say="' + i + '">Copy</button></div>';
    }).join('') +
    '<h3 style="margin:22px 0 10px;font-size:14px;color:var(--pb-mid)">When they push back</h3>' +
    OBJECTIONS.map(function (o) {
      return '<details class="pb-obj"><summary>' + esc(o[0]) + '</summary><p>' + esc(o[1]) + '</p></details>';
    }).join('');
  Array.prototype.forEach.call($('pb-screen').querySelectorAll('[data-say]'), function (b) {
    b.onclick = function () { copy(blocks[+b.getAttribute('data-say')].t, blocks[+b.getAttribute('data-say')].k); };
  });
}

// ── screen 4 · qualification + the mutual action plan ────────────────────────────────────────────
function screenQual() {
  var filled = MEDD.filter(function (m) { return (ACCT.meddpicc[m[0]] || '').trim(); }).length;
  $('pb-screen').innerHTML =
    '<div class="pb-card"><h3>Qualification · ' + filled + ' of 8</h3>' +
      '<div class="pb-bar"><i style="width:' + (filled / 8 * 100) + '%"></i></div>' +
      '<div id="pb-medd" style="margin-top:16px">' + MEDD.map(function (m) {
        var val = ACCT.meddpicc[m[0]] || '';
        return '<div class="pb-f"><div class="pb-q-label"><label for="pb-m-' + m[0] + '">' + m[1] + '</label>' +
          '<span class="pb-dot' + (val.trim() ? ' on' : '') + '"></span></div>' +
          '<textarea class="pb-in" id="pb-m-' + m[0] + '" data-k="' + m[0] + '" ' +
          'placeholder="' + esc(m[2]) + '">' + esc(val) + '</textarea></div>';
      }).join('') + '</div></div>' +
    '<div class="pb-card"><h3>Mutual action plan</h3><div id="pb-map"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="pb-btn small" id="pb-map-add">Add a row</button>' +
      '<button class="pb-btn small solid" id="pb-map-copy">Copy as text</button></div>' +
      '<p class="pb-floor-note">That export is what gets pasted into the email to them.</p></div>';

  Array.prototype.forEach.call($('pb-medd').querySelectorAll('textarea'), function (el) {
    el.oninput = function () {
      var k = el.getAttribute('data-k');
      ACCT.meddpicc[k] = el.value;
      queueSave({ meddpicc: ACCT.meddpicc });
      var dot = el.parentNode.querySelector('.pb-dot');
      if (dot) dot.className = 'pb-dot' + (el.value.trim() ? ' on' : '');
      var n = MEDD.filter(function (m) { return (ACCT.meddpicc[m[0]] || '').trim(); }).length;
      var h = $('pb-screen').querySelector('.pb-card > h3');
      if (h) h.textContent = 'Qualification · ' + n + ' of 8';
      var bar = $('pb-screen').querySelector('.pb-bar i');
      if (bar) bar.style.width = (n / 8 * 100) + '%';
    };
  });
  renderMap();
  $('pb-map-add').onclick = function () {
    ACCT.map_rows.push({ date: today(), who: '', what: '' });
    queueSave({ map_rows: ACCT.map_rows }); renderMap();
  };
  $('pb-map-copy').onclick = function () { copy(mapText(), 'Action plan'); };
}

function renderMap() {
  var box = $('pb-map');
  if (!ACCT.map_rows.length) {
    box.innerHTML = '<div class="pb-empty" style="padding:24px 0">Nothing agreed yet.</div>';
    return;
  }
  box.innerHTML = ACCT.map_rows.map(function (r, i) {
    return '<div class="pb-map-row">' +
      '<input class="pb-in" type="date" data-i="' + i + '" data-f="date" value="' + esc(r.date) + '">' +
      '<input class="pb-in" type="text" data-i="' + i + '" data-f="who" placeholder="Who" value="' + esc(r.who) + '">' +
      '<input class="pb-in" type="text" data-i="' + i + '" data-f="what" placeholder="What" value="' + esc(r.what) + '">' +
      '<button class="pb-map-del" data-del="' + i + '" aria-label="Remove row">' + IC.trash + '</button></div>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('input'), function (el) {
    el.oninput = function () {
      ACCT.map_rows[+el.getAttribute('data-i')][el.getAttribute('data-f')] = el.value;
      queueSave({ map_rows: ACCT.map_rows });
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (b) {
    b.onclick = function () {
      ACCT.map_rows.splice(+b.getAttribute('data-del'), 1);
      queueSave({ map_rows: ACCT.map_rows }); renderMap();
    };
  });
}

function mapText() {
  var lines = ['Plan de trabajo — ' + ACCT.name, ''];
  ACCT.map_rows.slice().sort(function (a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); })
    .forEach(function (r) {
      lines.push([r.date || 'sin fecha', r.who || '—', r.what || '—'].join('  ·  '));
    });
  return lines.join('\n');
}

// ── entry point (called by the shell, once the session is proven) ────────────────────────────────
window.__pbStart = function (me, sb) { ME = me; SB = sb; showList(); };
})();
