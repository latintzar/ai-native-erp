# Security

Keep provider credentials, identity service-role keys, encryption material, database DSNs and runtime journals in owned private files or the installation’s secret store. The setup helper validates mode-0600 regular files outside the checkout and prints names/status only.

Use separate owner/runtime/control database roles. Scoped runtime work uses RLS transactions; legacy domain operations retain their explicit tenant predicates. Authentication, OAuth verification, membership, CSRF, review/automatic mode and literal business gates keep their existing responsibilities.

Founder authority and outbound account bindings require explicit installation configuration. Public fixtures contain reserved synthetic identities. Public browser bootstrap accepts only explicitly public IdP key forms. A source copy grants no access to the original project’s accounts.

The prototype API is a local developer service with separately configured provider access. A public deployment requires its own authentication, account permissions, callbacks, quotas, retention and feature integration. The personal preview gateway has a separate task/budget boundary.

Report a vulnerability privately to the maintainer through the repository’s available private reporting channel before posting exploit details. Include affected source/revision, reproduction and observed impact with values removed. Avoid real customer data and live provider effects in reports.
