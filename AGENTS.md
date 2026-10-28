# Agent setup

This is the personal public-source derivative of Rocoto’s original AI-native ERP. `SOURCE.json` pins the upstream source; `RELEASE-STATUS.md` records the extraction and proof boundaries. The authoritative mixed original keeps its own protected workflow.

1. Read `README.md`, `docs/getting-started.md` and the subject’s source/specification. Establish whether the change belongs to Cedar, the maintained backend, the shared kit, prototype APIs or the collection service.
2. Use Node 22.12+ and Python 3.12. `make install-ui` provides the first interactive result; `make install` adds the isolated Python environment. Use the existing components, theme, domain models and provider adapters.
3. Start with synthetic records. `make starter-proof` provisions its own native PostgreSQL cluster and proves persistence/RLS with captured effects. Tests run with clean credentials and a loopback-only Python network fence. Ordinary app operation is a separate command.
4. For optional providers, select the account owner and exact capability first. `tools/provider-env.py configure` uses a hidden local terminal prompt and writes an owned mode-0600 file outside the checkout. Keep values in a private file or secret store. `doctor` prints names/status only. Do not request or echo keys in conversation, source, URLs, browser storage or logs.
5. `make dev RUNTIME_ENV=/absolute/private/providers.env` loads that selected file into the checkout-owned prototype runtime. Provider credentials exported for another task are excluded. The existing provider branches remain authoritative; the preview allowance gateway is a separate integration.
6. Inspect a provider request’s implemented input, approval and external effects before exercising it. Key presence and fixture transport tests establish different evidence from actual account acceptance. This release’s preparation used zero model/provider calls.
7. Run the checks appropriate to the changed subsystem. Keep public documentation and source navigation current. Preserve existing third-party notices. Capture actual UI components for product visuals and retain their source/proof record.

The Cedar browser does not currently use the maintained backend as its universal data adapter. Keep that boundary explicit when adding a real feature; use the domain APIs and scoped records rather than replacing the product with a generic completion.
