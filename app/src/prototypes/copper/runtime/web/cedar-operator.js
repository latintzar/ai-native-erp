'use strict';
const $ = id => document.getElementById(id);
let operatorToken = '';
let workspaces = [];
async function api(path, body) {
  const response = await fetch(path, {method: body === undefined ? 'GET' : 'POST', headers: {
    Authorization: `Bearer ${operatorToken}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})
  }, ...(body === undefined ? {} : {body: JSON.stringify(body)}), cache: 'no-store'});
  if (!response.ok) throw new Error('request_failed');
  return response.json();
}
function showState() {
  const item = workspaces.find(row => row.id === $('workspace').value);
  $('readiness').textContent = item ? `Sample workspace · ${item.request_count} requests · Prometeo ${item.readiness.prometeo.configured ? 'configured' : 'setup pending'} · Monitoring ${item.readiness.prometeo.monitor?.status || 'off'} · NubeFact ${item.readiness.nubefact.configured ? 'configured' : 'setup pending'}` : 'Create a collection request from Cedar to open its workspace here.';
}
async function refresh() {
  const chosen = $('workspace').value;
  await api('/api/config');
  workspaces = await api('/api/operator/workspaces');
  $('workspace').replaceChildren();
  workspaces.forEach(item => {const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.id} · ${item.request_count} requests`; $('workspace').append(option);});
  if (workspaces.some(item => item.id === chosen)) $('workspace').value = chosen;
  $('workspace-section').hidden = false;
  $('status').textContent = 'Connections loaded.';
  showState();
}
$('login').addEventListener('submit', async event => {event.preventDefault(); operatorToken = $('access').value; $('access').value = ''; try {await refresh();} catch {operatorToken = ''; $('status').textContent = 'Check operator access and try again.';}});
$('refresh').addEventListener('click', () => refresh().catch(() => {$('status').textContent = 'Reload connections and try again.';}));
$('workspace').addEventListener('change', showState);
$('provider').addEventListener('change', () => {$('invoice-fields').hidden = $('provider').value !== 'nubefact'; $('key').value = '';});
$('provider-form').addEventListener('submit', async event => {
  event.preventDefault(); const workspace = $('workspace').value; if (!workspace) {showState(); return;}
  const provider = $('provider').value;
  const credentials = provider === 'prometeo' ? {api_key: $('key').value} : {api_url: $('route').value, token: $('key').value, seller_ruc: $('ruc').value};
  try {await api(`/api/operator/workspaces/${encodeURIComponent(workspace)}/providers`, {provider, environment: $('environment').value, credentials}); $('key').value = ''; await refresh(); $('status').textContent = 'Provider configuration saved.';}
  catch {$('key').value = ''; $('status').textContent = 'Review the provider details, workspace binding and environment, then try again.';}
});
$('destination-form').addEventListener('submit', async event => {
  event.preventDefault(); const workspace = $('workspace').value; if (!workspace) {showState(); return;}
  const file = $('qr-file').files[0];
  if (!file || file.size > 131072 || !['image/png', 'image/jpeg'].includes(file.type)) {
    $('status').textContent = 'Choose a PNG or JPEG merchant QR up to 128 KB.'; return;
  }
  try {
    const qr = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject; reader.readAsDataURL(file);
    });
    await api(`/api/operator/workspaces/${encodeURIComponent(workspace)}/destination`, {
      method: $('wallet').value, account_number: $('receiving-number').value, currency: 'PEN',
      phone: $('receiving-phone').value, qr_base64: qr, account_ownership_confirmed: $('qr-ownership').checked,
      request_ids: $('real-request-ids').value.split(/\s+/).filter(Boolean), real_documents_confirmed: $('real-documents').checked
    });
    $('qr-file').value = ''; $('qr-ownership').checked = false; $('real-documents').checked = false;
    $('status').textContent = 'Seller payment destination saved for its selected receiving account.';
  } catch {$('status').textContent = 'Check the live account selection, QR image and existing destination binding.';}
});

$('monitor-form').addEventListener('submit', async event => {
  event.preventDefault(); const workspace = $('workspace').value; if (!workspace) {showState(); return;}
  try {
    await api(`/api/operator/workspaces/${encodeURIComponent(workspace)}/bank/monitor`, {
      enabled: $('monitor-enabled').value === 'true', interval_seconds: Number($('monitor-interval').value)
    });
    await refresh(); $('status').textContent = 'Bank monitoring settings saved.';
  } catch {$('status').textContent = 'Check the commissioned bank session, selected account and refresh interval.';}
});
