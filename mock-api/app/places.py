"""NUMBER → IDENTITY, the Hermes lookup, self-contained (FEED-IA §196.6).

Peter: «the hermes shit remember i wanted to port it. the number->gmaps info was working flawlessly
… i don't want dependencies on the actual hermes caller as that's a packed thing, i want it all
self contained in here, same as twilio.»

Ported from apps/call-recorder/product/backend/pipeline.py `_google_places_lookup` / `_enrich_phone`
— the two behaviours that made it «flawless» are kept exactly and are the whole of the accuracy:

  1 · The query is the PHONE NUMBER, through `inputtype=phonenumber`. Not a name, not a scraped
      title used as a seed — pipeline.py's own comment records what seeding cost: «a granja's number
      resolved to "Cuc de Llum" because the Yelp aggregator listed both».
  2 · The candidate must match back on the last NINE digits of the number. Places will happily
      answer with something plausible; an answer that does not carry the number we asked about is
      not an identity. VOICE-00 forbids «This is Customer X» from an approximate match, so a
      non-matching candidate returns NO NAME rather than a likely one.

Two roads, in this order: the legacy Find Place endpoint (the one Hermes uses, still answering — it
is the one that accepts a phone number as the input type), then Places API v1 `searchText` with the
same nine-digit gate. Both were probed live from the box on 2026-09-04; the receipts are in
THE-RUNTIME-SPEC §RUN-05.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.places")

FIND_PLACE = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
SEARCH_TEXT = "https://places.googleapis.com/v1/places:searchText"
AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete"
PLACE_DETAILS = "https://places.googleapis.com/v1/places/{}"
FIELDS = "name,formatted_address,place_id,types,international_phone_number"


#: the two markets the workspace toggle can select (FEED-IA §247.1); the region code Google reads
ADDRESS_COUNTRIES = {"PE": "pe", "ES": "es"}


async def address_suggestions(query: str, session_token: str, country: str = "PE") -> dict[str, Any]:
    """Google Places (New) predictions for the workspace's country; key stays in this runtime.

    https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
    The country follows the same Peru/Spain toggle that selects currency and Money (§247.1), so a
    Spanish demo searches Spanish addresses. A prediction supplies the user's address choice; it
    establishes no tax or bank identity.
    """
    query = query.strip()
    if not 3 <= len(query) <= 200 or not re.fullmatch(r"[A-Za-z0-9_-]{1,36}", session_token):
        raise RuntimeError_("bad_address_query", "Enter an address and a valid search session.", 422)
    if country not in ADDRESS_COUNTRIES:
        raise RuntimeError_("bad_address_country", "Choose Peru or Spain for the address search.", 422)
    if not settings.places_key:
        raise RuntimeError_("places_missing", "Connect Google Places to search addresses.", 503)
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.post(AUTOCOMPLETE, headers={
                "X-Goog-Api-Key": settings.places_key,
                "X-Goog-FieldMask": "suggestions.placePrediction.placeId,"
                    "suggestions.placePrediction.text.text,"
                    "suggestions.placePrediction.structuredFormat.mainText.text,"
                    "suggestions.placePrediction.structuredFormat.secondaryText.text",
                "Content-Type": "application/json",
            }, json={"input": query, "sessionToken": session_token,
                     "includedRegionCodes": [ADDRESS_COUNTRIES[country]], "languageCode": "es"})
    except httpx.HTTPError:
        raise RuntimeError_("places_unavailable", "Try the address search again.", 502) from None
    if response.status_code != 200:
        raise RuntimeError_("places_unavailable", "Try the address search again.", 502)
    try:
        body = response.json()
        if (not isinstance(body, dict) or body.get("error")
                or not isinstance(body.get("suggestions", []), list)):
            raise ValueError
        suggestions = []
        for item in body.get("suggestions", [])[:5]:
            prediction = item["placePrediction"]
            place_id, text = prediction["placeId"], prediction["text"]["text"]
            structure = prediction.get("structuredFormat", {})
            main = structure.get("mainText", {}).get("text", text)
            secondary = structure.get("secondaryText", {}).get("text", "")
            if (not all(isinstance(value, str) for value in (place_id, text, main, secondary))
                    or not place_id or len(place_id) > 300 or not text or len(text) > 1000
                    or len(main) > 1000 or len(secondary) > 1000):
                raise ValueError
            suggestions.append({"placeId": place_id, "text": text,
                                "mainText": main, "secondaryText": secondary})
    except (ValueError, KeyError, TypeError, AttributeError):
        raise RuntimeError_("places_invalid_response", "Try the address search again.", 502) from None
    return {"provider": "google-places", "country": country, "suggestions": suggestions}


async def place_details(place_id: str, session_token: str) -> dict[str, Any]:
    """The pin's own coordinates for a suggestion the person already chose (Place Details, New).

    https://developers.google.com/maps/documentation/places/web-service/place-details
    The same session token that priced the autocomplete call prices this one as its close, so the
    two ride as one session the way Google's own billing expects. The answer carries only what the
    map needs — the formatted address and the coordinate — never a phone, a rating or a photo.
    """
    place_id = (place_id or "").strip()
    if not place_id or len(place_id) > 300 or not re.fullmatch(r"[A-Za-z0-9_-]{1,36}", session_token):
        raise RuntimeError_("bad_place_id", "Choose an address from the suggestions to continue.", 422)
    if not settings.places_key:
        raise RuntimeError_("places_missing", "Connect Google Places to search addresses.", 503)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                PLACE_DETAILS.format(place_id),
                headers={
                    "X-Goog-Api-Key": settings.places_key,
                    "X-Goog-FieldMask": "id,formattedAddress,location",
                },
                params={"sessionToken": session_token},
            )
    except httpx.HTTPError:
        raise RuntimeError_("places_unavailable", "Try the address search again.", 502) from None
    if response.status_code != 200:
        raise RuntimeError_("places_unavailable", "Try the address search again.", 502)
    try:
        body = response.json()
        location = body["location"]
        lat, lng = float(location["latitude"]), float(location["longitude"])
        text = str(body.get("formattedAddress") or "")
        if not (-90 <= lat <= 90 and -180 <= lng <= 180) or not text or len(text) > 1000:
            raise ValueError
    except (ValueError, KeyError, TypeError):
        raise RuntimeError_("places_invalid_response", "Try the address search again.", 502) from None
    return {"placeId": place_id, "text": text, "lat": lat, "lng": lng}


def digits(value: str) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def same_number(a: str, b: str) -> bool:
    """The nine-digit tail, exactly as pipeline.py compares it — national significant number."""
    da, db = digits(a), digits(b)
    return bool(da) and bool(db) and da[-9:] == db[-9:]


def phone_type(number: str) -> str:
    """Spain's plan is a fact, so it is READ, not guessed; everywhere else answers «unknown».

    +34 6xx and 7xx are mobile, 8xx and 9xx are fixed. No other country's plan is asserted here —
    an unknown is honest and a wrong «landline» is a claim the product would have to defend.
    """
    d = digits(number)
    if number.strip().startswith("+34") or (len(d) == 11 and d.startswith("34")) or len(d) == 9:
        national = d[-9:]
        if national and national[0] in "67":
            return "mobile"
        if national and national[0] in "89":
            return "landline"
    return "unknown"


def maps_url(place_id: str) -> str:
    return f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else ""


async def identity(number: str) -> dict[str, Any]:
    """Return the kit's `Identity`. An unmatched number is an ANSWER, not an error."""
    if not settings.places_key:
        raise RuntimeError_("places_missing", "Google Places is not configured on this runtime.", 503)
    if not digits(number):
        raise RuntimeError_("bad_number", "That is not a phone number.", 400)

    empty = {
        "number": number, "confidence": 0.0, "provider": "google-places",
        "phoneType": phone_type(number),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        found = await _find_place(client, number)
        road = "find-place"
        if not found:
            found = await _search_text(client, number)
            road = "search-text"
    if not found:
        logger.info("places: no phone-matched candidate", extra={"provider": "places", "outcome": "unmatched"})
        return empty

    logger.info("places hit via %s", road, extra={"provider": "places", "outcome": "matched"})
    return {
        "number": number,
        "name": found.get("name") or "",
        "address": found.get("address") or "",
        "placeId": found.get("place_id") or "",
        "mapsUrl": maps_url(found.get("place_id") or ""),
        "phoneType": phone_type(number),
        # The number matched back on its nine significant digits and Google returned one listing for
        # it. That is a strong identity, not a certainty — nothing here reads 1.0.
        "confidence": 0.95 if road == "find-place" else 0.9,
        "provider": "google-places",
        "types": found.get("types") or [],
    }


async def _find_place(client: httpx.AsyncClient, number: str) -> dict[str, Any] | None:
    try:
        response = await client.get(FIND_PLACE, params={
            "input": number, "inputtype": "phonenumber", "fields": FIELDS, "key": settings.places_key,
        })
        body = response.json() if response.status_code < 400 else {}
    except Exception as exc:
        logger.warning("places find-place failed: %s", exc, extra={"provider": "places"})
        return None
    return pick_find_place(body, number)


def pick_find_place(body: dict[str, Any], number: str) -> dict[str, Any] | None:
    """THE GATE, pure and testable: a candidate counts only if it carries the number we asked for."""
    for candidate in body.get("candidates") or []:
        if same_number(candidate.get("international_phone_number") or "", number):
            return {
                "name": (candidate.get("name") or "").strip(),
                "address": (candidate.get("formatted_address") or "").strip(),
                "place_id": candidate.get("place_id") or "",
                "types": candidate.get("types") or [],
            }
    return None


async def _search_text(client: httpx.AsyncClient, number: str) -> dict[str, Any] | None:
    try:
        response = await client.post(SEARCH_TEXT, headers={
            "X-Goog-Api-Key": settings.places_key,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.id,places.internationalPhoneNumber,places.types",
            "Content-Type": "application/json",
        }, json={"textQuery": number})
        body = response.json() if response.status_code < 400 else {}
    except Exception as exc:
        logger.warning("places search-text failed: %s", exc, extra={"provider": "places"})
        return None
    return pick_search_text(body, number)


def pick_search_text(body: dict[str, Any], number: str) -> dict[str, Any] | None:
    for place in body.get("places") or []:
        if same_number(place.get("internationalPhoneNumber") or "", number):
            return {
                "name": ((place.get("displayName") or {}).get("text") or "").strip(),
                "address": (place.get("formattedAddress") or "").strip(),
                "place_id": place.get("id") or "",
                "types": place.get("types") or [],
            }
    return None


def keyterms(place: dict[str, Any]) -> list[str]:
    """pipeline.py `_keyterms_for_place`, ported: the business name biases nova-3's spelling.

    Enrichment runs BEFORE transcription in Hermes precisely so the name is available here —
    Deepgram then writes «La Hummuseria» instead of «la umuseria», and no correction pass is needed.
    """
    terms: list[str] = []
    for raw in (place.get("name", ""), _neighbourhood(place.get("address", ""))):
        value = (raw or "").strip()
        if value and value.lower() not in {t.lower() for t in terms}:
            terms.append(value)
    return terms[:50]


_ADDRESS_PART = re.compile(r",\s*([^,\d]{3,40}?),\s*\d{5}")


def _neighbourhood(address: str) -> str:
    """The district a Spanish formatted address states before its postcode, when it states one."""
    match = _ADDRESS_PART.search(address or "")
    return match.group(1).strip() if match else ""
