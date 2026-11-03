// Restored original marketing-only entry. See docs/RESTORATION.md.
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import './styles/tokens.css'  // versioned site token snapshot; provenance in styles/README.md
// GENERATED elevation->shadow ramp, same source. Was never imported anywhere on the landing (found
// 2026-07-28 writing ReviewCard's order card): every --rocoto-shadow-* var, including the six already
// referenced in deskapp.css, silently resolved to nothing — box-shadow: var(--undefined) computes to
// `none`, no console error, no visual bug obvious enough to flag on its own. Real elevation now renders.
import './styles/shadows.css'
import './wa-theme.css'  // landing-only WhatsApp-green overlay (values only; geometry stays tokens)
import './dotbg.css'  // STANDING RULE: message/bubble surfaces sit on the dot field (Peter, 2026-07-27)
import './hero.css'
import './sections.css'
// sections-v2.css is the SITE's own section/nav/typography layer. It used to reach the bundle
// only through HowItWorks' import — so unhooking the §35 graveyard silently dropped it and every
// page rendered unstyled (caught by LOOKING at staging, 2026-08-29). A sheet the whole site
// stands on is imported where the whole site can see it.
import './sections-v2.css'
import './appmotion.css'  // the three deterministic app-motion islands (canon §27/§28)
import './triptych.css'   // the kit-true three-step band (canon §36)
import './shots.css'      // THE SHOT LIBRARY — S1…S16, composed statics (SHOT-RULES.md)
import { TriptychKit } from './TriptychKit'
import {
  ShotStockModes, ShotSupplierMail, ShotReportChart, ShotAlbaran, ShotCatalog, ShotCustomer,
} from './shots'
import { PrecioLoop } from './PrecioLoop'
import { RiverResolve } from './RiverResolve'
import { ComposerBirth } from './ComposerBirth'

// Islands: mount each interactive component into its host in the static landing.
const lang = document.body.dataset.lang === 'en' ? 'en' : 'es'
const mount = (id: string, node: ReactElement) => {
  const host = document.getElementById(id)
  if (host) createRoot(host).render(node)
}
// static-aware mount: reads data-static="1" off the host so the SAME component (never a second
// implementation) renders either the live animated island or a fixed representative frame with its
// timers never started (SITE-V2-PLAN §5.2). Every host on a page still needs a UNIQUE id — this only
// changes what prop that one host passes in, not how many hosts a page may have.
function mountStatic<P extends { lang: 'es' | 'en'; static?: boolean }>(
  id: string,
  Comp: (props: P) => ReactElement,
  extra?: Omit<P, 'lang' | 'static'>,
) {
  const host = document.getElementById(id)
  if (!host) return
  const isStatic = host.dataset.static === '1'
  const props = { lang, static: isStatic, ...(extra || {}) } as P
  createRoot(host).render(<Comp {...props} />)
}
// ── §35 · THE GRAVEYARD IS UNHOOKED (translation day, 2026-08-29) ──────────────────────────────
// Eleven legacy islands were mounted here — hero-phone, how-it-works, app-desk, trackers-live,
// review-card, reparto-stops, stock-confirm, print-templates, alias-chat, portal-preview,
// oferta-del-dia. Since the W26 flip no page carries any of their host ids, so every mount was a
// silent no-op that still shipped its component and CSS to every visitor's phone — the exact trap
// this file already documents twice above. Mounts and imports are gone so vite tree-shakes the
// code out; the component files stay in git for the record. The round-7 set (TriptychKit, the
// am-* films, the shot library) is the only product imagery that renders anywhere.
// ── APP-MOTION: the three deterministic islands (canon §27/§28) ─────────────────────────────────
// Each one mounts INSIDE the gradient plate its still already lives on, over the capture: the
// <img> stays in the markup as the no-JS floor and `useTakeOver()` hides it once React is running.
// The host ids are printed by `frame_plate(..., island=…)` in landing/build.py — that table and
// these three lines are the whole contract, so a fourth island is a row there and a line here.
//   #am-compras-precio        /procurement.html — the price sheet run
//   #am-comerciales-river     /sales.html       — a flagged card resolving into the quiet rows
//   #am-comerciales-composer  /sales.html       — the albarán written into existence
mountStatic('am-compras-precio', PrecioLoop)
mountStatic('am-comerciales-river', RiverResolve)
mountStatic('am-comerciales-composer', ComposerBirth)
// ── §36: THE TRIPTYCH, KIT-TRUE — the flagship proof band, rebuilt from the kit's own world.
// It mounts NOWHERE on the site yet: it ships to /en/visuals-review.html as V44 for Peter's eyes
// before any page placement (canon §36, last line). One host id, one line here.
mountStatic('triptych-kit', TriptychKit)
// ── THE SHOT LIBRARY — six composed shots (SHOT-RULES.md, all fifteen) ──────────────────────────
// Kit-anatomy DOM at marketing dose, built out of the captures' content and the token package's own
// values. They carry NO CLOCK — each one builds itself in once on entering view (rule 15) and is
// then a still; the happening-loops stay the three app-motion islands and the morph.
//
// SIXTEEN BECAME SIX IN ROUND 1. Five were killed outright on their verdicts (S4 ambiguity, S6 the
// dials, S8 the final weight, S15 the supplier log, S16 the chat voice note) and five more were
// ABSORBED, because the library was a flat list of screens and the world is not one — Peter's
// catch: «customer page and past orders separately is obviously wrong — history lives inside the
// page.» So one subject is now one shot, inside a group:
//   S3  → V3 (RiverResolve does the checking now)      S13 → S10 (the catalogue opens onto it)
//   S11 → S12 (the history lives in the page)          S14 → S9  (the document prints itself)
//   S5  → V5 (the price-taps island already IS that subject)
// Each surviving shot is a host id here and a row in /en/visuals-review.html.
const SHOTS = [
  ['shot-albaran', ShotAlbaran],              // THE ORDER
  ['shot-customer', ShotCustomer],            // THE CUSTOMER
  ['shot-stock-modes', ShotStockModes],       // STOCK & PRICES
  ['shot-catalog', ShotCatalog],              // STOCK & PRICES
  ['shot-supplier-mail', ShotSupplierMail],   // SUPPLIERS
  ['shot-report-chart', ShotReportChart],     // THE REPORT
] as const
SHOTS.forEach(([id, Comp]) => mountStatic(id, Comp))

// /join's island IS NOT HERE (JOIN-PAGE-SPEC §3). It is built on the kit — Base Web, styletron and
// `situations/baseweb`'s own components — which is the right weight for the application form and the
// wrong weight for every other page on this site. So it ships as its own bundle, `assets/join.js`
// + `join.css`, and the join page alone loads it (`PAGE_SCRIPT` in landing/build.py, entry
// `src/join.tsx`). Nothing in hero.js reaches for it.

