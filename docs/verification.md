# Verification

Preparation date: 28 October 2026. Python 3.12 and Node 22.23.2. Model/provider/GPU calls: **0**.

## Source and installation

The source export was selected from exact Git blobs at `12d77d610c82a21c602a7706861f043e16607a74`; its authority is recorded in `SOURCE.json`. It carries no private Git history. `docs/release/source-baseline.json` records original file hashes; release changes and omitted scope are described separately.

A new npm dependency installation and a new Python `.venv` were created in the release copy. `pip check` passes. Compatible dependency updates and the tested ExcelJS UUID override produce zero npm audit findings at preparation time. Python 3.12 is the verified backend version; its current voice code uses that version’s standard-library `audioop`.

## Checks

| Check | Result |
|---|---|
| Cedar English + Spanish source-export build | Passed; receipt identifies `source-export`, upstream pin and both entry hashes |
| App and scenario TypeScript checks | Passed |
| Shared kit build | Passed |
| Retained frontend tool suite | 55 files passed; separate Bodega source/tests belong to Peru |
| Prototype API fixture suite | 330 passed, 3 existing skips |
| Native collection fixture suite | 249 passed, 49 subtests passed |
| Private provider-file security checks | 6 passed |
| Installation-owned founder/public IdP bootstrap | 11 passed |
| Native PostgreSQL starter | Migration, data, ordinary HTTP/auth/CSRF, RLS and restart persistence passed |

The prototype and native collection suites run separately because their original test helpers use different `conftest` modules. Combining both directories into one pytest collection is not their supported invocation.

`tools/offline-python.py` removes inherited provider credentials, selects an explicit proof-only socket fence and disables model-hub network access. Its fence allows loopback PostgreSQL/HTTP and rejects outside DNS/connections. Application operation uses the ordinary launcher separately.

The native PostgreSQL receipt records one tenant, owner/member, three products, two customers and two orders. It verifies approval, a set-once 1,650-cent value snapshot, authenticated weight/audit persistence, CSRF/session revocation and both application/runtime tenant boundaries. PostgreSQL is stopped/restarted before the final order read. The proof owns a new private cluster and accepts no arbitrary database target.

## Presentation and remaining acceptance

`docs/assets/erp` records the six exact source-derived components, original painting bytes, capture CSS/renderer and source/build hashes. The native paste capture leaves Add ready; a generation or submitted import is not inferred from that image.

External identity, model quality, provider delivery, seller bank/QR and fiscal acceptance remain account-specific commissioning. The full backend database/vital suite retains its Docker runner; this preparation’s native persistent slice is reported at its exact scope. GitHub CI status belongs to the published release and is not inferred from these local results.

Build warnings about large existing chunks and ineffective dynamic imports remain visible. Their performance work is separate from the verified source extraction; the original component and provider architecture has been preserved.
