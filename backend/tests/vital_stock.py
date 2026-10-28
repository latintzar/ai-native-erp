"""vital_stock.py — «NO HAY STOCK» IS A REASON, NOT A SCREEN (SPEC §5.8a row 3 · §5.8 LOW_STOCK).

`StockCaptureScreen` shipped before the levels did. §5.8 names LOW_STOCK as one of exactly three
things that may put an order in front of the comercial — so until a level is STORED, and stored
HONESTLY, that source cannot fire. Each check is a product promise:

  S1  THE CORRECTION LOOP        — capture → WHAT ROCOTO READ → correction → APPLY → the level. The
                                   read is recorded BEFORE any level moves; applying is what writes.
  S2  A CORRECTION IS REMEMBERED — `corrected` records that the boss had to fix the reading, and the
                                   corrected numbers REPLACE the stored ones: what was applied and
                                   what is on file must be the same numbers or the trail lies.
  S3  APPLYING IS IDEMPOTENT     — a second «Guardar» writes nothing and says so.
  S4  ONE REASON, NAMING ONE ITEM— «no te queda suficiente PALETA COCIDA (quedan 4 kg, te piden 12)».
                                   Three short lines produce ONE sentence, never a list (§5.8a).
  S5  INVENTORY OFF → NEVER SHORT— OFF by default per tenant (`tenants.inventory_enabled`). A
                                   distributor who never counts a shelf must never see an order held.
  S6  NO LEVEL → NEVER SHORT     — a SKU we have never counted tells us nothing. Silence, not a guess.
  S7  NO GUESSED CONVERSIONS     — 12 «cajas» against 40 «kg» needs a pack factor and a decision; a
                                   reason built on a guessed unit is one we cannot defend.
  S8  THE LOW THRESHOLD IS DATA  — `low_at` per SKU; unset is SEEDED once from the count itself
                                   (LOW_AT_FRACTION), and an explicit threshold survives every recount.
  S9  THE FENCE IS A RULE        — one tenant can never apply a capture onto another's shelf: it
                                   RAISES. Fail-soft on the read, never on the rule.

AND THE READING ITSELF (added 2026-07-27, when it turned out there wasn't one — `/api/stock/capture`
took `read` as an INPUT and the server never looked at the photo or listened to the note):

  S10 A SPOKEN NOTE IS A CAPTURE — no photo at all, and the read still comes back with quantities AND
                                   units. The operator can simply say what came off the lorry.
  S11 A READ NEVER INVENTS A SKU — a name the catalogue does not have goes to `unmatched`, carrying
                                   the words that were actually used, and NEVER into `read`. Same law
                                   as the order brain: abstain, do not guess.
  S12 THE SPOKEN NOTE WINS       — a man standing at the pallet beats a photograph of it. On conflict
                                   the voice's number is the read's number, the photo's is kept as
                                   provenance, and the line says `foto+voz`.
  S13 IT FAILS HONESTLY          — no model, a refused image, a read that runs long ⇒ an EMPTY read
                                   with a plain es-ES note. Never a fabricated line, never a raise.
  S14 THE CORRECTION IS SACRED   — a client-supplied `read` is honoured verbatim and no model runs.
                                   Empty counts as absent (the shipped Android client always sends []).
  S15 EVERY LINE SAYS WHERE IT   — DESIGN-CANON's provenance law: the operator cannot correct a number
      CAME FROM                    he cannot trace. `source` is foto | voz | foto+voz, per line.

S4–S8 and S10–S15's logic is PURE — no database, and the model is STUBBED at the three seams
(`_vision_text` · `_extract_lines` · `_ground`) so a vital is never flaky because a provider was busy.
The LIVE proof that Rocoto can actually read a pallet is not a unit test and does not belong here.
S1–S3, S9 and the round-trips need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_stock.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_stock.py
"""
import asyncio
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from brain import stock  # noqa: E402

# The model seams (`_vision_text` · `_extract_lines` · `_ground`) are STUBBED for the pure half, so a
# vital is never flaky because a provider was busy. The db half must run against the REAL matcher —
# "it is matchable immediately" is a claim about production, and a stub cannot make it. Captured here,
# before the first `_install()`, and restored at the top of `_db_checks`.
_REAL_GROUND = stock._ground

R = []
SKIPPED = []
TENANT = "vitalstock"          # invented; never a real company (LOCKED LAW)
OTHER = "vitalstock-otro"      # the second distributor the fence is proved against
FOREIGN = "vs-otro-jamon"      # a sku belonging to OTHER, used to prove an override cannot smuggle
PALETA, POLLO, LOMO = "vs-paleta", "vs-pollo", "vs-lomo"


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


def _lvl(sku, qty, unit="kg", name="", low_at=None):
    return {"sku_id": sku, "qty": qty, "unit": unit, "name": name, "low_at": low_at}


LEVELS = {PALETA: _lvl(PALETA, 4, "kg", "PALETA COCIDA"),
          POLLO:  _lvl(POLLO, 30, "kg", "POLLO ENTERO"),
          LOMO:   _lvl(LOMO, 1, "kg", "LOMO ADOBADO")}


# ══ S4 · one reason, naming one item ═════════════════════════════════════════════════════════════
v = stock.verdict([{"sku_id": PALETA, "qty": 12, "unit": "kg", "name": "PALETA COCIDA"}],
                  LEVELS, inventory_enabled=True)
ck("S4 the spec's sentence, verbatim",
   v["reason"] == "no te queda suficiente PALETA COCIDA (quedan 4 kg, te piden 12)", v["reason"])
ck("S4 a short order is NOT ok", v["ok"] is False and len(v["short"]) == 1)

v3 = stock.verdict([{"sku_id": PALETA, "qty": 12, "unit": "kg", "name": "PALETA COCIDA"},
                    {"sku_id": LOMO, "qty": 20, "unit": "kg", "name": "LOMO ADOBADO"},
                    {"sku_id": POLLO, "qty": 40, "unit": "kg", "name": "POLLO ENTERO"}],
                   LEVELS, inventory_enabled=True)
ck("S4 three short lines produce exactly ONE reason (§5.8a: never a list)",
   isinstance(v3["reason"], str) and "\n" not in v3["reason"] and ";" not in v3["reason"]
   and v3["reason"].count("no te queda") == 1, v3["reason"])
ck("S4 the ONE named is the least COVERED, not the biggest number "
   "(kilos and units are not comparable; coverage is)",
   "LOMO ADOBADO" in v3["reason"], v3["reason"])
ck("S4 the short list still carries all three for the app, while the REASON stays one",
   len(v3["short"]) == 3)
ck("S4 quantities read in Spanish (comma decimal, no trailing zeros)",
   stock.short_reason({"name": "X", "have": 4.5, "want": 12.0, "unit": "kg"})
   == "no te queda suficiente X (quedan 4,5 kg, te piden 12)")
ck("S4 enough stock says nothing at all",
   stock.verdict([{"sku_id": POLLO, "qty": 10, "unit": "kg"}], LEVELS,
                 inventory_enabled=True) == {"ok": True, "short": [], "reason": "",
                                             "inventory": True})
ck("S4 exactly enough is enough (≥, not >)",
   stock.verdict([{"sku_id": PALETA, "qty": 4, "unit": "kg"}], LEVELS,
                 inventory_enabled=True)["ok"] is True)

# ══ S5 · inventory OFF → never short ═════════════════════════════════════════════════════════════
off = stock.verdict([{"sku_id": PALETA, "qty": 999, "unit": "kg"}], LEVELS, inventory_enabled=False)
ck("S5 inventory OFF → ok, no reason, and the levels are not even consulted",
   off == {"ok": True, "short": [], "reason": "", "inventory": False})

# ══ S6 · no level row → never short ══════════════════════════════════════════════════════════════
ck("S6 a SKU with no level row can never be short (we have never counted it)",
   stock.verdict([{"sku_id": "vs-never-counted", "qty": 999, "unit": "kg"}], LEVELS,
                 inventory_enabled=True)["ok"] is True)
ck("S6 an ungrounded line (no sku at all) can never be short",
   stock.verdict([{"mention": "unas cositas", "qty": 999}], LEVELS,
                 inventory_enabled=True)["ok"] is True)
ck("S6 an EMPTY levels table holds nothing, ever",
   stock.verdict([{"sku_id": PALETA, "qty": 999, "unit": "kg"}], {},
                 inventory_enabled=True)["ok"] is True)
ck("S6 a line with no quantity is not a shortage",
   stock.verdict([{"sku_id": PALETA, "qty": None, "unit": "kg"}], LEVELS,
                 inventory_enabled=True)["ok"] is True)

# ══ S7 · no guessed conversions ══════════════════════════════════════════════════════════════════
ck("S7 12 «cajas» against a level counted in «kg» is NOT a shortage — silence, never a guess",
   stock.verdict([{"sku_id": PALETA, "qty": 12, "unit": "caja"}], LEVELS,
                 inventory_enabled=True)["ok"] is True)
ck("S7 …but a line with no stated unit trusts the level's own unit",
   stock.verdict([{"sku_id": PALETA, "qty": 12}], LEVELS, inventory_enabled=True)["ok"] is False)

# ══ S8 · the low threshold is DATA ═══════════════════════════════════════════════════════════════
ck("S8 low_at set and reached → low", stock.is_low(_lvl(PALETA, 4, low_at=5)) is True)
ck("S8 low_at set and comfortable → not low", stock.is_low(_lvl(PALETA, 40, low_at=5)) is False)
ck("S8 no low_at → never low (we invent no threshold the boss never gave)",
   stock.is_low(_lvl(PALETA, 0.5)) is False)
ck(f"S8 the seed is {stock.LOW_AT_FRACTION:.0%} of the count itself, not an absolute number "
   "(5 is nothing in kilos of patata and a fortnight in corderos)",
   stock.seed_low_at(20) == 5.0 and stock.seed_low_at(0) is None)
ck("S8 a freshly counted shelf is never already low",
   stock.is_low(_lvl(PALETA, 20, low_at=stock.seed_low_at(20))) is False)

# ══ S2 (pure half) · what counts as a CORRECTION ═════════════════════════════════════════════════
_read = [{"sku_id": PALETA, "qty": 4, "unit": "kg", "name": "paleta cocida"}]
ck("S2 changing the quantity IS a correction",
   stock._read_key(_read) != stock._read_key([{**_read[0], "qty": 12}]))
ck("S2 changing the SKU IS a correction",
   stock._read_key(_read) != stock._read_key([{**_read[0], "sku_id": POLLO}]))
ck("S2 changing the unit IS a correction",
   stock._read_key(_read) != stock._read_key([{**_read[0], "unit": "ud"}]))
ck("S2 retyping the NAME is not a correction — the numbers are what a level stands on",
   stock._read_key(_read) == stock._read_key([{**_read[0], "name": "PALETA COCIDA"}]))


# ══ S10–S15 · THE READING, with the model stubbed at its three seams ═════════════════════════════
# A vital may never depend on a provider being up, so the three seams `read_capture` calls are
# replaced by fixtures: `_vision_text` (what the camera saw), `_extract_lines` (the two independent
# lists) and `_ground` (the matcher). Everything BETWEEN them is the real code — the fusion, the
# spoken-wins precedence, the grounding gate, the honest failures — and that is the part that can
# regress silently. The LIVE proof that Rocoto can read a real board is a real model run, not a test.
import logging  # noqa: E402

import config  # noqa: E402

config.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY or "vital-stub-key"
# S13 makes the reading fail on purpose, and the module logs those failures with a traceback (rightly
# — in production that log line is how a dead key is found). Here it would bury 54 result lines.
logging.getLogger("rocoto.brain.stock").setLevel(logging.CRITICAL)

# The seeded charcutería (`seed/catalogue.json`), reduced to the rows these checks need.
_CATALOGUE = {
    "jamon cocido":  ("sku-jamon-cocido-pieza", "JAMÓN COCIDO EXTRA PIEZA", "clean"),
    "paleta cocida": ("sku-paleta-cocida-pieza", "PALETA COCIDA PIEZA", "clean"),
    "chorizo sarta": ("sku-chorizo-sarta-500", "CHORIZO SARTA EXTRA 500 G", "note"),
}


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s or "").lower())
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).split())


class _Con:
    """Just enough connection for the two reads the pure path makes: `doubt.catalogue_ready` (which
    counts SKUs and nothing else) and `catalogue.catalogue_index` (which lists them, so an unmatched
    line can be offered the code we would actually mint)."""

    def __init__(self, skus=68, rows=None):
        self.skus = skus
        self.rows = rows if rows is not None else [
            {"id": "sku-jamon-cocido-pieza", "code": "35T", "name": "JAMÓN COCIDO EXTRA PIEZA",
             "family": "cocidos", "base_unit": "kg", "in_assortment": True},
            {"id": "sku-chorizo-sarta-500", "code": "ROC-CHO-001", "name": "CHORIZO SARTA EXTRA 500 G",
             "family": "embutidos", "base_unit": "kg", "in_assortment": True},
        ]

    async def fetchval(self, *a, **k):
        return self.skus

    async def fetch(self, *a, **k):
        return list(self.rows)


async def _ground_stub(tenant, mention, unit, qty):
    hit = _CATALOGUE.get(_norm(mention))
    if not hit:                       # the matcher's `unsure` band — indistinguishable from not ours
        return {"sku_id": "", "name": "", "band": "unsure", "score": 0.02, "alias": False,
                "tight": False, "n_close": 0, "unit_ok": True, "unit_note": "", "candidates": []}
    sid, name, band = hit
    # `n_close` is the matcher's own count of rows indistinguishable from the pick, over the FULL
    # pool. A `note` band here is a genuine two-way tie (500 G vs 1 KG), which is what makes it the
    # AMBIGUOUS case rather than a weak single hit.
    tight = band == "note"
    return {"sku_id": sid, "name": name, "band": band, "score": 0.91 if band == "clean" else 0.31,
            "alias": False, "tight": tight, "n_close": 2 if tight else 1,
            "unit_ok": True, "unit_note": "",
            "candidates": [{"sku_id": sid, "name": name, "score": 0.91},
                           {"sku_id": "sku-chorizo-sarta-1k", "name": "CHORIZO SARTA EXTRA 1 KG",
                            "score": 0.27}]}


_seen = {}


def _install(*, ocr="", photo=None, voice=None, raises=False, slow=0.0):
    _seen.clear()

    async def _vision(image_bytes, mime):
        _seen["vision"] = (len(image_bytes or b""), mime)
        return ocr

    async def _extract(ocr_text, transcript):
        _seen["extract"] = (ocr_text, transcript)
        if slow:
            await asyncio.sleep(slow)
        if raises:
            raise RuntimeError("credit balance is too low")
        return {"photo_lines": list(photo or []), "voice_lines": list(voice or [])}

    stock._vision_text = _vision
    stock._extract_lines = _extract
    stock._ground = _ground_stub


def _line(item, qty, unit, said=""):
    return {"item": item, "qty": qty, "unit": unit, "said": said}


# ── S10 · a spoken note, on its own, is a whole capture ──
_install(voice=[_line("jamón cocido", 2.5, "cajas", "quedan dos cajas y media"),
                _line("paleta cocida", 40, "kg", "y cuarenta kilos de paleta")])
r10 = asyncio.run(stock.read_capture(
    _Con(), TENANT, transcript="de jamón cocido quedan dos cajas y media y cuarenta kilos de paleta"))
ck("S10 a capture with NO photo and only a spoken note produces a real read",
   len(r10["read"]) == 2 and r10["note"] == "" and "vision" not in _seen, str(r10["read"])[:160])
ck("S10 the read carries QUANTITIES WITH UNITS, in the words of the trade",
   [(l["qty"], l["unit"]) for l in r10["read"]] == [(2.5, "cajas"), (40.0, "kg")])
ck("S10 «dos cajas y media» stays two and a half — a count is not rounded to please a schema",
   r10["read"][0]["qty"] == 2.5)
ck("S10 the names are the CATALOGUE's, and the operator's own words are kept beside them",
   r10["read"][0]["name"] == "JAMÓN COCIDO EXTRA PIEZA" and r10["read"][0]["heard"] == "jamón cocido")
ck("S15 every line says WHERE it came from (DESIGN-CANON provenance)",
   all(l["source"] in (stock.SRC_PHOTO, stock.SRC_VOICE, stock.SRC_BOTH) for l in r10["read"])
   and r10["read"][0]["source"] == stock.SRC_VOICE)

# ── S11 · a name the catalogue does not have is never a SKU ──
_install(voice=[_line("jamón cocido", 3, "cajas"),
                _line("salsa brava del proveedor nuevo", 6, "barquetas", "y seis barquetas de salsa")])
r11 = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres cajas y seis barquetas"))
ck("S11 an unknown name lands in `unmatched` and NEVER in `read`",
   [l["sku_id"] for l in r11["read"]] == ["sku-jamon-cocido-pieza"] and len(r11["unmatched"]) == 1)
ck("S11 …carrying the words that were actually used, and its quantity, so it can be fixed",
   r11["unmatched"][0]["name"] == "salsa brava del proveedor nuevo"
   and r11["unmatched"][0]["qty"] == 6.0 and r11["unmatched"][0]["unit"] == "barquetas")
ck("S11 no line anywhere in the read carries an empty sku_id (a level with no shelf)",
   all(l.get("sku_id") for l in r11["read"]))
ck("S11 an ungrounded TENANT reads the same way: everything unmatched, one honest sentence, no SKUs",
   (lambda r: r["read"] == [] and len(r["unmatched"]) == 2
    and r["note"] == stock.NOTE_NO_CATALOGUE)(
       asyncio.run(stock.read_capture(_Con(skus=0), TENANT, transcript="tres cajas"))))

# ── S12 · the spoken note WINS over the photo ──
_install(ocr="JAMON COCIDO — 4 cajas", photo=[_line("jamón cocido", 4, "cajas", "JAMON COCIDO 4 cajas")],
         voice=[_line("jamón cocido", 2.5, "cajas", "no son cuatro, quedan dos cajas y media")])
r12 = asyncio.run(stock.read_capture(_Con(), TENANT, image_bytes=b"\xff\xd8fake-jpeg", mime="image/jpeg",
                                     transcript="no son cuatro, quedan dos cajas y media"))
ck("S12 photo and voice about the same product are ONE line, not two",
   len(r12["read"]) == 1, str(r12["read"])[:160])
ck("S12 THE SPOKEN NOTE WINS — the read's number is the one the man standing there said",
   r12["read"][0]["qty"] == 2.5)
ck("S12 …and the photo's losing number is kept, flagged, so he can see we overrode the picture",
   r12["read"][0]["source"] == stock.SRC_BOTH and r12["read"][0]["conflict"] is True
   and r12["read"][0]["photo_qty"] == 4.0)
ck("S12 the photo WAS actually read (the vision seam ran on the bytes)", "vision" in _seen)
ck("S12 both senses reached the reader — one reading built from two, not two readings",
   _seen["extract"][0] == "JAMON COCIDO — 4 cajas" and "dos cajas y media" in _seen["extract"][1])
_install(ocr="X", photo=[_line("jamón cocido", 3, "cajas")], voice=[_line("jamón cocido", 3, "cajas")])
r12b = asyncio.run(stock.read_capture(_Con(), TENANT, image_bytes=b"x", transcript="tres cajas"))
ck("S12 agreement is not a conflict — same number from both senses is just a confident line",
   len(r12b["read"]) == 1 and r12b["read"][0]["source"] == stock.SRC_BOTH
   and r12b["read"][0].get("conflict") is not True)

# ── S13 · it fails honestly, and it never raises ──
ck("S13 no photo and no note ⇒ nothing read, and it says so",
   asyncio.run(stock.read_capture(_Con(), TENANT)) ==
   {"read": [], "ambiguous": [], "unmatched": [], "needs_qty": [], "note": stock.NOTE_NOTHING})

_key = config.ANTHROPIC_API_KEY
config.ANTHROPIC_API_KEY = ""
_install(voice=[_line("jamón cocido", 3, "cajas")])
r13a = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres cajas"))
config.ANTHROPIC_API_KEY = _key
ck("S13 NO MODEL KEY ⇒ empty read + an honest es-ES note, never a fabricated line",
   r13a["read"] == [] and r13a["note"] == stock.NOTE_NO_MODEL and "extract" not in _seen)

_install(ocr="")            # the model refused the image, or there was nothing on it
r13b = asyncio.run(stock.read_capture(_Con(), TENANT, image_bytes=b"\xff\xd8", mime="image/jpeg"))
ck("S13 A REFUSED / UNREADABLE IMAGE ⇒ empty read + «no he sabido leer la foto», never a guess",
   r13b["read"] == [] and r13b["unmatched"] == [] and r13b["note"] == stock.NOTE_UNREADABLE)

_install(raises=True, voice=[_line("jamón cocido", 3, "cajas")])
r13c = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres cajas"))
ck("S13 THE MODEL CALL RAISING never becomes an exception in the request — it becomes a sentence",
   r13c["read"] == [] and r13c["note"] == stock.NOTE_NO_MODEL)

_was = stock.READ_TIMEOUT_SEC
stock.READ_TIMEOUT_SEC = 0.05
_install(slow=0.5, voice=[_line("jamón cocido", 3, "cajas")])
r13d = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres cajas"))
stock.READ_TIMEOUT_SEC = _was
ck("S13 A SLOW READ IS CUT — the operator is standing there, so there is a hard ceiling on his wait",
   r13d["read"] == [] and r13d["note"] == stock.NOTE_SLOW)

_install(voice=[])          # the model came back with nothing usable
ck("S13 a model that returns no lines at all reads as unreadable, not as an empty shelf",
   asyncio.run(stock.read_capture(_Con(), TENANT, transcript="mmm"))["note"] == stock.NOTE_UNREADABLE)
ck("S13 every failure note is a plain es-ES sentence, never a stack trace or a code",
   all(n and n[0].isupper() and n.endswith(".") and "Error" not in n and "None" not in n
       for n in (stock.NOTE_NOTHING, stock.NOTE_NO_MODEL, stock.NOTE_SLOW,
                 stock.NOTE_UNREADABLE, stock.NOTE_NO_CATALOGUE)))

# ── S14 · the correction path is sacred: a client-supplied read is honoured verbatim ──
ck("S14 a NON-EMPTY client `read` is the correction — honour it, call no model",
   stock.client_supplied([{"sku_id": PALETA, "qty": 4, "unit": "kg"}]) is True)
ck("S14 an EMPTY list means READ IT — the shipped Android client always sends `read: []`",
   stock.client_supplied([]) is False)
ck("S14 absent / null / not-a-list also mean READ IT",
   stock.client_supplied(None) is False and stock.client_supplied("[]") is False)

# ── the fusion rules, exercised directly (they are the reading's only arithmetic) ──
ck("S12 two rows of the SAME product in the SAME unit from ONE source are one quantity",
   stock.fuse([_line("chorizo sarta", 3, "cajas"), _line("chorizo sarta", 2, "cajas")], [])
   == [{"item": "chorizo sarta", "qty": 5.0, "unit": "cajas", "said": "",
        "source": stock.SRC_PHOTO}])
ck("S12 …but the same product in DIFFERENT units stays two lines — no guessed pack conversion (S7)",
   len(stock.fuse([_line("chorizo sarta", 3, "cajas"), _line("chorizo sarta", 12, "kg")], [])) == 2)
ck("S12 «cajas» and «caja» are the same word to the reader (and only to the reader)",
   stock._unit_key("Cajas") == stock._unit_key("caja") == "caja")
ck("S12 a spoken line about a product supersedes EVERY photo row for it, not just the first",
   [(l["qty"], l["unit"]) for l in stock.fuse(
       [_line("jamón cocido", 4, "cajas"), _line("jamón cocido", 12, "kg")],
       [_line("jamón cocido", 2.5, "cajas")])] == [(2.5, "cajas")])
ck("S11 a line with no number is not a line — a count without a quantity is not a count",
   stock._clean_lines([{"item": "jamón cocido", "unit": "cajas"}, {"item": "", "qty": 3}],
                      stock.SRC_VOICE) == [])


# ══ M1–M9 · THE MATCH STEP, MADE EXPLICIT AND CORRECTABLE (§5.7a on a shelf, 2026-07-27) ═════════
# Peter: "when they use the inventory thing, if there's no matching, we need to match to an inventory
# item… If there's an SKU item, you need to ask them, 'Do you have an SKU code, or would you like to
# generate one?'" These are that, as promises:
#
#   M1 EXACTLY ONE OF THREE     — every read line is MATCHED or AMBIGUOUS or UNMATCHED. Never two,
#                                 never none, and the three lists together are the whole reading.
#   M2 A MATCHED LINE COUNTS    — …against the RIGHT sku, and it is the only kind `read` contains.
#   M3 AMBIGUOUS ASKS           — two real candidates ⇒ nobody picks. Out of `read`, so `apply_capture`
#                                 is STRUCTURALLY incapable of writing a level from an unresolved line.
#   M4 THE BANDS ARE BORROWED   — the order brain's own (`doubt.classify_line` over matcher's
#                                 band/tight/n_close). Stock owns NO threshold of its own.
#   M5 UNMATCHED NEVER BECOMES  — no sku is invented, and no row is created without being asked for.
#      A SKU BY ITSELF
#   M6 A GENERATED CODE IS SANE — family/product stem, per-stem sequence, unique against everything
#                                 already on the tenant, and OBVIOUSLY ours (never mistakable for ERP).
#   M7 …AND UNIQUE, EMBEDDED,   — db half.
#      MATCHABLE, PROVENANCED
#   M8 A SUPPLIED CODE IS EXACT — db half: he quotes «35T» and it hits deterministically (§5.7a's FTS
#                                 -floor argument — a real article code must never need a vector).
#   M9 A NULL PRICE NEVER 0     — a free wholesale product does not exist; 0 is a mis-encoded unknown.
import doubt as _doubt  # noqa: E402
from brain import catalogue as cat  # noqa: E402

# ── M1/M2/M3 · one capture, all three outcomes at once ──
_install(voice=[_line("jamón cocido", 3, "cajas", "tres cajas de cocido"),
                _line("chorizo sarta", 4, "cajas", "cuatro de sarta"),
                _line("salsa brava del proveedor nuevo", 6, "barquetas", "y seis de salsa")])
rM = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres, cuatro y seis"))
_states = [l["state"] for l in rM["read"] + rM["ambiguous"] + rM["unmatched"]]
ck("M1 the three lists together are the WHOLE reading — nothing is silently dropped",
   len(_states) == 3, str(_states))
ck("M1 each line declares its own state, and each list holds only its own kind",
   all(l["state"] == stock.MATCHED for l in rM["read"])
   and all(l["state"] == stock.AMBIGUOUS for l in rM["ambiguous"])
   and all(l["state"] == stock.UNMATCHED for l in rM["unmatched"]))
ck("M1 no line is in two lists at once (a stock count must not be double-counted)",
   len({id(l) for l in rM["read"] + rM["ambiguous"] + rM["unmatched"]}) == 3)
ck("M2 the MATCHED line counts against the RIGHT sku",
   [(l["sku_id"], l["qty"]) for l in rM["read"]] == [("sku-jamon-cocido-pieza", 3.0)],
   str(rM["read"]))
ck("M3 «chorizo sarta» — two real candidates, tight — ASKS instead of picking",
   len(rM["ambiguous"]) == 1 and not rM["ambiguous"][0].get("sku_id")
   and rM["ambiguous"][0]["why"] == "no sé cuál de estos es", str(rM["ambiguous"])[:180])
ck("M3 …and names BOTH candidates, so the operator has something to pick between",
   [c["name"] for c in rM["ambiguous"][0]["candidates"]]
   == ["CHORIZO SARTA EXTRA 500 G", "CHORIZO SARTA EXTRA 1 KG"])
ck("M3 AN AMBIGUOUS LINE IS NOT IN `read` — so no level can EVER be written from it",
   all(l["heard"] != "chorizo sarta" for l in rM["read"]))
ck("M3 …and it keeps its quantity and the words said, so resolving it does not re-do the count",
   rM["ambiguous"][0]["qty"] == 4.0 and rM["ambiguous"][0]["unit"] == "cajas"
   and rM["ambiguous"][0]["said"] == "cuatro de sarta")
ck("M5 the UNMATCHED line is offered a CREATION, never given a sku",
   len(rM["unmatched"]) == 1 and rM["unmatched"][0]["can_create"] is True
   and not rM["unmatched"][0].get("sku_id"))
ck("M6 …and the offer shows the code we would actually mint, before he agrees to it",
   rM["unmatched"][0]["suggested_code"] == "ROC-SAL-001", rM["unmatched"][0]["suggested_code"])

# ── M4 · the bands are the ORDER BRAIN's; stock owns no threshold ──
ck("M4 stock defines NO retrieval threshold of its own — the order brain's are the only ones",
   not any(hasattr(stock, n) for n in
           ("RERANK_CLEAR", "RERANK_UNSURE", "MARGIN_TIGHT", "TIE_WIDTH")))
_clean = {"sku_id": "s1", "name": "N", "band": "clean", "alias": False, "tight": False,
          "n_close": 1, "unit_ok": True, "unit_note": "", "candidates": [{"sku_id": "s1", "name": "N"}]}
ck("M4 clean band ⇒ MATCHED «alta»",
   (lambda v: v["state"] == stock.MATCHED and v["confidence"] == "alta")(
       stock.classify_stock_match(_clean)))
ck("M4 an ALIAS the customer already taught is MATCHED «alta» whatever the band says",
   stock.classify_stock_match({**_clean, "band": "note", "alias": True})["confidence"] == "alta")
ck("M4 THIN (one weak hit, wide margin) is MATCHED «media» — §5.7a asks for a confirm, not a choice",
   (lambda v: v["state"] == stock.MATCHED and v["confidence"] == "media")(
       stock.classify_stock_match({**_clean, "band": "note"})))
ck("M4 UNIT doubt keeps the product MATCHED and carries the unit note (the product IS identified)",
   (lambda v: v["state"] == stock.MATCHED and v["unit_note"] == "priced by kg — ordered as ud")(
       stock.classify_stock_match({**_clean, "band": "note", "unit_ok": False,
                                   "unit_note": "priced by kg — ordered as ud"})))
_tie2 = {**_clean, "band": "note", "tight": True, "n_close": 2,
         "candidates": [{"sku_id": "s1", "name": "MANZANA GOLDEN 20"},
                        {"sku_id": "s2", "name": "MANZANA GOLDEN 26"}]}
ck("M4 a TIGHT margin over exactly two rows is AMBIGUOUS (§5.7a: the margin, not the top score)",
   stock.classify_stock_match(_tie2)["state"] == stock.AMBIGUOUS)
_tie9 = {**_tie2, "n_close": 9,
         "candidates": [{"sku_id": f"s{i}", "name": f"CHORIZO {i}"} for i in range(9)]}
_v9 = stock.classify_stock_match(_tie9)
ck("M4 A WIDE TIE stays AMBIGUOUS here — §5.7a sends it to the COMERCIAL, and on a stock capture "
   "the comercial is the man holding the phone",
   _v9["state"] == stock.AMBIGUOUS and _v9["n_close"] == 9)
ck("M4 …and doubt itself still calls that one UNKNOWN/comercial — the FACULTY is unchanged, only "
   "the surface differs (a list, not three WhatsApp buttons)",
   (lambda d: d["kind"] == _doubt.UNKNOWN and d["direction"] == _doubt.COMERCIAL and d["ask"] is False)(
       _doubt.classify_line({"mention": "x", "match": {"band": "note", "tight": True, "n_close": 9,
                                                       "candidates": _tie9["candidates"]}})))
ck("M4 the wide tie shows more than two rows to the operator, capped at APP_CANDIDATES",
   len(_v9["candidates"]) == stock.APP_CANDIDATES and stock.APP_CANDIDATES > _doubt.MAX_CANDIDATES)
ck("M4 band «unsure» is UNMATCHED — nothing plausible, so the create offer and nothing else",
   stock.classify_stock_match({**_clean, "band": "unsure", "sku_id": ""})["state"] == stock.UNMATCHED)
ck("M4 …and a plausible-looking candidate list does NOT rescue an «unsure» band into a question",
   stock.classify_stock_match({**_clean, "band": "unsure", "sku_id": "",
                               "candidates": [{"sku_id": "s1", "name": "N"},
                                              {"sku_id": "s2", "name": "M"}]})["state"]
   == stock.UNMATCHED)

# ── M5 · UNMATCHED never silently becomes a SKU ──
_install(voice=[_line("jamón cocido", 3, "cajas")])


async def _ground_boom(*a, **k):
    raise RuntimeError("pgvector went away")


stock._ground = _ground_boom
_rboom = asyncio.run(stock.read_capture(_Con(), TENANT, transcript="tres cajas"))
stock._ground = _ground_stub
ck("M5 a grounding FAILURE is UNMATCHED but NOT creatable — «we could not look» is not the same "
   "fact as «it is not there», and only the second one may offer to create a row",
   len(_rboom["unmatched"]) == 1 and _rboom["read"] == []
   and _rboom["unmatched"][0]["can_create"] is False
   and _rboom["unmatched"][0]["suggested_code"] == "", str(_rboom["unmatched"])[:160])
ck("M5 an UNGROUNDED tenant is offered NO creation either — the fix for an empty catalogue is the "
   "catalogue, not sixty rows typed at a pallet",
   (lambda r: all(u["can_create"] is False and u["suggested_code"] == "" for u in r["unmatched"]))(
       asyncio.run(stock.read_capture(_Con(skus=0), TENANT, transcript="tres cajas"))))
ck("M5 create_sku REFUSES without an answer to the code question — a code is an identity, and we "
   "do not mint one unasked",
   (lambda r: r["ok"] is False and r["reason"] == "no_code"
    and r["detail"] == "Dime el código que le das tú, o te lo genero yo.")(
       asyncio.run(cat.create_sku(None, TENANT, name="SALSA BRAVA"))))
ck("M5 …and refuses a nameless product outright",
   asyncio.run(cat.create_sku(None, TENANT, name="   ", generate_code=True))["reason"] == "no_name")

# ── M6 · the code scheme (PURE — "unique" is the only promise a code makes) ──
ck("M6 the stem comes from the FAMILY when there is one — that is how the trade files things",
   cat.code_stem("SALSA BRAVA GARRAFA", "embutidos") == "EMB")
ck("M6 …and from the product name when there is not",
   cat.code_stem("SALSA BRAVA GARRAFA") == "SAL" and cat.code_stem("chorizo sarta extra") == "CHO")
ck("M6 digits, units and «de/del» never become the stem («500 G DE FUET» is a FUET)",
   cat.code_stem("500 g de fuet extra") == "FUE")
ck("M6 a name that reduces to nothing still gets a code, and it says so («GEN»)",
   cat.code_stem("500 1 kg") == cat._STEM_FALLBACK)
ck("M6 a two-letter word is padded rather than borrowing the next one — generated should LOOK it",
   cat.code_stem("té verde") == "TEX")
ck("M6 the sequence is per stem, zero-padded, and starts at 001",
   cat.next_code("SAL", []) == "ROC-SAL-001"
   and cat.next_code("CHO", ["ROC-SAL-001", "ROC-SAL-002"]) == "ROC-CHO-001")
ck("M6 it CONTINUES from the highest, never fills a gap (a reused number aims two histories at one "
   "string)",
   cat.next_code("SAL", ["ROC-SAL-001", "ROC-SAL-003"]) == "ROC-SAL-004")
ck("M6 it never shadows one of THEIR codes, whatever the case or the spacing",
   cat.next_code("SAL", ["roc-sal-001", " ROC-SAL-002 "]) == "ROC-SAL-003")
ck("M6 it survives past 999 by getting longer, not by wrapping",
   cat.next_code("SAL", ["ROC-SAL-999"]) == "ROC-SAL-1000")
ck("M6 a generated code is RECOGNISABLE as generated, and a real ERP code is not mistaken for one",
   cat.is_generated_code("ROC-SAL-001") is True and cat.is_generated_code("35T") is False
   and cat.is_generated_code("F-1020") is False)
ck("M6 the mark is the disclosure — every generated code carries it",
   cat.next_code("QUE", []).startswith(cat.CODE_MARK + "-"))
ck("M6 a supplied code keeps the supplier's own format — we fold case and spacing, nothing else",
   cat._norm_code("  f-10/20 ") == "F-10/20" and cat._norm_code("35t") == "35T")

# ── M9 · a NULL price never becomes 0 ──
ck("M9 no price is NO PRICE — never zero (a free wholesale product does not exist)",
   cat._clean_price(None) is None and cat._clean_price("") is None and cat._clean_price(0) is None
   and cat._clean_price("0,00 €") is None and cat._clean_price(-3) is None)
ck("M9 …and a real price still parses the way a person writes it",
   cat._clean_price("3,50 €") == 3.5 and cat._clean_price("1.234,56") == 1234.56
   and cat._clean_price(4.2) == 4.2)
ck("M9 unparseable text is UNKNOWN, not 0",
   cat._clean_price("a consultar") is None and cat._clean_price(True) is None)

# ── M10 · THE ASK IS THE MIND'S, NOT A FORM (the conversational half; the app gets a UI step) ──
ck("M10 a clean capture carries NO note into the fold — the mind is not handed noise",
   stock.capture_note({"read": [{"name": "X"}], "ambiguous": [], "unmatched": [], "note": ""}) == "")
_note = stock.capture_note(rM)
ck("M10 a capture with doubt hands the mind the FACTS: which line, which candidates, what to ask",
   "chorizo sarta" in _note and "CHORIZO SARTA EXTRA 500 G" in _note
   and "salsa brava del proveedor nuevo" in _note and "ROC-SAL-001" in _note,
   " ⏎ ".join(_note.splitlines())[:200])
ck("M10 it tells the mind to ASK, never what words to use (§5.7a: the faculty supplies the truth)",
   "PREGÚNTALE" in _note and "No elijas tú" in _note)
ck("M10 …and forbids «apuntado»/«listo» until he answers (§5.7's tone law)",
   "apuntado" in _note and "listo" in _note and "No digas" in _note)
ck("M10 the CONVERSATIONAL ask obeys the 3-button cap even though the screen does not "
   "(the cap is a property of the channel, not of the doubt)",
   (lambda n: n.count("«CHORIZO") <= 2)(
       stock.capture_note({"read": [], "unmatched": [],
                           "ambiguous": [{"heard": "chorizo", "qty": 1, "unit": "caja",
                                          "n_close": 9,
                                          "candidates": [{"name": f"CHORIZO {i}"} for i in range(9)]}],
                           "note": ""})))
ck("M10 …and says how many it did not name, rather than pretending there were only two",
   "y 7 más" in stock.capture_note(
       {"read": [], "unmatched": [],
        "ambiguous": [{"heard": "chorizo", "qty": 1, "unit": "caja", "n_close": 9,
                       "candidates": [{"name": f"CHORIZO {i}"} for i in range(9)]}], "note": ""}))


# ══ S1/S2/S3/S9 · the loop, on disk (needs a clone) ══════════════════════════════════════════════
async def _db_checks():
    import db
    stock._ground = _REAL_GROUND      # the real matcher, real encoder, real reranker — see above
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_stock against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")

        async def _wipe():
            for t in (TENANT, OTHER):
                await con.execute("delete from stock_levels where tenant_id=$1", t)
                await con.execute("delete from stock_captures where tenant_id=$1", t)
                await con.execute("delete from sku_aliases where tenant_id=$1", t)
                await con.execute("delete from catalogue_skus where tenant_id=$1", t)
                await con.execute("delete from tenants where slug=$1", t)

        try:
            await _wipe()
            # Invented company (LOCKED LAW). inventory_enabled is NOT set here on purpose: the
            # default is the check.
            await con.execute("insert into tenants (slug, name) values ($1,$2)",
                              TENANT, "Cárnicas Aldonza")
            for sid, nm in ((PALETA, "PALETA COCIDA"), (POLLO, "POLLO ENTERO"),
                            (LOMO, "LOMO ADOBADO")):
                await con.execute(
                    "insert into catalogue_skus (id, tenant_id, name, base_unit) values ($1,$2,$3,'kg')",
                    sid, TENANT, nm)

            ck("S5/db inventory is OFF BY DEFAULT for a brand-new tenant",
               await stock.inventory_on(con, TENANT) is False)

            # ── S1 · the capture records WHAT ROCOTO READ and touches no level ──
            read = [{"sku_id": PALETA, "qty": 40, "unit": "kg", "name": "PALETA COCIDA"},
                    {"sku_id": POLLO, "qty": 30, "unit": "kg", "name": "POLLO ENTERO"}]
            cid = await stock.record_capture(con, TENANT, image_url="file://estante.jpg",
                                             transcript="quedan cuarenta de paleta", read_json=read)
            row = await con.fetchrow("select read_json, applied, corrected from stock_captures "
                                     "where id=$1", cid)
            ck("S1/db the capture stores the READ and applies NOTHING yet",
               bool(cid) and row["applied"] is False and row["corrected"] is False
               and not await stock.get_levels(con, TENANT), f"capture {cid}")

            # ── S2 · the boss corrects it by talking, THEN it is applied ──
            corrected_read = [{**read[0], "qty": 4}, read[1]]
            res = await stock.apply_capture(con, TENANT, cid, corrected_read)
            levels = await stock.get_levels(con, TENANT)
            ck("S1/db applying writes the levels", res["written"] == 2 and len(levels) == 2
               and levels[PALETA]["qty"] == 4.0, str(res))
            row = await con.fetchrow("select read_json, applied, corrected from stock_captures "
                                     "where id=$1", cid)
            ck("S2/db the correction is remembered AND replaces the stored read "
               "(what was applied and what is on file are the same numbers)",
               res["corrected"] is True and row["corrected"] is True and row["applied"] is True
               and row["read_json"][0]["qty"] == 4)

            # ── S3 · idempotent ──
            again = await stock.apply_capture(con, TENANT, cid, corrected_read)
            ck("S3/db a second «Guardar» writes nothing and says so",
               again["already_applied"] is True and again["written"] == 0)

            # ── S5/S6 · the two structural silences, against REAL levels ──
            order = [{"sku_id": PALETA, "qty": 12, "unit": "kg", "name": "PALETA COCIDA"},
                     {"sku_id": "vs-never-counted", "qty": 999, "unit": "kg", "name": "X"}]
            ck("S5/db inventory OFF → a genuinely short order is STILL not held",
               (await stock.check_lines(con, TENANT, order))
               == {"ok": True, "short": [], "reason": "", "inventory": False})

            await con.execute("update tenants set inventory_enabled=true where slug=$1", TENANT)
            got = await stock.check_lines(con, TENANT, order)
            ck("S4/db inventory ON → ONE reason, naming the ONE item that is short",
               got["ok"] is False and len(got["short"]) == 1
               and got["reason"] == "no te queda suficiente PALETA COCIDA "
                                    "(quedan 4 kg, te piden 12)", got["reason"])
            ck("S6/db …and the level-less SKU in the same order contributed nothing",
               all(s["sku_id"] != "vs-never-counted" for s in got["short"]))

            # ── S8 · the threshold is data ──
            ck("S8/db the first count seeds low_at from itself",
               levels[POLLO]["low_at"] == stock.seed_low_at(30), str(levels[POLLO]["low_at"]))
            await stock.set_level(con, TENANT, POLLO, 30, "kg", low_at=12, source="manual")
            await stock.set_level(con, TENANT, POLLO, 8, "kg")          # a later recount, no low_at
            after = (await stock.get_levels(con, TENANT, [POLLO]))[POLLO]
            ck("S8/db an explicit threshold survives a later recount, and the recount trips it",
               after["low_at"] == 12.0 and after["qty"] == 8.0 and after["low"] is True)
            low = await stock.low_levels(con, TENANT)
            ck("S8/db «te queda poco» is a LIST for the app, never a review reason",
               [d["sku_id"] for d in low] == [POLLO])

            # ── S14 · a client-supplied read is stored EXACTLY as sent (the correction path) ──
            fixed = [{"sku_id": LOMO, "qty": 7.5, "unit": "kg", "name": "LOMO ADOBADO",
                      "source": "voz", "confidence": "alta"}]
            cid2 = await stock.record_capture(con, TENANT, transcript="siete kilos y medio",
                                              read_json=fixed)
            stored = (await con.fetchrow("select read_json from stock_captures where id=$1",
                                         cid2))["read_json"]
            ck("S14/db a client-supplied read is stored verbatim — the correction is never re-read",
               stored == fixed, str(stored)[:120])

            # ── S9 · the fence is a rule ──
            raised = ""
            try:
                await stock.apply_capture(con, "vitalstock-otro", cid, corrected_read)
            except ValueError as e:
                raised = str(e)
            ck("S9/db another tenant can NEVER apply this capture — it RAISES", bool(raised), raised)

            # ── M11 · AN OVERRIDE MAY NOT SMUGGLE IN A SKU THAT IS NOT THIS TENANT'S ──
            # The client is where an override comes from ("no, it's the paleta"), so it is exactly
            # the path a foreign id arrives on. `stock_levels`' FK is GLOBAL and would accept it.
            await con.execute("insert into tenants (slug, name) values ($1,$2) "
                              "on conflict (slug) do nothing", OTHER, "Casa Bermejo")
            await con.execute("insert into catalogue_skus (id, tenant_id, name, base_unit) "
                              "values ($1,$2,$3,'kg') on conflict (id) do nothing",
                              FOREIGN, OTHER, "JAMÓN DE OTRO")
            cid3 = await stock.record_capture(con, TENANT, transcript="cuarenta de eso",
                                              read_json=[{"sku_id": FOREIGN, "qty": 40, "unit": "kg"}])
            res3 = await stock.apply_capture(con, TENANT, cid3)
            ck("M11/db a sku that is NOT this tenant's writes NOTHING and is NAMED — a wrong SKU "
               "silently counted is worse than an uncounted line",
               res3["written"] == 0 and res3["rejected"] == [FOREIGN]
               and FOREIGN not in await stock.get_levels(con, TENANT), str(res3))

            # ── M7 · A CREATED ROW IS UNIQUE, EMBEDDED, IMMEDIATELY MATCHABLE, PROVENANCED ──
            made = await cat.create_sku(
                con, TENANT, name="SALSA BRAVA GARRAFA 5 L", generate_code=True, family="salsas",
                unit="barquetas", price=None,
                created_from={"capture_id": cid, "image_url": "https://x/media/estante.jpg",
                              "heard": "salsa brava del proveedor nuevo", "by": "vital"})
            ck("M7/db it is created, with the code the scheme promised",
               made["ok"] is True and made["code"] == "ROC-SAL-001"
               and made["code_generated"] is True, str(made)[:200])
            new_id = made["sku"]["id"]
            r = await con.fetchrow(
                "select id, code, name, family, base_unit, pack_factor::float8 as pack_factor, "
                "       variable_weight, price, in_assortment, seeded, "
                "       (embedding is not null) as embedded, "
                "       (search_text is not null) as indexed, attrs "
                "  from catalogue_skus where id=$1 and tenant_id=$2", new_id, TENANT)
            ck("M7/db the row carries the minimum that makes it USABLE — name, family, base_unit, "
               "pack_factor, variable_weight, in_assortment — and nothing invented",
               (r["name"], r["family"], r["base_unit"], r["pack_factor"], r["variable_weight"],
                r["in_assortment"]) == ("SALSA BRAVA GARRAFA 5 L", "salsas", "unit", 1.0, False, True),
               str(dict(r))[:220])
            ck("M9/db an unknown price is stored as NULL, never as 0", r["price"] is None)
            ck("M7/db it is NOT seeded — a created row is real, so no re-seed may ever touch it",
               r["seeded"] is False)
            ck("M7/db it lives OUTSIDE golive's id namespace, so the next catalogue upload cannot "
               "silently retire a product the boss is holding",
               new_id.startswith(f"{TENANT}#new:") and not new_id.startswith(f"{TENANT}:"))
            ck("M7/db it is EMBEDDED and FTS-indexed — the same path seed.load_catalogue uses",
               r["embedded"] is True and r["indexed"] is True and made["embedded"] is True)
            prov = (r["attrs"] or {}).get("created_from") or {}
            ck("M7/db PROVENANCE: it knows which capture and which PHOTOGRAPH it came from, and the "
               "words that were said (a catalogue row nobody can explain is a liability)",
               prov.get("capture_id") == cid and prov.get("image_url") == "https://x/media/estante.jpg"
               and prov.get("heard") == "salsa brava del proveedor nuevo" and prov.get("at"),
               str(prov)[:180])

            # THE PROOF THAT MATTERS: the very next order naming it must ground. Real matcher, real
            # encoder, real reranker — no stub. Without this the row is a record, not a product.
            from brain import matcher as _m
            hit = await _m.match("salsa brava garrafa", tenant=TENANT)
            ck("M7/db IT IS MATCHABLE IMMEDIATELY — the real matcher grounds the new name onto it "
               "with no re-seed, no restart, no re-embed",
               (hit.pick or {}).get("sku_id") == new_id and hit.band == "clean",
               f"{(hit.pick or {}).get('name')} band={hit.band} score={hit.pick_score:.3f}")
            # …and NOT ONLY BY THE ALIAS. The exact name hits the alias fast-path, which would still
            # pass if the embedding had silently failed to write — so the claim is re-made against a
            # paraphrase nobody aliased, which can only be reached through the dense + FTS + rerank
            # path. That is the one that decides whether the NEXT order grounds.
            para = await _m.match("una garrafa de la salsa brava esa", tenant=TENANT)
            ck("M7/db …and by the DENSE+FTS path too, not just by the alias we wrote — a paraphrase "
               "nobody taught still lands on it, which is what the very next order will be",
               (para.pick or {}).get("sku_id") == new_id and para.alias_hit is False,
               f"{(para.pick or {}).get('name')} band={para.band} method={para.method} "
               f"score={para.pick_score:.3f}")

            # ── M8 · a SUPPLIED code is searchable EXACTLY (§5.7a's FTS-floor argument) ──
            made2 = await cat.create_sku(con, TENANT, name="PIMENTÓN DE LA VERA LATA",
                                         code="35T", family="especias", unit="ud")
            ck("M8/db his OWN code is kept verbatim, and is not marked as ours",
               made2["ok"] is True and made2["code"] == "35T"
               and made2["code_generated"] is False, str(made2)[:160])
            hit2 = await _m.match("35T", tenant=TENANT)
            ck("M8/db a customer quoting a real article code HITS DETERMINISTICALLY — alias, not "
               "vector (§5.7a: «never vector-only»)",
               (hit2.pick or {}).get("sku_id") == made2["sku"]["id"] and hit2.alias_hit is True,
               f"{(hit2.pick or {}).get('name')} alias={hit2.alias_hit} method={hit2.method}")
            fts = await con.fetchval(
                "select count(*) from catalogue_skus "
                " where tenant_id=$1 and search_text @@ websearch_to_tsquery('english','35T')", TENANT)
            ck("M8/db …and the code is in the FTS document too, so the deterministic floor holds "
               "even if the alias is ever lost", fts == 1, f"fts rows={fts}")

            # ── M10 · REFUSE RATHER THAN DUPLICATE ──
            dup = await cat.create_sku(con, TENANT, name="OTRA COSA", code="35t", family="x")
            ck("M10/db the same code is REFUSED and the refusal CARRIES the row in the way — "
               "«ya lo tienes» is not an error, it is the match he was looking for",
               dup["ok"] is False and dup["reason"] == "code_taken"
               and dup["sku"]["sku_id"] == made2["sku"]["id"], str(dup)[:160])
            dup2 = await cat.create_sku(con, TENANT, name="  pimentón de la vera  LATA ",
                                        generate_code=True)
            ck("M10/db the same NAME (however it is spaced or cased) is REFUSED the same way — the "
               "last defence against the matcher having simply failed to find something",
               dup2["ok"] is False and dup2["reason"] == "name_taken"
               and dup2["sku"]["sku_id"] == made2["sku"]["id"], str(dup2)[:160])
            n_rows = await con.fetchval(
                "select count(*) from catalogue_skus where tenant_id=$1 and id like $2",
                TENANT, f"{TENANT}#new:%")
            ck("M10/db …and after two refused duplicates there are still exactly TWO created rows",
               n_rows == 2, f"created rows={n_rows}")
            again2 = await cat.create_sku(
                con, TENANT, name="SALSA BRAVA GARRAFA 5 L", generate_code=True, family="salsas")
            ck("M10/db a RETRY of the same creation (a double tap, a dropped response) comes back "
               "pointing at the row that already exists — never a second row, and never a second "
               "code burned on it",
               again2["ok"] is False and again2["reason"] == "name_taken"
               and again2["sku"]["sku_id"] == new_id
               and await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1 "
                                      "and id like $2", TENANT, f"{TENANT}#new:%") == 2,
               str(again2)[:140])

            # ── M11 · the OVERRIDE, end to end: he says what it really is, and it counts ──
            ov = await stock.match_one(con, TENANT, "salsa brava garrafa", unit="barquetas", qty=6)
            ck("M11/db «corregir hablando» re-grounds through the SAME matcher and comes back MATCHED",
               ov["state"] == stock.MATCHED and ov["sku_id"] == new_id, str(ov)[:160])
            cid4 = await stock.record_capture(con, TENANT, transcript="seis barquetas de salsa",
                                              read_json=[])
            res4 = await stock.apply_capture(
                con, TENANT, cid4, [{"sku_id": ov["sku_id"], "qty": 6, "unit": "barquetas"}])
            lv = await stock.get_levels(con, TENANT, [new_id])
            ck("M2/db …and the overridden line COUNTS AGAINST THAT SKU — the created product now "
               "has a level, which is the whole loop closing",
               res4["written"] == 1 and lv[new_id]["qty"] == 6.0
               and lv[new_id]["unit"] == "barquetas", str(res4))
            ck("M11/db an override is recorded as a CORRECTION — the only signal that says whether "
               "the reading is any good", res4["corrected"] is True)

            miss = await stock.match_one(con, TENANT, "trufa negra fresca del Périgord")
            ck("M5/db a name genuinely not in the catalogue comes back UNMATCHED with the code we "
               "would mint — never a sku, never a silent creation",
               miss["state"] == stock.UNMATCHED and not miss["sku_id"]
               and miss["can_create"] is True and miss["suggested_code"].startswith("ROC-TRU-"),
               str(miss)[:160])
        finally:
            await _wipe()


if os.environ.get("REHEARSAL_DSN"):
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, os.environ["REHEARSAL_DSN"])
    asyncio.run(_db_checks())
else:
    skip("S1/S2/S3/S9 the capture→correction→apply loop on disk",
         "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_stock: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — A REASON, NOT A SCREEN" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
