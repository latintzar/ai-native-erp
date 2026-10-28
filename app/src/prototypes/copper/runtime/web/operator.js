"use strict";

const byId = (id) => document.getElementById(id);
let operatorToken = "";
let configuration = null;
let sellers = [];
let requestAttempt = null;

const credentialLabels = {
  api_key: "API key", secret_key: "Secret key", merchant_id: "Associated merchant ID",
  payment_method: "Payment method ID", merchant_code: "Merchant code", hash_key: "Hash key",
  terms_url: "Merchant terms URL", access_token: "Access token", collector_id: "Collector ID",
  webhook_secret: "Webhook signing secret", public_key: "Public key", refresh_token: "Refresh token",
  expires_at: "Token expiry (Unix seconds)",
};
const phaseLabels = {
  draft: "Preparing", creating: "Creating checkout", ready: "Checkout ready",
  uncertain: "Provider confirmation pending", error: "Configuration review required",
};
const statusLabels = {
  pending: "Awaiting payment", paid: "Payment confirmed", failed: "Payment declined",
  cancelled: "Payment cancelled", refunded: "Payment reversed",
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options, cache: "no-store", credentials: "same-origin",
    headers: { "Authorization": `Bearer ${operatorToken}`, "Content-Type": "application/json",
      ...(options.headers || {}) },
  });
  if (!response.ok) {
    const error = new Error("request_failed");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function message(id, text) { byId(id).textContent = text; }
function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}
function money(minor, currency) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(minor / 100);
}
function credentialsForm() {
  const selected = configuration.providers[byId("provider").value];
  const fieldset = byId("credentials");
  const legend = document.createElement("legend");
  legend.textContent = "Provider credentials";
  fieldset.replaceChildren(legend);
  for (const name of [...selected.required, ...selected.optional]) {
    const label = document.createElement("label");
    label.textContent = `${credentialLabels[name] || name}${selected.optional.includes(name) ? " (optional)" : ""}`;
    const input = document.createElement("input");
    input.type = "password";
    input.name = name;
    input.autocomplete = "off";
    input.required = selected.required.includes(name);
    label.append(input);
    fieldset.append(label);
  }
  const registration = new URL(selected.registration);
  byId("provider-registration").href = registration.protocol === "https:" ? registration.href : "#";
  byId("oauth-section").hidden = !(configuration.oauth_configured && byId("provider").value === "mercadopago");
}
function sellerOptions() {
  const select = byId("request-seller");
  const previous = select.value;
  select.replaceChildren(option("", "Select a seller"));
  for (const seller of sellers) {
    select.append(option(seller.id, `${seller.name} · ${configuration.providers[seller.provider].label} · ${seller.environment}`));
  }
  if (sellers.some((seller) => seller.id === previous)) select.value = previous;
  else if (sellers.length === 1) select.value = sellers[0].id;
  byId("create-request").disabled = sellers.length === 0;
  updateCheckoutMode();
}
function updateCheckoutMode() {
  const seller = sellers.find((item) => item.id === byId("request-seller").value);
  const yapeOption = byId("checkout-mode").querySelector('option[value="yape"]');
  yapeOption.disabled = seller?.provider !== "mercadopago";
  if (yapeOption.disabled) byId("checkout-mode").value = "hosted";
  byId("address-details").hidden = seller?.provider !== "izipay";
  byId("address-details").open = seller?.provider === "izipay";
  byId("billing").required = seller?.provider === "izipay";
  byId("shipping").required = seller?.provider === "izipay";
}
function publicHref(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== new URL(configuration.origin).origin) {
    throw new Error("invalid_public_link");
  }
  return url.href;
}
function renderRequests(requests) {
  const body = byId("requests-body");
  body.replaceChildren();
  byId("requests-empty").hidden = requests.length > 0;
  byId("requests-table").hidden = requests.length === 0;
  for (const request of requests) {
    const seller = sellers.find((item) => item.id === request.seller_id);
    const row = document.createElement("tr");
    for (const value of [request.document_id, seller ? `${seller.name} · ${seller.environment}` : "Seller",
      money(request.amount_minor, request.currency), statusLabels[request.status] || "Review pending",
      phaseLabels[request.phase] || "Review pending"]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const actions = document.createElement("td");
    const link = document.createElement("a");
    link.href = publicHref(request.public_url);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open payment link";
    actions.append(link);
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "Refresh status";
    refresh.disabled = request.phase !== "ready";
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try {
        await api(`/api/requests/${encodeURIComponent(request.id)}/refresh`, { method: "POST" });
        await loadRecords();
        message("workspace-state", "Provider status refreshed.");
      } catch {
        message("workspace-state", "Provider confirmation pending. Review the connection and refresh again.");
        refresh.disabled = false;
      }
    });
    actions.append(refresh);
    if (request.last_error) {
      const evidence = document.createElement("small");
      evidence.textContent = "Provider verification needs review.";
      actions.append(evidence);
    }
    row.append(actions);
    body.append(row);
  }
}
async function loadRecords() {
  const [loadedSellers, requests] = await Promise.all([api("/api/sellers"), api("/api/requests")]);
  sellers = loadedSellers;
  sellerOptions();
  renderRequests(requests);
}

byId("access-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  operatorToken = byId("operator-token").value;
  byId("operator-token").value = "";
  try {
    configuration = await api("/api/config");
    byId("provider").replaceChildren(...Object.entries(configuration.providers)
      .map(([key, value]) => option(key, value.label)));
    byId("seller-environment").querySelector('option[value="live"]').disabled = !configuration.live_enabled;
    credentialsForm();
    await loadRecords();
    message("evidence", configuration.evidence);
    message("activation", configuration.live_enabled ? "Live connections enabled for this runtime." : "Sandbox runtime. Live activation requires commissioned credentials and runtime configuration.");
    byId("workspace").hidden = false;
    message("access-state", "Operator connected. The access token remains in this page’s memory.");
  } catch {
    operatorToken = "";
    byId("workspace").hidden = true;
    message("access-state", "Check the operator token and runtime connection, then connect again.");
  } finally { button.disabled = false; }
});
byId("provider").addEventListener("change", credentialsForm);
byId("request-seller").addEventListener("change", updateCheckoutMode);
byId("reload").addEventListener("click", async () => {
  try { await loadRecords(); message("workspace-state", "Sellers and requests refreshed."); }
  catch { message("workspace-state", "Reconnect operator access to refresh the records."); }
});
byId("seller-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const credentials = {};
  for (const input of byId("credentials").querySelectorAll("input")) {
    if (input.value) credentials[input.name] = input.value;
  }
  try {
    await api("/api/sellers", { method: "POST", body: JSON.stringify({
      name: byId("seller-name").value, provider: byId("provider").value,
      environment: byId("seller-environment").value, credentials,
    }) });
    for (const input of byId("credentials").querySelectorAll("input")) input.value = "";
    await loadRecords();
    message("seller-state", "Seller connection saved. A provider payment verifies the supplied credentials.");
  } catch { message("seller-state", "Check the seller fields, required credentials and environment, then save again."); }
  finally { button.disabled = false; }
});
byId("oauth-start").addEventListener("click", async (event) => {
  if (!byId("seller-name").reportValidity()) return;
  event.currentTarget.disabled = true;
  try {
    const result = await api("/api/oauth/mercadopago/start", { method: "POST", body: JSON.stringify({
      name: byId("seller-name").value, environment: byId("seller-environment").value,
    }) });
    const target = new URL(result.url);
    if (target.origin !== "https://auth.mercadopago.com") throw new Error("invalid_authorization_url");
    window.location.assign(target.href);
  } catch {
    message("seller-state", "Mercado Pago authorization needs the commissioned marketplace configuration.");
    byId("oauth-start").disabled = false;
  }
});
function addressObject(id) {
  const value = byId(id).value.trim();
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object"
      || Object.values(parsed).some((item) => typeof item !== "string")) throw new Error("address_fields");
  return parsed;
}
byId("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const amount = Number(byId("amount-minor").value);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 200000) throw new Error("amount");
    const payload = JSON.stringify({ seller_id: byId("request-seller").value,
      document_id: byId("document-id").value, description: byId("description").value,
      amount_minor: amount, currency: "PEN", payer_email: byId("payer-email").value,
      checkout_mode: byId("checkout-mode").value, billing: addressObject("billing"), shipping: addressObject("shipping"),
    });
    if (!requestAttempt || requestAttempt.payload !== payload) {
      requestAttempt = { payload, key: crypto.randomUUID() };
    }
    const result = await api("/api/requests", { method: "POST", body: payload,
      headers: { "Idempotency-Key": requestAttempt.key } });
    await loadRecords();
    requestAttempt = null;
    message("request-state", result.phase === "ready" ? "Payment link created. Open it from the request list."
      : "Request recorded. Provider setup or confirmation needs review; see its checkout state below.");
  } catch {
    message("request-state", "Review the form and refresh the request list. Retrying these same fields preserves the request attempt.");
  } finally { button.disabled = sellers.length === 0; }
});
