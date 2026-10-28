# Design decisions

Retrospective, 28 October 2026. These decisions explain the released source and extraction. The linked original specifications retain the detailed contracts; the historical `decisions/` directory retains the earlier engineering record.

| Decision | Reason and tradeoff | Source |
|---|---|---|
| One product identity across representations | A catalogue object, order line, lot and document should agree on the business item. Units, package conversions and revision evidence remain explicit. | `THE-OBJECT-MAP.md`, catalogue/units/lot contracts |
| Shared systems before isolated screens | Business capabilities, hierarchy, identities, rules and documents should be reused across workflows. Cedar-owned models and shared kit components keep their separate responsibilities. | Cedar `PRODUCT-SPEC.md`, `THE-SYSTEM-SPEC.md` |
| Review source interpretation before commit | Extraction can propose rows; acceptance must establish the intended business records. Typed codes/units and correction evidence matter more than a plausible-looking table. | `THE-PARSING-SPEC.md`, `THE-CATALOGUE-CONTRACT-SPEC.md` |
| Events before model reasoning | The maintained runtime appends the inbound sense, then assembles bounded scoped context. Reasoning/actions/replies become events too. This trades extra explicit state for replayable evidence. | `backend/runtime.py`, `spine.py`, `THE-ARCHITECTURE.md` |
| Deterministic gates around model actions | Prices, mode, permissions and business invariants belong to code and stored records. Review and automatic operation have explicit modes. | `backend/gate.py`, `THE-AI-SPEC.md` |
| Scoped runtime role and separate control role | Transaction scope and PostgreSQL RLS enforce the runtime wall; cross-scope workers use a different role. Legacy domain predicates retain their own contract. | `backend/db.py`, `schema_rls.sql`, `KERNEL-API.md` |
| Readable product faces with recorded provenance | Existing generated paintings help recognize the same SKU across workflows. Library bytes, approved SKU associations and new generation requests remain separate evidence. | `painting-map.ts`, `sku-artwork.tsx`, artwork adapter |
| Preserve the full design and actual integration boundary | The Cedar interface and maintained backend are valuable implemented systems with a remaining data-adapter seam. Presenting that seam explicitly makes reuse testable. | `PRODUCT-MAP.md`, release capability matrix |
| Preserve original providers | Parsewise, Gemini/Anthropic, Deepgram, Ideogram, Twilio and the native connection services retain their actual adapters. A new preview funding gateway does not redefine them. | `docs/providers.md`, prototype/collection source |
| Portable history-free build | The private multi-project publisher bundles separate products and assumes Git. This release builds Cedar alone, keeps the Spanish transform and records upstream/export provenance without copying history. | `SOURCE.json`, build wrappers |
| Installation-owned authority and private configuration | Real operator identities become reserved fixtures; founder bootstrap and outbound account bindings require explicit local configuration. Keys are entered privately and diagnostics report names/status. | `tools/provider-env.py`, `backend/config.py`, `brain/teams.py` |
| Scoped public asset set | Owned/generated artwork and applicable notices travel with the release. The supplied Meta reference profile photograph stays private; the sample row uses the existing kit initials Avatar. | `NOTICE.md`, release omissions |

The first-release modifications are retrospective engineering choices. They are not presented as an invented account of decisions made earlier in the product’s history.
