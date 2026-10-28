# Own provider keys

The original provider adapters remain separate from the maintained backend and from the personal preview allowance gateway. Select the account owner and intended capability before configuring it.

## Configure a local capability

Choose an absolute path outside the checkout. Use a private terminal for hidden input:

```sh
.venv/bin/python tools/provider-env.py configure \
  --file /absolute/private/rocoto/providers.env \
  --provider copilot-gemini
```

The helper prompts for the selected key, writes a mode-0600 file in a mode-0700 directory and prints status only. It accepts an explicit `--model` for the selected Copilot branch. Use a model supported by your own account; model defaults and endpoint settings remain in `mock-api/app/config.py`.

The new-key Gemini profile selects `gemini-3.5-flash-lite`. Google currently restricts the original `gemini-2.5-flash` default to accounts that used it previously and recommends newer models for new accounts. The original adapter remains; `--model` selects an installation’s supported model. Verified 28 October 2026 against [Google’s model catalogue](https://ai.google.dev/gemini-api/docs/models). The source Anthropic default, `claude-fable-5-1`, is listed in [Anthropic’s current model overview](https://platform.claude.com/docs/en/about-claude/models/overview). Documentation support and actual account acceptance remain distinct checks.

```sh
.venv/bin/python tools/provider-env.py doctor \
  --file /absolute/private/rocoto/providers.env
make dev RUNTIME_ENV=/absolute/private/rocoto/providers.env
```

`doctor` reports configured names and presence, with zero provider calls. `make dev` supplies only the selected private file to its prototype runtime, preserving checkout-owned state and loopback callback origins. A key exported for an unrelated task is excluded. The helper executes no shell expansion and offers no command that prints secret values.

An agent can prepare installation, inspect the relevant adapter and run masked diagnostics. The account owner supplies values through hidden terminal input or an owned private file/secret store. Keep key values out of agent conversation, source, screenshots, URLs and browser storage.

## Implemented branches

| Capability | Helper selection / private names | Actual source |
|---|---|---|
| Copilot, Gemini | `copilot-gemini`; `GEMINI_API_KEY`, `COPILOT_MODEL=gemini` | `mock-api/app/copilot.py` |
| Copilot, Anthropic | `copilot-anthropic`; `ANTHROPIC_API_KEY`, `COPILOT_MODEL=anthropic` | Same adapter, selected branch |
| Document extraction | `documents`; `PARSEWISE_API_KEY` | `mock-api/app/parsewise.py` |
| Speech transcription | `transcription`; `DEEPGRAM_API_KEY` | `mock-api/app/deepgram.py` |
| Business/place identity | `places`; `GOOGLE_PLACES_API_KEY` | `mock-api/app/places.py` |
| Artwork | `artwork`; `IDEOGRAM_API_KEY`, generated private `ARTWORK_SHARED_SECRET` | `mock-api/app/artwork.py` |

Artwork setup starts with a one-request hourly ceiling. The service’s secret header, provider request/polling and durable evidence are distinct from `sku-artwork.tsx`, which records local UI requests and approved/uploaded images. The UI request store is a design seam; the release does not assert an automatic UI→Ideogram pipeline.

Phone, email, WhatsApp, bank and fiscal integrations require their own application identifiers, callback origins, permissions and account commissioning. Their selected contracts remain in Cedar’s connection specifications and the native collection service. Provider credentials alone establish configuration presence. Account acceptance, recipient authorization, delivery and fiscal acceptance require their own measured proof.

## Backend identity and browser values

The backend reads its declared environment names from `.env.example`. Keep owner/runtime/control DSNs, service-role credentials, encryption keys and provider secrets private. The legacy Control Room/Playbook browser bootstrap now reads the installation’s public Supabase URL and an explicitly public anon/publishable key. Service-role and secret keys are excluded from that public bootstrap.

Ordinary application authentication, membership checks, CSRF, tenant scope and action gates remain in force. Local service adapters use your declared account and state; the shared public preview budget is a separate server-side feature integration.

## Optional public support

Set VITE_SUPPORT_WIDGET_URL in app/.env to your installation's Zendesk Messaging snippet URL. It must use HTTPS, static.zdassets.com/ekr/snippet.js and its single public UUID widget key. The key is a browser identifier, separate from provider secrets. An empty or invalid setting opens the project's GitHub issues; it creates no widget script and invokes no ambient widget/account. The original business widget binding remains in private source provenance.
