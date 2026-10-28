# Mounted guest preview

This optional build runs the original browser workspace against its own loopback guest services. Each mounted app scopes its browser local/session storage and IndexedDB to its prefix. The prototype and collection APIs keep their native session and workspace contracts; collection data lives in the recipient-owned encrypted SQLite store. The guest router admits only the sample workflows and read-only setup status, and excludes provider, sending and fiscal actions. It clears inherited provider credentials and has no provider accounts configured. The account-connection service issues a Secure, HttpOnly, SameSite Strict guest cookie scoped to the mount. Default self-hosted builds and their original cookie names remain unchanged.

Use Python 3.12 with the dependencies in `mock-api/requirements.txt` and `app/src/prototypes/copper/requirements.txt`. Create a private state directory outside the checkout, then select an HTTPS origin, prefix and loopback port. The operator must configure the HTTPS reverse proxy to preserve the path and Origin headers. The guest service never accepts client-supplied provider credentials.

```sh
VITE_ATELIER_GUEST_PREFIX=/apps/example npm run build
PYTHONPATH=tools/offline python tools/guest_preview.py --origin https://preview.example.test --prefix /apps/example --state /absolute/private/guest-state --port 18582 --static app/dist --entry index.html
```

The environment variable is an explicit build option; omit it for the ordinary source. Actual first-party handlers answer API requests and optional providers report their normal unconfigured status. Each collection workspace uses its own bearer capability. The loopback network fence from `tools/offline` should be enabled for a provider-free preview.

For Cedar, run the build from `app/` with `VITE_ATELIER_GUEST_PREFIX=/apps/erp npm run build:app-en`, then run the service from the repository root with `--prefix /apps/erp --static app/dist-export-review --entry app.html`. The workspace seed uses the original Spain/fish fixture and preserves pre-existing guest workspace choices. Browser stores remain the Cedar data layer; the separate maintained PostgreSQL backend is not substituted for them.

The customer-today gateway adapter is opt-in. Set `VITE_ATELIER_AI_ORIGIN` to a recipient-operated HTTPS gateway origin when building; without it the original Copilot runtime remains the active path. `tools/preview-gateway/` contains the bounded typed task registration and its original source-system prompt. Its owner configures `ERP_PREVIEW_SITE_ORIGIN` and the gateway's separate private settings. No provider account or key is included.
