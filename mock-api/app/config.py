"""THE KIT RUNTIME · configuration and provider presence.

FEED-IA §196.5 — «maybe we need an api. idk. maybe use parsewise so its solid»
FEED-IA §196.6 — «i don't want dependencies on the actual hermes caller as that's a packed thing,
                  i want it all self contained in here, same as twilio.»

Every secret enters the process ONE way: the environment (systemd `EnvironmentFile=`). Nothing in
this repository holds a key, and nothing this service returns or logs may carry one — `redact()`
below is the single chokepoint and `logging_setup.py` runs everything through it.

`/api/health` reports a provider as `configured` or `missing` BY ENV PRESENCE ALONE (the contract in
app/src/prototypes/cedar/runtime-client.ts) — except the Copilot, which reports WHICH mind answers
(§196.2). Presence is not reachability: a configured provider can still be suspended, out of quota
or wrong. The endpoints say what actually happened; health says what was handed to the process.
"""
from __future__ import annotations

import os
import pathlib
import re
from dataclasses import dataclass, field

VERSION = "1.0.0"

# A house secret shorter than this is a password, not a secret. The artwork door reads its own
# length before it reads its value, so a placeholder can never stand in for one (§200.2, RUN-12).
ARTWORK_SECRET_FLOOR = 24

# The kit's own origins. CORS is an allow-LIST, never a wildcard: this service holds four live keys
# and a page on any other origin has no business spending them (§196.5 «for real»).
ALLOWED_ORIGIN_PATTERN = re.compile(
    r"^https://kit\.soyrocoto\.com$"
    r"|^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
)


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def _first_env(*names: str) -> str:
    for name in names:
        value = _env(name)
        if value:
            return value
    return ""


@dataclass
class Settings:
    """Read ONCE per process, at import, so a key cannot appear or vanish mid-request.

    Deliberately NOT frozen: the test suite substitutes values to drive the missing-key and
    redaction paths, and a frozen dataclass would push those tests into monkeypatching the module
    instead — testing the patch rather than the code.
    """

    parsewise_key: str = field(default_factory=lambda: _env("PARSEWISE_API_KEY"))
    parsewise_base: str = field(default_factory=lambda: _env("PARSEWISE_BASE_URL") or "https://api.parsewise.ai/api/v1")
    parsewise_budget_seconds: float = field(default_factory=lambda: float(_env("PARSEWISE_BUDGET_SECONDS") or 600))

    deepgram_key: str = field(default_factory=lambda: _env("DEEPGRAM_API_KEY"))
    deepgram_url: str = field(default_factory=lambda: _env("DEEPGRAM_URL") or "https://api.deepgram.com/v1/listen")

    # THE-LIVE-PATH §4 measured it on this box: GOOGLE_PLACES_API_KEY answers Places, Geocoding and
    # Maps JS; GOOGLE_MAPS_API_KEY is expired. So the Places key leads and Maps is the fallback,
    # never the other way round.
    places_key: str = field(default_factory=lambda: _first_env("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"))

    # ── ARTWORK (FEED-IA §200.2) ────────────────────────────────────────────────────────────
    # «You should have the whole ideogram API hooked up… it should be in the specification we can
    # make you ship from there.» One key, and three PATHS held in configuration rather than in the
    # code: the adapter is pinned by specs/intelligence/v1/image-job.schema.json, so the day the
    # provider moves an endpoint the house edits an environment file instead of shipping Python.
    ideogram_key: str = field(default_factory=lambda: _env("IDEOGRAM_API_KEY"))
    ideogram_base: str = field(default_factory=lambda: _env("IDEOGRAM_BASE_URL") or "https://api.ideogram.ai")
    ideogram_describe_path: str = field(default_factory=lambda: _env("IDEOGRAM_DESCRIBE_PATH") or "/v1/ideogram-v3/describe")
    ideogram_generate_path: str = field(default_factory=lambda: _env("IDEOGRAM_GENERATE_PATH") or "/v1/ideogram-v4/async/generate")
    ideogram_generation_path: str = field(default_factory=lambda: _env("IDEOGRAM_GENERATION_PATH") or "/v1/generations/{id}")
    # THE DOOR. Every other endpoint here spends a key that is already paid for; this one spends
    # GENERATION CREDIT per call, so reachability alone must not be permission. CORS restrains a
    # browser and nothing else, so the road carries a house secret of its own — `ARTWORK_SHARED_SECRET`,
    # presented on the `X-Rocoto-Artwork-Key` header — and an hourly ceiling that bounds what a
    # leaked secret could ever cost. Both are read here so the whole configuration is in one file.
    artwork_secret: str = field(default_factory=lambda: _env("ARTWORK_SHARED_SECRET"))
    artwork_hourly_ceiling: int = field(default_factory=lambda: int(_env("ARTWORK_HOURLY_CEILING") or 40))

    # ── THE COPILOT'S MIND (FEED-IA §196.2 · E198) ──────────────────────────────────────────
    # One seam, two providers, one choice. ⚠ THE KEYS ARE THE ONES DECLARED ABOVE FOR THE
    # HANDWRITING READER — one key per account, read once, whatever asks for it. What is separate
    # is WHICH MODEL each road runs, and that separation is the point: Google's free tier counts
    # requests PER MODEL PER DAY, so a day whose twenty reads are spent on the reader's model can
    # still answer a Copilot ask on a sibling — and `evidence.model` reports the model that
    # actually answered, never a default.
    gemini_base: str = field(default_factory=lambda: _env("GEMINI_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta")
    anthropic_base: str = field(default_factory=lambda: _env("ANTHROPIC_BASE_URL") or "https://api.anthropic.com")
    copilot_model: str = field(default_factory=lambda: (_env("COPILOT_MODEL") or "gemini").lower())
    copilot_gemini_model: str = field(default_factory=lambda: _env("COPILOT_GEMINI_MODEL") or "gemini-2.5-flash")
    copilot_anthropic_model: str = field(default_factory=lambda: _env("COPILOT_ANTHROPIC_MODEL") or "claude-fable-5-1")
    copilot_timeout_seconds: float = field(default_factory=lambda: float(_env("COPILOT_TIMEOUT_SECONDS") or 30))

    twilio_account_sid: str = field(default_factory=lambda: _env("TWILIO_ACCOUNT_SID"))
    twilio_auth_token: str = field(default_factory=lambda: _env("TWILIO_AUTH_TOKEN"))
    twilio_api_key_sid: str = field(default_factory=lambda: _env("TWILIO_API_KEY_SID"))
    twilio_api_key_secret: str = field(default_factory=lambda: _env("TWILIO_API_KEY_SECRET"))
    twilio_twiml_app_sid: str = field(default_factory=lambda: _env("TWILIO_TWIML_APP_SID"))
    # How many numbers this runtime may buy for its workspaces, in total. 0 is the default and
    # means issuance is refused by name: buying a number spends the account's balance every month.
    twilio_number_issue_limit: int = field(
        default_factory=lambda: int(_env("TWILIO_NUMBER_ISSUE_LIMIT") or 0)
    )
    # The house's own line — the number a customer sees. VOICE-00 forbids claiming a caller ID that
    # has not been proven, so an unset house number is a REFUSAL to dial, never a guess.
    house_number: str = field(default_factory=lambda: _env("ROCOTO_HOUSE_NUMBER"))
    # Click-to-call rings the operator first, then bridges to the customer (the Hermes shape:
    # channel 0 = us, channel 1 = them, which is what makes multichannel transcription exact).
    operator_number: str = field(default_factory=lambda: _env("ROCOTO_OPERATOR_NUMBER"))
    # A callback/asset origin belongs to this consumer. Deployment units and local startup set it;
    # an unconfigured runtime must never borrow the published reference's provider callbacks.
    public_base: str = field(default_factory=lambda: _env("ROCOTO_RUNTIME_PUBLIC_BASE").rstrip("/"))

    # ── ROCOTO'S OWN WHATSAPP NUMBER (the bodega rig, WIRING-SPEC §4) ────────────────────────
    # WABA 2033396113925190, number +1 978 958 9459: the mouth that sends the closing message and
    # the supplier notice (`bodega.py`). ⚠ **NEITHER NAME HAS A DEFAULT, ON PURPOSE.**
    # `backend/config.py` defaults WA_CLOUD_PHONE_ID to 1144962938711312 — another company's number
    # — so a fallback here would message a Peruvian bodega from the wrong mouth. Absent values are
    # the named 503 `bodega_whatsapp_unconfigured`, which is the honest answer.
    wa_cloud_token: str = field(default_factory=lambda: _env("WA_CLOUD_TOKEN"))
    wa_cloud_phone_id: str = field(default_factory=lambda: _env("WA_CLOUD_PHONE_ID"))
    # Authentication templates are a separate, expressly commissioned provider surface. An empty
    # name means the OTP route refuses before generating a code or spending the messaging account.
    bodega_otp_template_name: str = field(default_factory=lambda: _env("BODEGA_OTP_TEMPLATE_NAME"))
    bodega_otp_template_language: str = field(default_factory=lambda: _env("BODEGA_OTP_TEMPLATE_LANGUAGE"))
    bodega_otp_digest_key: str = field(default_factory=lambda: _env("BODEGA_OTP_DIGEST_KEY"))
    # Google Group is the fixed Play Console tester source. This is a dedicated Rocoto service
    # account with domain-wide delegation, never an operator's browser OAuth credential.
    bodega_play_testers_group: str = field(default_factory=lambda: _env("BODEGA_PLAY_TESTERS_GROUP").lower())
    bodega_play_opt_in_url: str = field(default_factory=lambda: _env("BODEGA_PLAY_OPT_IN_URL"))
    bodega_play_delegated_admin: str = field(
        default_factory=lambda: _env("BODEGA_PLAY_DELEGATED_ADMIN").lower()
    )
    bodega_play_service_account_json: str = field(
        default_factory=lambda: _env("BODEGA_PLAY_SERVICE_ACCOUNT_JSON")
    )

    # ── THE RETENTION CLOCK (VOICE-21, kept by app/retention.py) ─────────────────────────────
    # Audio with no transcript lives 30 days; transcript text lives the tenant's period, default
    # twelve months. The call RECORD's own deadline is 0 — «the tenant's business-record period» is
    # the tenant's to state, and a service that invented one would be deleting a house's books on a
    # number nobody chose. Set it and the sweep enforces it.
    #
    # ⚠ **0 MEANS THE CLOCK IS OFF, ON ALL THREE.** One meaning for one number, because the other
    # reading is a disaster: an operator who typed `ROCOTO_AUDIO_RETENTION_DAYS=0` meaning «hold
    # nothing» would, under an «age >= 0» rule, have every wav AND every transcript on the box
    # destroyed on the next sweep — including this morning's. So `sweep()` guards each rule with
    # `if <days> and age >= <days>`, and 0 keeps. A house that wants audio gone at once has that
    # already: it goes the moment its transcript is ready.
    audio_retention_days: int = field(default_factory=lambda: int(_env("ROCOTO_AUDIO_RETENTION_DAYS") or 30))
    transcript_retention_days: int = field(default_factory=lambda: int(_env("ROCOTO_TRANSCRIPT_RETENTION_DAYS") or 365))
    call_record_retention_days: int = field(default_factory=lambda: int(_env("ROCOTO_CALL_RECORD_RETENTION_DAYS") or 0))

    # ── OUR OWN PAPER (PAR-10) ─────────────────────────────────────────────────────────────
    # The handwriting reader is CHOSEN by configuration and there are two of them. `gemini` is the
    # default because it is the one proven answering from this box; `anthropic` is implemented and
    # unit-tested against a recorded answer, so switching is one environment variable and no code.
    handwriting_reader: str = field(default_factory=lambda: (_env("HANDWRITING_READER") or "gemini").strip().lower())
    # ⚠ `GEMINI_API_KEY_HELLO` is the name the repo's own env file uses; the deploy pipes it to the
    # box AS `GEMINI_API_KEY`, and this fallback means a developer running uvicorn straight off the
    # repo's env file gets the same reader the box gets, rather than a puzzling `missing`.
    gemini_key: str = field(default_factory=lambda: _first_env("GEMINI_API_KEY", "GEMINI_API_KEY_HELLO"))
    gemini_url: str = field(default_factory=lambda: _env("GEMINI_URL") or "https://generativelanguage.googleapis.com/v1beta/models")
    gemini_model: str = field(default_factory=lambda: _env("GEMINI_MODEL") or "gemini-2.5-flash")
    anthropic_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    anthropic_url: str = field(default_factory=lambda: _env("ANTHROPIC_URL") or "https://api.anthropic.com/v1/messages")
    anthropic_model: str = field(default_factory=lambda: _env("ANTHROPIC_MODEL") or "claude-fable-5-1")
    # HOW LONG A READER MAY TAKE OVER ONE PAGE. Ninety seconds was the first guess and the E196.5
    # harness measured past it: a current flash model spent 69 to 90 seconds on a page of nineteen
    # crops and its whole read was thrown away by the timeout, twice, after the model had already
    # done the work. A read that is cut at the wire costs the request AND the answer, so the ceiling
    # is four minutes and the shorter wait is the model's business, not the clock's.
    handwriting_timeout_seconds: float = field(default_factory=lambda: float(_env("HANDWRITING_TIMEOUT_SECONDS") or 240))
    # A manifest is the geometry of a sheet of paper that is in somebody's hand this week. It is
    # kept for as long as that paper is plausibly in circulation and then it goes (PAR-10.6).
    paper_manifest_days: int = field(default_factory=lambda: int(_env("ROCOTO_PAPER_MANIFEST_DAYS") or 30))

    state_dir: pathlib.Path = field(default_factory=lambda: pathlib.Path(_env("ROCOTO_RUNTIME_STATE_DIR") or "/srv/rocoto-kit-runtime"))
    transcribe_language: str = field(default_factory=lambda: _env("ROCOTO_TRANSCRIBE_LANGUAGE") or "es")
    max_upload_bytes: int = field(default_factory=lambda: int(_env("ROCOTO_MAX_UPLOAD_BYTES") or 40 * 1024 * 1024))

    @property
    def providers(self) -> dict[str, str]:
        """The health contract's names, in the contract's own order."""
        return {
            "parsewise": "configured" if self.parsewise_key else "missing",
            "deepgram": "configured" if self.deepgram_key else "missing",
            "places": "configured" if self.places_key else "missing",
            # Calling also needs this consumer's callback origin. Account metadata access alone
            # cannot make the browser's calling setup ready.
            "twilio": "configured" if (
                self.twilio_account_sid and self.twilio_auth_token and self.public_base
            ) else "missing",
            # ARTWORK SAYS WHAT IS OWED, IN ITS OWN WORDS (Peter, §200.2). The other four report
            # `missing`, a word for a key that should already be here; the artwork road is built and
            # waiting, so it says «awaiting key» — the road takes the key the moment the house
            # holds one, and nothing else about it changes. Like Twilio it needs BOTH halves: the
            # provider key it spends and the house secret that says who may spend it.
            "artwork": "configured" if self.artwork_open else "awaiting key",
            # THE COPILOT SAYS WHICH MIND ANSWERS, not merely that a key exists — the two providers
            # are one seam with one choice, and «gemini» is a different product from «anthropic» to
            # the person reading the reply. With neither key the word is «awaiting key», which is
            # what is true: the surface has a posture for it and the endpoint states it by name.
            "copilot": self.copilot_provider,
        }

    @property
    def handwriting(self) -> dict[str, str]:
        """WHICH reader is selected, and whether its key was handed to the process.

        Deliberately its own key on `/api/health` rather than a fifth entry in `providers`: the kit
        types `providers` as exactly four names (runtime-client.ts `RuntimeProvider`), and widening
        that record would be drift. This is the same additive move `code` already made (RUN-02).
        """
        reader = self.handwriting_reader if self.handwriting_reader in ("gemini", "anthropic") else "gemini"
        key = self.gemini_key if reader == "gemini" else self.anthropic_key
        return {"reader": reader, "key": "configured" if key else "missing"}

    @property
    def artwork_open(self) -> bool:
        """Both halves of the artwork road: credit to spend, and a house secret naming who spends it."""
        return bool(self.ideogram_key) and len(self.artwork_secret) >= ARTWORK_SECRET_FLOOR

    @property
    def copilot_provider(self) -> str:
        """Which mind answers: the chosen provider where its key is present, else «awaiting key»."""
        chosen = self.copilot_model if self.copilot_model in ("gemini", "anthropic") else "gemini"
        key = self.gemini_key if chosen == "gemini" else self.anthropic_key
        return chosen if key else "awaiting key"

    @property
    def secrets(self) -> tuple[str, ...]:
        """Every value that must never reach a response, a log line or a traceback."""
        return tuple(
            s for s in (
                self.parsewise_key, self.deepgram_key, self.places_key,
                self.twilio_auth_token, self.twilio_api_key_secret,
                self.gemini_key, self.anthropic_key,
                self.ideogram_key, self.artwork_secret,
                self.wa_cloud_token, self.bodega_otp_digest_key, self.bodega_play_service_account_json,
            ) if s and len(s) >= 8
        )

    def recordings_dir(self) -> pathlib.Path:
        return self.state_dir / "recordings"

    def calls_dir(self) -> pathlib.Path:
        return self.state_dir / "calls"

    def manifests_dir(self) -> pathlib.Path:
        return self.state_dir / "manifests"


settings = Settings()

# A key-shaped token in free text (a provider's own error message can quote the key back at us).
_KEYISH = re.compile(r"\b(sk-ant|sk|rk|AC|SK|dg|pw|AIza)[-_a-zA-Z0-9]{16,}\b")


def redact(text: str) -> str:
    """Replace every configured secret, and anything key-shaped, with «[redacted]»."""
    if not text:
        return text
    out = text
    for secret in settings.secrets:
        out = out.replace(secret, "[redacted]")
    return _KEYISH.sub("[redacted]", out)


def ensure_state_dirs() -> None:
    """Create the custody directories, and say so if the disk refuses (fail closed, never silent)."""
    for path in (settings.state_dir, settings.recordings_dir(), settings.calls_dir(), settings.manifests_dir()):
        path.mkdir(parents=True, exist_ok=True)
