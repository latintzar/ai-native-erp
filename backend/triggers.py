"""triggers.py — TRIGGER VOCABULARY, one owner (de-workflow pass, 2026-07-22).

Every 'what fires what' pattern in the runtime lives HERE as data — the keyed-read families, the
heavy-intent aside hints, the order-shaped detector. Consumers (voice_protocol, voice_fabric, ...)
import; nobody defines a trigger inline. Promoting these to manifest rows (per-tenant overrides) is
the documented upgrade — same category, storage moves.
"""
import re

PRICE_Q = re.compile(r"\b(precio|cu[aá]nto\s+(cuesta|vale|es|sale)|a\s+cu[aá]nto|c[oó]mo\s+est[aá]\s+el)\b", re.I)

DEBT_Q = re.compile(r"\b(debo|deuda|cu[aá]nto\s+(debo|te\s+debo|le\s+debo|queda)|pendiente\s+de\s+pago|factura\s+pendiente|a\s+deber)\b", re.I)

STATUS_Q = re.compile(r"\b(pedido|mi\s+pedido|el\s+pedido|estado|va\s+mi|llega|env[ií]o|cuando\s+(llega|sale))\b", re.I)

ASIDE_HINTS = re.compile(
    r"\b(cursa|c[uú]rsalo|haz\s+el\s+pedido|conf[ií]rmalo|mand[ao]?\s+(el\s+)?correo|env[ií]a\s+(el\s+)?email|"
    r"habla\s+con|pregunta\s+a|que\s+lo\s+revise|cambio\s+de\s+precio|hazme\s+precio|dame\s+cr[eé]dito|fi[aá]melo)\b", re.I)

ORDERISH = re.compile(r"\b(pedido|ponme|p[oó]nme|m[áa]ndame|manda|quiero|tr[áa]eme|apunta|"
                       r"kilos?|kg|cajas?|bandejas?|unidades?|botes?|docenas?)\b", re.I)

