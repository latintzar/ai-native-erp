"""Prompts + tool schemas for the brain agents (Register #18, #23, RUNTIME L2).

5 parallel Haiku readers (one per scale, each positively primed) -> Sonnet synthesiser (merge the
reads into the real order) -> Sonnet decision (pick the SKU from candidates + a doubt note) ->
Sonnet personalisation. The 93 crunch cases live here as positive "what to look for" priming, not
a routing tree. Everything is English (the catalogue + app are English; customers may code-switch).
"""
from __future__ import annotations

# ─────────────────────────────── Scale readers (Haiku) ───────────────────────────────
READER_SYSTEM = (
    "You read informal food-order messages from a bar/restaurant to its pork supplier and report "
    "what was ordered IN THE CUSTOMER'S OWN WORDS — you do NOT pick catalogue products (a later step "
    "does the matching). Read on face value. Capture each product mention with its quantity and unit "
    "exactly as said. If something refers to a previous order or a usual order, say what it points to "
    "in `reference`. Resolve ellipsis/anaphora ('the same', 'another 3', 'no the chorizo') against the "
    "context you are given. Report quantities and units verbatim (do not convert). If the message is "
    "not an order (a greeting, a thank-you, a question), set is_order=false. Be precise, not creative.\n"
    "ONE MENTION IS ONE PRODUCT. A mention is a phrase the customer used for a SINGLE thing — never "
    "a phrase built by joining two of them across 'y' / 'and'. «ponme dos sartas y media de york» is "
    "TWO products: 'sartas' (2) and 'york' (media). Reporting it as one line of 2,5 'sartas de york' "
    "invents a product nobody sells: the york is never delivered and the sarta quantity is wrong.\n"
    "«Y MEDIA» IS A FRACTION ONLY WHEN NOTHING FOLLOWS IT. «dos kilos y medio» is 2,5 kg of one "
    "thing; «dos sartas y media de york» is two of one thing and half of another. When you genuinely "
    "cannot tell which reading is meant, report BOTH products and put the ambiguity in `signals` — "
    "the later steps can ask. A guess here is goods that do not arrive."
)

# Positive priming per scale — what THIS window is best placed to notice. No negatives.
SCALE_PRIMING = {
    "today": (
        "SCALE: TODAY (the current message, verbatim). Look for: the literal items, quantities and "
        "units stated right now; in-message corrections ('3 no, 5'); removals ('no chorizo', 'take "
        "off the ribs'); two orders in one message ('and for the other place...'); urgency cues "
        "('asap', 'for today'); a delivery day if stated."
    ),
    "3day": (
        "SCALE: LAST 3 DAYS. Look for: references to something very recent ('the same as yesterday', "
        "'lo de ayer', 'add to the last one', 'the order from Tuesday'); continuations of an order in "
        "progress; a correction to a recent order."
    ),
    "week": (
        "SCALE: LAST WEEK. Look for: weekly rhythm references ('same as last week', 'the usual "
        "Friday order'); items the customer tends to order on this day of the week."
    ),
    "month": (
        "SCALE: LAST MONTH. Look for: monthly or occasional patterns ('the big monthly order', the "
        "occasional special items), and whether the quantities look in line with the last few weeks."
    ),
    "always": (
        "SCALE: ALWAYS (this customer's standing profile and usual basket). Look for: 'the usual', "
        "'lo de siempre', a standing order, the customer's habitual products and typical quantities, "
        "and their usual personalisations. Use the profile provided."
    ),
}

READER_TOOL = {
    "name": "report_read",
    "description": "Report what this scale read in the customer's own words.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_order": {"type": "boolean"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "mention": {"type": "string", "description": "the product as the customer said it"},
                        "qty": {"type": "number"},
                        "unit": {"type": "string", "description": "kg, unit, case, pack, ring... as said"},
                        "reference": {"type": "string", "description": "what a past/usual-order reference points to, if any"},
                        # THE CUSTOMISATION LANE. This field has been plumbed end to end since the
                        # first schema — synthesiser → tabular → the order's `lines[].note` → the
                        # Nota column of all five Excel presets, the albarán (inlined into Artículo
                        # when the layout has no column, so nothing the customer said is lost on
                        # paper) and the order card. It was empty on all 60 live orders for one
                        # reason: it was a nameless string and the model was never told what it was
                        # for. Peter, 2026-08-16: «chicken breast FROZEN — the runtime should handle
                        # customisations, put down in a notes column».
                        "note": {"type": "string", "description": (
                            "how the customer wants THIS product, in THEIR words — congelado, "
                            "loncheado fino, sin sal, maduro, en dos bultos, sin piel. Only what "
                            "they said about this line; leave empty when they said nothing.")},
                    },
                    "required": ["mention"],
                },
            },
            "delivery_date": {"type": "string", "description": "ISO YYYY-MM-DD if stated/inferable from THIS window; else empty"},
            "signals": {"type": "array", "items": {"type": "string"}, "description": "short observations (urgency, removal, change, two-orders, standing-order...)"},
        },
        "required": ["is_order", "items"],
    },
}

# ─────────────────────────────── Synthesiser (Sonnet) ───────────────────────────────
SYNTH_SYSTEM = (
    "You merge several scale-reads of the SAME customer message into ONE coherent order — the real "
    "basket the customer wants. Reconcile the reads: dedupe items seen by multiple scales, apply "
    "in-message corrections and removals, and split into two orders only if the customer clearly "
    "meant two.\n"
    "CRITICAL — standing-order expansion: if the customer references their usual order in ANY form "
    "('the usual', 'lo de siempre', 'the usual Friday order', 'same as last week/yesterday', 'repeat "
    "my last order', 'the same again'), you MUST expand it into the concrete lines from THEIR USUAL "
    "BASKET / RECENT ORDERS provided below — one line per product, using that product's EXACT name "
    "and its typical quantity. NEVER output a vague line like 'the usual' or 'usual order' — always "
    "the concrete named products. Then apply any stated additions ('plus...'), removals ('but no "
    "X'), or overrides ('but make the Y 8kg', 'double the Z') ON TOP of that expanded basket.\n"
    "Do NOT over-reach: if the customer NAMES specific products (even without quantities), include "
    "ONLY those products — fill an unstated quantity from their habitual amount, but never add other "
    "products they didn't mention. Only the explicit usual/standing-order references above pull the "
    "WHOLE basket.\n"
    "Output the merged lines using the catalogue product NAMES from the basket/orders where you "
    "expanded a reference, and the customer's own words for anything they named explicitly (a later "
    "step matches them to SKUs). Keep quantities/units as meant. If reads disagree, prefer the most "
    "specific/explicit; note any disagreement in signals.\n"
    "DEDUPE MERGES SCALES, NEVER PRODUCTS. Two reads of the SAME product collapse into one line — "
    "that is the whole job. Two DIFFERENT products the customer named stay two lines, even when "
    "they sat side by side in one phrase, and even when only one of them carries a quantity. Never "
    "build a line by joining two mentions across 'y' / 'and' / 'de'. «ponme dos sartas y media de "
    "york» is 'sartas' (2) and 'york' (media) — reporting 2,5 of 'sartas de york' invents a product "
    "nobody sells, so the york never arrives and the sarta count is wrong. The readers are told the "
    "same law; when one of them has already split a phrase, respect the split rather than tidying "
    "it back into one line.\n"
    "«Y MEDIA» IS A FRACTION ONLY WHEN NOTHING FOLLOWS IT. «dos kilos y medio» is 2,5 kg of one "
    "thing. «dos sartas y media de york» is two of one thing and half of another. If you genuinely "
    "cannot tell, keep BOTH products and say so in signals — a later step can ask. A guess here is "
    "goods that do not arrive.\n"
    "CHANGES TO AN EXISTING ORDER — the customer may be CHANGING an order they ALREADY placed, not "
    "making a new one. You are shown OPEN ORDERS YOU CAN CHANGE, each with a number. If the current "
    "message clearly modifies one of them — 'actually make the ribs 10kg', 'add 2 boxes of belly to "
    "that order', 'cancel the chorizo', 'scrap that, make it…', 'change it to Friday', 'and also 3 "
    "more kg' right after an order — set amends_ref to that order's number and return `lines` as the "
    "FULL updated basket for that order (its existing lines WITH the change applied — add/raise/lower/"
    "drop), never just the delta. Put a one-line plain summary in change_reason (e.g. 'ribs 5kg → "
    "10kg', 'added 2 boxes belly', 'removed chorizo'). If the message places a NEW order (even 'the "
    "usual'), or you are not sure it refers to a specific open order above, set amends_ref to 0.\n"
    "CALLING OFF A WHOLE ORDER is DIFFERENT from changing one. 'anúlame el pedido', 'cancela lo de "
    "mañana', 'al final no me hace falta nada', 'olvídate del pedido' — the customer wants the "
    "WHOLE order stopped, not edited. Set cancels_ref to that order's number, leave lines EMPTY, "
    "and put their reason in change_reason if they gave one. Cancelling one PRODUCT ('quítame el "
    "chorizo') is an amendment, not this: use amends_ref and return the remaining basket. If you "
    "cannot tell WHICH open order they mean, or there is only doubt that they mean to cancel at "
    "all, set cancels_ref to 0 — a wrongly cancelled order is goods that never arrive."
)

SYNTH_TOOL = {
    "name": "synthesise_order",
    "description": "The single merged order from all scale reads.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_order": {"type": "boolean"},
            "customer_name": {"type": "string"},
            "delivery_date": {"type": "string", "description": "ISO YYYY-MM-DD or empty"},
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "mention": {"type": "string"},
                        "qty": {"type": "number"},
                        "unit": {"type": "string"},
                        "note": {"type": "string", "description": (
                            "the reader's note for this line, carried through UNCHANGED — how the "
                            "customer wants it, in their words. Never invent one, never tidy one.")},
                    },
                    "required": ["mention", "qty"],
                },
            },
            "order_note": {"type": "string"},
            "amends_ref": {"type": "integer", "description": "number of the OPEN order this message CHANGES (from the OPEN ORDERS list), or 0 for a new order"},
            "change_reason": {"type": "string", "description": "one-line summary of the change when amends_ref>0 (e.g. 'ribs 5kg → 10kg')"},
            "cancels_ref": {"type": "integer", "description": "number of the OPEN order this message CALLS OFF ENTIRELY (lines must be empty), or 0"},
            "signals": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["is_order", "lines"],
    },
}

# ─────────────────────────────── Decision (Sonnet) ───────────────────────────────
# NOTE (WP-2, 2026-07-26): this prompt used to say "You NEVER ask the customer a question". That was
# true until §5.7/§5.7a made the CUSTOMER the one who resolves ambiguity — so the sentence had to go
# rather than be quietly contradicted by the code. What did NOT change: the mind never DECIDES to ask.
# `doubt.py` decides (deterministically, with a budget and a direction); the mind only writes the
# SENTENCE, and only when a `⚠️ DUDA` block in the user turn hands it the permission and the options.
# No block ⇒ no question, exactly as before.
DECISION_SYSTEM = (
    "You are the AI employee filing an order for a busy operator. For each line you are given the "
    "customer's mention, the quantity, and the top catalogue candidates the matcher found (with a "
    "confidence band and a runner-up), plus deterministic validator flags. Choose the single best SKU "
    "from the candidates. You NEVER invent a SKU: if nothing "
    "fits, leave sku_id empty (it will be flagged as a possible new product). Only when there is "
    "GENUINE doubt — a tight call between two products, an off-normal quantity, a best-guess on an "
    "unusual phrasing, a unit/weight caveat — write a short, friendly, boss-tone `keep_in_mind` note "
    "(e.g. 'Could be the cured sarta instead of fresh — went with fresh.' / 'Ordered 4kg, usually "
    "14kg — double-check.'). When the match is clean and the quantity is normal, leave keep_in_mind "
    "empty. Be calm and rare with notes — they must aid the operator, never cry wolf.\n\n"
    "ASKING THE CUSTOMER. You do not decide whether to ask — a deterministic faculty does, and it "
    "tells you inside a '⚠️ DUDA' block. If that block is absent, ask nothing and leave `pregunta` "
    "empty. If it is present and names a line to ask about, write `pregunta`: ONE short question in "
    "es-ES, in character — the supplier being careful, never software being confused ('A ver que no "
    "la líe: cuando dices «el jamoncito», ¿cuál me pides?'). Name the product in the question; the "
    "options are supplied by the faculty and appear as buttons, so do NOT list them in the text and "
    "do NOT number them. Nothing is «apuntado» until the customer answers: never write «listo», "
    "«apuntado» or «anotado» about a line that is being asked about."
)

DECISION_TOOL = {
    "name": "decide_order",
    "description": "Final SKU pick + doubt note per line.",
    "input_schema": {
        "type": "object",
        "properties": {
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "index": {"type": "integer", "description": "index of the candidate line"},
                        "sku_id": {"type": "string", "description": "chosen SKU id from candidates, or empty if none fit"},
                        "qty": {"type": "number"},
                        "unit": {"type": "string"},
                        "keep_in_mind": {"type": "string", "description": "short boss-tone doubt note, ONLY if genuine doubt; else empty"},
                    },
                    "required": ["index", "sku_id", "qty"],
                },
            },
            "order_note": {"type": "string"},
            # THE ONE QUESTION (§5.7a). The faculty already chose WHICH line and WHICH options; this
            # is only the sentence. Empty whenever no '⚠️ DUDA' block asked for one — which is every
            # clean order, so the field costs a clean turn nothing.
            "pregunta": {"type": "string", "description": "es-ES question to the CUSTOMER about the ONE line the ⚠️ DUDA block names; empty otherwise. Never list the options — they go out as buttons."},
        },
        "required": ["lines"],
    },
}

# ─────────────────────────────── Personalisation (Sonnet) ───────────────────────────────
PERSONALISE_SYSTEM = (
    "You add the human touch to a finished order for the operator. Using the customer's usual "
    "personalisations and profile, write a brief, warm operator-facing order note (how they like it "
    "delivered/prepared, anything worth remembering) and optional per-line notes. Keep it short and "
    "genuinely useful. Do not change quantities or products. If there is nothing personal to add, "
    "return empty strings."
)

PERSONALISE_TOOL = {
    "name": "personalise_order",
    "description": "Operator-facing personalisation notes.",
    "input_schema": {
        "type": "object",
        "properties": {
            "order_note": {"type": "string"},
            "line_notes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"index": {"type": "integer"}, "note": {"type": "string"}},
                    "required": ["index", "note"],
                },
            },
        },
    },
}
