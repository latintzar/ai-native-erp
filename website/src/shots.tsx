import { useEffect, useRef, useState } from 'react'
import { useBeat } from './motionkit'

/** ══ THE SHOT LIBRARY — six composed, kit-true shots ═══════════════════════════════════════════
 *
 *  A shot is COMPOSED from the kit at marketing dose — never a raw screen crop, never an
 *  illustration. This file is the still half of the marketing vocabulary: six compositions built
 *  out of the app's own anatomy, each registered with a `mountStatic` id and each checked, in a
 *  comment above it, against SHOT-RULES.md — with THE ONE IDEA on the first line of that check.
 *
 *  ══ WHAT ROUND TWO DID TO THIS FILE ═══════════════════════════════════════════════════════════
 *
 *  FILM THINKING ENTERED THE LAW, and three of these six stopped being arrangements and became
 *  SCENES. Peter, on S1: «I want to see the field where they choose the product or take a photo,
 *  then choose it, and then it shows how much stock they just added and the number they are
 *  choosing. Think about these pragmatically, even the way I am describing them. I'm describing it
 *  like a film, almost. You should be thinking that way.» So:
 *
 *    S1  was a number over two identical outcome boxes — «Multiple numbers is a ridiculous thing.
 *        Like, what? They all look the same, with the same boxes and the same size.» It is now the
 *        stock door as it is lived: the pick, the amount, the act, and ONE resulting number.
 *    S9  «doesn't look like it's going to be printed. It should be an A4 thing… Let's see how it
 *        changes when they go from A4 to A5.» It is now a true A4 — the page's own proportion, its
 *        own margins, its own column heads — and the A4/A5 control actually REFORMATS it.
 *    S10 «that's cool. I like that. I want to see tariffs for one, and then another one expands.»
 *        It is now a two-beat choreography that shows both dimensions: the shrimp opens on its
 *        three tarifas, then the merluza opens on its three sub-products.
 *
 *  And three were corrected without becoming films:
 *    S2  «It clearly doesn't show that this is an email inbox… should feel like gmail. shapes,
 *        icons etc speak louder than sentences. and it's ambiguous. arrival landed.. etc idk» —
 *        rebuilt in the Gmail register he sent as the reference.
 *    S7  «this bar chart is awfully imprecise. For a whole year, it should be more precise… You
 *        always have to have these things with enough padding or gutter on those sides.»
 *    S12 «The line chart isn't about their order days, but about their historical ordering volume…
 *        The bar chart of their usual order is silly when the leaderboard already shows the
 *        standing. There should be a "Show more" button with a chevron, and the order history is a
 *        different thing.»
 *
 *  ══ THE LAWS THIS FILE IS WRITTEN AGAINST ═════════════════════════════════════════════════════
 *
 *  RULE 15 — EVERYTHING APPEARS, and the STORY shots also animate something happening. Every shot
 *  builds itself in once on entering view (`useBuildIn`); S1, S9 and S10 additionally run a beat
 *  script (`useFilm`), because their verdicts asked for a scene rather than an arrangement. The
 *  three that are arrangements stay clockless.
 *
 *  RULE 14 — LABELS, NOT CHAT. Every string is the product's own professional label.
 *  RULE 13 — A SHOT IS A QUICK IDEA. Shapes and icons over sentences, at Peter's explicit
 *  instruction on S2 and by the same logic everywhere else.
 *
 *  WHERE THE CONTENT COMES FROM. The captures are the CONTENT SOURCE, never the shipped pixels:
 *  every string, price, name, count, series and geometry below was read off a file in
 *  `public/assets/app-frames/` (whose FRAMES.md transcribes each one) or off
 *  `landing/informe_muestra.py`, the report generator. The source is named on every shot.
 *
 *  ARITHMETIC IS ALLOWED; INVENTION IS NOT. Where the dose cuts lines off a document, its foot is
 *  re-totalled over the lines that remain. Where a shot needs a figure the captures give only
 *  indirectly, the derivation is written out in that shot's comment so a reviewer can check it.
 */

type ShotProps = { lang?: 'es' | 'en'; static?: boolean }

const F = '/assets/app-motion/faces/'

/* ── RULE 15 · THE BUILD-IN ────────────────────────────────────────────────────────────────────
 * One observer per shot, one class flip, and the staging happens in CSS. Elements that stage carry
 * `.sh-r` and a `--d` delay; the transition is declared ONLY on the `.is-in` side, so a shot never
 * plays backwards when it leaves view and never re-runs.
 *
 * THREE WAYS IT FAILS SAFE, because the rest state is invisible and an animation that never fires
 * is a blank card — the exact class of bug that has shipped blank sections on this site before:
 *   · `static: true` settles immediately, never observing;
 *   · no IntersectionObserver in the browser at all → settle immediately;
 *   · the callback fires on observe() for an element already in view.
 * Reduced motion is handled in CSS, where the rest state itself is cancelled. */
function useBuildIn(staticFrame?: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (staticFrame) { setInView(true); return }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect() } },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [staticFrame])
  return { ref, cls: 'sh' + (inView ? ' is-in' : '') }
}

/** RULE 15's SECOND HALF — «the story shots ALSO animate something happening». A film shot is a
 *  build-in AND a beat script on the islands' one rAF clock, so a scene costs the same few dozen
 *  renders an island does and holds a settled frame under reduced motion. The observer that starts
 *  the clock is `useBeat`'s own; this hook adds the build-in's on the same element. */
function useFilm<S>(loop: number, rest: number, staticFrame: boolean | undefined, derive: (t: number, l: number) => S) {
  const [s, ref] = useBeat(loop, rest, !!staticFrame, derive)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (staticFrame) { setInView(true); return }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect() } },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [staticFrame, ref])
  return { s, ref, cls: 'sh' + (inView ? ' is-in' : '') }
}

/** the per-element delay in the build-in's stagger. One helper, so no shot hand-types a `--d`. */
const d = (ms: number) => ({ ['--d' as string]: ms + 'ms' })

/* ── THE ICONS ────────────────────────────────────────────────────────────────────────────────
 * Linework only — the app ships no filled icon, and «transparent» in this house means a real hole
 * in the asset. Every path is the Lucide glyph the app's own `MAP` in
 * `situations/baseweb/src/app/glyphs.tsx` binds to that name, at the app's own stroke width of 2.
 */
const Ic = ({ d: path }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={path} />
  </svg>
)
const IcChat = () => <Ic d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
const IcDown = () => <Ic d="m6 9 6 6 6-6" />
const IcCam = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h3l1.6-2h6.8L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
)
const IcPrint = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
)
/** the mail attachment's PDF mark — Gmail's own register, drawn in this house's linework and in the
 *  red the app already owns. Peter's reference frame is a Gmail inbox, and the red document is the
 *  single most recognisable shape in it. */
const IcPdf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 2.5H7a1.5 1.5 0 0 0-1.5 1.5v16A1.5 1.5 0 0 0 7 21.5h10a1.5 1.5 0 0 0 1.5-1.5V6.5Z" />
    <path d="M14.5 2.5v4h4" />
    <path d="M8.6 17v-4.2h1.3a1.1 1.1 0 0 1 0 2.2H8.6" /><path d="M12.9 17v-4.2h1a1.6 1.6 0 0 1 1.6 1.6v1a1.6 1.6 0 0 1-1.6 1.6Z" />
  </svg>
)
const IcTick = () => <Ic d="m5 13 4 4 10-10" />
/** lucide `phone` — the account's own reachable fact on the customer sheet (round 7). */
const IcPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15.6 21A13.6 13.6 0 0 1 3 8.4 2 2 0 0 1 5 6.2h2.4a1.4 1.4 0 0 1 1.4 1.2c.1.9.3 1.7.6 2.5a1.4 1.4 0 0 1-.3 1.5l-1 1a12 12 0 0 0 4.5 4.5l1-1a1.4 1.4 0 0 1 1.5-.3c.8.3 1.6.5 2.5.6a1.4 1.4 0 0 1 1.2 1.4V19a2 2 0 0 1-2.2 2Z" />
  </svg>
)

/* ── THE MONTH AXIS, SHARED BY S7 AND S12 ─────────────────────────────────────────────────────
 * ROUND 3 · «the month shit is shit lol» (S7) and «the sondermamjja is shit» (S12) — the same
 * failure on two shots. Twelve single letters under twelve nodes is not an axis: `s o n d e f m a
 * m j j a` reads as a word, two of them repeat, and in Spanish the initials do not even match the
 * English ones a reader might guess. It is replaced by SPARSE, NAMED ticks — four months named out
 * of twelve, the first and last carrying their year — while the SVG keeps a mark on every month, so
 * the plot stays twelve readings and only the labelling stops shouting.
 *
 * ⚠️ ROUND 7 · AND THE AXIS SPEAKS THE PAGE'S LANGUAGE. These shots now render on the ENGLISH pages,
 * where `sep 25 · dic · mar · jun · ago 26` is a Spanish axis under an English heading — and an axis
 * is the one part of a chart a reader is never meant to stop at. The ticks are a pair of records
 * keyed by lang; the SERIES, the money and its `1.144,82` grouping stay Spanish-formatted, because
 * that is the product's own number format on every page and not a string to translate.
 */
const MES_TICKS: Record<'es' | 'en', Record<number, string>> = {
  es: { 0: 'sep 25', 3: 'dic', 6: 'mar', 9: 'jun', 11: 'ago 26' },
  en: { 0: 'Sep 25', 3: 'Dec', 6: 'Mar', 9: 'Jun', 11: 'Aug 26' },
}
const Meses = ({ hot, lang = 'es' }: { hot?: number; lang?: 'es' | 'en' }) => (
  <div className="sh-mo">
    {Array.from({ length: 12 }, (_, i) => (
      <span key={i} className={hot !== undefined && i >= hot ? 'is-on' : undefined}>{MES_TICKS[lang][i] || ''}</span>
    ))}
  </div>
)

/** the figure lockup: big integer · small decimals · THE UNIT ON THE NUMBER'S OWN LINE */
const Fig = ({ int, dec, unit, lg }: { int: string; dec?: string; unit: string; lg?: boolean }) => (
  <span className={'sh-fig' + (lg ? ' sh-fig-lg' : '')}>
    <b>{int}</b>{dec && <i>{dec}</i>}<em>{unit}</em>
  </span>
)

/* ══ S1 · shot-stock-modes — GROUP «STOCK & PRICES» ════════════════════════════════════════════
 * ROUND 2 · «this is extremely confusing. The stock door shouldn't be this. I want to see the field
 * where they choose the product or take a photo, then choose it, and then it shows how much stock
 * they just added and the number they are choosing… Multiple numbers is a ridiculous thing. Like,
 * what? They all look the same, with the same boxes and the same size. I don't know. It doesn't
 * show anything.»
 *
 * THE TWO OUTCOME BOXES ARE GONE. They were the shot's whole content and they were two figures at
 * the same size in two cards of the same shape, which is a comparison nobody asked for standing
 * where a scene should be. This is now the scene, in the four beats he dictated.
 *
 * ▶ THE ONE IDEA: PICK THE GOODS, SAY HOW MUCH CAME IN, AND THE FLOOR HAS A NEW NUMBER.
 *
 * SOURCE: app-frames/inventario-hoy.png, whose every string is used verbatim — the head `Stock
 * update`, the five goods as pills, `On hand · What Merluza stands at` `40,0 kg`, the `780` typed,
 * the door `Photograph the document`, `Stock becomes` `820,0 kg`, and the act `Add to stock`.
 *
 * ⚠️ ROUND 3 · IT IS A TYPEFORM NOW. «the merluza gamba etc chips are bad. it's one question at a
 * time like typeform. free form entry to select product with smart dropdown, then just the price,
 * etc. come on.»
 *
 *   THE CHIP ROW IS DEAD. Five goods standing as pills asked the reader to pick one out of a set
 *   the shot never explains, and it printed four words nobody uses to say one thing. In its place:
 *   ONE FREE-FORM FIELD asking `Product`, `merluza` typed into it, and a smart list narrowing under
 *   it as the characters land — the shelf becomes the three forms of Merluza this house holds, the
 *   first pre-active, and it is taken.
 *   THEN, AND ONLY THEN, THE SECOND QUESTION. `How much came in`, with question one collapsed to a
 *   small ticked answer above it, the big number field, and the act. One question on screen at a
 *   time, which is what a typeform is and what makes each beat readable at a glance.
 *   AND THEN THE ONE RESULT, unchanged: `Added 780 kg` over what the floor now stands at.
 *
 * 15 FILM        the question, the typing, the list narrowing, the pick; then the second question,
 *                780 typed, `Add to stock`; and ONE result. 8,0 s, no seam.
 * 13 QUICK IDEA  a field with a list under it, a big number, one bigger number. Nothing to read.
 * 14 LABELS      THE APP SPEAKS IN THE FIRST PERSON HERE AND THE SHOT DOES NOT: «I'm telling you
 *                how much we just added» is the app's own mode label and it stays out; the shot
 *                carries `Added` and `On hand · What Merluza stands at`, which are the screen's own
 *                nouns. The founder-voice is simply not carried into a marketing still.
 *  1 SOURCE      every string above, plus the paintings from the kit's own library.
 *  2 ONE IDEA    goods in, and what the floor stands at after.
 *  3 DOSE        the capture carries eleven objects. Five survive across the whole film, and never
 *                more than four at once: the pills, the field, the act, the result. `Lote`, the
 *                lot suggestion, the two mode boxes, `Close` and the timestamp are cut.
 *  4 CHROMELESS  no modal, no `Close`, no pane.
 *  5 SCALE       480 wide at a FIXED 360 tall, so the square's scale never moves mid-beat.
 *  6 TRUE DATA   40,0 on hand + 780 added = 820,0 — the capture's own arithmetic, printed on the
 *                capture itself as `Stock becomes 820,0 kg`. And that 780 kg of goods is the same
 *                780,0 kg S2 shows arriving by email, one world, two shots.
 *  7 LEGIBLE     the smallest type is the 11.5px caps label.
 *  8 MOTION      a state change that clarifies: nothing on the shot means anything until the
 *                product is picked, which is precisely what the film says.
 *  9 ONE PROOF   the only stock-entry proof in the library.
 * 10 STRANGER    «picking a fish, typing 780 kg, and the floor going to 820.»
 * 11 FILL        the pill row and the field both run the full width, edge to edge.
 * 12 BREATHE     one object per beat. There is never a second card to fuse with.
 */
/* ⚠️ ROUND 5 · MONZO-CENTRED, AND THE OTHER DOOR STANDS FROM THE FIRST FRAME.
 *
 * «what's going on here? This is the only thing that's actually properly aligned. The image isn't
 *  really big here, though… Why is the photograph and the document left-aligned when they shouldn't
 *  be? Why does the document only appear when we're trying to select a product so that it captures
 *  it from the product? Why is the text saying "on hand" left-aligned like this? It should all be
 *  Monzo-style centered.» (Peter, round 5)
 *
 * FOUR THINGS, AND THEY ARE ONE THING. A single-question sheet has ONE CENTRE AXIS — Monzo's entire
 * entry grammar is a question, a figure and an act stacked on it — and this shot had a head split
 * left/right, a question hard left, a field whose value hung left, a list hung left, an `On hand`
 * line hung left and a result hung left. Everything now stands on the axis: the kicker, the
 * question, the typed value, every hit, the `or` rule, the camera door, the answered chip, the
 * amount, `On hand`, the act, and the result.
 *
 *   · THE DOCUMENT DOOR IS A DOOR, NOT A HEADER ORNAMENT. It was a 12,5px line in the top-right
 *     corner of a header, which is where a screen puts a thing it does not really offer. It is now
 *     a bordered control, centred, standing UNDER the product question behind an `or` rule — a
 *     genuine second way to answer the same question, present from the frame the question is.
 *   · AND THE PAINTING IS THE RESULT'S SUBJECT. 44 → 76 on the outcome and 26 → 32 in the list.
 *
 * ⚠️ ROUND 7 · ISOLATED CARDS. «not bad but i dont want such transparent shit. put isolated cards
 * lol» (Peter, round 6). Every other shot in this library stands its subject on `.sh-card`; S1 alone
 * laid its question, its field, its list and its 60px figure straight onto the plate's gradient, so
 * the composition read as a transparency — because it was one. The question sheet and the result are
 * now each their own white card inside the one stage, which is also what the app draws: an entry
 * sheet is paper. The whole treatment invented to survive standing ON the plate came off with it
 * (the paintings' tile shadow, the result label's `--sh-onplate` darkening); the camera door stays,
 * because THIS is the stock context and the camera belongs to it — round 6's icon law names S1 as
 * the one place it may appear.
 */
/** THE SHELF, before anything is typed — the goods the door opens on (inventario-hoy.png's own
 *  five, cut to three by rule 3). */
const S1_SHELF = ['Merluza', 'Gamba roja de Palamós', 'Pulpo']
/** and what `merl` narrows to: the house's own Merluza ambiguity set, off ambiguedad-informada.png
 *  («Merluza austral · Merluza · Merluza de pincho»), with the first hit pre-active the way the
 *  app leaves it (draft-typeahead.png: «the first pre-active so Enter would take it»). */
const S1_HITS = ['Merluza', 'Merluza austral', 'Merluza de pincho']
const S1_Q = 'merluza'
/** the shot's chrome, in the page's language. The GOODS — Merluza, the hits, 40,0 / 780 / 820 —
 *  are the seeded Spanish reality on every page and are not in this table. */
const S1_T = {
  es: {
    head: 'Entrada de género', q1: 'Producto', or: 'o', cam: 'Fotografiar el albarán',
    q2: 'Cuánto ha entrado', on: 'En stock · Lo que hay de Merluza', add: 'Añadir al stock',
    added: 'Añadidos 780 kg',
  },
  en: {
    head: 'Stock update', q1: 'Product', or: 'or', cam: 'Photograph the document',
    q2: 'How much came in', on: 'On hand · What Merluza stands at', add: 'Add to stock',
    added: 'Added 780 kg',
  },
}
/* ── THE BEAT SCRIPT ─────────────────────────────────────────────────────────────────────────
   ONE QUESTION AT A TIME (round 3, «it's one question at a time like typeform»):
   0     QUESTION 1 · `Product`. An empty field with a caret, the shelf standing under it, and the
         camera door beside the label. Hold 460.
   460   typing `merluza`, 7 characters 110 ms apart → 1230. The list NARROWS on the first
         character: the shelf becomes the three forms of Merluza the house actually holds.
   1500  the first hit is taken (press 170)
   1670  QUESTION 2 · `How much came in`. Question one collapses to its answer — a small ticked
         row — and the big number field opens under the new question.
   2000  typing `780`, 3 characters 150 ms apart → 2450
   2800  the pointer lands on `Add to stock` (300), 3100 press (160)
   3260  THE RESULT · one number, once: `Added 780 kg` over what the floor now stands at.
   Loop 8000, rest on the result.                                                               */
const S1_TYPE = 460, S1_QPER = 110
const S1_TAKE = 1500, S1_Q2 = 1670
const S1_AMT = 2000, S1_PER = 150
const S1_OVER = 2800, S1_PRESS = 3100, S1_DONE = 3260
export function ShotStockModes(p: ShotProps) {
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t1 = S1_T[lang]
  const f = useFilm(8000, 5200, p.static, (t) => {
    const q = t < S1_TYPE ? '' : S1_Q.slice(0, Math.min(S1_Q.length, Math.floor((t - S1_TYPE) / S1_QPER) + 1))
    return {
      q,
      taking: t >= S1_TAKE && t < S1_Q2,
      step: t >= S1_DONE ? 2 : t >= S1_Q2 ? 1 : 0,
      amount: t < S1_AMT ? '' : '780'.slice(0, Math.min(3, Math.floor((t - S1_AMT) / S1_PER) + 1)),
      over: t >= S1_OVER && t < S1_DONE,
      press: t >= S1_PRESS && t < S1_DONE,
    }
  })
  const s = f.s
  const hits = s.q ? S1_HITS : S1_SHELF
  return (
    <div className={f.cls} ref={f.ref}>
      <div className="s1">
        <div className="s1-hd sh-r" style={d(0)}>
          <span className="sh-kc">{t1.head}</span>
        </div>

        {/* ONE stage, three states — so the shot's height never moves and the square holds its
            scale through the whole run. */}
        <div className="s1-stage sh-r" style={d(120)}>

          {/* ── QUESTION 1 · WHICH GOODS. One field, the list narrowing under it, and the OTHER
                 DOOR standing beside them from the first frame. ─────────────────────────────── */}
          {s.step === 0 && (
            <div className="s1-step">
              <span className="s1-q">{t1.q1}</span>
              <div className="sh-field s1-qf">
                <span className="sh-field-v s1-typed">{s.q}<i className="s1-caret" /></span>
              </div>
              <div className="s1-hits">
                {hits.map((h, i) => (
                  <span className={'s1-hit' + (s.q && i === 0 ? ' is-on' : '') + (i === 0 && s.taking ? ' is-tap' : '')} key={h}>
                    <img src={F + (i === 0 || s.q ? 'merluza.webp' : i === 1 ? 'gamba-roja.webp' : 'pulpo.webp')}
                         alt="" width={32} height={32} loading="lazy" decoding="async" />
                    {/* the typed part is marked inside every hit, the way the app marks it */}
                    <b>{s.q ? <><mark>{h.slice(0, s.q.length)}</mark>{h.slice(s.q.length)}</> : h}</b>
                  </span>
                ))}
              </div>
              {/* THE OTHER DOOR — «or take a photo». A control, on the axis, offered from the
                  frame the question is asked in. Line art, the app's own words. */}
              <span className="s1-or">{t1.or}</span>
              <span className="s1-cam"><IcCam />{t1.cam}</span>
            </div>
          )}

          {/* ── QUESTION 2 · HOW MUCH CAME IN. Question one is now an answer. ────────────── */}
          {s.step === 1 && (
            <div className="s1-step">
              <span className="s1-ans">
                <IcTick /><img src={F + 'merluza.webp'} alt="" width={22} height={22} loading="lazy" decoding="async" />
                Merluza
              </span>
              <span className="s1-q">{t1.q2}</span>
              {/* ⚠️ THE VALUE AND ITS UNIT SHARE ONE LINE BOX. As two flex children they were
                  centred as BOXES — the 20px unit's box bottom aligned to the 54px value's box
                  bottom, which put `kg` a clear four pixels under the number's baseline. Inline
                  layout baseline-aligns them for free, and the field then centres the one span. */}
              <div className="sh-field s1-field">
                <span className="s1-amt">
                  <span className="sh-field-v">{s.amount}{!s.amount && <i className="s1-caret" />}</span>
                  <span className="sh-field-u">kg</span>
                </span>
              </div>
              <span className="s1-on">{t1.on} <b>40,0 kg</b></span>
              <span className={'sh-btn s1-add' + (s.amount ? ' live' : '') + (s.over ? ' over' : '') + (s.press ? ' press' : '')}>
                {t1.add}
              </span>
            </div>
          )}

          {/* ── THE RESULT — one number, once, and nothing beside it at the same size ────── */}
          {s.step === 2 && (
            <div className="s1-out">
              <img className="s1-face" src={F + 'merluza.webp'} alt="" width={76} height={76} loading="lazy" decoding="async" />
              <span className="s1-added"><i className="sh-dot" />{t1.added}</span>
              <span className="sh-kc">{t1.on}</span>
              <span className="s1-now"><Fig int="820" dec=",0" unit="kg" lg /></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══ S2 · shot-supplier-mail — GROUP «SUPPLIERS» ═══════════════════════════════════════════════
 * ROUND 2 · «There's a duplicate here. It clearly doesn't show that this is an email inbox. You can
 * be more visually clear with it. should feel like gmail. shapes, icons etc speak louder than
 * sentences. and it's ambiguous. arrival landed.. etc idk» — sent with a Gmail screenshot as the
 * register to build against.
 *
 * FOUR THINGS CHANGED, EACH ONE HIS.
 *   · GMAIL'S OWN ROW GRAMMAR: bold sender, then the subject, then the attachment, then the date
 *     hard right — a LIST with hairlines and a `Today` divider, not a stack of separate cards. This
 *     is the one place rule 12 gives way: an inbox that breathes into detached cards stops being an
 *     inbox, and the reference frame is the instruction.
 *   · THE PDF READS AS A PDF: a red document mark and its truncated filename in a pill, which is
 *     the shape a stranger recognises across a room. Shapes over sentences.
 *   · «1 arrival landed» IS GONE. It was printed identically on every row (the duplicate) and it
 *     was ambiguous besides. The state is now a small chip — `In arrivals` with a tick — which is
 *     a label and not a sentence, and a repeated label is how a mail list marks a repeated state.
 *   · AND THE HEAD NAMES THE INBOX, with the address the app actually reads.
 *
 * ⚠️ ROUND 3 · «this is almost there! why full width. but busy. why "in arrivals"? why not one with
 * a problem maybe or another with a credit note?»
 *
 *   NARROWER: 660 → 520, and the row went from five columns on one line to the two-line shape every
 *   mail client settles on at a narrow measure — sender and time, then the subject with its
 *   attachment and its state. That is the app's own inbox at this width (`app/inbox.tsx`: «Phone:
 *   the row every phone inbox has settled on — sender and time, then the subject»).
 *
 *   LESS BUSY: the filename text is gone (the red PDF mark IS the attachment; the name was 22
 *   characters of noise repeated four times) and the inbox address dropped to its own quiet line
 *   instead of competing with the head.
 *
 *   AND THE ROWS SHOW RANGE, HONESTLY. `In arrivals` on every row was one label printed four times.
 *   The kit's own reading of a supplier mail has THREE finding kinds — `incoming.ts`'s
 *   `MailFindingKind`: `no-lot` («the sheet carries no lote code»), `differs` («zona: X on the
 *   sheet, Y on your row») and `cost` («14,20 €/kg, 12,80 €/kg last landing») — plus the clean case,
 *   a mail with no findings at all. So the list now reads: landed · no lote on the sheet · cost
 *   moved · landed. Two clean, two flagged in two different ways, all four real.
 *   ⚠️ NO CREDIT NOTE, and the reason is a product boundary rather than an omission: «Rocoto records
 *   the incidencia; the ERP issues the abono» (situations/notes/SECTORS.md, and the app states it on
 *   its own card in scenarios/screens/A13-bis.tsx). An abono is a fiscal document this product does
 *   not raise, so a credit-note row in its inbox would be a state it does not have.
 *
 * ▶ THE ONE IDEA: SUPPLIER ALBARANES ARRIVE BY EMAIL, READ, WITH WHAT ROCOTO FOUND ON EACH.
 *
 * SOURCE: app-frames/email-proveedores.png, transcribed row for row — `Pescados Rubio`, the four
 * albaranes `L-2217 Rape 780,0 kg` `L-2214 Pulpo 1600,0 kg` `L-2211 Gamba roja de Palamós 420,0 kg`
 * `L-2208 Merluza 3200,0 kg`, their PDFs, their minutes `05:04 · 04:46 · 04:28 · 04:10`, the head
 * `Incoming mail · 4 new` and the address `pedidos@peixvilalta.cat`; the flag words are
 * `incoming.ts`'s own finding kinds.
 *
 * 15 BUILD-IN    the head, then the rows top down, the way a list fills. 300 + 420 = 720 ms.
 * 13 QUICK IDEA  four mail rows with red PDFs on them, two of them flagged. The 05:04 and 04:28
 *                stamps carry the whole «before you were awake» claim without a sentence about it.
 * 14 LABELS      `Supplier emails`, `4 new`, `In arrivals`, `No lote on the sheet`, `Cost moved`.
 *  1 SOURCE      every string above.
 *  2 ONE IDEA    mail in → read → and it says what it found.
 *  3 DOSE        four rows, which is the capture's own four and rule 3's ceiling — so `4 new`
 *                counts what is on screen rather than pointing at a row that was cut.
 *  4 CHROMELESS  no window, no sidebar, no compose button — a head and a list.
 *  5 SCALE       520 wide: the two-line row survives the square whole and stacks nothing at 390.
 *  6 TRUE DATA   the goods and the minutes are the capture's. That 780,0 kg of Rape is the same
 *                arrival S1 types at the stock door.
 *  7 LEGIBLE     12.5px is the floor — the PDF pill and the time.
 *  8 MOTION      the build-in and nothing else. Mail arriving is not a state change you can watch.
 *  9 ONE PROOF   the only goods-in proof in the library.
 * 10 STRANGER    «supplier delivery notes coming in by email, with the PDF on each one.»
 * 11 FILL        the list runs the frame's full width.
 * 12 BREATHE     ⚠️ THE ONE DELIBERATE EXCEPTION, on Peter's own reference: an inbox is a list.
 *                The air is INSIDE the row (16px of it) and the separator is the app's hairline.
 */
/** THE FOUR MESSAGES, AND WHAT ROCOTO READ OF EACH. `flag` names the reading's own kind, straight
 *  off `situations/baseweb/src/app/incoming.ts` — the three `MailFindingKind`s the product actually
 *  ships (`no-lot`, `differs`, `cost`) plus the clean case, which is a mail whose findings are
 *  empty. Their words are the finding sentences' own, cut to a chip. */
const S2_MAIL: {
  ref: string; goods: string; pdf: string; at: string
  flag?: { es: string; en: string }
}[] = [
  { ref: 'L-2217', goods: 'Rape 780,0 kg', pdf: 'albaran-L-2217.pdf', at: '05:04' },
  { ref: 'L-2214', goods: 'Pulpo 1600,0 kg', pdf: 'albaran-L-2214.pdf', at: '04:46',
    flag: { es: 'Lote por anotar', en: 'No lote on the sheet' } },
  { ref: 'L-2211', goods: 'Gamba roja de Palamós 420,0 kg', pdf: 'albaran-L-2211.pdf', at: '04:28',
    flag: { es: 'Cambio de coste', en: 'Cost moved' } },
  { ref: 'L-2208', goods: 'Merluza 3200,0 kg', pdf: 'albaran-L-2208.pdf', at: '04:10' },
]
/** the inbox's chrome, in the page's language. The senders, the refs, the goods, the minutes and
 *  the address are the capture's own and stand on every page. */
const S2_T = {
  es: { head: 'Correo de proveedores', nnew: '4 nuevos', today: 'Hoy', landed: 'En entradas' },
  en: { head: 'Supplier emails', nnew: '4 new', today: 'Today', landed: 'In arrivals' },
}
export function ShotSupplierMail(p: ShotProps) {
  const b = useBuildIn(p.static)
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t2 = S2_T[lang]
  return (
    /* ⚠️ ROUND 7 · THE GUTTER. «add padding on the sides...» (Peter, round 6). The list ran on a
       16px gutter and put the sender hard against the left edge and the time hard against the
       right — a phone's measure on a 520px card, so the rows read as text laid on a rectangle
       rather than as a document with margins. 16 → 24, on the `Today` divider and on every row.

       ⚠️ AND THE CARD KEEPS THE PLATE'S WHOLE MEASURE, WHICH IS A DECISION AND NOT AN OVERSIGHT.
       S2 is the one shot whose card is not inset from its plate, and 20px of ground either side was
       built and then TAKEN OUT AGAIN: measured, it costs 40px of row, and the only row that cannot
       give it is `Albarán L-2211 — Gamba roja de Palamós 420,0 kg · Cost moved`, which then
       ellipsised mid-figure — «420,0 kg» cut to «4…». A quantity truncated is a worse fault than a
       card without a margin, and Peter's words are about the space inside the rows. If this shot
       ever needs plate air, the row has to lose the PDF mark to line one first. */
    <div className={b.cls} ref={b.ref}>
      <div className="s2-hd sh-r" style={d(0)}>
        <span className="sh-head">{t2.head}</span>
        <span className="s2-new">{t2.nnew}</span>
      </div>
      <div className="s2-inbox sh-r" style={d(60)}>pedidos@peixvilalta.cat</div>
      <div className="sh-card s2-list sh-r" style={d(120)}>
        <div className="s2-day">{t2.today}</div>
        {S2_MAIL.map((m, i) => (
          <div className="s2-row sh-r" style={d(220 + i * 80)} key={m.ref}>
            <span className="s2-l1">
              <span className="s2-from">Pescados Rubio</span>
              <span className="s2-at">{m.at}</span>
            </span>
            <span className="s2-l2">
              <span className="s2-sub"><b>Albarán {m.ref}</b><em>{m.goods}</em></span>
              <i className="s2-pdf-i" title={m.pdf}><IcPdf /></i>
              {m.flag
                ? <span className="s2-chip is-flag"><i className="sh-dot" />{m.flag[lang]}</span>
                : <span className="s2-chip"><IcTick />{t2.landed}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ S7 · shot-report-chart — GROUP «THE REPORT» ═══════════════════════════════════════════════
 * ROUND 2 · «this bar chart is awfully imprecise. For a whole year, it should be more precise.
 * Otherwise, it's pretty decent. The width and stuff is not good. You always have to have these
 * things with enough padding or gutter, or whatever you want to call it, on those sides.»
 *
 * PRECISION, THREE WAYS. The plot drew twelve months as one continuous stroke, so a reader could
 * see a fall but could not see WHEN — twelve months of a year read as a shape rather than as
 * twelve readings. Now: a marked node on EVERY month, a labelled tick under every month, and two
 * horizontal references (the twelve-month mean and the last-three mean) so the −41,5 % is a
 * distance you can measure with your eye instead of a figure you have to trust.
 *
 * GUTTERS. The card's padding went 22/24 → 30/34 and the plot is inset inside that, so the stroke
 * no longer runs into the card's own edge at either end. Rule 11 is about the shot filling its
 * PLATE; a chart running into its own card is a different thing and it is the thing he flagged.
 *
 * ▶ THE ONE IDEA: THIS CUSTOMER IS FALLING AWAY, AND YOU CAN SEE THE MONTH IT STARTED.
 *
 * SOURCE: landing/informe_muestra.py — `FALLING[0]`, the twelve-month series the sample report
 * plots for Vermuteria Xifré, and `sparkline()`, whose encoding this chart is drawn to.
 *
 * ⚠️ ROUND 3 · «why full width? and like, almost there. the month shit is shit lol… just make the
 * shit better.» 520 → 480 with the 34px gutter kept whole, so the plot measures 412 and the card
 * stands narrower on its plate; the twelve single-letter month marks became four named ticks (see
 * `Meses` above) with the year on the first and the last, and the duplicate `sep 2025 / ago 2026`
 * axis line under them is gone — it was saying, in a second row, what those two ticks now say.
 *
 * 15 BUILD-IN    the name, the plot, the months, then the three figures. 300 + 420 = 720 ms.
 * 13 QUICK IDEA  a cliff, and the month it starts in named under it.
 * 14 LABELS      `MEDIA 12M` · `ÚLTIMOS 3M` · `EN JUEGO` are the report's own column names, and
 *                `última compra 21 ago · 7 días` is its own meta line.
 *  1 SOURCE      the series is `[34200 … 15100]`, copied from the generator; the palette, the zero
 *                anchor, the nine context months + three accent months + end dot and the .26 area
 *                fill are `sparkline()`'s own contract.
 *  2 ONE IDEA    one customer's twelve months, and what the fall is worth.
 *  3 DOSE        SIX customers in the figure, ONE here, at full size.
 *  4 CHROMELESS  no report page, no linen ground, no masthead, no table.
 *  5 SCALE       520 wide; the plot is an SVG on a viewBox, so it scales exactly with the card.
 *  6 TRUE DATA   media 12m and últimos 3m are the MEANS OF THAT SERIES, computed here the way the
 *                generator computes them, and −41,5 % and the €/mes in play are their difference.
 *                ZERO-ANCHORED, per the generator's own note: a min-max plot makes a −14 % look
 *                like an −86 %.
 *  7 LEGIBLE     11px caps and 10px mono month marks, at the report's own sizes.
 *  8 MOTION      the build-in and nothing else.
 *  9 ONE PROOF   the only report proof in the library.
 * 10 STRANGER    «a customer whose orders fell off a cliff in June.»
 * 11 FILL        the card is the frame; the gutter is inside the card, where he asked for it.
 * 12 BREATHE     ONE object — a chart is a chart.
 *  ES  the report is a Spanish object and stays Spanish, exactly as the captured figure is.
 *
 * ⚠️ ROUND 7 OVERTURNED THAT LAST LINE, AND HERE IS WHY. «the report is a Spanish object» was true
 * when this shot only ever stood on a Spanish page; it now ships on the ENGLISH owner page, where
 * `Media 12m · Últimos 3m · En juego · €/mes · última compra 21 ago` is five Spanish labels under an
 * English heading — a reader who cannot read them cannot read the chart, which is the whole job.
 * THE LINE BETWEEN WHAT TRANSLATES AND WHAT DOES NOT: the LABELS are the page speaking and follow
 * the page; the FIGURES, their `1.144,82` grouping and the `€` are the product's own format and
 * stay as the app prints them on every page in every language. `Vermuteria Xifré` is a name.
 */
const XIFRE = [34200, 33100, 35800, 41600, 30900, 29700, 32400, 31500, 30500, 19400, 16800, 15100]
/** the report's own labels, in the page's language. The Spanish is the captured figure's, verbatim
 *  (landing/informe_muestra.py); the English is what those five things are called in English. */
const S7_T = {
  es: { since: 'última compra 21 ago · 7 días', m12: 'Media 12m', m3: 'Últimos 3m', play: 'En juego', per: '€/mes' },
  en: { since: 'last order 21 Aug · 7 days', m12: '12m avg', m3: 'Last 3m', play: 'At stake', per: '€/mo' },
}
export function ShotReportChart(p: ShotProps) {
  const b = useBuildIn(p.static)
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t = S7_T[lang]
  /* the generator's own geometry at this shot's size: zero-anchored, `tail` = 3 accent months.
     ROUND 3 · 520 → 480 wide with the 34px gutter kept whole, so the plot measures 412. */
  const W = 412, H = 160, PAD = 8, TAIL = 3
  const hi = Math.max(...XIFRE)
  const step = (W - PAD * 2) / (XIFRE.length - 1)
  const y = (v: number) => H - 4 - (v / hi) * (H - 16)
  const pts = XIFRE.map((v, i) => [PAD + i * step, y(v)] as const)
  const s = (a: readonly (readonly [number, number])[]) => a.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(' ')
  const area = `${PAD},${H - 4} ${s(pts)} ${W - PAD},${H - 4}`
  const [ex, ey] = pts[pts.length - 1]
  /* the two means the report prints, computed off the series above so they can never disagree */
  const mean = (a: number[]) => Math.round(a.reduce((x, yy) => x + yy, 0) / a.length)
  const m12 = mean(XIFRE), m3 = mean(XIFRE.slice(-TAIL))
  const es = (n: number) => n.toLocaleString('es-ES')
  return (
    <div className={b.cls} ref={b.ref}>
      <div className="sh-card s7-card">
        <div className="s7-hd sh-r" style={d(0)}>
          <span className="s7-who">
            <b>Vermuteria Xifré</b>
            <span>{t.since}</span>
          </span>
          <span className="s7-chg"><i>▼</i>−41,5 %</span>
        </div>
        {/* ⚠️ ROUND 5 · THE STYLE PASS. «This is pretty great, but pay attention to the style of
            these charts» (Peter). Five things, all of them dataviz discipline rather than taste:

            1 · TICK WEIGHT AND COUNT. Twelve ticks at 1,4px under twelve nodes was a second row of
                marks competing with the readings themselves — and seven of them stood under months
                that carry no label, so they pointed at nothing. Ticks now appear ONLY under the
                five labelled months, at 1px, and the axis reads as an axis.
            2 · A BASELINE. The plot floated: an area fill has to end ON something or its lower edge
                reads as data. One ghost rule at the zero line, under everything.
            3 · THE AREA STEPS BACK, .26 → .15. At .26 the fill was a grey slab with as much visual
                weight as the stroke, so the eye read a mass instead of a line.
            4 · THE TWO MEANS SHARE ONE DASH PATTERN (4 4) at one weight, differing only in colour —
                two references drawn two ways read as two different KINDS of thing.
            5 · AND THEY ARE LEGENDED WHERE THEIR VALUES ALREADY STAND: each stat card below carries
                the dash of its own line (`.s7-key`). A legend inside a 412px plot is four more
                words on the drawing; a legend on the tile that prints the number is free. */}
        <svg className="s7-plot sh-r" style={d(130)} viewBox={`0 0 ${W} ${H + 4}`} width={W} height={H + 4}
             aria-hidden="true" focusable="false">
          {/* the zero line the area stands on */}
          <line x1={PAD} x2={W - PAD} y1={H - 4} y2={H - 4} stroke="var(--sh-ghost)" strokeWidth="1" />
          {/* THE TWO REFERENCES — the year's mean and the last three months', so the fall is a
              distance the eye measures rather than a percentage it takes on trust. One dash
              pattern, one weight; only the colour separates them. */}
          <line x1={PAD} x2={W - PAD} y1={y(m12)} y2={y(m12)} stroke="var(--sh-warm)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={PAD} x2={W - PAD} y1={y(m3)} y2={y(m3)} stroke="var(--sh-accent)" strokeWidth="1" strokeDasharray="4 4" opacity=".62" />
          <polygon points={area} fill="var(--sh-warm)" fillOpacity=".15" />
          <polyline points={s(pts.slice(0, pts.length - TAIL + 1))} fill="none" stroke="var(--sh-warm)"
                    strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={s(pts.slice(pts.length - TAIL))} fill="none" stroke="var(--sh-accent)"
                    strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {/* A NODE ON EVERY MONTH — twelve readings, not one shape */}
          {pts.map(([px, py], i) => (
            <circle key={i} cx={px.toFixed(1)} cy={py.toFixed(1)} r={i >= pts.length - TAIL ? 3 : 2.4}
                    fill={i >= pts.length - TAIL ? 'var(--sh-accent)' : 'var(--sh-warm)'} />
          ))}
          {/* a tick ONLY under a month that carries a label — an axis mark that names nothing is
              noise, and there were seven of them */}
          {pts.map(([px], i) => (MES_TICKS[lang][i]
            ? <line key={'t' + i} x1={px.toFixed(1)} x2={px.toFixed(1)} y1={H - 4} y2={H + 1}
                    stroke="var(--sh-ghost)" strokeWidth="1" />
            : null))}
          <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="5" fill="var(--sh-accent)" stroke="#fff" strokeWidth="2.5" />
        </svg>
        <div className="sh-r" style={d(210)}><Meses hot={9} lang={lang} /></div>
      </div>

      {/* ── THE THREE FIGURES, EACH ITS OWN CARD ─────────────────────────────────────────────
          ROUND 4 · «The single-card report: the stuff below still as individual cards.» They were
          three columns fused into the chart's own card under a hairline, which is the slab rule 12
          exists to break: a mean, a mean and a difference are three separate readings and the eye
          should be able to take one without stepping over the other two. Each one now stands on
          its own white ground with air between them — and the chart card stays the lead, because
          it is the object and these are what it comes to. */}
      {/* THE LEGEND RIDES THE TILES. Each mean's dash stands beside the label of the tile that
          prints that mean, so the two dashed lines in the plot are named without a word being added
          to the drawing. `En juego` is a DIFFERENCE and not a line, so it wears no dash — a swatch
          on it would point at something that is not there. */}
      <div className="s7-stats">
        <div className="sh-card s7-stat sh-r" style={d(300)}>
          <span className="sh-kc"><i className="s7-key" />{t.m12}</span><Fig int={es(m12)} unit={t.per} />
        </div>
        <div className="sh-card s7-stat sh-r" style={d(360)}>
          <span className="sh-kc"><i className="s7-key is-hot" />{t.m3}</span><Fig int={es(m3)} unit={t.per} />
        </div>
        <div className="sh-card s7-stat is-play sh-r" style={d(420)}>
          <span className="sh-kc">{t.play}</span><Fig int={es(m12 - m3)} unit={t.per} />
        </div>
      </div>
    </div>
  )
}

/* ══ S9 · shot-albaran — GROUP «THE ORDER» ═════════════════════════════════════════════════════
 * ROUND 2 · «this doesn't look like it's going to be printed. It should be an A4 thing. I don't
 * think they understood that either. Let's see how it changes when they go from A4 to A5.»
 *
 * HE IS RIGHT AND THE OLD SHOT WAS A SCREEN. It was the app's document CARD — a 12px radius, a
 * popover shadow, a grey total bar — with a print button parked under it, which is a picture of
 * software and not a picture of paper. This one IS the page:
 *   · TRUE A4 PROPORTION, 1 : √2 exactly, computed rather than eyeballed.
 *   · PAPER MARGINS — 34px at this scale, the same on all four sides, with the foot pinned to the
 *     bottom of the sheet and real white between the last line and it. A document is mostly empty.
 *   · THE PRINTED ANATOMY, not the screen's: the house's own masthead over its razón social, the
 *     albarán's identity block hard right, `PRODUCT / LOTE / SENT / €` as column heads, the
 *     trazabilidad under each product's own name, the payment terms, the signature rule and `1 / 1`.
 *   · SQUARE CORNERS AND A PAPER SHADOW. Paper has neither a radius nor a card's elevation.
 *
 * AND THE TOGGLE REFORMATS IT, which is the half he asked to see. A5 is exactly half an A4, so the
 * sheet steps to 1/√2 of its linear size — and because the measure narrows, the document RE-LAYS
 * ITSELF the way a document does: the LOTE column collapses into the trazabilidad line under each
 * product, the masthead stacks, the type steps down, and the page count goes `1 page` → `2 pages`.
 * That is a reformat and not a zoom, which is the difference between showing print and miming it.
 *
 * ▶ THE ONE IDEA: THE ALBARÁN IS A REAL PRINTED DOCUMENT, AND IT FITS THE PAPER YOU CHOOSE.
 *
 * SOURCE: app-frames/print-export.png, transcribed: `A4`, `1 PAGE`, `Peix Vilalta`, `Peix Vilalta,
 * S.L. · B-65 428 901`, `Albarán 2508-2115`, `Hostal Llobregat · tier 1`, `Monday 25.08`,
 * `3 · eixample`, the column heads `PRODUCT LOTE SENT €`, `lote to attach`, the trazabilidad lines,
 * `Delivered Monday 25.08 · pay by Wednesday 24.09`, `Received by`, `1 / 1`.
 *
 * ⚠️ ROUND 3 · THREE CORRECTIONS. «but small… weird fitting of everything. i would just keep the
 * shape the same as the proportions are identical… just make it snappier. and make the print and
 * settings shit maybe below or on the right or something?»
 *
 *   1 · THE SHEET NO LONGER CHANGES SIZE. He is right that the proportions are identical — A4 and
 *       A5 are both 1 : √2 — so shrinking the drawing to 70,71 % was showing the same rectangle
 *       twice at two scales, which is a zoom wearing a reformat's name and is why the fitting read
 *       as weird (the box had to be the A4's height, and the A5 then floated inside it). The paper
 *       is now ONE constant 448 × 634 rectangle and only its CONTENT reformats: on A5 the type
 *       steps UP by 1,26 — the same ink on a physically smaller page occupies more of it — the
 *       LOTE column collapses into the trazabilidad, the masthead stacks, the third line moves to
 *       the next sheet and the count goes `1 page` → `2 pages`, `1 / 1` → `1 / 2`.
 *   2 · SNAPPIER. The old swap animated width, height and padding over 520 ms, which is 520 ms of
 *       a rectangle sliding. There is nothing to slide now: the content cross-fades in over 190 ms
 *       and the frame around it never moves.
 *   3 · THE CONTROLS MOVED OUT OF THE PAGE'S WAY.
 *
 * ⚠️ ROUND 4 · THE CONTROLS ARE UNDER THE PAGE, AND THE PAGE HAS AIR AROUND IT. «The print page
 * needs work: print button at the bottom or something, figure it out; and padding above and below
 * the pages.» Round 3's right rail is overruled, and the arithmetic it was argued from is the
 * price paid, stated honestly: in a 1:1 box a portrait page is height-starved, so moving 76px of
 * controls under the sheet costs it ~14 % of its linear size (500 → 431 px tall at the gallery's
 * 520 square). What is bought is worth more than the pixels — the page stands ALONE in the frame
 * with nothing beside it, which is what a sheet of paper looks like, and the controls read as what
 * you do WITH the page rather than as furniture the page is mounted in.
 *   · The controls are ONE ROW, CENTRED under the sheet: the paper size as a horizontal segmented
 *     control, what it comes to in pages, and Print.
 *   · THE SHEET HAS REAL AIR ABOVE AND BELOW IT inside the frame — 22px composed on each side, so
 *     the paper never touches the plate's edge at any width. That is his second sentence and it is
 *     the difference between a page on a surface and a page cropped by the frame.
 *   · The non-paper height is held to 106 of 740 (86 % of the drawing is the sheet), because
 *     «keep it as large as the square allows» is the constraint the rest of the row is designed to.
 *
 * 15 FILM        the sheet builds in, then the paper reformats A4 → A5 → A4, 8,4 s, seamless.
 * 13 QUICK IDEA  a sheet of paper with fish on it. Read across a room.
 * 14 LABELS      every string is the printed document's own.
 *  1 SOURCE      as above; the paintings are the kit's own library.
 *  2 ONE IDEA    the document, printed.
 *  3 DOSE        FIVE lines on the capture, THREE here, and each trazabilidad is cut to the four
 *                facts that fit one line — cutting, which is what rule 3 asks for.
 *  4 CHROMELESS  no modal, no print-preview window, no desk. Under the paper are two controls and
 *                a page count, standing clear of it.
 *  5 SCALE       448 × 634 of paper in a 448 × 740 drawing. The page survives the square whole,
 *                with air on all four sides, which is the entire point of a shot of a page.
 *  6 TRUE DATA   101,25 + 322,00 + 442,40 = 865,65, so the foot reads `3 lines · 865,65 €` — the
 *                document's own arithmetic over the lines it actually carries.
 *  7 LEGIBLE     ⚠️ THE ARGUED EXCEPTION. The trazabilidad is 10px composed — legible at native and
 *                small in the square. It is fine print ON A PRINTED PAGE, and it is the only thing
 *                on the shot that says this document carries the law. Everything a reader needs —
 *                the house, the number, the products, the weights, the money, the total — is 12px
 *                or larger. Shrinking the page to make the fine print big would be the shot lying
 *                about what an albarán looks like.
 *  8 MOTION      the toggle, which is exactly the state change he asked to be shown.
 *  9 ONE PROOF   the standing document, once. V44 shows an albarán being WRITTEN; different claims,
 *                and rule 9 keeps them off one page.
 * 11 FILL        the paper is the frame.
 * 12 BREATHE     ONE object. A document is a document; its rows are held by its own hairlines.
 */
/* the trazabilidad follows the page's language ONLY in its state word (fresco/descongelado — the
 * one language-bearing word in it); the species, the FAO zones, the gear and the dates are the
 * document's own facts on every page. */
const S9_LINES = [
  { face: F + 'pulpo.webp', n: 'Pulpo', kg: '7,5 kg', int: '101', dec: ',25',
    trace: { es: 'Octopus vulgaris · FAO 27 Gran Sol · nasas · descongelado · 20.08',
             en: 'Octopus vulgaris · FAO 27 Gran Sol · nasas · defrosted · 20.08' } },
  { face: F + 'gamba-roja.webp', n: 'Gamba roja de Palamós', kg: '3,5 kg', int: '322', dec: ',00',
    trace: { es: 'Aristeus antennatus · FAO 37 Palamós · arrastre de fondo · fresco · 21.08',
             en: 'Aristeus antennatus · FAO 37 Palamós · arrastre de fondo · fresh · 21.08' } },
  { face: F + 'merluza.webp', n: 'Merluza', kg: '28 kg', int: '442', dec: ',40',
    trace: { es: 'Merluccius merluccius · FAO 27 Gran Sol · palangre de fondo · fresco · 21.08',
             en: 'Merluccius merluccius · FAO 27 Gran Sol · palangre de fondo · fresh · 21.08' } },
]
/** the printed page's chrome and the print bar's, in the page's language. The house, its razón
 *  social, `Albarán 2508-2115`, the van, the weights and the money are the document's own. `Lote`
 *  heads its column in both languages — it is the product's noun, term rather than translation. */
const S9_T = {
  es: {
    client: 'Hostal Llobregat · tarifa 1', date: 'lunes 25.08', product: 'Producto', sent: 'Enviado',
    toAttach: 'lote por adjuntar', foot: '3 líneas · 865,65 €',
    terms: 'Entregado el lunes 25.08 · vence el miércoles 24.09', recv: 'Recibí',
    p1: '1 página', p2: '2 páginas', print: 'Imprimir',
  },
  en: {
    client: 'Hostal Llobregat · tier 1', date: 'Monday 25.08', product: 'Product', sent: 'Sent',
    toAttach: 'lote to attach', foot: '3 lines · 865,65 €',
    terms: 'Delivered Monday 25.08 · pay by Wednesday 24.09', recv: 'Received by',
    p1: '1 page', p2: '2 pages', print: 'Print',
  },
}
/* 2300 press A5 · 2460 reformat · 5100 press A4 · 5260 reformat back. Loop 8400, rest on A4. */
const S9_A5 = 2460, S9_A4 = 5260
export function ShotAlbaran(p: ShotProps) {
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t9 = S9_T[lang]
  const f = useFilm(8400, 1200, p.static, (t) => ({
    a5: t >= S9_A5 && t < S9_A4,
    tap5: t >= S9_A5 - 160 && t < S9_A5,
    tap4: t >= S9_A4 - 160 && t < S9_A4,
  }))
  const s = f.s
  /* A5 IS HALF AN A4, so the third line does not fit on the first sheet — it is on page two, which
     is exactly what the count says. Cutting it is the reformat; keeping it would be the lie. */
  const lines = s.a5 ? S9_LINES.slice(0, 2) : S9_LINES
  return (
    <div className={f.cls} ref={f.ref}>
      <div className="s9-wrap">
        <div className="s9-box sh-r" style={d(0)}>
          {/* THE SHEET IS ONE CONSTANT RECTANGLE. Only what is printed on it reformats — and the
              inner layer is KEYED on the size, so the swap is a 190 ms cross-fade rather than an
              animated rectangle. «just make it snappier.» */}
          <div className={'s9-paper' + (s.a5 ? ' is-a5' : '')}>
            <div className="s9-ink" key={s.a5 ? 'a5' : 'a4'}>
              {/* THE MASTHEAD — the house, its razón social, and whose albarán this is */}
              <div className="s9-mast">
                <div className="s9-house">
                  <b>Peix Vilalta</b>
                  <span className="s9-van">3 · eixample</span>
                  <span className="s9-legal">Peix Vilalta, S.L. · B-65 428 901</span>
                </div>
                <div className="s9-doc">
                  <b>Albarán 2508-2115</b>
                  <span>{t9.client}</span>
                  <span>{t9.date}</span>
                </div>
              </div>

              <div className="s9-rule" />
              <div className="s9-cols">
                <span>{t9.product}</span>
                <span className="s9-c-lote">Lote</span>
                <span className="s9-r">{t9.sent}</span>
                <span className="s9-r">€</span>
              </div>

              {lines.map((l) => (
                <div className="s9-ln" key={l.n}>
                  <span className="s9-p">
                    <img className="s9-face" src={l.face} alt="" width={20} height={20} loading="lazy" decoding="async" />
                    <span className="s9-p-t">
                      <b>{l.n}</b>
                      {/* on A5 the lote has nowhere to stand as a column, so it joins the trace —
                          which is what a document does when the measure narrows */}
                      <em>{s.a5 ? t9.toAttach + ' · ' : ''}{l.trace[lang]}</em>
                    </span>
                  </span>
                  <span className="s9-lote">{t9.toAttach}</span>
                  <span className="s9-sent">{l.kg}</span>
                  <span className="s9-eur"><b>{l.int}</b><i>{l.dec}</i> €</span>
                </div>
              ))}

              {/* the white of the page — a document is mostly empty, and that is what makes it paper */}
              <div className="s9-white" />

              <div className="s9-rule" />
              <div className="s9-foot">
                <span className="s9-f-l">
                  <b>{t9.foot}</b>
                  <span>{t9.terms}</span>
                </span>
                <span className="s9-f-r">
                  <i className="s9-sig" />
                  <span>{t9.recv}</span>
                  <span className="s9-pg">1 / {s.a5 ? 2 : 1}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* THE CONTROLS — the paper size, what it comes to in pages, and the act. UNDER the sheet
            and centred on it (round 4), so the page stands alone in the frame. */}
        <div className="s9-bar sh-r" style={d(140)}>
          <span className="s9-size">
            <span className={'s9-sz' + (s.a5 ? '' : ' is-on') + (s.tap4 ? ' tap' : '')}>A4</span>
            <span className={'s9-sz' + (s.a5 ? ' is-on' : '') + (s.tap5 ? ' tap' : '')}>A5</span>
          </span>
          <span className="s9-pages">{s.a5 ? t9.p2 : t9.p1}</span>
          <span className="sh-btn s9-print"><IcPrint />{t9.print}</span>
        </div>
      </div>
    </div>
  )
}

/* ══ S10 · shot-catalog — GROUP «STOCK & PRICES» ═══════════════════════════════════════════════
 * ROUND 2 · «that's cool. I like that. I want to see tariffs for one, and then another one expands.
 * The middle one expands, and the shrimp one expands. You have tariffs for the shrimp, and that's
 * the first thing. You put the merluza second, and then it expands. You can see that it has a bunch
 * of sub-products. What would be the best way to show this: both sides, multiple tariffs, and
 * multiple products.»
 *
 * THE ANSWER TO HIS QUESTION IS TWO BEATS RATHER THAN ONE FRAME. A three-by-three matrix of prices
 * shows both axes at once and reads as a spreadsheet — and worse, this house prices Merluza's three
 * variations off one ladder, so the matrix would print the same three numbers three times and look
 * broken while being true. Walking it shows more and asserts less:
 *
 *   BEAT 1 · THE SHRIMP OPENS on its three TARIFAS — one product, its price on each price list.
 *   BEAT 2 · IT CLOSES AS THE MERLUZA OPENS on its three SUB-PRODUCTS — one family, its members.
 *
 * And the tarifa selector stands in the head through BOTH beats (`Today · Tarifa 1`, the screen's
 * own), so the second axis is named while the first is being shown and the reader is never asked
 * to hold a diagram in their head. One card is open at a time and both expansions are exactly three
 * rows at the same row height, so the shot's height never moves.
 *
 * ▶ THE ONE IDEA: THE CATALOGUE IS THE GOODS, AND OPENING ONE SHOWS ITS PRICES — OR ITS MEMBERS.
 *
 * SOURCE: app-frames/catalogo-roll.png for the head (`Catalogue · 12 products · Today · Tarifa 1`),
 * the family/member structure and the members' own sublines (`sin cabeza · Asked 11 times this
 * month`, `de pincho · Written on 12 albaranes, under Merluza`, `Merluza · 3 variations · 40 kg on
 * the floor`); app-frames/producto-precio.png for Merluza's three bands.
 *
 * 15 FILM        the shrimp's tarifas, then the merluza's members. 9,6 s, no seam.
 * 13 QUICK IDEA  a list of fish, one of them open. Read in one look, twice.
 * 14 LABELS      every string is the screen's own, character for character.
 *  1 SOURCE      as above; the paintings are the kit's 793-file library.
 *  2 ONE IDEA    the goods as records, and what opening one gives you.
 *  3 DOSE        three products, three rows inside whichever one is open. Never more than six
 *                objects on screen.
 *  4 CHROMELESS  no list pane, no shelf headings, no scroll rail.
 *  5 SCALE       480 wide at a fixed 408 tall.
 *  6 TRUE DATA   ⚠️ THE ONE DERIVED FIGURE, WRITTEN OUT SO IT CAN BE CHECKED. Gamba roja's Tarifa 1
 *                is 92,00 €/kg — read twice off the captures (albaran-sheet.png prices 3,5 kg at
 *                322,00 €, and BEATS.md §3 beat 5 prices 6 kg at 552,00 €; both divide to 92,00).
 *                Its Tarifa 2 and 3 are that figure through MERLUZA'S OWN VERIFIED LADDER, because
 *                producto-precio.png states the bands are «Set by margin %» off a chain — so the
 *                ratios 15,50/14,82 and 16,07/14,82 are the house's rule, not a curve fitted here:
 *                92,00 × 1,04588 = 96,22 and 92,00 × 1,08434 = 99,76.
 *                Merluza's own three bands and its members' sublines are read directly.
 *  7 LEGIBLE     13px is the floor (the members' sublines).
 *  8 MOTION      an expansion is the one interaction this object has, and he asked to see it.
 *  9 ONE PROOF   the only catalogue proof, and the only tarifa-structure proof, in the library.
 * 10 STRANGER    «a product list where opening a fish shows its prices — or the versions of it.»
 * 11 FILL        every card runs the full width.
 * 12 BREATHE     the catalogue is one continuous roll in the app; here each product is its own card
 *                with 12px of air, and what it opens carries inside itself.
 */
/* ⚠️ ROUND 5 · THE SHOT IS ABOUT VARIATIONS, AND THE TARIFA AXIS LEAVES IT ═══════════════════════
 *
 * «The fact that you have the tariff selector at the top and then you have tariffs in one of these
 *  feels wrong. Maybe this is all about how the catalog has different variations. I think that's the
 *  main thing, but there needs to be a little bullet or bent arrow on each of the variations, and
 *  each of these things should show that we cover different variations. All it is is an animated
 *  thing to make them notice it, so it's not that it shows different info about those variations.
 *  The price per variation would change, bro.» (Peter, round 5)
 *
 * THE CONFLICT WAS REAL AND IT IS RESOLVED BY SUBTRACTION. `Today · Tarifa 1` stood in the head as
 * the shot's second axis, and directly under it the shrimp opened on THREE TARIFAS — so one frame
 * said «you are on tarifa 1» and «here are your three tarifas» at the same time, and a reader had to
 * work out which one the prices in the rows belonged to. The tarifa dimension already has two proofs
 * in the library (V5 walks a product's three tarifas; V4's price opens the tarifa that filled it),
 * and rule 9 keeps one claim to one place. So the selector is gone, the shrimp's tarifa beat is
 * gone, and this shot now makes ONE argument: A PRODUCT IS A FAMILY, AND EVERY VARIATION IN IT
 * CARRIES ITS OWN PRICE.
 *
 * THE BENT ARROW is on every variation row — `↳`, the mark for a thing that hangs off the thing
 * above it — so the indent is stated and not merely implied.
 *
 * THE ANIMATED NOTICE is an ATTENTION CHOREOGRAPHY and nothing else: a soft wash walks the three
 * rows in turn, ~900 ms each, lifting each variation's price as it passes. It adds no information
 * («it's not that it shows different info about those variations») — it makes the eye visit three
 * prices it would otherwise read as one block.
 *
 * ⚠️ AND THE THREE PRICES ARE THE HOUSE'S OWN, WHICH IS THE POINT PETER IS MAKING.
 *   · `entera` 14,82 €/kg — producto-precio.png, Merluza's own Tarifa 1 band; entera is the base
 *     form, so the family's band IS its price.
 *   · `sin cabeza` 15,80 €/kg — READ TWICE: ambiguedad-informada.png prints `15,80 €/kg` against
 *     `merluza` in the line entry, and comerciales-composer.png prices 12 kg of `Merluza sin cabeza`
 *     at 189,60 €, and 189,60 ÷ 12 = 15,80. Two captures, one figure. It is 6,6 % over `entera`, and
 *     that difference is the whole claim: a variation is not a label, it is a price.
 *   · `de pincho` carries NO figure, and that is a shipped state rather than a gap.
 *     `situations/baseweb/src/app/catalogue.ts` holds it as `{ node: 'n-hake-hook', name: 'Merluza de
 *     pincho', albaranes: 12, provisional: true }` — a variation ROCOTO FOUND on twelve albaranes
 *     and proposed, which the house has not priced yet. So the row carries the act instead of a
 *     number, and the choreography's last stop lands on the one row that needs a person. Inventing a
 *     third €/kg would have been the only dishonest way to fill that cell.
 */
/* the variation WORDS — entera, sin cabeza, de pincho — are the goods' own names and stand on
 * every page; the notes and the act are chrome and follow the page. */
const S10_MEMBERS: {
  w: string; int: string; dec: string
  note?: { es: string; en: string }; act?: { es: string; en: string }
}[] = [
  { w: 'entera', int: '14', dec: ',82' },
  { w: 'sin cabeza', int: '15', dec: ',80',
    note: { es: 'Pedida 11 veces este mes', en: 'Asked 11 times this month' } },
  { w: 'de pincho', int: '', dec: '',
    note: { es: 'Escrita en 12 albaranes', en: 'Written on 12 albaranes' },
    act: { es: 'Poner precio', en: 'Set the price' } },
]
/** the roll's chrome, in the page's language. */
const S10_T = {
  es: { head: 'Catálogo', cnt: '12 productos', sub: '3 variaciones · 40 kg en cámara' },
  en: { head: 'Catalogue', cnt: '12 products', sub: '3 variations · 40 kg on the floor' },
}
/* ── THE BEAT SCRIPT ─────────────────────────────────────────────────────────────────────────
   900   the family is tapped (160)
   1060  it opens; the three variation rows stagger in 130 ms apart
   2100  THE NOTICE WALKS: row 0 for 900, row 1, row 2 — one price lifted at a time
   4800  it holds, all three standing, for 3,4 s
   8600  it closes · 9200 the shot fades and plays again                                       */
const S10_OPEN = 1060, S10_WALK = 2100, S10_STEP = 900, S10_END = 8600
export function ShotCatalog(p: ShotProps) {
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t10 = S10_T[lang]
  const f = useFilm(9600, 5600, p.static, (t) => ({
    tap: t >= S10_OPEN - 160 && t < S10_OPEN,
    open: t >= S10_OPEN && t < S10_END,
    /* how many rows have arrived, and which one the notice is on (-1 = none) */
    rows: t < S10_OPEN ? 0 : Math.min(3, Math.floor((t - S10_OPEN) / 130) + 1),
    lit: t >= S10_WALK && t < S10_WALK + 3 * S10_STEP
      ? Math.floor((t - S10_WALK) / S10_STEP) : -1,
  }))
  const s = f.s
  return (
    <div className={f.cls} ref={f.ref}>
      <div className="s10-hd sh-r" style={d(0)}>
        <span className="sh-head">{t10.head}</span>
        <span className="s10-cnt">{t10.cnt}</span>
      </div>

      <div className="s10-rows">
        {/* ── THE FAMILY, AND THE THREE VARIATIONS IN IT ───────────────────────────────────── */}
        <div className={'sh-card s10-card sh-r' + (s.open ? ' is-open' : '') + (s.tap ? ' is-tap' : '')} style={d(120)}>
          <div className="s10-row">
            <img className="sh-face sh-face-lg" src={F + 'merluza.webp'} alt="" width={44} height={44} loading="lazy" decoding="async" />
            <span className="s10-b">
              <span className="s10-n">Merluza</span>
              <span className="s10-s">{t10.sub}</span>
            </span>
            <span className={'s10-caret' + (s.open ? ' up' : '')}><IcDown /></span>
          </div>
          <div className="s10-open">
            {S10_MEMBERS.map((m, i) => (
              <div className={'s10-mem' + (s.rows > i ? ' in' : '') + (s.lit === i ? ' lit' : '')}
                   key={m.w}>
                {/* the bent arrow: this row hangs off the family above it, said and not implied */}
                <i className="s10-arrow" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 2.5v6a2 2 0 0 0 2 2h6" /><path d="m9.5 8 3 2.5-3 2.5" />
                  </svg>
                </i>
                <span className="s10-mw">{m.w}</span>
                <span className="s10-mn">{m.note ? m.note[lang] : ''}</span>
                {m.act
                  ? <span className="s10-set">{m.act[lang]}</span>
                  : <Fig int={m.int} dec={m.dec} unit="€/kg" />}
              </div>
            ))}
          </div>
        </div>

        <div className="sh-card s10-card s10-shut sh-r" style={d(200)}>
          <div className="s10-row">
            <img className="sh-face sh-face-lg" src={F + 'gamba-roja.webp'} alt="" width={44} height={44} loading="lazy" decoding="async" />
            <span className="s10-b"><span className="s10-n">Gamba roja de Palamós</span></span>
            <span className="s10-caret"><IcDown /></span>
          </div>
        </div>

        <div className="sh-card s10-card s10-shut sh-r" style={d(280)}>
          <div className="s10-row">
            <img className="sh-face sh-face-lg" src={F + 'rape.webp'} alt="" width={44} height={44} loading="lazy" decoding="async" />
            <span className="s10-b"><span className="s10-n">Rape</span></span>
            <span className="s10-caret"><IcDown /></span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══ S12 · shot-customer — GROUP «THE CUSTOMER» ════════════════════════════════════════════════
 * ROUND 2 · «The line chart isn't about their order days, but about their historical ordering
 * volume (last month, last year, or something). The bar chart of their usual order is silly to have
 * when the leaderboard already shows the different progress or the different standing. There should
 * be a "Show more" button with a chevron, and the order history is a different thing.»
 *
 * FOUR CORRECTIONS, ALL HIS:
 *   · THE CHART IS NOW VOLUME OVER TIME — twelve months, month-marked, with the same encoding the
 *     report uses. A weekday chart answered «which days» when the question a customer page opens
 *     with is «how much, and is it going up».
 *   · THE LEADERBOARD LOST ITS BARS. A rank number and a weight, nothing else — the bars re-drew a
 *     ranking the rank was already stating.
 *   · A «SHOW MORE» CHEVRON closes the history, because the page says `4 albaranes` and shows two,
 *     and a list that is cut should say so with a control rather than with a fading ghost bar.
 *   · THE HISTORY IS ITS OWN LABELLED BLOCK, on its own ground, under its own rule.
 *
 * ▶ THE ONE IDEA: THE PAGE KNOWS THIS CUSTOMER — WHAT THEY BUY, WHAT IT COMES TO, AND EVERYTHING
 *   THEY HAVE BOUGHT.
 *
 * SOURCE: app-frames/cliente-ficha.png (`Bar Manolo`, `THEIR USUAL ORDER 7,1 kg of Gamba roja de
 * Palamós, 8,2 kg of Rape and 6,3 kg of Merluza`, `TARIFA Tarifa 2`) and
 * app-frames/pedidos-anteriores.png (`Their orders · 4 albaranes` and its rows).
 *
 * ⚠️ THE TWELVE-MONTH SERIES IS DERIVED, AND HERE IS THE DERIVATION, because rule 6 does not let a
 * figure stand without one. The app's seeded per-customer history is FOURTEEN DAYS deep
 * (`historyOf` in situations/baseweb/src/app/knows.ts returns five albaranes over ~2 weeks), so no
 * capture holds twelve months for one customer — only the sample report does, for the six it
 * prints. So this series is built out of two facts that ARE Bar Manolo's:
 *     · their four albaranes' own money, off pedidos-anteriores.png:
 *       508,16 + 232,10 + 1213,77 + 293,96 = 2248,00 over four → a 562,00 € albarán
 *     · their order days, off cliente-ficha.png: `Mon · Fri`, counted against the real calendar for
 *       each month from September 2025 to August 2026 → 9,9,8,9,9,8,9,8,9,9,9,9 order days
 * and shaped by THE HOUSE'S OWN SEASONALITY, taken as the mean of the six report series normalised
 * over their first nine months (`informe_muestra.FALLING`, months sep–may, the stretch before those
 * six start falling). The last three months are held at the index's own mean of 1,00, because the
 * report's own jun–ago carry the FALL and this customer is not one of the falling six.
 *     month €  =  562,00 × order-days × seasonal index
 * Every input is on a real screen and the arithmetic is written above; nothing is estimated by eye.
 * The December peak in the picture is the house's own December, not a curve drawn to look good.
 *
 * ⚠️ ROUND 3 · «why full height. confusing. the sondermamjja is shit. the tarifs are ok. the order
 * history is ok but the show more should be in their usual order.» Three corrections:
 *   · SHORTER. The plot lost 20px of height and every block under it lost its slack (the label
 *     margins, the leaderboard's row height, the history's gaps). Same six facts, ~70px less page.
 *   · THE MONTH MARKS ARE NAMED AND SPARSE — four ticks with the years on the ends, drawn by the
 *     shared `Meses` above. `s o n d e f m a m j j a` was a word, not an axis.
 *   · `SHOW MORE` MOVED INTO `THEIR USUAL ORDER`. It is the control for the list that is cut, and
 *     the ranking is the cut list — the history already states its own count in its label.
 *
 * ⚠️ ROUND 7 · «ok just fix the padding and put the tarifa to be aroudn the top. better not around
 * states as it;s a control thing. and put the phone number of the account lol.» (Peter, round 6)
 *   · THE TARIFA IS A CONTROL AND NOW SITS WHERE ONE SITS — the head's second row, over the rule
 *     that starts the reading. It used to stand between the leaderboard and the history, wedged in
 *     among the things the page TELLS you; a lever the house pulls on this customer is not one of
 *     those. The rule under it is the whole argument: above it, the account and the one control on
 *     it; below it, everything the page knows.
 *   · THE ACCOUNT'S PHONE NUMBER stands under the name. Bar Manolo `ORDERS ON WhatsApp`
 *     (cliente-ficha.png) — the account IS a number, and a sheet you cannot ring is a record.
 *   · THE PADDING IS ONE NUMBER. `15px 20px 16px` was three, none of them the house's; 20px on all
 *     four sides is the app's own card measure, and the height it costs comes back out of the block
 *     the tarifa vacated.
 *
 * 15 BUILD-IN    the name, the chart, the months, the leaderboard, the tarifa, the history.
 * 13 QUICK IDEA  a curve, three ranks and two receipts.
 * 14 LABELS      `ORDER VOLUME · 12 MONTHS`, `THEIR USUAL ORDER`, `TARIFA`, `ORDER HISTORY`,
 *                `Show more`, `To print`, `Out today`, `They asked a question`.
 *  3 DOSE        the sheet's seven fields became three; the history's four albaranes became two
 *                and a control that says there are more.
 *  4 CHROMELESS  no sheet pane, no pager, no account rail.
 *  5 SCALE       480 wide; every block is a full-width row, so the page scales as one object.
 *  7 LEGIBLE     11.5px caps labels; 10px month marks; 13px history meta.
 *  8 MOTION      the build-in and nothing else — a page is not an event.
 *  9 ONE PROOF   the only customer proof, and the only history proof, in the library.
 * 10 STRANGER    «a restaurant's page: what they buy a month, what they buy, and their last notes.»
 * 11 FILL        one card at the full width, everything inside it edge to edge.
 * 12 BREATHE     ONE object — a page is a page. Air and one hairline separate its parts.
 */
const MANOLO = [5018, 4970, 4584, 6055, 4870, 4211, 5069, 4381, 4717, 5058, 5058, 5058]
/** ⚠️ ROUND 7 · THE ACCOUNT'S NUMBER, AND IT IS DERIVED THE HOUSE'S OWN WAY.
 *  «put the phone number of the account lol» (Peter). No capture prints a customer's phone, so this
 *  is not read off a screen — it is BUILT by the app's own generator, which is the one thing rule 6
 *  allows in place of a reading. `cast.ts` states the law in its own words: «PHONE NUMBERS ARE
 *  DERIVED TOO (`phoneOf`), from the person's own place in the list plus the house's own salt, so
 *  nothing in this file is a number somebody could mistake for a real one and every row still shows
 *  the shape of one.» So this is `phoneOf(14, 0)` — Bar Manolo's own place in the customers roster
 *  (index 0) taken past the thirteen-person staff roster, so it can never collide with a comercial's
 *  and it is the same shape every other number in the product wears. */
const MANOLO_TEL = '+34 644 19 62 81'
/** the sheet's chrome, in the page's language. `Bar Manolo`, the phone, the weights, the money and
 *  the albarán count are the account's own facts; `Tarifa` and `albaranes` are the product's nouns
 *  and stand as terms in both languages. */
const S12_T = {
  es: {
    vol: 'Volumen de pedidos · 12 meses', usual: 'Su pedido habitual', more: 'Ver más',
    hist: 'Pedidos anteriores · 4 albaranes',
    d1: 'sábado 23.08', m1: '2 líneas · 07:55', asked: 'Han preguntado', s1: 'Por imprimir',
    d2: 'viernes 22.08', m2: '4 líneas · 08:37', s2: 'Sale hoy',
  },
  en: {
    vol: 'Order volume · 12 months', usual: 'Their usual order', more: 'Show more',
    hist: 'Order history · 4 albaranes',
    d1: 'Saturday 23.08', m1: '2 lines · 07:55', asked: 'They asked a question', s1: 'To print',
    d2: 'Friday 22.08', m2: '4 lines · 08:37', s2: 'Out today',
  },
}
export function ShotCustomer(p: ShotProps) {
  const b = useBuildIn(p.static)
  /* ROUND 7 · the month axis follows the page, like S7's — this card's own labels are English, so a
     Spanish axis under them was the one string in it a reader had to stop at. */
  const lang = p.lang === 'en' ? 'en' : 'es'
  const t12 = S12_T[lang]
  /* ROUND 3 · «why full height. confusing.» The plot lost 20px and every block below it lost its
     slack, so the page is a page rather than a column that keeps going.
     ROUND 5 · «the fact that it's full height is an issue» — 76 → 62, and the measure widened to
     436 with the card's own padding cut 24 → 20. A twelve-month shape reads on 62px of height; what
     it cannot survive is losing months, and it loses none. */
  const W = 436, H = 62, PAD = 6
  const hi = Math.max(...MANOLO)
  const step = (W - PAD * 2) / (MANOLO.length - 1)
  const pts = MANOLO.map((v, i) => [PAD + i * step, H - 5 - (v / hi) * (H - 18)] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${PAD},${H - 5} ${line} ${W - PAD},${H - 5}`
  const [ex, ey] = pts[pts.length - 1]

  const USUAL = [
    { f: F + 'rape.webp', n: 'Rape', kg: '8,2 kg' },
    { f: F + 'gamba-roja.webp', n: 'Gamba roja de Palamós', kg: '7,1 kg' },
    { f: F + 'merluza.webp', n: 'Merluza', kg: '6,3 kg' },
  ]
  return (
    <div className={b.cls} ref={b.ref}>
      <div className="sh-card s12-card">
        <div className="s12-top sh-r" style={d(0)}>
          <span className="s12-who">
            <span className="s12-nm">Bar Manolo</span>
            {/* ⚠️ ROUND 7 · «and put the phone number of the account lol» (Peter). Bar Manolo
                `ORDERS ON WhatsApp` (cliente-ficha.png), so the account IS a phone number, and a
                customer sheet that cannot be dialled from is a record rather than a relationship. */}
            <span className="s12-tel"><IcPhone />{MANOLO_TEL}</span>
          </span>
          {/* ROUND 5 · «The map thing can be bigger.» 52 → 72 — where this customer is, at the size
              of a fact rather than of an icon. */}
          <img className="s12-map" src={F + 'map-thumb.png'} alt="" width={72} height={74} loading="lazy" decoding="async" />
        </div>

        {/* ── THE TARIFA — A CONTROL, AND IT SITS WHERE CONTROLS SIT ───────────────────────
               ⚠️ ROUND 7 · «put the tarifa to be around the top. better not around states as it's
               a control thing» (Peter). It used to stand between `Their usual order` and the
               history — in the middle of the READ-OUT, wedged among things the page is telling you.
               A tarifa is not a state this customer is in; it is the lever the house pulls on them,
               and a lever belongs beside the name it applies to, where a hand looks for it. It is
               the head's second line now, over the rule that starts the reading. */}
        <div className="s12-two sh-r" style={d(60)}>
          <span className="sh-kc">Tarifa</span>
          <span className="s12-tarifas">
            <span className="s12-t">1</span><span className="s12-t is-on">2</span><span className="s12-t">3</span>
          </span>
        </div>

        {/* ── ORDER VOLUME, twelve months ─────────────────────────────────────────────────── */}
        <div className="s12-read sh-r" style={d(110)}>
          <span className="sh-kc">{t12.vol}</span>
          <svg className="s12-vol" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" focusable="false">
            <polygon points={area} fill="var(--sh-accent)" fillOpacity=".10" />
            <polyline points={line} fill="none" stroke="var(--sh-accent)" strokeWidth="2.2"
                      strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.4" fill="var(--sh-accent)" />)}
            <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="4.5" fill="var(--sh-accent)" stroke="#fff" strokeWidth="2.2" />
          </svg>
          <Meses lang={lang} />
        </div>

        {/* ── THEIR USUAL ORDER — rank and weight, and no bar re-drawing the rank ───────────
            ROUND 3 · `Show more` LIVES HERE. «the show more should be in their usual order» — and
            he is right about where it belongs: this is the cut list. A house buys forty things and
            three are ranked; the history under it prints the albaranes it has room for and says how
            many there are in its own label. The control belongs to the ranking it truncates. */}
        <div className="sh-r" style={d(210)}>
          <span className="sh-kc s12-lab">{t12.usual}</span>
          <div className="s12-board">
            {USUAL.map((u, i) => (
              <div className="s12-lr" key={u.n}>
                <span className="s12-rk">{i + 1}</span>
                <img src={u.f} alt="" width={26} height={26} loading="lazy" decoding="async" />
                <span className="s12-ln">{u.n}</span>
                <span className="s12-lv">{u.kg}</span>
              </div>
            ))}
          </div>
          <div className="s12-more">{t12.more}<IcDown /></div>
        </div>

        {/* ── THE HISTORY, its own labelled block ─────────────────────────────────────────── */}
        <div className="s12-hist sh-r" style={d(300)}>
          <span className="sh-kc">{t12.hist}</span>
          <div className="s12-h-row">
            <span className="s12-h-b">
              <span className="s12-h-d">{t12.d1}</span>
              <span className="s12-h-m"><i className="sh-dot" />{t12.m1}<IcChat />{t12.asked}</span>
            </span>
            <span className="s12-h-r"><Fig int="508" dec=",16" unit="€" /><span className="s12-h-s">{t12.s1}</span></span>
          </div>
          <div className="s12-h-row">
            <span className="s12-h-b">
              <span className="s12-h-d">{t12.d2}</span>
              <span className="s12-h-m">{t12.m2}</span>
            </span>
            <span className="s12-h-r"><Fig int="1213" dec=",77" unit="€" /><span className="s12-h-s">{t12.s2}</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
