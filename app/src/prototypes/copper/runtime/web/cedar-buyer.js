/* THE CHECKOUT GOES THROUGH THE MOTIONS (FEED-IA §252).
 *
 * «can we just clone that and serve the links in our own demo domain as a new tab that goes
 *  through the motions? would make this all super more real»    — Peter, 14 September 2026
 *
 * The page polls its own balance the way it always did, and adds the approval-code act: nine
 * digits behind +51, six code boxes that a paste fills at once and the arrows walk, and one
 * `POST …/approve`. The working state is honest — the service really is being called — and the
 * card becomes the receipt on its answer. A payment recorded anywhere else reaches the same
 * receipt through the poll, so the merchant's own record and this page never disagree. */
'use strict';
const money = (value, currency = 'PEN') => new Intl.NumberFormat('es-PE', {style: 'currency', currency}).format(value / 100);
const $ = id => document.getElementById(id);
const base = location.pathname.replace(/\/$/, '');
const boxes = [...document.querySelectorAll('#code-boxes .box')];
const digits = value => (value || '').replace(/\D/g, '');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sourceLabel = {sample: 'Pago por Yape', manual: 'Registro del vendedor', prometeo: 'Confirmación bancaria'};
const methodLabel = {transfer: 'Transferencia', cash: 'Efectivo', yape: 'Yape', plin: 'Plin'};
let timer;
let request = null;
let timelineKey = '';
let settled = false;
let sending = false;

/* ── THE FORM ──────────────────────────────────────────────────────────────────────────────── */
const phoneDigits = () => digits($('phone').value).slice(0, 9);
const codeDigits = () => boxes.map(box => box.value).join('');
const ready = () => phoneDigits().length === 9 && codeDigits().length === 6;

function paint() {
  const amount = request ? request.amount_minor : 0;
  $('pay-label').textContent = amount > 0 ? `Yapear ${money(amount, request.currency)}` : 'Yapear';
  $('pay').disabled = sending || settled || !request || !request.approval_code || !request.quote_id || amount === 0 || !ready();
  boxes.forEach(box => box.setAttribute('data-filled', box.value ? 'yes' : 'no'));
}

function fillCode(value) {
  const typed = digits(value).slice(0, 6).split('');
  boxes.forEach((box, index) => { box.value = typed[index] || ''; });
  const next = boxes[Math.min(typed.length, boxes.length - 1)];
  next.focus();
  paint();
}

$('phone').addEventListener('input', () => {
  const value = phoneDigits();
  $('phone').value = [value.slice(0, 3), value.slice(3, 6), value.slice(6, 9)].filter(Boolean).join(' ');
  paint();
});

boxes.forEach((box, index) => {
  box.addEventListener('input', () => {
    const typed = digits(box.value);
    if (typed.length > 1) return fillCode(codeDigits().slice(0, index) + typed);
    box.value = typed;
    if (typed && index < boxes.length - 1) boxes[index + 1].focus();
    paint();
  });
  box.addEventListener('keydown', event => {
    // Backspace on an empty box walks back AND clears the box it lands on, so six presses empty six.
    if (event.key === 'Backspace' && !box.value && index > 0) { boxes[index - 1].value = ''; boxes[index - 1].focus(); paint(); event.preventDefault(); }
    if (event.key === 'ArrowLeft' && index > 0) { boxes[index - 1].focus(); event.preventDefault(); }
    if (event.key === 'ArrowRight' && index < boxes.length - 1) { boxes[index + 1].focus(); event.preventDefault(); }
  });
  box.addEventListener('paste', event => {
    const text = (event.clipboardData || window.clipboardData).getData('text');
    event.preventDefault();
    fillCode(codeDigits().slice(0, index) + text);
  });
  box.addEventListener('focus', () => box.select());
});

/* ── THE ACT ───────────────────────────────────────────────────────────────────────────────── */
const answer = {
  409: 'Confirma este pago desde tu aplicación Yape.',
  422: 'Revisa el celular y el código de aprobación.',
  429: 'Espera un momento y vuelve a intentarlo.',
};

$('approve-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || !ready() || $('pay').disabled) return;
  sending = true;
  let reloadQuote = false;
  $('approve-note').textContent = '';
  $('pay-label').hidden = true;
  $('pay-working').hidden = false;
  paint();
  try {
    const [response] = await Promise.all([
      fetch(base + '/approve', {
        method: 'POST', cache: 'no-store', credentials: 'omit',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({phone: phoneDigits(), code: codeDigits(), quote_id: request.quote_id}),
      }),
      wait(1200),
    ]);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // The amount changed: read the new quote and let the buyer confirm its exact value.
      $('approve-note').textContent = error.error === 'payment_quote_changed'
        ? 'El importe se ha actualizado. Revisa el total y confirma el pago.'
        : answer[response.status] || 'Vuelve a intentarlo en un momento.';
      reloadQuote = response.status === 409;
      return;
    }
    render(await response.json());
  } catch {
    $('approve-note').textContent = 'Revisa tu conexión y vuelve a intentarlo.';
  } finally {
    sending = false;
    $('pay-working').hidden = true;
    $('pay-label').hidden = false;
    paint();
    if (reloadQuote) await refresh();
  }
});

/* ── THE QR ROUTE ──────────────────────────────────────────────────────────────────────────── */
function openQr() {
  $('qr-panel').hidden = false;
  $('qr-open').setAttribute('aria-expanded', 'true');
  if (!$('merchant-qr').getAttribute('src')) $('merchant-qr').src = base + '/qr';
}
$('qr-open').addEventListener('click', () => {
  if ($('qr-panel').hidden) return openQr();
  $('qr-panel').hidden = true;
  $('qr-open').setAttribute('aria-expanded', 'false');
});


/* ── THE RECORD ────────────────────────────────────────────────────────────────────────────── */
function renderTimeline(rows) {
  const key = JSON.stringify(rows);
  if (timelineKey === key) return;
  timelineKey = key;
  $('timeline').replaceChildren();
  rows.forEach(row => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${sourceLabel[row.source] || 'Registro'} · ${methodLabel[row.method] || 'Transferencia'}${row.status === 'review' ? ' · En revisión' : ''}`;
    const amount = document.createElement('strong'); amount.textContent = money(row.amount_minor, row.currency);
    const date = document.createElement('time'); date.dateTime = row.effective_at || row.created_at;
    date.textContent = new Intl.DateTimeFormat('es-PE', {dateStyle: 'medium', timeStyle: 'short',timeZone:'America/Lima'}).format(new Date(row.effective_at || row.created_at));
    item.append(label, amount, date); $('timeline').append(item);
  });
  $('history-empty').hidden = rows.length > 0;
}

/* ── THE WHOLE CARD ────────────────────────────────────────────────────────────────────────── */
function render(value) {
  request = value;
  const destination = value.destination;
  const covered = value.balance_minor === 0;
  settled = covered;
  const received = value.invoice_amount_minor + (value.rounding_received_minor || 0);
  $('amount').textContent = money(covered ? received : value.amount_minor, value.currency);
  $('payment-verb').textContent = covered ? 'Pago recibido' : value.quote_status === 'ready' || value.approval_code ? 'Paga exactamente' : 'Paga con la referencia';
  const rounding = covered ? value.rounding_received_minor || 0 : value.rounding_minor || 0;
  $('rounding').hidden = rounding === 0;
  $('rounding').textContent = `Pedido: ${money(covered ? value.invoice_amount_minor : value.balance_minor, value.currency)} · Redondeo: ${money(rounding, value.currency)}`;
  $('order').textContent = `Pedido ${value.reference}`;
  $('reference').textContent = value.reference;
  $('seller').textContent = value.seller_name;
  $('for-order').textContent = `Pago para el pedido ${value.reference} · ${value.seller_name}`;
  $('account').textContent = `${value.receiving_bank.toUpperCase()} · ${value.account_label}${destination ? ' · ' + destination.account_mask : ''}`;
  $('ask').hidden = covered;
  $('receipt').hidden = !covered;
  if (covered) {
    const last = (value.timeline || []).filter(row=>row.status==='matched').slice(-1)[0];
    $('receipt-amount').textContent = money(received, value.currency);
    $('receipt-order').textContent = `Pedido ${value.reference}`;
    $('receipt-hour').textContent = last
      ? new Intl.DateTimeFormat('es-PE', {dateStyle: 'medium', timeStyle: 'short',timeZone:'America/Lima'}).format(new Date(last.effective_at || last.created_at)) : '';
  }
  $('qr-open').hidden = covered || !destination;
  if (destination) {
    $('payment-instruction').textContent = `Escanea el QR del vendedor desde ${destination.method === 'yape' ? 'Yape' : 'Plin'} y escribe el importe. El pago llega a su cuenta.`;
    $('phone-seller').textContent = destination.phone ? `Celular del vendedor: ${destination.phone}` : '';
    if (!value.approval_code && !covered) openQr();
  } else {
    $('qr-panel').hidden = true;
  }
  // A workspace whose own account is commissioned leaves the payment to the buyer's Yape app.
  if (!value.approval_code && !covered) $('approve-note').textContent = answer[409];
  if (value.quote_status === 'reference-required' && !value.approval_code && !covered) $('approve-note').textContent = `Usa la referencia ${value.reference} para pagar este importe.`;
  $('payment-status').textContent = covered
    ? value.confirmed_minor === value.invoice_amount_minor ? 'Pago confirmado por el banco.' : 'Saldo cubierto en los registros de esta solicitud.'
    : value.status === 'partial' ? 'Pago parcial registrado.' : 'Esperando el pago de este pedido.';
  $('evidence').textContent = `Pagos por Yape: ${money(value.sample_received_minor)} · Registros del vendedor: ${money(value.manual_received_minor)} · Confirmado por el banco: ${money(value.confirmed_received_minor)}`;
  renderTimeline(value.timeline || []);
  paint();
  if (covered && timer) { clearInterval(timer); timer = undefined; }
}

async function refresh() {
  if (sending) return;
  try {
    const response = await fetch(base + '/status', {cache: 'no-store', credentials: 'omit'});
    if (!response.ok) throw new Error('request_failed');
    render(await response.json());
  } catch { $('payment-status').textContent = 'Actualiza la página para consultar este pedido.'; }
}

void refresh(); timer = setInterval(refresh, 3000);
window.addEventListener('pagehide', () => clearInterval(timer));
