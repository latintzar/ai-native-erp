# Website restoration

## Original source

The retained `rocoto-site` Git store contains the food-distributor marketing website at `c9c41946d4376d858833dfe8ccd9e77c8336ca41`, dated 8 September 2026. Its README identifies the split website, product and company repositories. That commit restored the editable islands from the original product snapshot `76d7ab50653dde26089c3f620233172e8856e1b1` (`v0.196.0`). Later site revisions changed the root product toward Peru and retail; this restoration selects the earlier distributor website deliberately.

The public personal ERP’s previous `website/index.html` was a later one-page presentation. It retained selected artwork and captures. The original website has separate sales, purchasing, owner, custom-agent and onboarding pages, in English and Spanish. This package recovers those pages rather than replacing them with a new design.

`provenance/source-inventory.json` records each original Git path/blob and SHA-256, plus the public derivative’s changes. The source files remain in their original owners’ repositories. This package is a separately reviewed derivative.

## Preserved work

- The original Spanish and English homepage, product subpages and sample operating report.
- Original `ComposerBirth`, `RiverResolve`, `PrecioLoop`, `TriptychKit` and the six current shot-library components.
- The website’s original token, shadow, hero, section, app-motion and shot styles.
- Original face artwork, seafood imagery, report cover and public market photograph.
- Local Inter and Fraunces font bytes with their OFL notices.

The visual components keep their authored sample data and animations. Their interactive frames demonstrate the original product design. The reusable ERP, live services and current implementation scope are documented in the [public product repository](https://github.com/latintzar/ai-native-erp).

## Public derivative

The original general entry also imported sign-in, account callbacks, CRM, lead capture, booking and call components. It is replaced by `src/marketing.tsx`, a dependency-closed entry containing only the original pure visual mounts. The old generated bundle and its account bindings are excluded.

The public adoption actions lead to the current ERP demo, repository and documentation. Old company login, booking, WhatsApp and customer-service routes are rerouted. Historical legal links point to the reusable source’s security documentation rather than offering a new contract with the former service. The September 2026 commercial proposal is explicitly dated; its prices describe that original proposal.

The catalogue-upload, join, account callback, portal, admin, private bodega directory and customer pages are excluded from the runnable website. Their original filenames are retained in the inventory, with the source revision. The ERP source contains the catalogue and import implementation for further work.

All initial resources are local. The original remote font CSS is replaced by the licensed local fonts. Former monospaced interface text uses Inter. The static package has no provider/client credentials, account session loader, submission endpoint, analytics or paid-provider client.

## Stage

This is a source-complete, locally reviewable static restoration. Domain activation, deployment and replacing the personal ERP repository’s website require the owner’s reviewed publication step. Canonical `soyrocoto.com` routing is unchanged by this recovery.
