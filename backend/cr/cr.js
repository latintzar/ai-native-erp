/* Control Room SPA — WP-9. Login-gated (Supabase Google OAuth → server session cookie); everything is
   token-driven (cr.css on tokens.css). Read surfaces: profile card · typed event timeline · summaries
   expandable to source · Sherlock tabs → dossier drawer · app-grade chat. Preserves review/inbox/lab. */
(async function () {
'use strict';

// ── config (public: URL + anon ship in every client, by design) ──────────────────────────────────
var publicIdentity;
try {
  var configuration = await fetch('/api/config', {credentials:'same-origin'});
  publicIdentity = (await configuration.json()).identity || {};
} catch (_) { publicIdentity = {}; }
var SUPABASE_URL = publicIdentity.supabaseUrl || '';
var SUPABASE_ANON = publicIdentity.supabaseAnonKey || '';
if (!SUPABASE_URL || !SUPABASE_ANON) {
  document.getElementById('app').textContent = 'Configure your identity provider to sign in.';
  document.getElementById('app').removeAttribute('aria-busy');
  return;
}
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

// ── state ──────────────────────────────────────────────────────────────────────────────────────────
var ME = null;              // {email, role, caps, csrf}
var BOARD = null, DR = null, PT = [];
var tlFilter = 'all', tlThought = false, drillTab = 'timeline';

// ── tiny helpers ────────────────────────────────────────────────────────────────────────────────────
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return (s == null ? '' : String(s)).replace(/[<>&"]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]; }); }
function ago(iso) { if (!iso) return ''; var d = (Date.now() - new Date(iso)) / 1000; if (d < 0) return 'en ' + Math.round(-d / 3600) + 'h'; if (d < 60) return 'ahora'; if (d < 3600) return Math.floor(d / 60) + 'm'; if (d < 86400) return Math.floor(d / 3600) + 'h'; return Math.floor(d / 86400) + 'd'; }
function hhmm(iso) { try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function dayKey(iso) { try { var d = new Date(iso); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; } }
function toast(m, err) { var t = $('toast'); t.textContent = m; t.className = 'toast on' + (err ? ' err' : ''); setTimeout(function () { t.className = 'toast'; }, 2600); }
function initials(name) { return (name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase() || '?'; }
function jparse(p) { if (p && typeof p === 'object') return p; if (typeof p === 'string') { try { return JSON.parse(p); } catch (e) { return {}; } } return {}; }

// ── inline icons (12–18px, currentColor) ─────────────────────────────────────────────────────────────
var IC = {
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  webhook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  reasoning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z"/><path d="M9 22h6"/></svg>',
  action: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.4-1 1.8-2.5 2.5s-2.5 1.1-2.5 2.5a2.5 2 0 0 0 5 0"/></svg>',
  call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  gate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.7"/></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg>',
  lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v6l-5.2 9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9V3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
};

// ── event-kind classifier (typed timeline) ────────────────────────────────────────────────────────
function evKind(e) {
  var t = (e.type || '').toLowerCase(), src = (e.source || '').toLowerCase(), lane = (e.lane || '');
  if (lane === 'reasoning') return 'reasoning';
  if (/refund|stripe|invoice|paid|charge|payment|payout|money/.test(t) || src === 'stripe') return 'money';
  if (/call|voice/.test(t) || src === 'voice' || src === 'twilio_voice') return 'call';
  if (/gate|guard|blocked|needs_human|escalat/.test(t)) return 'gate';
  if (/timer|wake|fires|due/.test(t)) return 'timer';
  if (/message|msg|inbound|outbound|whatsapp/.test(t)) return 'message';
  if (src === 'medusa' || src === 'stripe' || /webhook|delivery|dispatch|order\.|sync/.test(t)) return 'webhook';
  return 'action';
}
function evText(e) { var p = jparse(e.payload); return e.text || p.text || (p.sentence) || e.type; }
function evMoney(e) { var p = jparse(e.payload); return !!(p.money || p.amount || evKind(e) === 'money'); }

// ── API layer (cookie session + CSRF on mutations; 401 → gate) ──────────────────────────────────────
function apiFetch(path, opts) {
  opts = opts || {};
  var h = { 'Content-Type': 'application/json' };
  var mutating = opts.method && opts.method !== 'GET';
  if (mutating && ME && ME.csrf) h['X-CSRF-Token'] = ME.csrf;
  if (opts.headers) for (var k in opts.headers) h[k] = opts.headers[k];
  return fetch(path, { method: opts.method || 'GET', credentials: 'include', headers: h, body: opts.body })
    .then(function (r) {
      if (r.status === 401) { ME = null; renderGate(); throw { handled: true }; }
      return r;
    });
}
function apiJSON(path, opts) { return apiFetch(path, opts).then(function (r) { return r.json(); }); }

// ── auth ────────────────────────────────────────────────────────────────────────────────────────────
function boot() {
  $('app').innerHTML = '<div class="empty">…</div>';
  sb.auth.getSession().then(function (res) {
    var session = res && res.data && res.data.session;
    if (session && session.access_token) {
      // just returned from Google OAuth — exchange the supabase token for a CR session cookie
      return fetch('/api/crm/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
      }).then(function (r) {
        // clean OAuth params from the URL either way
        try { history.replaceState({}, '', location.pathname); } catch (e) { }
        if (r.status === 403) return sb.auth.signOut().then(function () { renderGate('Esta cuenta no tiene acceso al Control Room.'); throw { handled: true }; });
        return null;
      });
    }
    return null;
  }).then(function () {
    return apiJSON('/api/crm/me');
  }).then(function (me) {
    if (me && me.ok) { ME = me; renderApp(); showBoard(); loadCounts(); }
    else renderGate();
  }).catch(function (e) { if (!(e && e.handled)) renderGate(); });
}
function loginWithGoogle() {
  $('gbtn').disabled = true;
  sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}
function logout() {
  apiFetch('/api/crm/logout', { method: 'POST' }).catch(function () { }).then(function () {
    return sb.auth.signOut().catch(function () { });
  }).then(function () { ME = null; renderGate(); });
}
window.__cr = { loginWithGoogle: loginWithGoogle, logout: logout };

function renderGate(err) {
  document.body.className = '';
  $('app').innerHTML =
    '<div class="gate"><div class="gate-card enter">' +
    '<div class="orb" style="width:44px;height:44px;margin:0 auto 12px;border-radius:999px;background:radial-gradient(circle at 34% 28%,var(--rocoto-hero-accent),var(--rocoto-saffron) 68%)"></div>' +
    '<h1>Control Room</h1><div class="sub">Acceso restringido · Rocoto</div>' +
    '<button class="gate-google" id="gbtn" onclick="__cr.loginWithGoogle()">' +
    '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.8h6c-.1 1-.8 2.5-2.3 3.5l3.3 2.6c2-1.8 3.1-4.5 3.1-7.9z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.3-2.6c-.9.6-2.1 1-4 1-3 0-5.6-2-6.5-4.8l-3.4 2.6C3.9 20.3 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.5 14c-.2-.6-.4-1.3-.4-2s.2-1.4.4-2L2.1 7.3C1.4 8.7 1 10.3 1 12s.4 3.3 1.1 4.7z"/><path fill="#EA4335" d="M12 5.4c1.7 0 2.8.7 3.5 1.3l2.9-2.8C16.5 2.3 14 1 12 1 7.6 1 3.9 3.7 2.1 7.3l3.4 2.6C6.4 7.3 9 5.4 12 5.4z"/></svg>' +
    'Entrar con Google</button>' +
    (err ? '<div class="gate-err">' + esc(err) + '</div>' : '') +
    '<div class="gate-foot">Sesión segura · solo propietarios/administradores</div>' +
    '</div></div>';
}

// ── app shell ────────────────────────────────────────────────────────────────────────────────────────
function nav(view) {
  return '<button class="nav-it" id="nb-' + view.id + '" onclick="__cr.go(\'' + view.id + '\')">' +
    '<span class="ico">' + IC[view.ic] + '</span>' + view.label +
    '<span class="badge" id="ct-' + view.id + '"></span></button>';
}
function renderApp() {
  document.body.className = '';
  var caps = (ME.caps || []).join(' ');
  $('app').innerHTML =
    '<div class="app"><nav class="rail">' +
    '<div class="brand"><div class="orb"></div><div><b>Rocoto</b><span>Control Room</span></div></div>' +
    nav({ id: 'board', ic: 'contacts', label: 'Contactos' }) +
    nav({ id: 'review', ic: 'review', label: 'Revisar' }) +
    nav({ id: 'inbox', ic: 'inbox', label: 'Rocoto te avisa' }) +
    nav({ id: 'lab', ic: 'lab', label: 'Laboratorio' }) +
    '<div class="rail-foot"><div class="rail-user"><div class="av">' + esc(initials(ME.email)) + '</div>' +
    '<div class="who"><b>' + esc(ME.email) + '</b><span>' + esc(ME.role) + '</span></div>' +
    '<button class="out" onclick="__cr.logout()">salir</button></div>' +
    '<span class="live"><i></i>en vivo</span> · el runtime real</div>' +
    '</nav><main class="main" id="main"></main></div>' +
    '<div class="drawer-scrim" id="dscrim" onclick="__cr.closeDrawer()"></div>' +
    '<div class="drawer" id="drawer"></div>' +
    '<div class="modal-scrim" id="mscrim"></div>';
  document.body.setAttribute('data-caps', caps);
}
function setNav(id) {
  ['board', 'review', 'inbox', 'lab'].forEach(function (v) { var b = $('nb-' + v); if (b) b.classList.toggle('on', v === id); });
}
window.__cr.go = function (id) {
  if (id === 'board') showBoard(); else if (id === 'review') showReview();
  else if (id === 'inbox') showInbox(); else if (id === 'lab') showLab();
};

function loadCounts() {
  apiJSON('/api/crm/room/alerts').then(function (d) { var e = $('ct-inbox'); if (e) { var n = (d.alerts || []).length; e.textContent = n || ''; e.className = 'badge' + (n ? ' hot' : ''); } }).catch(function () { });
  apiJSON('/api/review/list').then(function (d) { var e = $('ct-review'); if (e) { var n = ((d && d.items) || []).length; e.textContent = n || ''; } }).catch(function () { });
}

// ── BOARD ─────────────────────────────────────────────────────────────────────────────────────────
function showBoard() {
  setNav('board'); $('main').innerHTML = '<div class="empty">Cargando…</div>';
  apiJSON('/api/crm/room/board').then(function (d) {
    BOARD = d; var s = d.stats || {}, rows = d.contacts || [];
    $('ct-board') && ($('ct-board').textContent = rows.length || '');
    $('main').innerHTML =
      '<div class="head enter"><h1>Contactos</h1><span class="live"><i></i>en vivo</span>' +
      '<span class="spacer"></span><div class="stat-row">' +
      '<span><b class="num">' + (s.contacts || 0) + '</b> contactos</span>' +
      '<span><b class="num">' + (s.with_memory || 0) + '</b> con memoria</span>' +
      '<span><b class="num">' + (s.open_tabs || 0) + '</b> tabs abiertos</span>' +
      '<span><b class="num">' + (s.booked || 0) + '</b> agendados</span></div></div>' +
      '<div class="board enter"><table><thead><tr><th>Contacto</th><th>Estado</th><th>Memoria</th><th>Tabs</th><th></th></tr></thead><tbody>' +
      (rows.map(rowHtml).join('') || '<tr><td colspan="5" class="empty">Aún sin contactos.</td></tr>') +
      '</tbody></table></div>';
  }).catch(function (e) { if (!(e && e.handled)) $('main').innerHTML = '<div class="empty">No se pudo cargar.</div>'; });
}
function rowHtml(c) {
  var st = c.booked ? '<span class="pill ok">agendado</span>'
    : (c.took_demo ? '<span class="pill due">demo hecha</span>' : '<span class="pill info">' + esc(c.stage || 'prospecto') + '</span>');
  var mem = c.has_memory ? '<span class="pill ok">ficha viva</span>' : '<span class="sub">—</span>';
  var act = c.lead_id
    ? onbBtn(c.lead_id, c.name || c.phone, c.stage, true)
    : '<button class="btn sm" onclick="event.stopPropagation();__cr.call(\'' + (c.phone || '') + '\')"><span class="ico">' + IC.phone + '</span>Llamar</button>';
  return '<tr class="row" onclick="__cr.drill(\'' + c.scope + '\')"><td><div class="nm">' + esc(c.name || '(sin nombre)') + '</div><div class="sub">' + esc(c.business || c.phone || '') + '</div></td>' +
    '<td>' + st + '</td><td>' + mem + '</td><td>' + (c.open_tabs ? '<span class="pill tabs num">' + c.open_tabs + '</span>' : '<span class="sub">0</span>') + '</td>' +
    '<td style="text-align:right">' + act + '</td></tr>';
}

// ── DRILL: ficha · tabs(Sherlock) · segmented[timeline|chat|resúmenes|hechos] · children · override ──
window.__cr.drill = function (scope) {
  $('main').innerHTML = '<div class="empty">Cargando…</div>';
  apiJSON('/api/crm/room/drill?scope=' + encodeURIComponent(scope)).then(function (d) { DR = d; drillTab = 'timeline'; renderDrill(); })
    .catch(function (e) { if (!(e && e.handled)) $('main').innerHTML = '<div class="empty">No se pudo cargar.</div>'; });
};
function renderDrill() {
  var d = DR, p = d.person || {};
  var canAct = ME.caps.indexOf('act') >= 0;
  $('main').innerHTML =
    '<div class="crumbs"><button onclick="__cr.go(\'board\')">Contactos</button><span>›</span><span style="color:var(--rocoto-fg);font-weight:600">' + esc(p.name || d.scope) + '</span></div>' +
    '<div class="head"><h1>' + esc(p.name || d.scope) + '</h1>' + (p.business ? '<span class="sub">' + esc(p.business) + '</span>' : '') +
    (p.stage ? '<span class="pill info">' + esc(p.stage) + '</span>' : '') + '<span class="live"><i></i>en vivo</span>' +
    '<span class="spacer"></span>' +
    (p.lead_id && canAct ? onbBtn(p.lead_id, p.name || '', p.stage, false) : '') +
    (d.scope.indexOf('wa.') === 0 && canAct ? '<button class="btn sm" onclick="__cr.call(\'+' + d.scope.slice(3) + '\')"><span class="ico">' + IC.phone + '</span>Llamar</button>' : '') +
    '</div>' +
    '<div class="drill"><div class="col enter">' + fichaHtml(d, p) + tabsHtml(d) + '</div>' +
    '<div class="col enter-up"><div class="pane">' + segHtml() + '<div id="drill-panel">' + panelHtml() + '</div>' +
    (canAct ? '<div class="compose"><input class="field" id="ovr" placeholder="Escribir como Rocoto…" onkeydown="if(event.key===\'Enter\')__cr.override()"><button class="btn pri" onclick="__cr.override()"><span class="ico">' + IC.send + '</span>Enviar como Rocoto</button></div><div class="hint">se registra como <span class="mono">override.outbound</span> — la mente sabe que hablaste tú</div>' : '') +
    '</div></div></div>' +
    ((d.children || []).length ? '<div class="pane" style="margin-top:16px"><div class="h2">Sus clientes</div><div class="cust-grid">' + d.children.map(function (c) { return '<button class="cust" onclick="__cr.drill(\'' + c.scope + '\')"><b>' + esc(c.label || c.scope) + '</b><span>' + esc(c.tier || '') + '</span></button>'; }).join('') + '</div></div>' : '');
}
function fichaHtml(d, p) {
  var lines = (d.card || '').split('\n').filter(function (l) { return l.trim(); });
  var body = lines.map(function (l) {
    var m = l.split(/:(.+)/); // split on first colon
    if (m.length >= 2 && m[1] !== undefined) return '<div class="ficha-row"><span class="k">' + esc(m[0].trim()) + '</span><span class="v">' + esc(m[1].trim()) + '</span></div>';
    return '<div class="ficha-row"><span class="k">' + esc(l.trim()) + '</span></div>';
  }).join('') || '<div class="ficha-row"><span class="k">sin ficha todavía</span></div>';
  return '<div class="ficha"><div class="ficha-top"><div class="ficha-av">' + esc(initials(p.name || d.scope)) + '</div>' +
    '<div class="ficha-id"><b>' + esc(p.name || '(sin nombre)') + '</b><span>' + esc(p.business || (d.scope.indexOf('wa.') === 0 ? '+' + d.scope.slice(3) : d.scope)) + '</span></div></div>' +
    '<div class="ficha-body">' + body + '</div></div>';
}
function tabsHtml(d) {
  var tabs = d.tabs || [];
  if (!tabs.length) return '<div class="pane" style="margin-top:16px"><div class="h2">Tabs — casos abiertos</div><div class="sub">ningún asunto abierto</div></div>';
  var open = tabs.filter(function (t) { return (t.status || 'open') !== 'resolved'; });
  var done = tabs.filter(function (t) { return (t.status || 'open') === 'resolved'; });
  function card(t) {
    var resolved = (t.status || 'open') === 'resolved';
    var conts = (t.contingencies || []).map(function (c) { return '<div class="tab-cont"><span class="arrow">→</span> ' + esc(c.branch_id || '') + (c.action ? ': ' + esc((c.action.sentence || c.action.action || c.action)) : (c.trigger ? ': ' + esc(c.trigger) : '')) + '</div>'; }).join('');
    return '<div class="tab-c' + (resolved ? ' resolved' : '') + '" onclick="__cr.dossier(\'' + DR.scope + '\',' + t.id + ')">' +
      '<div class="tab-hd"><button class="tab-ico" onclick="event.stopPropagation();__cr.dossier(\'' + DR.scope + '\',' + t.id + ',1)" title="ver disparador y cierre">' + IC.eye + '</button>' +
      '<b>' + esc(t.text || t.kind) + '</b>' + (t.money ? '<span class="pill money">€</span>' : '') + '</div>' +
      '<div class="tab-meta">' + (resolved ? '<span class="pill ok">resuelto</span>' : '<span class="pill due">abierto</span>') + (t.due_at ? '<span class="pill info">vence ' + ago(t.due_at) + '</span>' : '') + '</div>' +
      conts + (t.timer ? '<div class="timer">reloj → ' + esc(new Date(t.timer).toLocaleString('es-ES')) + '</div>' : '') + '</div>';
  }
  return '<div class="pane" style="margin-top:16px"><div class="h2">Tabs — casos abiertos (Sherlock)</div>' +
    open.map(card).join('') + (done.length ? '<div style="margin-top:8px">' + done.map(card).join('') + '</div>' : '') + '</div>';
}
function segHtml() {
  var segs = [['timeline', 'Cronología'], ['chat', 'Chat'], ['summaries', 'Resúmenes'], ['facts', 'Hechos'], ['account', 'Cuenta y datos']];
  return '<div class="tl-controls" style="margin-bottom:14px">' + segs.map(function (s) { return '<button class="chip' + (drillTab === s[0] ? ' on' : '') + '" onclick="__cr.seg(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('') + '</div>';
}
window.__cr.seg = function (t) { drillTab = t; $('drill-panel').innerHTML = panelHtml(); if (t === 'account') loadAccount(); };
function panelHtml() {
  if (drillTab === 'chat') return chatHtml();
  if (drillTab === 'summaries') return summariesHtml();
  if (drillTab === 'facts') return factsHtml();
  if (drillTab === 'account') return '<div class="empty">Cargando…</div>';
  return timelineHtml();
}

// ── TIMELINE (typed, day-grouped, thought toggle, money flag) ───────────────────────────────────────
function timelineHtml() {
  var log = (DR.log || []).slice().sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
  var controls = '<div class="tl-controls">' +
    ['all', 'message', 'webhook', 'timer', 'money', 'action'].map(function (f) {
      var lbl = { all: 'todo', message: 'mensajes', webhook: 'webhooks', timer: 'timers', money: 'dinero', action: 'acciones' }[f];
      return '<button class="chip' + (tlFilter === f ? ' on' : '') + '" onclick="__cr.tlf(\'' + f + '\')">' + lbl + '</button>';
    }).join('') +
    '<button class="tog' + (tlThought ? ' on' : '') + '" onclick="__cr.tlth()"><span class="sw"></span> pensamiento</button></div>';
  var items = log.filter(function (e) {
    var k = evKind(e);
    if (k === 'reasoning') return tlThought;
    return tlFilter === 'all' || k === tlFilter;
  });
  if (!items.length) return controls + '<div class="empty">sin actividad' + (tlThought ? '' : ' — activa «pensamiento» para ver el razonamiento') + '</div>';
  var out = controls, lastDay = null, buf = '';
  items.forEach(function (e) {
    var dk = dayKey(e.ts);
    if (dk !== lastDay) { if (buf) out += '<div class="tl">' + buf + '</div>'; buf = ''; out += '<div class="tl-day">' + esc(dk) + '</div>'; lastDay = dk; }
    var k = evKind(e);
    buf += '<div class="ev k-' + k + '"><div class="ev-dot">' + (IC[k] || IC.action) + '</div>' +
      '<div class="ev-hd"><span class="ev-who">' + esc(e.source || k) + '</span>' +
      '<span class="ev-tag">' + esc(e.type) + '</span><span class="ev-when">' + hhmm(e.ts) + '</span>' +
      (evMoney(e) ? '<span class="ev-money-flag">€ dinero</span>' : '') + '</div>' +
      '<div class="ev-tx">' + esc(evText(e)) + '</div></div>';
  });
  if (buf) out += '<div class="tl">' + buf + '</div>';
  return out;
}
function bindTimeline() { }
window.__cr.tlf = function (f) { tlFilter = f; $('drill-panel').innerHTML = panelHtml(); };
window.__cr.tlth = function () { tlThought = !tlThought; $('drill-panel').innerHTML = panelHtml(); };

// ── CHAT (WhatsApp bubbles + call cards) ────────────────────────────────────────────────────────────
function chatHtml() {
  var msgs = DR.transcript || [], calls = DR.call_lines;
  var body = '';
  if (calls && calls.length) {
    body += '<div class="callcard"><div class="callcard-hd"><div class="ci">' + IC.call + '</div><b>Llamada de voz</b><span class="dur">' + calls.length + ' líneas</span></div>' +
      '<div class="callcard-tr">' + calls.map(function (l) { var sp = (l.role === 'user' || l.role === 'customer') ? 'Cliente' : 'Rocoto'; return '<div class="callcard-line"><span class="sp">' + esc(sp) + '</span><span>' + esc(l.text || l) + '</span></div>'; }).join('') + '</div></div>';
  }
  if (!msgs.length && !body) return '<div class="empty">sin conversación todavía</div>';
  var lastDay = null;
  msgs.forEach(function (m) {
    var dk = dayKey(m.ts);
    if (dk !== lastDay) { body += '<div class="day-sep"><span>' + esc(dk) + '</span></div>'; lastDay = dk; }
    var out = (m.role !== 'user' && m.role !== 'customer');
    var vn = (m.message_type === 'audio' || m.type === 'audio' || m.transcript);
    var inner;
    if (vn && m.transcript) {
      inner = '<div class="kindtag">🎤 Nota de voz</div><div class="vn"><div class="play">▶</div><div class="wave">' + Array.from({ length: 22 }, function (_, i) { return '<i style="height:' + (30 + (i * 37 % 60)) + '%"></i>'; }).join('') + '</div></div><div class="vn-tx">' + esc(m.transcript) + '</div>';
    } else {
      inner = esc(m.text || m.message_text || '');
    }
    body += '<div class="msg ' + (out ? 'out' : 'in') + '"><div class="bub' + (vn ? ' media' : '') + '">' + inner +
      '<div class="meta">' + hhmm(m.ts) + (out ? ' <span class="tick">✓✓</span>' : '') + '</div></div></div>';
  });
  return '<div class="chat">' + body + '</div>';
}

// ── SUMMARIES (expandable → source events) ──────────────────────────────────────────────────────────
function summariesHtml() {
  var sums = DR.summaries || [];
  if (!sums.length) return '<div class="empty">se generan cada noche</div>';
  return sums.map(function (s, i) {
    return '<div class="sum" id="sum-' + i + '"><div class="sum-hd" onclick="__cr.sumToggle(' + i + ',' + (s.id || 0) + ')"><span class="caret">' + IC.caret + '</span>Resumen<span class="date">' + esc(new Date(s.ts).toLocaleDateString('es-ES')) + '</span></div>' +
      '<div class="sum-tx">' + esc(s.text) + '</div>' +
      '<div class="sum-src" id="sumsrc-' + i + '"><div class="src-lbl">de qué se destiló</div><div class="empty" style="padding:8px">…</div></div></div>';
  }).join('');
}
window.__cr.sumToggle = function (i, id) {
  var el = $('sum-' + i); if (!el) return;
  var open = el.classList.toggle('open');
  if (open && id && !el.__loaded) {
    el.__loaded = true;
    apiJSON('/api/crm/room/summary-sources?scope=' + encodeURIComponent(DR.scope) + '&id=' + id).then(function (d) {
      var box = $('sumsrc-' + i);
      if (!d || !d.ok) { box.innerHTML = '<div class="src-lbl">de qué se destiló</div><div class="sub">no disponible</div>'; return; }
      var evs = d.events || [];
      box.innerHTML = '<div class="src-lbl">de qué se destiló · ' + evs.length + ' eventos</div>' +
        (evs.length ? '<div class="tl">' + evs.map(function (e) { var k = evKind(e); return '<div class="ev k-' + k + '"><div class="ev-dot">' + (IC[k] || IC.action) + '</div><div class="ev-hd"><span class="ev-who">' + esc(e.source || k) + '</span><span class="ev-when">' + hhmm(e.ts) + '</span></div><div class="ev-tx">' + esc(evText(e)) + '</div></div>'; }).join('') + '</div>' : '<div class="sub">sin eventos ligados</div>');
    }).catch(function () { });
  }
};

// ── FACTS ────────────────────────────────────────────────────────────────────────────────────────────
function factsHtml() {
  var facts = DR.facts || [];
  if (!facts.length) return '<div class="empty">aún sin hechos</div>';
  return facts.map(function (f) {
    return '<div class="fact ' + esc(f.kind || '') + (f.dead ? ' dead' : '') + '"><div class="tx">' + esc(f.text) + '</div><div class="meta">' + esc(f.kind || '') + (f.key ? ' · ' + esc(f.key) : '') + (f.dead ? ' · invalidado' : '') + '</div></div>';
  }).join('');
}

// ── SHERLOCK DOSSIER drawer ──────────────────────────────────────────────────────────────────────────
window.__cr.dossier = function (scope, tabId, briefOnly) {
  openDrawer('<div class="empty">Cargando…</div>');
  apiJSON('/api/crm/room/tab?scope=' + encodeURIComponent(scope) + '&tab_id=' + tabId).then(function (d) {
    if (!d || !d.ok) { openDrawer('<div class="drawer-hd"><h1>Dossier</h1><button class="drawer-x" onclick="__cr.closeDrawer()">' + IC.close + '</button></div><div class="drawer-bd"><div class="empty">no encontrado</div></div>'); return; }
    openDrawer(dossierHtml(d, briefOnly));
  }).catch(function () { });
};
function evLine(e, label) {
  if (!e) return '<div class="trace"><span class="lbl">' + label + '</span><span class="sub">—</span></div>';
  var k = evKind(e);
  return '<div class="trace"><span class="lbl">' + label + '</span><div><div class="ev-hd"><span class="ev-who" style="color:var(--kc,var(--rocoto-fg))">' + esc(e.source || k) + '</span><span class="ev-tag">' + esc(e.type) + '</span><span class="ev-when">' + hhmm(e.ts) + '</span></div><div class="ev-tx">' + esc(evText(e)) + '</div></div></div>';
}
function dossierHtml(d, briefOnly) {
  var t = d.tab || {};
  var head = '<div class="drawer-hd"><div class="ev-dot k-' + evKind({ type: t.kind || '', payload: {} }) + '" style="position:static">' + IC.gate + '</div><h1>' + esc(t.text || t.kind || 'Caso') + '</h1><button class="drawer-x" onclick="__cr.closeDrawer()">' + IC.close + '</button></div>';
  var trigger = '<div class="dossier-sec"><div class="h2">Disparador y cierre</div>' + evLine(d.opened_by, 'abrió') + evLine(d.closed_by, 'cerró') + '</div>';
  var status = '<div class="dossier-sec"><div class="h2">Estado</div><div class="tab-meta">' +
    ((t.status === 'resolved') ? '<span class="pill ok">resuelto</span>' : '<span class="pill due">abierto</span>') +
    (t.money ? '<span class="pill money">€ dinero</span>' : '') +
    (t.entity_key ? '<span class="pill info">' + esc(t.entity_key) + '</span>' : '') +
    (t.answer_shape ? '<span class="pill info">espera: ' + esc(t.answer_shape) + '</span>' : '') + '</div>' +
    (t.opened_at ? '<div class="sub" style="margin-top:6px">abierto ' + ago(t.opened_at) + (t.resolved_at ? ' · resuelto ' + ago(t.resolved_at) : '') + '</div>' : '') + '</div>';
  if (briefOnly) return head + '<div class="drawer-bd">' + status + trigger + '</div>';
  var scen = (d.scenarios || []).map(function (c) {
    return '<div class="scenario"><div class="br">' + esc(c.branch_id || 'rama') + (c.gated ? '<span class="gated">requiere OK</span>' : '') + '</div>' +
      (c.trigger ? '<div class="ln"><span class="lbl">si</span>' + esc(c.trigger) + '</div>' : '') +
      (c.action ? '<div class="ln"><span class="lbl">haz</span>' + esc(c.action.sentence || c.action.action || c.action) + '</div>' : '') +
      (c.prediction ? '<div class="ln"><span class="lbl">predice</span>' + esc(c.prediction) + '</div>' : '') + '</div>';
  }).join('') || '<div class="sub">sin escenarios</div>';
  var timers = (d.timers || []).map(function (tm) { return '<div class="ln"><span class="lbl">' + esc(tm.state || '') + '</span>' + esc(new Date(tm.fires_at).toLocaleString('es-ES')) + '</div>'; }).join('') || '<div class="sub">sin relojes</div>';
  var caseEv = (d.case || []).map(function (e) { var k = evKind(e); return '<div class="ev k-' + k + '"><div class="ev-dot">' + (IC[k] || IC.action) + '</div><div class="ev-hd"><span class="ev-who">' + esc(e.source || k) + '</span><span class="ev-tag">' + esc(e.type) + '</span><span class="ev-when">' + hhmm(e.ts) + '</span></div><div class="ev-tx">' + esc(evText(e)) + '</div></div>'; }).join('') || '<div class="sub">sin eventos ligados</div>';
  return head + '<div class="drawer-bd">' + status + trigger +
    '<div class="dossier-sec"><div class="h2">Escenarios (contingencias)</div>' + scen + '</div>' +
    '<div class="dossier-sec"><div class="h2">Relojes</div>' + timers + '</div>' +
    '<div class="dossier-sec"><div class="h2">El caso — todo lo ligado</div><div class="tl">' + caseEv + '</div></div></div>';
}
function openDrawer(html) { $('drawer').innerHTML = html; $('drawer').classList.add('on'); $('dscrim').classList.add('on'); }
window.__cr.closeDrawer = function () { $('drawer').classList.remove('on'); $('dscrim').classList.remove('on'); };

// ── actions ──────────────────────────────────────────────────────────────────────────────────────────
window.__cr.override = function () {
  var i = $('ovr'); if (!i || !i.value.trim()) return; var t = i.value; i.value = '';
  apiJSON('/api/crm/room/override', { method: 'POST', body: JSON.stringify({ scope: DR.scope, text: t }) })
    .then(function (j) { toast(j && j.ok ? 'Enviado como Rocoto' : 'No se pudo enviar', !(j && j.ok)); __cr.drill(DR.scope); }).catch(function () { });
};
// ── ONBOARDING — the door Peter opens. «Enviar onboarding» POSTs /api/crm/room/onboard, which is the
//    CRM mark-done flow: mint the wizard token → email the personalised link → flip the lead to
//    wizard_sent. From that moment the app lets that person in, so the button is never a silent
//    re-mint: it READS the lead's stage and, once sent, says so and offers a typed-confirm re-send.
var ONB_SENT = { wizard_sent: 1, waitlisted: 1 };
function onbSent(stage) { return !!ONB_SENT[String(stage || '').toLowerCase()]; }
function onbBtn(leadId, name, stage, stopProp) {
  if (!leadId) return '';
  var st = String(stage || '').toLowerCase();
  var call = (stopProp ? 'event.stopPropagation();' : '') +
    '__cr.onboard(\'' + leadId + '\',\'' + esc(name || '') + '\',\'' + esc(st) + '\')';
  if (st === 'waitlisted')
    return '<span class="pill ok">onboarding hecho</span> <button class="btn ghost sm" onclick="' + call + '">Reenviar</button>';
  if (onbSent(st))
    return '<span class="pill info">enviado</span> <button class="btn ghost sm" onclick="' + call + '">Reenviar</button>';
  return '<button class="btn pri sm" onclick="' + call + '">Enviar onboarding</button>';
}
function onbRefresh() { if (document.querySelector('.drill') && DR && DR.scope) __cr.drill(DR.scope); else showBoard(); }
window.__cr.onboard = function (id, nm, stage) {
  if (!id) return;
  var again = onbSent(stage), who = nm || 'este contacto';
  var go = function () {
    toast(again ? 'Reenviando onboarding…' : 'Enviando onboarding…');
    apiJSON('/api/crm/room/onboard', { method: 'POST', body: JSON.stringify({ lead_id: id }) })
      .then(function (j) {
        var good = !!(j && j.ok);
        toast(good ? (again ? 'Onboarding reenviado' : 'Onboarding enviado') + (nm ? ' a ' + nm : '') : 'No se pudo', !good);
        if (good) onbRefresh();
      }).catch(function () { });
  };
  if (again) {
    confirmModal({
      title: 'Reenviar el onboarding',
      body: 'A ' + who + ' ya se le envió. Se genera un enlace NUEVO y se le vuelve a mandar por correo; el anterior sigue funcionando.',
      word: 'reenviar', cta: 'Reenviar', onOk: go,
    });
  } else {
    confirmSimple({
      title: 'Enviar el onboarding',
      body: 'Le mandamos a ' + who + ' su enlace personalizado por correo y, desde ese momento, la app le deja entrar a montar su catálogo.',
      cta: 'Enviar', onOk: go,
    });
  }
};
window.__cr.call = function (ph) {
  if (!ph) return; toast('Llamando a ' + ph + '…');
  apiJSON('/api/crm/room/call', { method: 'POST', body: JSON.stringify({ phone: ph }) })
    .then(function (j) { toast(j && j.ok ? '📞 Sonando' : 'No se pudo llamar', !(j && j.ok)); }).catch(function () { });
};

// ── CONTROL surfaces: account · refund · GDPR (typed-confirm modal) ─────────────────────────────────
function confirmModal(o) {
  var m = $('mscrim');
  m.innerHTML = '<div class="modal"><h3>' + esc(o.title) + '</h3><p>' + esc(o.body || '') + '</p>' +
    (o.warn ? '<div class="warn">' + esc(o.warn) + '</div>' : '') +
    '<input class="field" id="cfw" placeholder="escribe ' + esc(o.word) + ' para confirmar" autocomplete="off" autocorrect="off" spellcheck="false">' +
    '<div class="modal-acts"><button class="btn ghost" onclick="__cr.closeModal()">Cancelar</button>' +
    '<button class="btn ' + (o.danger ? 'danger' : 'pri') + '" id="cfok" disabled>' + esc(o.cta || 'Confirmar') + '</button></div></div>';
  m.classList.add('on');
  var inp = $('cfw'), ok = $('cfok');
  inp.oninput = function () { ok.disabled = inp.value.trim() !== o.word; };
  inp.onkeydown = function (e) { if (e.key === 'Enter' && !ok.disabled) ok.click(); };
  ok.onclick = function () { __cr.closeModal(); o.onOk(); };
  setTimeout(function () { inp.focus(); }, 60);
}
// Same modal, no typed word — for a routine, reversible action (sending a link) where making Peter
// type a word at 6am is friction, not safety. The typed confirmModal stays for anything that re-mints,
// refunds or erases.
function confirmSimple(o) {
  var m = $('mscrim');
  m.innerHTML = '<div class="modal"><h3>' + esc(o.title) + '</h3><p>' + esc(o.body || '') + '</p>' +
    (o.warn ? '<div class="warn">' + esc(o.warn) + '</div>' : '') +
    '<div class="modal-acts"><button class="btn ghost" onclick="__cr.closeModal()">Cancelar</button>' +
    '<button class="btn ' + (o.danger ? 'danger' : 'pri') + '" id="cfok">' + esc(o.cta || 'Confirmar') + '</button></div></div>';
  m.classList.add('on');
  var ok = $('cfok');
  ok.onclick = function () { __cr.closeModal(); o.onOk(); };
  setTimeout(function () { ok.focus(); }, 60);
}
window.__cr.closeModal = function () { var m = $('mscrim'); m.classList.remove('on'); m.innerHTML = ''; };

function loadAccount() {
  $('drill-panel').innerHTML = '<div class="empty">Cargando…</div>';
  apiJSON('/api/crm/room/account?scope=' + encodeURIComponent(DR.scope))
    .then(function (a) { $('drill-panel').innerHTML = (a && a.ok) ? accountHtml(a) : '<div class="empty">no disponible</div>'; })
    .catch(function () { });
}
function accountHtml(a) {
  var canAct = ME.caps.indexOf('act') >= 0, canAdmin = ME.caps.indexOf('admin') >= 0;
  var rows = [['Número del cliente', a.contact_number || '—'],
    ['Número Rocoto (pool compartido)', a.rocoto_number || '—'],
    ['Plan', a.plan || '—'], ['Tier', a.tier || '—'], ['Etapa', a.stage || '—'], ['Estado', a.status || '—']];
  var card = '<div class="ficha"><div class="ficha-top"><div class="ficha-av">' + esc(initials(a.name)) + '</div>' +
    '<div class="ficha-id"><b>' + esc(a.name || '(sin nombre)') + '</b><span>' + esc(a.business || a.email || '') + '</span></div></div>' +
    '<div class="ficha-body">' + rows.map(function (r) { return '<div class="ficha-row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>'; }).join('') +
    (a.onboarded_unpaid ? '<div class="ficha-row"><span class="k">Onboarded sin pagar</span><span class="v"><span class="pill due">sí</span></span></div>' : '') + '</div></div>';
  var pays = (a.payments || []).map(function (p) {
    var refunded = p.refunded_amount ? '<span class="pill ok">reembolsado ' + (p.refunded_amount / 100).toFixed(2) + '€</span>' : '';
    var btn = (canAct && p.payment_intent && !p.refunded_amount) ? '<button class="btn danger sm" onclick="__cr.refund()">Reembolsar</button>' : '';
    return '<div class="pane" style="margin-top:8px;display:flex;align-items:center;gap:10px"><span class="pill money">€ ' + esc(p.kind) + '</span>' +
      '<div style="flex:1;min-width:0"><div class="mono" style="font-size:11px;color:var(--rocoto-faint);overflow:hidden;text-overflow:ellipsis">' + esc(p.payment_intent || p.invoice || '') + '</div>' +
      '<div class="sub">' + (p.paid_at ? ago(p.paid_at) : '') + '</div></div>' + refunded + btn + '</div>';
  }).join('') || '<div class="sub">sin pagos reembolsables</div>';
  var gdpr = '<div class="pane" style="margin-top:16px"><div class="h2">Datos (GDPR)</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="__cr.exportData()">Exportar JSON</button>' +
    (canAct ? '<button class="btn sm" onclick="__cr.anonymize()">Anonimizar</button>' : '') +
    (canAdmin ? '<button class="btn danger sm" onclick="__cr.erase()">Borrar (irreversible)</button>' : '') + '</div>' +
    '<div class="hint">exportar y anonimizar quedan auditados; borrar es irreversible y solo lo puede el propietario.</div></div>';
  return card + numerosHtml(a, canAct) + '<div class="pane" style="margin-top:16px"><div class="h2">Pagos</div>' + pays + '</div>' + gdpr;
}
// ── WP-2 Números y activación: button-or-reason from the account payload's READINESS block ─────────
function numerosHtml(a, canAct) {
  var rd = a.readiness;
  if (!rd) return '';
  var rows = '<div class="ficha-row"><span class="k">Número propio</span><span class="v">' + esc(rd.number || '—') + '</span></div>' +
    '<div class="ficha-row"><span class="k">Espacio</span><span class="v mono">' + esc(rd.tenant || '—') + '</span></div>' +
    '<div class="ficha-row"><span class="k">Pago de alta</span><span class="v">' + (rd.paid_at ? '<span class="pill ok">pagado</span>' : '<span class="pill due">pendiente</span>') + '</span></div>' +
    '<div class="ficha-row"><span class="k">Catálogo</span><span class="v">' + (rd.has_catalogue ? '<span class="pill ok">cargado</span>' : (rd.wizard_skus ? '<span class="pill info">' + rd.wizard_skus + ' productos en el wizard</span>' : '<span class="pill due">sin catálogo</span>')) + '</span></div>';
  var act;
  if (rd.active) {
    act = '<div style="margin-top:10px"><span class="pill ok">activo</span>' + (rd.golive_at ? '<span class="sub" style="margin-left:8px">en vivo desde hace ' + ago(rd.golive_at) + '</span>' : '') + '</div>';
  } else {
    var hard = (rd.blocking || []).filter(function (b) { return b.reason !== 'no_number'; });
    if (hard.length) {
      act = hard.map(function (b) { return '<div class="hint" style="margin-top:8px">⛔ ' + esc(b.message || b.reason) + '</div>'; }).join('');
    } else if (canAct) {
      act = '<div class="compose" style="border:none;padding:0;margin-top:10px"><input class="field" id="glnum" placeholder="+34…" value="' + esc(rd.number || '') + '" autocomplete="off">' +
        '<button class="btn pri" onclick="__cr.golive()">Activar</button></div>' +
        '<div class="hint">carga el catálogo, vincula el número, activa el espacio y envía la bienvenida — una sola vez</div>';
    } else {
      act = '<div class="hint" style="margin-top:8px">solo lectura</div>';
    }
  }
  return '<div class="pane" style="margin-top:16px"><div class="h2">Números y activación</div><div class="ficha-body" style="padding:0 0 6px">' + rows + '</div>' + act + '</div>';
}
window.__cr.golive = function () {
  var i = $('glnum'), num = i ? i.value.trim() : '';
  toast('Activando…');
  apiJSON('/api/crm/room/golive', { method: 'POST', body: JSON.stringify({ scope: DR.scope, number: num }) })
    .then(function (j) {
      if (j && j.ok) toast(j.already_live ? 'Ya estaba en vivo' : 'Activado — bienvenida enviada');
      else toast((j && (j.message || j.error)) || 'No se pudo activar', true);
      loadAccount();
    }).catch(function (e) { if (!(e && e.handled)) toast('No se pudo activar', true); });
};
window.__cr.refund = function () {
  confirmModal({ title: 'Reembolsar el pago', body: 'Se reembolsará en Stripe el cargo de la cuota de alta de este cliente. Queda auditado.', warn: 'Esto mueve dinero real.', word: 'REFUND', cta: 'Reembolsar', danger: true, onOk: function () {
    apiJSON('/api/crm/room/refund', { method: 'POST', body: JSON.stringify({ scope: DR.scope, confirm: 'REFUND' }) })
      .then(function (j) { toast(j && j.ok ? 'Reembolsado' : ('No se pudo: ' + ((j && j.error) || 'error')), !(j && j.ok)); loadAccount(); }).catch(function () { }); } });
};
window.__cr.exportData = function () {
  apiFetch('/api/crm/room/data/export?scope=' + encodeURIComponent(DR.scope)).then(function (r) { return r.json(); }).then(function (j) {
    var blob = new Blob([JSON.stringify(j.data || j, null, 2)], { type: 'application/json' });
    var u = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = u; a.download = 'rocoto-datos-' + DR.scope + '.json'; a.click(); URL.revokeObjectURL(u); toast('Exportado'); }).catch(function () { });
};
window.__cr.anonymize = function () {
  confirmModal({ title: 'Anonimizar', body: 'Se sustituirá la información personal por seudónimos irreversibles, conservando un registro anónimo.', word: 'ANONYMIZE', cta: 'Anonimizar', danger: true, onOk: function () {
    apiJSON('/api/crm/room/data/anonymize', { method: 'POST', body: JSON.stringify({ scope: DR.scope, confirm: 'ANONYMIZE' }) })
      .then(function (j) { toast(j && j.ok ? 'Anonimizado' : 'No se pudo', !(j && j.ok)); loadAccount(); }).catch(function () { }); } });
};
window.__cr.erase = function () {
  confirmModal({ title: 'Borrar todos los datos', body: 'Se eliminarán de forma permanente TODOS los datos de este sujeto (memoria, conversación, pagos). No se puede deshacer.', warn: 'Irreversible · solo propietario.', word: 'ERASE', cta: 'Borrar', danger: true, onOk: function () {
    apiJSON('/api/crm/room/data/erase', { method: 'POST', body: JSON.stringify({ scope: DR.scope, confirm: 'ERASE' }) })
      .then(function (j) { toast(j && j.ok ? 'Datos borrados' : ('No se pudo: ' + ((j && j.error) || 'error')), !(j && j.ok)); if (j && j.ok) __cr.go('board'); }).catch(function () { }); } });
};

// ── REVISAR ──────────────────────────────────────────────────────────────────────────────────────────
function showReview() {
  setNav('review'); $('main').innerHTML = '<div class="head"><h1>Revisar</h1><span class="live"><i></i>cola de aprobaciones</span></div><div id="rev"><div class="empty">Cargando…</div></div>';
  apiJSON('/api/review/list').then(function (j) {
    var items = (j && j.items) || []; $('ct-review') && ($('ct-review').textContent = items.length || '');
    if (!items.length) { $('rev').innerHTML = '<div class="empty">✅ Nada pendiente. Rocoto no necesita nada tuyo ahora.</div>'; return; }
    var canAct = ME.caps.indexOf('act') >= 0;
    $('rev').innerHTML = '<div class="stagger" style="max-width:640px">' + items.map(function (it) {
      var pl = it.payload || {}, draft = esc(pl.draft || pl.sentence || '');
      return '<div class="pane" id="rev-' + it.id + '" style="margin-top:12px"><div class="head" style="margin-bottom:6px"><b>' + esc(it.kind || 'acción') + (it.money ? ' 💶' : '') + '</b><span class="spacer"></span><span class="sub">' + ago(it.created_at) + '</span></div>' +
        '<div style="font-size:14px;margin-bottom:6px">' + esc(it.reason || '') + '</div>' +
        (draft ? '<div class="fact" style="border-left-color:var(--rocoto-saffron)">“' + draft + '”</div>' : '') +
        '<div class="sub" style="margin-bottom:10px">' + esc((it.party || '').slice(0, 90)) + '</div>' +
        (canAct ? '<div style="display:flex;gap:8px"><button class="btn pri" onclick="__cr.review(' + it.id + ',\'approve\',this)">Aprobar</button><button class="btn ghost" onclick="__cr.review(' + it.id + ',\'reject\',this)">Rechazar</button></div>' : '<div class="sub">solo lectura</div>') +
        '</div>';
    }).join('') + '</div>';
  }).catch(function (e) { if (!(e && e.handled)) $('rev').innerHTML = '<div class="empty">No se pudo cargar.</div>'; });
}
window.__cr.review = function (id, decision, btn) {
  var card = $('rev-' + id); if (card) card.style.opacity = .5; if (btn) btn.disabled = true;
  apiJSON('/api/review/' + decision, { method: 'POST', body: JSON.stringify({ action_id: id }) })
    .then(function (j) {
      if (j && (j.ok || j.decision)) { toast(decision === 'approve' ? 'Aprobado' : 'Rechazado'); if (card) card.remove(); loadCounts(); }
      else { toast('No se pudo', true); if (card) card.style.opacity = 1; if (btn) btn.disabled = false; }
    }).catch(function () { if (card) card.style.opacity = 1; });
};

// ── ROCOTO TE AVISA (inbox) ──────────────────────────────────────────────────────────────────────────
function showInbox() {
  setNav('inbox'); $('main').innerHTML = '<div class="head"><h1>Rocoto te avisa</h1><span class="live"><i></i>lo que Rocoto quiere que veas</span></div><div id="inbox"><div class="empty">Cargando…</div></div>';
  apiJSON('/api/crm/room/alerts').then(function (d) {
    var A = d.alerts || [];
    $('inbox').innerHTML = A.length ? '<div class="stagger">' + A.map(function (a) {
      return '<div class="pane" style="margin-top:10px;display:flex;align-items:center;gap:12px"><span class="pill info">' + esc(a.kind || '') + '</span><div style="flex:1">' + esc(a.detail || '') + '</div><span class="sub">' + esc(ago(a.ts)) + '</span>' +
        (a.scope ? '<button class="btn sm" onclick="__cr.drill(\'' + esc(a.scope) + '\')">ver →</button>' : '') +
        '<button class="btn ghost sm" onclick="__cr.resolveAlert(' + a.id + ',this)">hecho</button></div>';
    }).join('') + '</div>' : '<div class="empty">Nada pendiente — Rocoto no necesita nada de ti ahora.</div>';
  }).catch(function (e) { if (!(e && e.handled)) $('inbox').innerHTML = '<div class="empty">No se pudo cargar.</div>'; });
}
window.__cr.resolveAlert = function (id, btn) {
  if (btn) btn.disabled = true;
  apiJSON('/api/crm/room/alerts/resolve', { method: 'POST', body: JSON.stringify({ id: id }) })
    .then(function () { if (btn) btn.closest('.pane').style.opacity = .4; loadCounts(); }).catch(function () { });
};

// ── LABORATORIO (persona console + test world) ──────────────────────────────────────────────────────
function showLab() {
  setNav('lab');
  $('main').innerHTML = '<div class="head"><h1>Laboratorio de pruebas</h1></div>' +
    '<div class="pane" style="border-left:4px solid var(--rocoto-info);margin-bottom:16px"><b style="color:var(--rocoto-info)">Tinta azul</b> — todo aquí es lineage=test: llega al runtime REAL con números/emails falsos, sin tocar a nadie real.</div>' +
    '<div class="pane"><div class="h2">Consola de personas — háblale a Rocoto como un cliente falso</div><div id="pconv" style="min-height:60px;margin-bottom:10px"></div>' +
    '<div class="compose" style="border:none;padding:0"><input class="field" id="pin" placeholder="Escribe como el cliente… («llámame», «quiero empezar»)" onkeydown="if(event.key===\'Enter\')__cr.pSend()"><button class="btn pri" onclick="__cr.pSend()">Enviar</button></div>' +
    '<div class="hint">llega a la MISMA mente agéntica que usa en vivo — abre tabs, decide acciones — pero no sale nada de verdad</div></div>' +
    '<div class="pane"><div class="h2">Crear un mundo de prueba desde una frase</div><div class="compose" style="border:none;padding:0"><input class="field" id="tw" placeholder="un supplier con 4 restaurantes, 2 morosos, 3 meses de historia…"><button class="btn pri" onclick="__cr.mkWorld()">Generar</button></div></div>';
  PT = []; paintP();
}
function paintP() { var el = $('pconv'); if (!el) return; el.innerHTML = PT.map(function (m) { return m.loading ? '<div class="msg in"><div class="bub" style="opacity:.6">Rocoto está pensando…</div></div>' : '<div class="msg ' + (m.me ? 'out' : 'in') + '"><div class="bub">' + esc(m.t) + (m.acts && m.acts.length ? '<div class="meta" style="justify-content:flex-start;color:var(--rocoto-saffron-text)">acciones: ' + esc(m.acts.join(', ')) + '</div>' : '') + '</div></div>'; }).join(''); }
window.__cr.pSend = function () {
  var i = $('pin'); if (!i || !i.value.trim()) return; var t = i.value; i.value = '';
  PT.push({ me: 1, t: t }); PT.push({ loading: 1 }); paintP();
  apiJSON('/api/crm/room/persona', { method: 'POST', body: JSON.stringify({ phone: '+34699000001', text: t }) })
    .then(function (j) { PT.pop(); if (j && j.ok) PT.push({ me: 0, t: j.reply, acts: (j.actions || []).map(function (a) { return Object.keys(a)[0]; }) }); else PT.push({ me: 0, t: '(error)' }); paintP(); })
    .catch(function () { PT.pop(); paintP(); });
};
window.__cr.mkWorld = function () {
  var i = $('tw'); if (!i || !i.value.trim()) return; toast('Generando mundo…');
  apiJSON('/api/crm/room/test-world', { method: 'POST', body: JSON.stringify({ sentence: i.value }) })
    .then(function (j) { toast(j && j.ok ? 'Mundo creado: ' + j.scope + ' (' + j.customers + ' clientes)' : 'No se pudo', !(j && j.ok)); }).catch(function () { });
};

// ── go ────────────────────────────────────────────────────────────────────────────────────────────────
boot();
})();
