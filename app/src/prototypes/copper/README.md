# Cedar collection service

This directory owns Cedar's persistent collection API and buyer pages. The selected flow is **direct Yape/Plin payments to the seller, Prometeo account and movement reads, and NubeFact electronic invoices**. Cedar's Money workspace creates document-bound links and consumes their receipt ledger. `runtime.__main__:application` starts this native service; the older gateway adapters and their tests remain historical experiments.

[API contract](SPEC.md) · [Cedar Money specification](../cedar/MONEY-SPEC.md) · [Payment specification](../cedar/PAYMENTS-SPEC.md) · [Company research](../../../../docs/omitted-sources.md)

## Evidence and environment

The logical environment is **development/demo**. Local HTTP tests exercise persisted workspace isolation, current balances across old links, atomic opening receipts, duplicate protection, exact receiving-account matching, NubeFact uncertain creation/query recovery, and protected merchant QR configuration. The connected browser drive uses the actual service and SQLite with separate seller/buyer browsers. Provider transport tests inject documented HTTP responses. These proofs make zero external provider calls.

Real Prometeo bank authentication, movement/reference coverage, provider refresh behavior, a seller-owned QR payment, and NubeFact seller activation/SUNAT acceptance remain commissioning work. A configured credential records setup; authenticated provider responses establish evidence. Prometeo's historical official SDK supplies the implemented transport contract; the current gated provider contract must be verified with the commissioned account.

The existing supporting address is [copper-demo.soyrocoto.com](https://copper-demo.soyrocoto.com), on loopback port `8795` of the physical `rocoto-staging` host. Its initial gateway deployment was [PR #85](../../../../docs/omitted-sources.md). This source selects the native Cedar replacement; the publication record identifies the revision actually running there. Cedar's current frontend is [demo.soyrocoto.com/cedar/](https://demo.soyrocoto.com/cedar/). [Operations and access record](../../../../docs/omitted-sources.md).

## Start locally

From the repository root, with Python 3.12 or later:

```bash
python3 -m venv ~/.local/share/rocoto/copper-venv
~/.local/share/rocoto/copper-venv/bin/pip install -r app/src/prototypes/copper/requirements.txt
PYTHONPATH=app/src/prototypes/copper ~/.local/share/rocoto/copper-venv/bin/python -m runtime init
PYTHONPATH=app/src/prototypes/copper ~/.local/share/rocoto/copper-venv/bin/python -m runtime serve
```

Open `http://127.0.0.1:8795`. Initialization atomically creates `~/.config/rocoto/copper.env` with generated operator/Fernet secrets, mode `0600`, and a private state directory at `~/.local/state/rocoto/copper`. Repeating initialization preserves the file. Retrieve `COPPER_ADMIN_TOKEN` through the private editor/company secret workflow and enter it in **Operator access**. The interface holds it in memory. Preserve the encryption key with the database.

`--config /absolute/private/copper.env` selects another private configuration. Initialization also accepts `--state-dir` and `--public-origin`. Add an exact local frontend origin to `CEDAR_ALLOWED_ORIGINS`, for example `http://127.0.0.1:8094`, when using the local Cedar app. Deployed CORS explicitly allows the configured public origin, `https://demo.soyrocoto.com` and `https://cedar-demo.soyrocoto.com`. Workspace bearer capabilities have collection scope; operator credentials stay outside the Cedar browser.

The artifact includes `runtime/`, [run.py](run.py), and [requirements.txt](requirements.txt). Its service command is `/srv/copper-preview/venv/bin/python /srv/copper-preview/current/run.py --port 8795`, defaulting to loopback. Systemd supplies the private values through `EnvironmentFile=/etc/rocoto/copper-preview.env`. Complete inherited environment values work independently of the local default configuration. Keep access logging disabled because buyer URLs carry capabilities. [Example configuration](.env.example).

## Commission the selected connections

1. **Cedar workspace.** Open a collectible priced order; its payment link registers automatically. The browser receives its own synthetic workspace capability; the operator sees that workspace's identifier and readiness. Its SQLite ledger persists across browser reloads and service restarts.
2. **Prometeo.** Configure the account's API key and explicit sandbox/live environment. Use the protected bank login API for the commissioned provider, handle its challenge/client selection, and read authenticated accounts. Select the exact receiving account through `/bank/select-account`. Bank passwords remain transient; the provider session key is encrypted server-side. Each movement refresh validates account membership and queries at most 31 days. Session renewal follows the bank's response. Enable **Automatic bank monitoring** for the commissioned live account to refresh automatically every 300 seconds (configurable up to 3600). Each run reads the last seven days, updates the selected account balance and applies exact matches. Readiness reports last attempt/success, safe error code and next run. Transient failures back off; authorization failures pause for reconnection.
3. **Merchant QR.** With live access commissioned, configure the seller's own Yape or Plin PNG/JPEG through the operator form. Confirm that it receives into the selected authenticated account. The image is validated, decoded and stored as a clean raster; its destination binding is permanent. Explicitly select the request IDs reviewed as real seller documents and confirm their collection. Only those requests receive the destination; other seeded and future requests retain their sample context. A QR setup proves the operator's destination declaration; the pilot must verify the actual recipient and received bank transaction.
4. **NubeFact.** Complete the seller's provider activation and SUNAT appointment requirements, then commission the seller-specific API URL, token and RUC. Cedar prepares a commercial billing draft and collection link before fiscal issuance. The operator commissions the seller's exclusive series/next number and account unit codes, then reviews the exact stored draft and authorizes its issuance. This reserves the fiscal number. The owner can issue after authenticated bank receipts cover the document total, or the operator can explicitly enable automatic issue at that point. The actual first-submission date in Lima, final payload and number are saved before the provider call. A timeout/crash preserves that identity for query. Definitive rejection and pre-existing-number conflicts require document review. SUNAT acceptance and collection payment remain separate records. Existing sample invoices remain sample records when provider keys are added.

`COPPER_ALLOW_LIVE=0` is the default. Set live access only in the explicitly commissioned private configuration. A live pilot needs the actual seller/bank ownership record, a real receiving QR, an observed payment and its bank movement, and the activated NubeFact seller route with its accepted document. Record account owner, consuming runtime, permitted operations and outcomes in company Operations. Automatic allocation requires one commissioned document with the exact account, currency and reference; a positive credit up to its remaining balance can pay it partly or fully. The owner movement feed retains unmatched evidence for review. The same movement allocates once. Proving that a real wallet transfer preserves the required reference remains part of commissioning.

The [API contract](SPEC.md#billing-draft-and-fiscal-owner-actions) lists normalized billing fields, owner fiscal actions and operator approval inputs. Native HTTP tests cover frozen drafts, partial payment conservation, customer/workspace isolation, numbering conflicts, real-versus-manual payment gates, automatic issue, explicit provider rejection, and uncertain submission/query recovery. These use fixture responses; real bank/SUNAT commissioning remains the provider proof step.

## Verify

With the repository verification environment, Playwright and Chromium installed:

```bash
PYTHONPATH=app/src/prototypes/copper .venv/bin/python -m pytest app/src/prototypes/copper/tests -q
.venv/bin/python drives/drive-cedar-collections.py
```

The connected drive starts isolated local services and cleans them up. Its report and screenshots are under `/tmp/cedar-collections-proof/`. HTTP fixture tests cover Prometeo and NubeFact independently. The historical `drive-copper-payments.py` explicitly imports the earlier gateway service and retains that experiment's evidence; it exercises a different runtime from the default Cedar service.

The current order-owned lifecycle proof is
[drive-cedar-order-payments.py](../../../../drives/drive-cedar-order-payments.py). It starts the native
service locally by default. `ROCOTO_PUBLISHED=1 ROCOTO_URL=https://demo.soyrocoto.com/cedar/` selects
the declared deployed sample runtime and fresh owned fixture workspaces. It verifies delivery contact,
held sending, actual buyer approval, shared owner polling and retained receipts at1600/390/320.
