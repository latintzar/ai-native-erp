import { Fit, useBeat, useTakeOver, typed } from './motionkit'

/** ── comerciales-composer · «free form in, finished structure out» ────────────────────────────
 *
 *  ⚠️ REBUILT FROM ZERO, ROUND 2. The old island's film was «who is this albarán for» — a customer
 *  name typed into a title, a hits panel narrowing, and only then a line entry that arrived already
 *  wearing a price and a row of suggestions. Peter killed all of it in one breath:
 *
 *    «You still have the price on the left. It's really, really bad… Why isn't this whole thing
 *     centered, or why do you have the fold? … When you add a new line item, it shouldn't have the
 *     price on it at all. It shouldn't have the recommendations at the bottom… it should only show
 *     the fields once they press Enter. Once they press Enter, it should show the name, the thing,
 *     the type, the unit, the quantity, and the price in columns. Below that, it should show the
 *     class and the lots. You didn't change anything.»
 *
 *  …and then gave the exact film, which is what this file now is, beat for beat:
 *
 *    1 · ONE FREE-FORM FIELD   nothing but a field, and it is ALREADY BEING TYPED. Its placeholder
 *                              is the app's own free-form example, so the field says «type it
 *                              however it was said» by showing it. Inside the field, on the RIGHT,
 *                              ONE mark plus the key: the ROCOTO FACE (what Rocoto would put here)
 *                              and the ENTER key. ⚠️ ROUND 3 KILLED THE HEART — «why the heart AND
 *                              the rocoto logo. just the rocoto thing».
 *    2 · ENTER                 and the STRUCTURE POPULATES, in columns:
 *                                 col 1, widest   the name and its sort — `Merluza` `sin cabeza`
 *                                                 with `class A · lote` SMALL underneath
 *                                 col 2           the quantity, with the unit as its own editable
 *                                                 sub-column — `12` `kg`
 *                                 col 3, right    the price, AUTO-FILLED off this customer × this
 *                                                 tarifa — `189,60 €`
 *                              …AND THE LINE IS ON THE DOCUMENT AT THAT INSTANT: the row drops its
 *                              chip ground into the document's own register, `Add item` stands
 *                              under it again and the foot totals two lines.
 *    3 · THE PRICE TAP         tapping the price opens a small dropdown of THEIR tarifas with
 *                              `Edit tariffs` at its foot. Everything is circular: price → tarifa →
 *                              the catalogue that sets it. Every value on the row keeps its
 *                              editable underline for good — the row is live, not frozen.
 *
 *  ══ ROUND 4 · THERE IS NO CONFIRM, AND THERE IS NO IDLE BEAT ══════════════════════════════════
 *
 *  «I told you not confirm… why is there still confirm??? EVERYTHING SHOULD ALWAYS BE EDITABLE FROM
 *   THE GET-GO. You shouldn't need to confirm anything — that's exactly what RAQUEL complained
 *   about… everything should be clickable, we're not in 2002 SaaS territory.» (Peter, round 4)
 *
 *  TWO THINGS WENT.
 *    · THE CONFIRM BUTTON AND ITS BEAT. Enter built the columns and then a dark `Confirm` sat under
 *      them for two and a half seconds while the document waited — a gate between a person and
 *      their own line. Enter IS the commit; the total moves with it; there is nothing to press
 *      afterwards. What used to be the «flatten» beat now happens AT Enter, because the row does
 *      not become a line, it IS one.
 *    · THE IDLE OPENING. `Add item` was pressed at 900 and the field then stood empty until 1600,
 *      so the first 1,6 s of a 10 s loop was a frame waiting to be interesting. The field is open
 *      and being typed from t=0 — «the field is being typed as soon as the shot enters».
 *  The loop came 10000 → 8000 ms on those two cuts alone, and nothing was lost: every beat that
 *  carried an argument is still here, in the same order.
 *
 *  CENTERED, AND NO FOLD. The old island was drawn at 719 × 692 and its empty state filled barely
 *  half of that, which is the «fold» — a card at the top of a box and 300px of nothing under it.
 *
 *  ROUND 3 · NARROWER, AND THE HEIGHT IS NAILED DOWN. «why full width? … the jitteryness can
 *  improve, the height keeps changing.» The card is 460 inside a 500 stage, so it stands at its own
 *  width with air either side rather than running the frame's whole measure. And the height that
 *  kept changing is gone at the root: the card no longer MEASURES itself per beat (the old
 *  `useOwnHeight` produced five different heights in one loop and animated between them). Every
 *  beat now draws inside `.cb-slot`, one reserved box sized to the tallest of them, so the card's
 *  height is a constant and nothing in the frame can reflow.
 *
 *  ⚠️ EVERY FIGURE IS OFF A CAPTURE.
 *    · `Hostal Montserrat` · `2208-7000` · `for Friday 22.08 · at 09:45` · `Tarifa 1` · the map
 *      square                                        — app-frames/comerciales-composer.png
 *    · `Gamba roja de Palamós · 6 kg · class A · lote · 552,00 €`  — BEATS.md §3, beat 5
 *    · `Merluza` · `sin cabeza` · `12 kg` · `class A` · `lote` · `189,60 €`  — the same capture's
 *      first line; and 189,60 ÷ 12 = 15,80 €/kg, which is the price the line entry fills in
 *      app-frames/ambiguedad-informada.png. The two captures agree, so the number is doubly read.
 *    · the placeholder `merluza sin cabeza caja 6 kg` is the field's own placeholder text.
 *    · THE TARIFA LADDER. `Tarifa 1` is the 15,80 €/kg above. Tarifas 2 and 3 are that figure
 *      through MERLUZA'S OWN VERIFIED MARGIN LADDER — producto-precio.png prints its three bands
 *      as 14,82 · 15,50 · 16,07 €/kg and states they are «Set by margin %» off a chain, so the
 *      ratios 15,50/14,82 and 16,07/14,82 are the house's own rule and not a curve fitted here:
 *      15,80 × 1,04588 = 16,52 and 15,80 × 1,08434 = 17,13. Arithmetic over verified figures.
 *    · the foot totals its own two lines: 552,00 + 189,60 = 741,60.
 */

const F = '/assets/app-motion/faces/'

/** what is typed into the one free-form field — the app's own line grammar, said as a person says
 *  it rather than as a form asks for it. Twenty-four characters is the whole input. */
const LINE = '12 kg merluza sin cabeza'
/** the placeholder, verbatim: the field teaches free form by standing an example in it */
const PLACEHOLDER = 'merluza sin cabeza caja 6 kg'

/** ── UI CHROME, PER LANGUAGE ─────────────────────────────────────────────────────────────────
 *  Only the labels AROUND the seeded data localize. The data itself — `Hostal Montserrat`,
 *  `2208-7000`, `Tarifa 1..3`, `Merluza sin cabeza`, `class A · lote`, every figure — is off the
 *  captures above and stands verbatim in both languages. `when` carries the capture's own figures
 *  `22.08` and `09:45` unchanged; only the words around them switch. */
const L = {
  es: {
    classA: 'clase A',
    when: 'para el viernes 22.08 · a las 09:45',
    colProduct: 'Producto',
    colQty: 'Cantidad',
    colPrice: 'Precio',
    usual: 'Lo de siempre de este cliente',
    editTariffs: 'Editar tarifas',
    addItem: 'Añadir línea',
    total: 'Total',
    line: 'línea',
    lines: 'líneas',
  },
  en: {
    classA: 'class A',
    when: 'for Friday 22.08 · at 09:45',
    colProduct: 'Product',
    colQty: 'Quantity',
    colPrice: 'Price',
    usual: 'What they usually put on',
    editTariffs: 'Edit tariffs',
    addItem: 'Add item',
    total: 'Total',
    line: 'line',
    lines: 'lines',
  },
} as const

/** THEIR tarifas — what the price tap opens. `on` is the one this customer is on (the head's own
 *  `Tarifa 1`), so the auto-filled price and the marked row are the same fact twice. */
const TARIFAS = [
  { t: 'Tarifa 1', int: '15', dec: ',80', on: true },
  { t: 'Tarifa 2', int: '16', dec: ',52', on: false },
  { t: 'Tarifa 3', int: '17', dec: ',13', on: false },
]

/* ── the beat script, in milliseconds ────────────────────────────────────────────────────────
   0     the albarán in this customer's name with one line already on it, and THE FIELD ALREADY
         OPEN AND ALREADY BEING TYPED — 24 characters 52 ms apart, ending 1248. The Enter key goes
         LIVE on the first character, which is the field saying it can already take this. No `Add
         item` press, no empty hold: «the field is being typed as soon as the shot enters».
   1450  the pointer lands on the Enter key (#1A1413 → #312B2B), 300
   1750  press, 150
   1900  ENTER, AND THE LINE IS ON THE DOCUMENT. The structure populates in reading order 80 ms
         apart — the name and its sort, the quantity and its unit, then THE PRICE, filled from this
         customer's tarifa without anybody typing it, then `class A · lote` under the name — into
         the columns the document already names at the top of its body. The row drops the chip
         ground for the document's own register, `Add item` comes back under it, and THE FOOT
         TOTALS TWO LINES in the same beat. Nothing is pending and nothing waits to be approved.
   2900  the price is tapped (150)
   3050  THEIR TARIFAS drop under it — three bands and `Edit tariffs`. Hold 2400: long enough to
         read that the price is a choice and that the choice has a door out of it.
   5450  the dropdown closes (180)
   5700  hold on the settled albarán — two lines, both editable, and its total
   7600  dissolve 400 and play again                                                             */
const T_TYPE = 0, PER = 52
const T_ENTER_OVER = 1450, T_ENTER_PRESS = 1750, T_COLS = 1900
const T_TAP = 2900, T_DROP = 3050, T_CLOSE = 5450
const T_FADE = 7600, LOOP = 8000
const REST = 6400     // settled: two lines on the albarán and its total

export function ComposerBirth({ lang = 'es', static: staticFrame = false }: { lang?: 'es' | 'en'; static?: boolean }) {
  const T = L[lang]
  const [s, root] = useBeat(LOOP, REST, staticFrame, (t, loop) => {
    const line = typed(LINE, t, T_TYPE, PER)
    /* the columns populate one at a time — 0 none, 5 all of them */
    const cols = t < T_COLS ? 0 : Math.min(5, Math.floor((t - T_COLS) / 80) + 1)
    return {
      loop,
      line,
      ready: line.length > 0,                   // the Enter key can take it
      over: t >= T_ENTER_OVER && t < T_COLS,
      press: t >= T_ENTER_PRESS && t < T_COLS,
      cols,
      /* ROUND 4 · THE ONE STATE THAT USED TO NEED A BUTTON. The line is on the document from the
         moment Enter builds it: the same boolean dresses the row in the document's register and
         moves the foot to two lines, so no frame can ever show a written line the total has not
         counted. There is nothing between them to press. */
      onDoc: cols > 0,
      tap: t >= T_TAP && t < T_DROP,
      drop: t >= T_DROP && t < T_CLOSE,
      fade: t >= T_FADE,
    }
  })
  useTakeOver(root)

  return (
    <div ref={root}>
      <Fit nw={500} nh={430} className="am-composer">
        <div className={'cb' + (s.fade ? ' fade' : '')} key={s.loop}>
          <div className="cb-card">
           <div>

            {/* ── THE HEAD. Whose albarán, which one, and on what tarifa. ─────────────────── */}
            <div className="cb-head">
              <div className="cb-h-l">
                <span className="cb-title">Hostal Montserrat</span>
                <span className="cb-ident">
                  <b className="cb-ref">2208-7000</b>
                  <span>{T.when}</span>
                  <span className="cb-tarifa">Tarifa 1</span>
                </span>
              </div>
              <img className="cb-map" src={F + 'map-thumb.png'} alt="" width={54} height={56} loading="lazy" decoding="async" />
            </div>

            {/* ── THE DOCUMENT. The line that is already on it, then the one being written. ──
                   THE COLUMN HEADS STAND AT THE TOP OF THE BODY AND NAME THE DOCUMENT'S OWN
                   COLUMNS. Round 4 moved them here from inside the row being written: with the
                   Confirm gone, that row never flattens, so the heads it carried would have sat
                   permanently BETWEEN the two lines — column heads halfway down a document. Named
                   once, above both lines, they are true of everything under them. */}
            <div className="cb-body">
              <div className="cb-ch cb-ch-doc in">
                <span>{T.colProduct}</span><span>{T.colQty}</span><span className="cb-r">{T.colPrice}</span>
              </div>
              <Row face={F + 'gamba-roja.webp'} name="Gamba roja de Palamós" sort=""
                   under={[T.classA, 'lote']} qty="6" unit="kg" int="552" dec=",00" />

              {/* ⚠️ ONE RESERVED SLOT, ROUND 3. Every beat below draws INSIDE this box and the box
                  never changes size — which is the whole answer to «the height keeps changing».
                  The two things that can stand here (the field, and the line it becomes with
                  `Add item` under it) are alternatives, not additions, so one height holds both. */}
              <div className="cb-slot">
                <div>
                  {/* THE ROW. One anatomy in two states and NO GATE BETWEEN THEM: a field while it
                      is being typed, a line on the document from the instant Enter is pressed.
                      `.built` is the same boolean that moves the foot. */}
                  <div className={'cb-new' + (s.onDoc ? ' built' : '')}>

                    {/* THE ONE FIELD. Nothing is beside it and nothing is under it — the whole row
                        is a place to type, until Enter says otherwise. */}
                    {!s.cols && (
                      <div className="cb-field">
                        <span className="cb-f-in">
                          {s.line
                            ? <span className="cb-f-typed">{s.line}<i className="cb-caret" /></span>
                            : <span className="cb-f-ph">{PLACEHOLDER}<i className="cb-caret" /></span>}
                        </span>
                        {/* IN THE FIELD, ON THE RIGHT: one mark, and the key that takes it.
                            ⚠️ ROUND 3 CUT THE HEART: «why the heart AND the rocoto logo. just the
                            rocoto thing». ⚠️ AND ROUND 6 CUT THE LOGO: «the rocoto logo icon should
                            actually be in this case a products icon as it's their common products.
                            or actually be a rewind kinda icon like the one i showed» (Peter).

                            A BRAND MARK IS NOT AN AFFORDANCE. The face said «Rocoto is here», which
                            the whole product already says, and left the button with no verb — a
                            reader had to decode a logo to find out what pressing it does. What this
                            control actually offers is THIS CUSTOMER'S OWN LINES, the ones they put
                            on last time, so the mark is the app's own `reset` glyph (`RotateCcw` in
                            situations/baseweb/src/app/glyphs.tsx — «the arrow that turns back on
                            itself»), which is the rewind Peter showed. Same shape, same stroke, same
                            file the app draws it from; the family rule is his too — a mark of this
                            kind is topical where the context demands and usually this one. */}
                        <span className="cb-f-acts">
                          <span className="cb-f-b" aria-label={T.usual}>
                            <Rewind />
                          </span>
                          <span className={'cb-f-key' + (s.ready ? ' live' : '') + (s.over ? ' over' : '') + (s.press ? ' press' : '')}>
                            <Enter />
                          </span>
                        </span>
                      </div>
                    )}

                    {/* THE STRUCTURE. Three columns, named, in the order the line is read — and
                        every value wearing the app's editable underline, from the first frame it
                        exists. There is nothing to unlock and nothing to approve. */}
                    {s.cols > 0 && (
                      <div className="cb-cols">
                        <div className="cb-cr">
                          {/* col 1 — the name and its sort, class and lot small underneath */}
                          <div className={'cb-c1' + (s.cols >= 1 ? ' in' : '')}>
                            <img className="cb-c-face" src={F + 'merluza.webp'} alt="" width={30} height={30} loading="lazy" decoding="async" />
                            <span className="cb-c-txt">
                              <span className="cb-c-nm"><b className="cb-ed">Merluza</b> <em className="cb-ed">sin cabeza</em></span>
                              <span className={'cb-c-sub' + (s.cols >= 4 ? ' in' : '')}>
                                <b className="cb-ed">{T.classA}</b> · <b className="cb-ed">lote</b>
                              </span>
                            </span>
                          </div>
                          {/* col 2 — the quantity, with the unit as its own editable sub-column */}
                          <div className={'cb-c2' + (s.cols >= 2 ? ' in' : '')}>
                            <b className="cb-ed cb-qty">12</b><em className="cb-ed cb-unit">kg</em>
                          </div>
                          {/* col 3 — the price, filled from this customer's tarifa, and a door */}
                          <div className={'cb-c3' + (s.cols >= 3 ? ' in' : '')}>
                            {/* the €'s own element, because `.cb-price` is an inline-FLEX and a
                                flex container drops the whitespace text node either side of a
                                child — «189,60€» against the settled row's «552,00 €» */}
                            <span className={'cb-price' + (s.tap ? ' tap' : '') + (s.drop ? ' open' : '')}>
                              <span className="cb-p-v cb-ed">
                                <b>189</b><i>,60</i><em className="cb-cur">€</em>
                              </span><Chev />
                            </span>
                            {s.drop && (
                              <div className="cb-drop">
                                {TARIFAS.map((b) => (
                                  <span className={'cb-dr' + (b.on ? ' on' : '')} key={b.t}>
                                    {b.t}<u><b>{b.int}</b><i>{b.dec}</i> €/kg</u>
                                  </span>
                                ))}
                                <span className="cb-dr cb-edit">{T.editTariffs}<Chev /></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AND `Add item` STANDS UNDER IT AGAIN, because that is what the composer
                      actually offers once a line is written, and because it is what keeps the
                      settled frame from being a line over a band of white. */}
                  {s.onDoc && <div className="cb-add"><Plus />{T.addItem}</div>}
                </div>
              </div>
            </div>

            {/* ── THE FOOT. It counts the lines that are on the document — and the second one is on
                   it from the beat Enter builds it, so the total moves with the line and never
                   after a press. ──────────────────────────────────────────────────────────────── */}
            <div className="cb-dock">
              <span className="cb-d-k">{T.total} · {s.onDoc ? 2 : 1} {s.onDoc ? T.lines : T.line}</span>
              <span className="cb-d-v">
                {s.onDoc ? <><b>741</b><i>,60</i> €</> : <><b>552</b><i>,00</i> €</>}
              </span>
            </div>
           </div>
          </div>
        </div>
      </Fit>
    </div>
  )
}

/** A LINE ON THE ALBARÁN — the same three columns. The row being written and the rows already
 *  written are ONE anatomy and share ONE grid (`--cb-grid`): what Enter removes is the chip ground
 *  and the field's frame, never the shape. That is why the line arrives as the row settling into
 *  the document rather than as a second component taking over — and it is why no button is needed
 *  in between.
 *
 *  ⚠️ ROUND 5 · AND EVERY VALUE ON IT WEARS `.cb-ed`, THE UNIT INCLUDED. «kg should unit should be
 *  editable in all» (Peter). This row carried NO editable mark at all: the row being written wore
 *  the underline on its five values and the row already on the document wore none, so the card said
 *  a line goes dead the moment it is written — the exact opposite of «EVERYTHING SHOULD ALWAYS BE
 *  EDITABLE FROM THE GET-GO» (round 4). The name, its sort, the quantity, the unit, the class-and-
 *  lot line and the money are each their own field and each says so. */
function Row({
  face, name, sort, under, qty, unit, int, dec, fresh,
}: { face: string; name: string; sort: string; under: string[]; qty: string; unit: string
     int: string; dec: string; fresh?: boolean }) {
  return (
    <div className={'cb-line' + (fresh ? ' fresh' : '')}>
      <img className="cb-l-face" src={face} alt="" width={30} height={30} loading="lazy" decoding="async" />
      <span className="cb-l-txt">
        <span className="cb-l-nm"><b className="cb-ed">{name}</b>{sort && <em className="cb-ed"> {sort}</em>}</span>
        {/* the chips are SEPARATE values with a plain separator between them, exactly as the row
            being written sets them — one underline per field, never one under the whole line */}
        <span className="cb-l-sub">
          {under.map((c, i) => (
            <span key={c}>{i > 0 && ' · '}<b className="cb-ed">{c}</b></span>
          ))}
        </span>
      </span>
      <span className="cb-l-qty"><b className="cb-ed">{qty}</b><em className="cb-ed">{unit}</em></span>
      <span className="cb-l-amt"><b className="cb-ed"><b>{int}</b><i>{dec}</i> €</b></span>
    </div>
  )
}

/* ⚠️ `useOwnHeight` WAS DELETED IN ROUND 3. It measured the card's content on every beat and handed
   back an explicit height, which is exactly the mechanism behind «the height keeps changing»: five
   beats, five heights, and a 300 ms transition between each pair. The reserved `.cb-slot` replaced
   it — a constant box that the tallest beat fits in — so there is nothing left to measure. */

/* ── the line marks. Lucide at the app's own stroke, never a filled glyph. ───────────────────── */
const Plus = () => <svg viewBox="0 0 16 16" className="cb-ic"><path d="M8 2.6v10.8M2.6 8h10.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
/** THE REWIND — lucide `rotate-ccw`, which the app's own `MAP` binds to `reset`: «the arrow that
 *  turns back on itself». In the composer's field it is the door to what this customer has put on
 *  before, and it replaced the Rocoto face in round 6 («a rewind kinda icon like the one i showed»).
 *  ⚠️ AND THE CAMERA IS NOT IN THIS FILE, deliberately: «the camera icon i said is for the stock
 *  shit not the albaran field» — S1's stock door is the only place in the library it may appear. */
const Rewind = () => (
  <svg viewBox="0 0 24 24" className="cb-ic" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
  </svg>
)
/** lucide `corner-down-left` — the return key, and the only thing in the field that commits */
const Enter = () => (
  <svg viewBox="0 0 24 24" className="cb-ic" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
)
const Chev = () => <svg viewBox="0 0 24 24" className="cb-ic cb-chev" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
