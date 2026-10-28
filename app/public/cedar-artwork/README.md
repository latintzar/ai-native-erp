# Cedar feature artwork

Owner: Rocoto / Cedar. Environment: development. The system that makes these files, their
references, prompts, candidates and receipts is [`library/illustrations`](../../../docs/omitted-sources.md);
this directory holds only the installed copies the app reads through `FeatureArtwork` and
`HeroArtwork` (`app/src/prototypes/cedar/feature-artwork.tsx`).

## Feature objects

Register (FEED-IA §247.5): Uber's 3D illustration, one solid matte object on a clean white ground,
simple stylized forms, clear at the size it is drawn (88–184 px). The four objects are one set:
every new object is an Ideogram remix of the wallet anchor using the anchor's own verbatim
description with only the subject changed, reviewed on a contact sheet at 184/120/88 px before
installation. The images are decorative; account and provider status comes from adjacent text.

| File | Drawn at | Object | Provenance |
|---|---|---|---|
| `working-capital.png` | Money → Future working-capital card | sage leather wallet, gold coins, receipt, sprout | built-in generation 2026-09-10 plus a background edit; kept as the set's anchor («the original wallet image we had was good») |
| `delivery-batch.png` | workspace entrance, setup completion, delivery preparation | open sage fish crate on ice with two fish, a clipped packing slip and a coral check seal | Ideogram remix of the anchor, frame B, 2026-09-11 |
| `phone-connection.png` | the call entry while phone setup is needed | powder-blue desk telephone with handset, cream keypad and coral light | Ideogram remix of the anchor, frame B, 2026-09-11 |
| `email-connection.png` | the email entry while mailbox setup is needed | cream envelope with a coral seal in a powder-blue letter tray | Ideogram remix of the anchor, frame B, 2026-09-11 |

Frame B is frame A (the anchor's verbatim description) plus one clause: «The surfaces carry a mild
hand-painted Studio Ghibli softness in their light and colour while the forms stay solid and clear.»
Exact prompts: `library/illustrations/prompts/<file>.txt`. Hashes and sizes:
`library/illustrations/accepted/receipts.json`. The 10 September objects the set replaces are kept
under `library/illustrations/references/`; the rejected flat and painterly attempts under
`library/illustrations/candidates/`. No credential is stored with the assets.

## Heroes

Register (FEED-IA §247.6): Uber's modal illustration — one full-bleed flat scene across the top of
a dialog at 3:2, above its title, in the anatomy image · title · body · one primary action. Drawn
by `HeroArtwork` with empty alt text, because the title below it carries the content. The anchor is
Uber's own «Community Guidelines» hero, held privately at
`library/illustrations/references/uber-community-guidelines-hero.jpeg`; only Cedar's own generated
hero ships. Files are named `hero-<subject>.png` and reviewed at the width the popup draws them —
800 px inside the desk dialog at 1600, the full frame width at 390.

| File | Drawn at | Subject | Provenance |
|---|---|---|---|
| `hero-working-capital.png` (16:9, phone) · `hero-working-capital-wide.png` (21:9, desk band) | the Pay over time dialog, full width above its title | the distributor and one of their team loading crates of fresh fish on ice at the wholesale fish terminal at dawn into a plain white van; a Peruvian place, no lettering | Ideogram 4 generation from the anchor's style words and the dialog's own subject, 13 September 2026; prompt at `library/illustrations/prompts/hero-working-capital.txt`; hashes in `accepted/receipts.json` |

A hero belongs where a flow starts, a feature is introduced or a notice must be read; the Pay
over time dialog is Cedar's one seat today. The rule, the method and the rejected record are under
«Hero register» in [`library/illustrations`](../../../docs/omitted-sources.md).
