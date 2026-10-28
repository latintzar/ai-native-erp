"use strict";

const byId = (id) => document.getElementById(id);
const paymentPath = window.location.pathname.replace(/\/$/, "");
let currentPayment = null;
let submitting = false;
let chargeSubmitted = false;
let chargeGeneration = 0;
let retryOutcomeConfirmed = false;
let pollTimer = null;
let closed = false;

const states = {
  pending: "Pago pendiente.", paid: "Pago confirmado. Tu documento está pagado.",
  failed: "Pago rechazado. Contacta al vendedor para continuar.",
  cancelled: "Pago cancelado. Contacta al vendedor para continuar.",
  refunded: "Pago revertido. Consulta los detalles con el vendedor.",
};

function retryableFailure(payment) {
  return payment?.provider === "mercadopago" && payment.checkout_mode === "yape"
    && payment.phase === "ready" && payment.charge_phase === "idle"
    && ["failed", "cancelled"].includes(payment.status);
}

function render(payment, authoritative = false) {
  // A POST failure response identifies the current attempt's outcome; the next
  // status read confirms that the server released its charge lock. An uncertain
  // POST keeps its latch, even if an older failure is still visible on the request.
  if (authoritative && retryableFailure(payment) && !submitting
      && (!chargeSubmitted || retryOutcomeConfirmed)) {
    chargeSubmitted = false;
    retryOutcomeConfirmed = false;
  }
  currentPayment = payment;
  byId("payment-title").textContent = "Detalles del pago";
  byId("seller-name").textContent = payment.seller_name;
  byId("document-id").textContent = payment.document_id;
  byId("description").textContent = payment.description;
  byId("amount").textContent = new Intl.NumberFormat("es-PE", {
    style: "currency", currency: payment.currency,
  }).format(payment.amount_minor / 100);
  byId("environment").textContent = payment.environment === "sandbox" ? "Pago de prueba" : "Pago real";
  const processing = chargeSubmitted || payment.charge_phase === "processing";
  let text = states[payment.status] || "Consultando la confirmación del pago.";
  if (["pending", "failed", "cancelled"].includes(payment.status)
      && (processing || payment.phase === "uncertain")) {
    text = "Estamos confirmando el pago con el proveedor. El estado se actualiza automáticamente.";
  } else if (retryableFailure(payment)) {
    text = payment.status === "failed" ? "Pago rechazado. Puedes intentarlo de nuevo con otro código de Yape."
      : "Pago cancelado. Puedes intentarlo de nuevo con otro código de Yape.";
  } else if (payment.phase === "creating" || payment.phase === "draft") {
    text = "Preparando el enlace de pago.";
  } else if (payment.phase === "error") {
    text = "El vendedor está preparando la conexión para este pago. Contacta con él para continuar.";
  }
  byId("payment-state").textContent = text;
  const available = payment.phase === "ready" && !processing
    && (payment.status === "pending" || retryableFailure(payment));
  byId("hosted-payment").hidden = !(available && payment.status === "pending" && payment.checkout_mode === "hosted");
  byId("hosted-payment").href = `${paymentPath}/continue`;
  byId("yape-form").hidden = !(available && payment.checkout_mode === "yape");
  byId("yape-submit").disabled = submitting;
  if (["paid", "refunded"].includes(payment.status)) {
    closed = true;
    clearTimeout(pollTimer);
    byId("payment-message").textContent = "";
  }
}
async function loadStatus() {
  const generation = chargeGeneration;
  try {
    const response = await fetch(`${paymentPath}/status`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("status_unavailable");
    const payment = await response.json();
    if (generation === chargeGeneration) render(payment, true);
  } catch {
    byId("payment-message").textContent = "Estamos consultando el pago. Revisa tu conexión para recibir la actualización.";
  } finally {
    if (!closed) pollTimer = setTimeout(loadStatus, 5000);
  }
}

byId("yape-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || chargeSubmitted || currentPayment?.phase !== "ready"
      || currentPayment.charge_phase === "processing"
      || !(currentPayment.status === "pending" || retryableFailure(currentPayment))) return;
  submitting = true;
  chargeGeneration += 1;
  retryOutcomeConfirmed = false;
  byId("yape-submit").disabled = true;
  byId("payment-message").textContent = "Preparando tu pago con Yape.";
  let token;
  try {
    if (!currentPayment.public_key || typeof window.MercadoPago !== "function") throw new Error("sdk_pending");
    const mp = new window.MercadoPago(currentPayment.public_key);
    const result = await mp.yape({ phoneNumber: byId("yape-phone").value,
      otp: byId("yape-otp").value }).create();
    if (!result || typeof result.id !== "string" || !result.id) throw new Error("token_pending");
    token = result.id;
  } catch {
    byId("payment-message").textContent = "Consulta un código de aprobación actualizado en Yape e inténtalo de nuevo.";
    submitting = false;
    byId("yape-submit").disabled = false;
    return;
  } finally {
    byId("yape-phone").value = "";
    byId("yape-otp").value = "";
  }
  chargeSubmitted = true;
  render(currentPayment);
  byId("payment-message").textContent = "Pago enviado. Estamos esperando la confirmación.";
  try {
    const response = await fetch(`${paymentPath}/yape`, { method: "POST", cache: "no-store",
      credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    token = undefined;
    if (!response.ok) throw new Error("payment_confirmation_pending");
    const result = await response.json();
    retryOutcomeConfirmed = ["failed", "cancelled"].includes(result.status);
    render({ ...currentPayment, status: result.status });
  } catch {
    byId("payment-message").textContent = "La confirmación sigue en curso. Este enlace mostrará el resultado del pago.";
  } finally {
    token = undefined;
    submitting = false;
  }
});
window.addEventListener("pagehide", () => { closed = true; clearTimeout(pollTimer); });
loadStatus();
