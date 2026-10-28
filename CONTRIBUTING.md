# Contributing

Read `AGENTS.md`, the subject’s source and its specification. Keep Cedar models, shared components, maintained backend and provider services in their declared layers.

Start with `make install-ui && make dev-ui`; use `make install` for Python checks and `make starter-proof` for the owned persistent backend walkthrough. `make check-ui`, `make test-prototype`, `make test-collections` and `make test-setup` cover the retained subsystems. `make test-backend` and `make vitals` use their own Docker PostgreSQL lifecycle.

Use synthetic data, scoped local resources and fixture provider transports for development. Keep credentials/runtime state outside source. A provider/account proof records exactly the operation and receipt it establishes. Add a regression for a meaningful invariant or failure, then document the resulting behaviour.

Use a branch and pull request for review. Keep changes focused; include the affected contract, useful validation and any remaining integration boundary. Preserve ownership/notices. `make source-reference` refreshes the source navigation after symbols move.
