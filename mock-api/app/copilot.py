"""THE COPILOT'S MIND — one endpoint, one seam, two providers (FEED-IA §196.2 · §199.3 · E198).

Peter, 2026-09-04: «the supply issue and the catalogue shit is just suggestions but it's literally
an agent and should have the same shit like all top agents with other sessions etc.»

The kit shipped the agent's BODY — sessions, the ported chat and composer, the cards that do the
work. Behind it stood a 158-line keyword table: `hay.includes('short')`. A surface with sessions
and no mind is a chat window, so this module is the mind, and it is built the way every other
provider in this service is built: one module, httpx, the house's own error shape, nothing
retained, and a journal line that carries the cost and never the contents.

═══ WHAT IT MAY SAY, AND WHAT IT MAY NOT ══════════════════════════════════════════════════════
Every number the Copilot states comes out of the CONTEXT the kit sent with the ask — the day's
orders, the shortage ledger, the open document, the customer. The model composes sentences and
chooses proposals; it does not supply facts. That is enforced twice: the system prompt says it,
and `_ground()` below DROPS any proposal naming an order, a customer or a product that is absent
from the context it was given. A proposal that survives grounding names only what the person can
already see, which is what makes «Open order» land on the right document every time.

═══ THE PROVIDER SEAM (§199.3) ════════════════════════════════════════════════════════════════
«Gemini 2.5 Flash reads today (the key the house holds answers); Claude is the first choice the
moment the API credit exists.» So the seam is one function with two implementations, chosen by
COPILOT_MODEL, and `/api/health` reports WHICH mind answers rather than merely that a key exists.
Both are raw httpx, exactly like parsewise · deepgram · places · twilio in this same package —
one transport, one timeout discipline, one error shape, and no fifth dependency on the box.

═══ FAILING HONESTLY ══════════════════════════════════════════════════════════════════════════
A missing key is a 503 with a name. A provider that fails or runs out of time is a 502/504 with a
name — the kit reads those as «the runtime answered a failure» and stands the Copilot on its
offline posture, where the keyword flows it can still run are offered. The one case that answers
200 is a model that REPLIED in a shape this module could not read twice: the mind did answer, so
the person gets a sentence and the `answer` proposal, never a fabricated supply report.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import httpx

from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.copilot")

# ── THE CAPS ARE THE SERVER'S, NOT THE CLIENT'S ────────────────────────────────────────────────
# The kit already trims what it sends; a cap that lives only on the client is a cap a different
# client does not have. Every list below is cut here as well, and the cut is by the same rule the
# kit uses (the newest turns, the day's own orders, the worst shortages first), so a trimmed
# request and a full one produce the same prompt for the rows they share.
MAX_MESSAGES = 20
MAX_ORDERS = 40
MAX_STOCK = 60
MAX_LINES = 30
MAX_ASK = 2000
MAX_TEXT = 1200

def model_name(provider: str) -> str:
    """The model that will actually answer. `evidence.model` reports THIS, never a default."""
    return settings.copilot_gemini_model if provider == "gemini" else settings.copilot_anthropic_model

PROPOSAL_KINDS = ("supply-report", "drafts", "open-order", "open-chat", "stock-note", "answer")

# WHAT THE PERSON READS WHEN THE MIND ANSWERED IN A SHAPE THIS MODULE COULD NOT READ. It says
# what is and what to do next — the copy law: a sentence about the failure is a sentence about the
# wrong subject.
RETRY_SENTENCE = (
    "Let me have that one again. Ask in a sentence, or start a supply report and I will lay out "
    "the orders it touches."
)

SYSTEM = """You are the Copilot in Rocoto, the operations desk of a Spanish fresh-food distributor.

WHO YOU ARE
You work beside one person at that desk: the person who answers customers, fixes the day's orders
and sends the delivery notes out. You read what the desk already holds — today's orders and their
flags, the shortage ledger, the open document, the customer whose conversation is open — and you
propose the next act. The person accepts it. Every act stays theirs.

WHAT YOU MAY SAY
Every quantity, price, availability, order number, customer name and product name you state comes
out of the CONTEXT block below. Where the context is silent, say what you can do instead. You may
count, compare, sort and summarise what the context holds; supplying a figure it does not hold is
the one thing that would make you useless at this desk.

HOW YOU WRITE
English, in plain words a tired person reads on the first pass. Short, complete sentences, each one
standing on its own. Say what is, rather than what is absent — a sentence about what is missing
spends the reader's attention on the wrong thing. Name the orders a proposal touches by their number
and their customer. Skip idioms and skip exclamation marks. Two or three sentences answer most asks;
the proposals carry the work.

WHAT YOU PROPOSE
Answer with JSON alone — no prose around it, no code fence — in exactly this shape:

{"reply": {"text": "<what you say to the person>"},
 "proposals": [ <zero or more of the proposals below> ]}

  {"kind": "supply-report", "product": "<a product in the context>", "orderIds": ["<order id>"]}
      Open the supply report on this product, with the orders it touches already laid out.
  {"kind": "drafts", "drafts": [{"orderId": "<order id>", "customer": "<their name>",
                                 "text": "<the message to that customer>"}]}
      One drafted customer message per affected order, ready for the person to read and send.
      A draft is what the customer reads: one or two sentences, addressed to them, naming the
      product and what the house can do about it. Draft only for the orders that are actually
      affected, and leave the order alone where it is covered.
  {"kind": "open-order", "orderId": "<order id>"}      Open that document.
  {"kind": "open-chat", "customerId": "<customer id>"} Open that customer's conversation.
  {"kind": "stock-note", "product": "<product>", "text": "<one line about the floor>"}
  {"kind": "answer"}                                   The words alone answer the ask.

Every id you name exists in the context. A proposal naming anything else is dropped before the
person sees it, so name what is there."""


class Invalid(Exception):
    """The model replied, in a shape this module could not read. Carries what to feed back."""


# ── SHAPING WHAT CAME IN ───────────────────────────────────────────────────────────────────────

def _text(value: Any, limit: int = MAX_TEXT) -> str:
    return str(value or "").strip()[:limit]


def _number(value: Any) -> float | int | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if out != out or out in (float("inf"), float("-inf")):
        return None
    return int(out) if out == int(out) else round(out, 3)


def _lines(raw: Any, prices: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in (raw or [])[:MAX_LINES]:
        if not isinstance(line, dict):
            continue
        product = _text(line.get("product"), 120)
        if not product:
            continue
        row: dict[str, Any] = {"product": product, "qty": _number(line.get("qty")), "unit": _text(line.get("unit"), 24)}
        if prices and _number(line.get("price")) is not None:
            row["price"] = _number(line.get("price"))
        out.append(row)
    return out


def shape(payload: dict[str, Any]) -> dict[str, Any]:
    """The request, cut to this service's own caps and to the fields the prompt names.

    Anything else the client sent is DROPPED here rather than forwarded: the prompt is built from
    this dict alone, so a field nobody documented cannot reach a provider by accident.
    """
    if not isinstance(payload, dict):
        raise RuntimeError_("bad_request", "The Copilot takes a JSON object.", 400)
    ask = _text(payload.get("ask"), MAX_ASK)
    if not ask:
        raise RuntimeError_("bad_request", "The Copilot needs an `ask`.", 400)

    session = payload.get("session") if isinstance(payload.get("session"), dict) else {}
    messages: list[dict[str, str]] = []
    for message in (session.get("messages") or [])[-MAX_MESSAGES:]:
        if not isinstance(message, dict):
            continue
        role = "copilot" if message.get("role") == "copilot" else "person"
        body = _text(message.get("text"))
        if body:
            messages.append({"role": role, "text": body, "at": _text(message.get("at"), 40)})

    raw = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    document = raw.get("document") if isinstance(raw.get("document"), dict) else None
    orders: list[dict[str, Any]] = []
    for order in (raw.get("orders") or [])[:MAX_ORDERS]:
        if not isinstance(order, dict) or not _text(order.get("id"), 80):
            continue
        orders.append({
            "id": _text(order.get("id"), 80),
            "number": _text(order.get("number"), 40),
            "customer": _text(order.get("customer"), 120),
            "customerId": _text(order.get("customerId"), 80),
            "state": _text(order.get("state"), 40),
            "flags": [_text(flag, 160) for flag in (order.get("flags") or [])[:6] if _text(flag, 160)],
            "lines": _lines(order.get("lines"), prices=False),
        })

    stock: list[dict[str, Any]] = []
    for row in (raw.get("stock") or [])[:MAX_STOCK]:
        if not isinstance(row, dict) or not _text(row.get("product"), 120):
            continue
        entry: dict[str, Any] = {
            "product": _text(row.get("product"), 120),
            "available": _number(row.get("available")),
            "unit": _text(row.get("unit"), 24),
        }
        if _text(row.get("expected"), 160):
            entry["expected"] = _text(row.get("expected"), 160)
        stock.append(entry)

    customer = raw.get("customer") if isinstance(raw.get("customer"), dict) else None
    context: dict[str, Any] = {
        "day": _text(raw.get("day"), 40),
        "area": _text(raw.get("area"), 40),
        "document": None if not document else {
            "number": _text(document.get("number"), 40),
            "customer": _text(document.get("customer"), 120),
            "state": _text(document.get("state"), 40),
            "lines": _lines(document.get("lines"), prices=True),
        },
        "orders": orders,
        "stock": stock,
        "customer": None if not customer else {
            "name": _text(customer.get("name"), 120),
            "tariff": _text(customer.get("tariff"), 60),
            **({"rhythm": _text(customer.get("rhythm"), 160)} if _text(customer.get("rhythm"), 160) else {}),
        },
    }
    return {"ask": ask, "messages": messages, "context": context}


# ── THE PROMPT ─────────────────────────────────────────────────────────────────────────────────

def build_prompt(shaped: dict[str, Any]) -> tuple[str, str]:
    """(system, user) — DETERMINISTIC. The same request builds the same two strings, forever.

    Nothing here reads a clock, a random source or an environment: the day is the kit's own day
    and the transcript is the session's. That is what lets `test_copilot.py` hold the whole prompt
    as a snapshot, which is the only way an edit to these words shows up as a diff someone reads
    rather than as a change in what the agent says on a Tuesday.
    """
    context = json.dumps(shaped["context"], ensure_ascii=False, indent=2, sort_keys=False)
    transcript = "\n".join(
        f"{'The person' if message['role'] == 'person' else 'You'}: {message['text']}"
        for message in shaped["messages"]
    )
    user = f"CONTEXT (this desk, right now)\n{context}\n\n"
    if transcript:
        user += f"THIS SESSION SO FAR\n{transcript}\n\n"
    user += f"THE ASK\n{shaped['ask']}\n\nAnswer with the JSON object alone."
    return SYSTEM, user


# ── THE TWO MINDS, ONE SEAM ────────────────────────────────────────────────────────────────────

async def _gemini(client: httpx.AsyncClient, system: str, turns: list[dict[str, str]]) -> tuple[str, int]:
    """Gemini 2.5 Flash — the mind that answers today (§199.3)."""
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": turn["role"], "parts": [{"text": turn["text"]}]} for turn in turns],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 4096, "responseMimeType": "application/json"},
    }
    response = await client.post(
        f"{settings.gemini_base}/models/{settings.copilot_gemini_model}:generateContent",
        headers={"x-goog-api-key": settings.gemini_key, "Content-Type": "application/json"},
        json=body,
    )
    if response.status_code >= 400:
        raise RuntimeError_("copilot_failed", f"Gemini answered {response.status_code}.", 502)
    data = response.json()
    candidates = data.get("candidates") or []
    parts = (candidates[0].get("content", {}).get("parts") if candidates else []) or []
    text = "".join(part.get("text", "") for part in parts)
    tokens = int((data.get("usageMetadata") or {}).get("totalTokenCount") or 0)
    return text, tokens


async def _anthropic(client: httpx.AsyncClient, system: str, turns: list[dict[str, str]]) -> tuple[str, int]:
    """Claude Fable 5.1 — the first choice the moment the credit exists (§199.3 · §199.6).

    Raw httpx rather than the SDK, for the reason the module header states: this service holds one
    transport, one timeout discipline and one error shape across five providers, and a sixth
    dependency shipped to the box to speak one documented REST endpoint buys none of that back.
    Thinking is always on for this model and takes no parameter; effort is what tunes it.
    """
    body = {
        "model": settings.copilot_anthropic_model,
        "max_tokens": 4096,
        "system": system,
        "output_config": {"effort": "low"},
        "messages": [{"role": "user" if turn["role"] == "user" else "assistant", "content": turn["text"]} for turn in turns],
    }
    response = await client.post(
        f"{settings.anthropic_base}/v1/messages",
        headers={
            "x-api-key": settings.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json=body,
    )
    if response.status_code >= 400:
        raise RuntimeError_("copilot_failed", f"Anthropic answered {response.status_code}.", 502)
    data = response.json()
    text = "".join(block.get("text", "") for block in (data.get("content") or []) if block.get("type") == "text")
    usage = data.get("usage") or {}
    tokens = int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0)
    return text, tokens


PROVIDERS = {"gemini": _gemini, "anthropic": _anthropic}


# ── READING THE ANSWER, AND GROUNDING IT ───────────────────────────────────────────────────────

_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.S)


def _json_object(text: str) -> dict[str, Any]:
    """The object the model meant, or `Invalid` carrying what to feed back on the retry."""
    body = text.strip()
    fenced = _FENCE.match(body)
    if fenced:
        body = fenced.group(1).strip()
    if not body:
        raise Invalid("The answer was empty. Answer with the JSON object alone.")
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as error:
        # A model that wrapped the object in a sentence still gets one honest chance: take the
        # outermost braces and try those, then say exactly what failed.
        start, end = body.find("{"), body.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(body[start:end + 1])
            except json.JSONDecodeError:
                raise Invalid(f"That was not valid JSON ({error.msg}). Answer with the JSON object alone.") from error
        else:
            raise Invalid(f"That was not valid JSON ({error.msg}). Answer with the JSON object alone.") from error
    if not isinstance(parsed, dict):
        raise Invalid("The answer must be a JSON object with `reply` and `proposals`.")
    return parsed


def _ground(proposals: Any, context: dict[str, Any]) -> list[dict[str, Any]]:
    """Keep the proposals that name things the person can already see; drop the rest.

    THIS IS THE HALF THAT DOES NOT TRUST THE MODEL. «Open order» on an id that is not on the day's
    book opens nothing and teaches the person that the agent's buttons are a lottery; a drafted
    message to a customer who has no order today is a message about goods nobody ordered. So the
    ids are checked against the context that was sent, and a proposal whose whole reason for
    existing is gone goes with it.
    """
    orders = {order["id"]: order for order in context["orders"]}
    numbers = {order["number"]: order for order in context["orders"] if order["number"]}
    customers = {order["customerId"] for order in context["orders"] if order["customerId"]}
    known_products = {row["product"].lower() for row in context["stock"]}
    for order in context["orders"]:
        known_products.update(line["product"].lower() for line in order["lines"])
    if context["document"]:
        known_products.update(line["product"].lower() for line in context["document"]["lines"])

    def order_id(value: Any) -> str:
        said = _text(value, 80)
        if said in orders:
            return said
        return numbers[said]["id"] if said in numbers else ""

    kept: list[dict[str, Any]] = []
    for raw in (proposals if isinstance(proposals, list) else [])[:6]:
        if not isinstance(raw, dict):
            continue
        kind = _text(raw.get("kind"), 40)
        if kind not in PROPOSAL_KINDS:
            continue
        if kind == "answer":
            kept.append({"kind": "answer"})
        elif kind == "open-order":
            found = order_id(raw.get("orderId"))
            if found:
                kept.append({"kind": "open-order", "orderId": found})
        elif kind == "open-chat":
            said = _text(raw.get("customerId"), 80)
            if said in customers:
                kept.append({"kind": "open-chat", "customerId": said})
        elif kind == "stock-note":
            product = _text(raw.get("product"), 120)
            note = _text(raw.get("text"), 400)
            if product.lower() in known_products and note:
                kept.append({"kind": "stock-note", "product": product, "text": note})
        elif kind == "supply-report":
            product = _text(raw.get("product"), 120)
            ids = [found for found in (order_id(one) for one in (raw.get("orderIds") or [])[:MAX_ORDERS]) if found]
            entry: dict[str, Any] = {"kind": "supply-report", "orderIds": ids}
            if product.lower() in known_products:
                entry["product"] = product
            kept.append(entry)
        elif kind == "drafts":
            drafts = []
            for draft in (raw.get("drafts") or [])[:MAX_ORDERS]:
                if not isinstance(draft, dict):
                    continue
                found = order_id(draft.get("orderId"))
                body = _text(draft.get("text"), 800)
                if found and body:
                    drafts.append({
                        "orderId": found,
                        "customer": _text(draft.get("customer"), 120) or orders[found]["customer"],
                        "text": body,
                    })
            if drafts:
                kept.append({"kind": "drafts", "drafts": drafts})
    return kept


def read(text: str, context: dict[str, Any]) -> dict[str, Any]:
    """The model's words → the kit's contract, or `Invalid` with the sentence to feed back."""
    parsed = _json_object(text)
    reply = parsed.get("reply")
    said = _text(reply.get("text"), 4000) if isinstance(reply, dict) else _text(reply, 4000)
    if not said:
        raise Invalid("`reply.text` was missing. Answer with {\"reply\": {\"text\": \"…\"}, \"proposals\": [...]}.")
    return {"reply": {"text": said}, "proposals": _ground(parsed.get("proposals"), context)}


# ── THE ENDPOINT'S OWN WORK ────────────────────────────────────────────────────────────────────

async def ask(payload: dict[str, Any]) -> dict[str, Any]:
    """One ask, one answer, at most two attempts, inside one budget.

    THE RETRY IS THE ERROR FED BACK, not the same request sent twice: a model that answered with a
    sentence around its JSON is told precisely that, in the turn after its own answer, which is the
    correction it can act on. Two invalid answers is where this stops — a third attempt spends the
    person's wait on the same mistake.
    """
    provider = settings.copilot_provider
    if provider == "awaiting key":
        raise RuntimeError_("copilot_unconfigured",
                            "The Copilot's mind is awaiting its key on this runtime.", 503)

    shaped = shape(payload)
    system, user = build_prompt(shaped)
    call = PROVIDERS[provider]
    model = model_name(provider)
    started = time.time()
    budget = settings.copilot_timeout_seconds
    turns = [{"role": "user", "text": user}]
    tokens = 0
    complaint = ""

    async with httpx.AsyncClient(timeout=httpx.Timeout(budget, connect=10.0)) as client:
        for attempt in (1, 2):
            try:
                text, spent = await call(client, system, turns)
            except RuntimeError_:
                raise
            except httpx.TimeoutException as error:
                raise RuntimeError_("copilot_timeout",
                                    f"The Copilot's mind did not answer within {int(budget)}s.", 504) from error
            except Exception as error:  # transport, decoding, a provider shape nobody has seen
                raise RuntimeError_("copilot_failed",
                                    f"The Copilot's mind failed: {type(error).__name__}.", 502) from error
            tokens += spent
            try:
                answer = read(text, shaped["context"])
            except Invalid as error:
                complaint = str(error)
                logger.info("copilot answer refused", extra={
                    "provider": provider, "outcome": f"invalid_attempt_{attempt}",
                    "ms": int((time.time() - started) * 1000),
                })
                if attempt == 2 or time.time() - started > budget:
                    break
                # THE MODEL'S OWN WORDS GO BACK IN, then the correction — an assistant turn it can
                # see it wrote, so the retry is a conversation rather than a louder repeat.
                turns = [
                    {"role": "user", "text": user},
                    {"role": "model", "text": text[:MAX_TEXT]},
                    {"role": "user", "text": f"{complaint} Answer again with the JSON object alone."},
                ]
                continue
            ms = int((time.time() - started) * 1000)
            logger.info("copilot answered", extra={
                "provider": provider, "outcome": f"{len(answer['proposals'])} proposals",
                "ms": ms, "tokens": tokens, "kind": model,
            })
            return {**answer, "evidence": {"model": model, "ms": ms, "tokens": tokens}}

    ms = int((time.time() - started) * 1000)
    logger.warning("copilot answered outside the contract", extra={
        "provider": provider, "outcome": "invalid", "ms": ms, "tokens": tokens, "kind": model,
    })
    return {
        "reply": {"text": RETRY_SENTENCE},
        "proposals": [{"kind": "answer"}],
        "evidence": {"model": model, "ms": ms, "tokens": tokens},
    }
