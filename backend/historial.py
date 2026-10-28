"""§17.21 — EL HISTORIAL: uploading a customer's past, landing as PROPOSALS, never writes.

Two of the three doors, the deterministic ones (the facturas door rides §17.6's LLM invoice
path and stays in that lane):

  · CSV de clientes  → customer-record proposals (name · phone · address). Accept upserts
    `customer_profiles` (tenant-keyed) — configuration, not memory.
  · Historial de WhatsApp (.txt «Exportar chat») → how this customer actually writes: the
    thread's honest stats, and CANDIDATE VOCABULARY — their frequent product words that the
    tenant's alias table does not know yet. Accepting one binds it to a catalogue SKU as an
    `sku_aliases` row (source='historial', phone-bound) — §17.6's tap, in bulk.

The §17.21 laws carried here:
  · Nothing writes memory into the customer's drawer. Proposals the supplier confirms become
    ASSIGNMENTS and RECORDS — the drawer fills in live conversation. Uploaded history informs
    what Rocoto is CONFIGURED to know, never fabricates what it REMEMBERS.
  · An unreadable line says so and never fails the batch (S4's rule): the CSV reports its
    skipped rows by number, the chat parser counts media/system lines out loud.
"""
from __future__ import annotations

import csv
import io
import logging
import re
import unicodedata
from collections import Counter

import db

log = logging.getLogger("rocoto.historial")


# ── the CSV door ─────────────────────────────────────────────────────────────────────────────
_PHONE_KEYS = ("telefono", "teléfono", "phone", "movil", "móvil", "whatsapp", "tel")
_NAME_KEYS = ("nombre", "name", "cliente", "razon social", "razón social", "negocio")
_ADDR_KEYS = ("direccion", "dirección", "address", "domicilio")


def _canon_phone(v: str) -> str:
    d = re.sub(r"\D", "", v or "")
    if len(d) == 9 and d[0] in "6789":       # a bare Spanish mobile/landline
        d = "34" + d
    return f"+{d}" if len(d) >= 9 else ""


def _pick(row: dict, keys: tuple) -> str:
    for k, v in row.items():
        if any(x in (k or "").strip().lower() for x in keys):
            return str(v or "").strip()
    return ""


async def csv_propose(tenant: str, text: str) -> dict:
    """Parse a customer-list CSV → proposals. NO writes. Delimiter sniffed; a row without a
    readable phone is reported by NUMBER and skipped, never a batch failure."""
    text = (text or "").strip()
    if not text:
        raise ValueError("El archivo llegó vacío.")
    try:
        dialect = csv.Sniffer().sniff(text[:2000], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ValueError("No he encontrado cabeceras — la primera fila debe nombrar las columnas.")
    proposals, skipped = [], []
    seen: set[str] = set()
    for i, row in enumerate(reader, start=2):        # row 1 is the header
        phone = _canon_phone(_pick(row, _PHONE_KEYS))
        name = _pick(row, _NAME_KEYS)
        if not phone:
            skipped.append(i)
            continue
        if phone in seen:
            skipped.append(i)
            continue
        seen.add(phone)
        proposals.append({"phone": phone, "name": name,
                          "address": _pick(row, _ADDR_KEYS)})
    if not proposals:
        raise ValueError("Ninguna fila traía un teléfono legible — sin teléfono no hay cliente.")
    known: set[str] = set()
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select phone_number from customer_profiles where tenant_id = $1 "
            "and phone_number = any($2::text[])", tenant, [p["phone"] for p in proposals])
        known = {r["phone_number"] for r in rows}
    for p in proposals:
        p["exists"] = p["phone"] in known
    return {"proposals": proposals, "skipped_rows": skipped}


async def csv_accept(tenant: str, rows: list[dict], actor: str) -> dict:
    """The confirmed records → customer_profiles upserts. Only the fields the CSV carried are
    touched; an existing profile keeps everything else it knows."""
    created = updated = 0
    async with db.get_pool().acquire() as con:
        for r in rows:
            phone = _canon_phone(str(r.get("phone") or ""))
            if not phone:
                continue
            name = str(r.get("name") or "").strip()
            address = str(r.get("address") or "").strip()
            # an upsert's command tag says INSERT either way — (xmax = 0) is the honest
            # inserted/updated split (R8: «Hecho: 1 nuevos» on a row that was an update)
            was_insert = await con.fetchval(
                "insert into customer_profiles(tenant_id, phone_number, display_name, address) "
                "values($1,$2,$3,$4) "
                "on conflict (tenant_id, phone_number) do update set "
                "  display_name = case when excluded.display_name <> '' then excluded.display_name "
                "                      else customer_profiles.display_name end, "
                "  address = case when excluded.address <> '' then excluded.address "
                "                 else customer_profiles.address end "
                "returning (xmax = 0)",
                tenant, phone, name, address)
            if was_insert:
                created += 1
            else:
                updated += 1
    return {"created": created, "updated": updated}


# ── the WhatsApp-export door ─────────────────────────────────────────────────────────────────
# WhatsApp's .txt is stable: «12/3/24, 9:41 - Nombre: cuerpo» (Android) or
# «[12/3/24, 9:41:07] Nombre: cuerpo» (iOS). Media/system lines are counted, not silently lost.
_LINE = re.compile(
    r"^\[?(?P<d>\d{1,2}/\d{1,2}/\d{2,4})[,\s]+(?P<t>\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*"
    r"(?P<who>[^:]{1,60}):\s(?P<body>.*)$")
_MEDIA = ("<multimedia omitido>", "<media omitted>", "imagen omitida", "audio omitido",
          "video omitido", "sticker omitido", "document omitted", "image omitted")

_STOP = set(["de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u", "a", "al", "del", "que", "en", "para", "por", "con", "sin", "kg", "kilo", "kilos", "caja", "cajas", "gramos", "g", "litro", "litros", "unidad", "unidades", "me", "te", "se", "lo", "le", "nos", "os", "buenas", "buenos", "dias", "días", "hola", "gracias", "porfa", "favor", "mañana", "hoy", "tarde", "noche", "quiero", "pon", "ponme", "manda", "mándame", "trae", "tráeme", "necesito", "quisiera", "hace", "falta", "como", "siempre", "lo", "mismo", "cuanto", "vale", "sale", "euros", "euro", "precio", "pedido", "apunta", "apúntame", "si", "no", "vale", "ok", "perfecto", "venga", "hasta", "luego", "adios", "adiós", "saludos", "jueves", "viernes", "sabado", "sábado", "lunes", "martes", "miercoles", "miércoles", "domingo", "semana"])


def _norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    return "".join(c for c in w if unicodedata.category(c) != "Mn")


def parse_chat(text: str) -> dict:
    """The deterministic read of an exported thread: messages by sender, media count, the
    body corpus of the CUSTOMER side (the non-business sender is whoever wrote most — the
    export is theirs; the caller shows both names and can flip)."""
    msgs: list[tuple[str, str]] = []
    media = 0
    system = 0
    for raw in (text or "").splitlines():
        m = _LINE.match(raw.strip())
        if not m:
            if raw.strip():
                system += 1          # continuation lines fold into noise counting, honestly
            continue
        body = m.group("body").strip()
        if any(x in body.lower() for x in _MEDIA):
            media += 1
            continue
        msgs.append((m.group("who").strip(), body))
    if not msgs:
        raise ValueError("Esto no parece un chat exportado de WhatsApp (.txt) — no leo mensajes.")
    by = Counter(w for w, _ in msgs)
    senders = [w for w, _ in by.most_common()]
    return {"messages": msgs, "media": media, "noise": system, "senders": senders}


async def chat_propose(tenant: str, phone: str, text: str, customer_sender: str = "") -> dict:
    """Thread stats + candidate vocabulary: the customer's frequent words that neither the
    alias table nor the catalogue knows. Each candidate is a WORD + its example lines — the
    supplier binds it to a SKU (or ignores it); nothing is guessed."""
    parsed = parse_chat(text)
    senders = parsed["senders"]
    who = customer_sender or (senders[0] if senders else "")
    corpus = [b for w, b in parsed["messages"] if w == who]

    # every alias + catalogue word the tenant already understands
    known: set[str] = set()
    async with db.get_pool().acquire() as con:
        for r in await con.fetch("select alias from sku_aliases where tenant_id=$1", tenant):
            known.update(_norm(w) for w in re.findall(r"[a-záéíóúñü]+", r["alias"].lower()))
        for r in await con.fetch(
                "select name from catalogue_skus where tenant_id=$1 and in_assortment", tenant):
            known.update(_norm(w) for w in re.findall(r"[a-záéíóúñü]+", r["name"].lower()))

    freq: Counter = Counter()
    examples: dict[str, list[str]] = {}
    for body in corpus:
        for w in re.findall(r"[a-záéíóúñü]{4,}", body.lower()):
            n = _norm(w)
            if n in _STOP or n in known:
                continue
            freq[n] += 1
            examples.setdefault(n, [])
            if len(examples[n]) < 2 and body not in examples[n]:
                examples[n].append(body[:110])
    candidates = [{"word": w, "times": c, "examples": examples.get(w, [])}
                  for w, c in freq.most_common(12) if c >= 2]
    return {
        "stats": {"messages": len(parsed["messages"]),
                  "from_customer": len(corpus),
                  "media_skipped": parsed["media"],
                  "unparsed_lines": parsed["noise"],
                  "senders": senders[:4], "customer_sender": who},
        "candidates": candidates,
    }


async def chat_accept(tenant: str, phone: str, links: list[dict], actor: str) -> dict:
    """The confirmed word→SKU bindings → sku_aliases rows (source='historial', phone-bound).
    A word bound to an unknown SKU is refused by name, never silently dropped."""
    wrote, refused = [], []
    async with db.get_pool().acquire() as con:
        for l in links:
            word = str(l.get("word") or "").strip().lower()
            sku = str(l.get("sku_id") or "").strip()
            if not word or not sku:
                continue
            ok = await con.fetchval(
                "select 1 from catalogue_skus where tenant_id=$1 and id=$2", tenant, sku)
            if not ok:
                refused.append(word)
                continue
            await con.execute(
                "insert into sku_aliases(tenant_id, alias, sku_id, phone_number, source) "
                "values($1,$2,$3,$4,'historial') on conflict do nothing",
                tenant, word, sku, phone)
            wrote.append(word)
    return {"linked": wrote, "refused": refused}
