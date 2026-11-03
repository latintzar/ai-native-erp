import { Fit, useBeat, useTakeOver, typed } from './motionkit'

/** ── comerciales-river · THE ALBARÁN, AND THE ANXIETY LIVES ON THE LINE ────────────────────────
 *
 *  ══ ROUND 7 · THE BIG TURNAROUND ══════════════════════════════════════════════════════════════
 *
 *  «lots of content i feel like the albaran wouldnt have the other orders below it lol. and the
 *   explanation about the anxiety would be shorter and the explanation of the resolution would be
 *   typed in free text. they can ignore the question too. the delivery note would always be as
 *   usual, but the anxiety would be inline around the products which are put down as usual, or
 *   around the comms inline.
 *
 *   Name / time / location / truck // Products // Order (comm trail) // anxieties are inline of the
 *   above // then theres the thing to print but now i realise that may as well just be at the top
 *   of the albaran, and be sticky along with the name and the delivery time and truck. its the
 *   products and comms that scrolls. bosh!!! big turnaroind i know. figure that shit out!!!!!! and
 *   be efficient.!! do it fucking well and ensure the spec is airtight for the wiring!!!»
 *                                                    (Peter, rounds 5–6; canon: FEED-IA §131 + §134.1)
 *
 *  ══ WHAT ROUND 5 GOT WRONG, IN ONE SENTENCE ═══════════════════════════════════════════════════
 *
 *  IT BUILT THE ANXIETY A HOUSE. The card carried `What they sent`, then `Why this stopped` with two
 *  ratio bars, then `The delivery note`, then a choice row — four titled sections, in a river of
 *  three orders, and the delivery note appeared as ONE OF THEM. So the document a person works in
 *  all morning was reduced to a quotation inside a machine's argument about it, and the argument got
 *  three quarters of the frame. Peter's correction is not a layout note; it inverts the subject:
 *
 *     THE ALBARÁN IS THE PAGE. THE ANXIETY IS AN ANNOTATION ON ONE LINE OF IT.
 *
 *  Everything below follows from that, and each piece answers a sentence of his.
 *
 *    1 · IT IS ONE DOCUMENT, NOT A RIVER. «the albaran wouldnt have the other orders below it lol».
 *        The two extra rows are gone. A shot that shows an albarán with somebody else's albaranes
 *        stacked under it is not showing an albarán.
 *    2 · THE HEAD IS STICKY AND CARRIES THE PRINT ACT. Name · the delivery time BIG («the time of
 *        delivery is way too small») · where it goes and on which truck · the tarifa they run, as a
 *        SELECTABLE control · and Print, which used to be somewhere below and «may as well just be
 *        at the top… and be sticky». What scrolls is the products and the comms, which is exactly
 *        what a delivery note is: a fixed identity over a variable body.
 *    3 · THE LINES ARE COLUMNS. Product · Quantity · Price, named once at the top of the body —
 *        «the column shit.. like basics», re-affirmed with heat in §131.2. Nothing is stacked.
 *    4 · THE ANXIETY IS INLINE, UNDER THE LINE IT IS ABOUT, and it is SLIM: an accent rule down its
 *        left, four words of reasoning (`6× their usual` — the capture's own sentence, cut to the
 *        ratio), the act, and a field. It cannot be mistaken for a section, and it cannot be read
 *        without reading the line it hangs off.
 *    5 · THE DISMISSAL IS FREE TEXT, TYPED. «the explanation of the resolution would be typed in
 *        free text» — so the two chips are gone and the reason is written into the field, one
 *        character at a time, the way a person on a desktop keyboard actually answers («people have
 *        a keyboard persistently on desktop, and they can always type something»).
 *    6 · AND IT IS IGNORABLE. «they can ignore the question too.» The third run touches nothing: the
 *        body simply SCROLLS under the sticky head, past the annotation, down to the comm trail. One
 *        run of the loop is the whole proof that this thing is an annotation and not a gate.
 *    7 · THE COMM TRAIL IS THE ORDER. «Order (comm trail)» — the message that started the document
 *        lives below the products, in one place, with the seat to answer it standing open. There is
 *        no `Rocoto answers` pill, no `How it arrived` block, and no popup: «a popup that pulls you
 *        out of context is wrong» (§131.3).
 *
 *  ══ THREE RUNS, ONE DOCUMENT ══════════════════════════════════════════════════════════════════
 *  `loop % 3` — because the philosophy has three endings and only one of them is a button:
 *      run 0  ACT          `Put 12 kg on` — the line corrects in place and the foot re-totals.
 *      run 1  SAY WHY      the reason is TYPED, and the 72 kg stands.
 *      run 2  LEFT ALONE   nothing is touched; the document scrolls under its own head.
 *  Beat one is identical in all three, so the loop reads as one document with three futures.
 *
 *  ══ EVERY WORD AND EVERY FIGURE, AND WHERE IT IS READ ═════════════════════════════════════════
 *  · `Vermuteria Xifré`, their message verbatim, `Amount unreadable`, «They ordered 6× their usual»
 *    and the WhatsApp channel  — app-frames/comerciales-chat.png.
 *  · `for Friday 22.08` is their own message's day. `Tarifa 1` and the head's shape (name, day, the
 *    tarifa chip, the map square) — app-frames/comerciales-composer.png.
 *  · `Print` — app-frames/print-export.png, the albarán's own print door.
 *  · THE COLUMN HEADS `Product · Quantity · Price` are the composer's own, already shipped in V4.
 *  · THE MONEY. Lubina de estero prices at 10,66 €/kg (albaran-sheet.png: 40 kg → 426,40 €),
 *    Merluza at 15,80 (ambiguedad-informada.png), Gamba roja at 92,00 (albaran-sheet.png: 3,5 kg →
 *    322,00 €). At the 72 kg Rocoto read: 72 × 10,66 + 3,5 × 15,80 + 3,5 × 92,00 = 1144,82 €, which
 *    is comerciales-chat.png's own printed total to the cent. Corrected to the 12 kg they wrote:
 *    127,92 + 55,30 + 322,00 = 505,22 €. Every number that moves in this film is that subtraction.
 *  · `6× their usual` is 72 ÷ 12 = 6, which is the capture's own sentence.
 *  ⚠️ THE ONE COMPOSED PAIRING, NAMED SO A REVIEWER CAN CHECK IT: no capture puts Vermuteria Xifré
 *    on a run or a slot. `eixample · truck 3` is the app's OWN seeded run (`{ truck: 3, zone:
 *    'eixample' }` in situations/baseweb/src/scenarios/data/cast.ts) and `10:45` is one of its own
 *    seeded delivery slots; a customer sits on some run, and these are the house's, not invented
 *    ones. Nothing else on this document is composed.
 */

const WHO = 'Vermuteria Xifré'
/** THE HEAD'S FACTS — his own list, in his own order: name · time · location · truck. The day is
 *  their message's; the slot and the run are the house's own seeded values (see the note above).
 *  The time line carries the day WORD, so it renders from L below with its figures repeated
 *  verbatim in both rows; the run and the tarifa read the same in both languages. */
const RUN = 'eixample · truck 3'
const TARIFA = 'Tarifa 1'

/** THE LINES, in columns. `hot` is the one the annotation hangs off — the only one that moves. */
const LINES = [
  { n: 'Lubina de estero', hot: true, qty: '72', unit: 'kg', fix: '12', int: '767', dec: ',52', fInt: '127', fDec: ',92' },
  { n: 'Merluza', hot: false, qty: '3,5', unit: 'kg', fix: '', int: '55', dec: ',30', fInt: '', fDec: '' },
  { n: 'Gamba roja de Palamós', hot: false, qty: '3,5', unit: 'kg', fix: '', int: '322', dec: ',00', fInt: '', fDec: '' },
]

/** THE ANXIETY, CUT TO THE BONE. Round 5 spent a titled section, two bars and eleven words on this;
 *  «the explanation about the anxiety would be shorter» (Peter). It is the ratio and nothing else —
 *  the figure it is about is standing 20px above it, in the line's own quantity column. Its words
 *  (`flag` · `why` · `act` · `say`) are chrome, so they live in L below.
 *  And the reason a person types instead — Peter's own sentence, typed rather than picked. It is
 *  the film's SCRIPT (23 characters against the beat table), so it stays as scripted, like the
 *  message it answers. */
const REASON = { es: 'Tienen un finde fuerte', en: 'They have a big weekend' }

/** THE COMM TRAIL — the message the document was made out of, with the figure in question marked
 *  inside their own words, and the seat that answers it standing open. */
const SAID: Record<'es' | 'en', Array<[string, boolean]>> = {
  es: [
    ['Para el viernes 22.08: ', false], ['12 kg', true],
    [' Lubina de estero, 3,5 kg Merluza, 3,5 kg Gamba roja de Palamós.', false],
  ],
  en: [
    ['For Friday 22.08: ', false], ['12 kg', true],
    [' Lubina de estero, 3,5 kg Merluza, 3,5 kg Gamba roja de Palamós.', false],
  ],
}
const CHANNEL = 'WhatsApp · 06:14'

/* ── UI CHROME, BY LANGUAGE ─────────────────────────────────────────────────────────────────────
   ONLY the labels the interface itself paints: the head's acts, the column heads, the annotation's
   rubric and prompts, the foot, the trail's kicker and its seat. Every seeded FACT on the document —
   names, products, quantities, prices, the message, the typed reason — is the film's script and
   lives in the consts above, identical in both languages. */
const L = {
  es: {
    when: 'Viernes 22.08 · 10:45',
    print: 'Imprimir',
    flag: 'Cantidad ilegible',
    why: '6× lo habitual',
    act: 'Poner 12 kg',
    say: 'Di por qué',
    putOn: 'Puesto a 12 kg',
    leftAt: 'Dejado en 72 kg',
    colProduct: 'Producto',
    colQty: 'Cantidad',
    colPrice: 'Precio',
    total: 'Total · 3 líneas',
    order: 'Pedido',
    seat: `Escribe a ${WHO}`,
  },
  en: {
    when: 'Friday 22.08 · 10:45',
    print: 'Print',
    flag: 'Amount unreadable',
    why: '6× their usual',
    act: 'Put 12 kg on',
    say: 'Say why',
    putOn: 'Put on at 12 kg',
    leftAt: 'Left at 72 kg',
    colProduct: 'Product',
    colQty: 'Quantity',
    colPrice: 'Price',
    total: 'Total · 3 lines',
    order: 'Order',
    seat: `Write to ${WHO}`,
  },
} as const

/* ── the beat script, in milliseconds ────────────────────────────────────────────────────────
   THE LOOP CAME 10000 → 8000 («be efficient»), and it holds three endings instead of two, because
   beat one is now a document standing still rather than four sections being read.

   0     BEAT 1 — THE ALBARÁN, AS USUAL. The sticky head, the three lines in their columns, the
         annotation open under the Lubina line, the foot, and the comm trail below the fold.
         Hold 1900 — long enough to see that this is a delivery note and that one line has a note
         on it, which is the whole picture.

   ⟳ RUN 0 · THE ACT
   2000  the pointer lands on `Put 12 kg on` (300), 2300 press (160)
   2460  THE LINE CORRECTS IN PLACE: `72` rules through, `12` lands beside it, that line's money
         goes 767,52 → 127,92 and the foot goes 1144,82 → 505,22 in the same frame. The annotation
         drops its accent rule and becomes one settled grey line.
   ⟳ RUN 1 · SAY WHY
   1900  the field wakes and takes the caret
   2100  `They have a big weekend` is TYPED, 23 characters 52 ms apart → 3296
   3700  it is entered. The 72 kg STANDS — a reason is not a correction — and the annotation
         settles into `Left at 72 kg · They have a big weekend`.
   ⟳ RUN 2 · LEFT ALONE
   1500  nothing is pressed and nothing is typed. The BODY SCROLLS under the head over 1500 ms,
         carrying the lines, the untouched annotation and the foot up past the comm trail. The head
         does not move: that is the sticky head proved, and the anxiety ignored, in one movement.

   7600  dissolve 400 and play the NEXT run                                                      */
const T_OVER = 2000, T_PRESS = 2300, T_FIXED = 2460
const T_FOCUS = 1900, T_TYPE = 2100, PER = 52, T_ENTER = 3700
const T_SCROLL = 1500
const T_FADE = 7600, LOOP = 8000
/** THE FRAME THE LOOP ENTERS AT — the document standing, its one line annotated, nothing pressed.
 *  It is also the frame `static` and reduced motion hold, so a still preview is always the albarán
 *  as it arrives rather than a number mid-correction. */
const REST = 1000
/** HOW FAR THE BODY TRAVELS IN RUN 2, and it is MEASURED, not chosen: the track is 443px of content
 *  in a 300px viewport, so 143 is the whole document — and 143 is also exactly the column heads plus
 *  the annotated line plus its annotation. The two facts coinciding is what makes this scroll read:
 *  the run ends on a clean document bottom (Merluza · Gamba roja · the foot · the whole comm trail)
 *  with nothing cut through the middle, and the thing that has been WALKED PAST is the annotation.
 *  ⚠️ IT IS EXACTLY 143 AND NOT A PIXEL LESS. At 140 the fold landed three pixels inside the
 *  annotation and left a crumb of its accent rule and its red first line standing at the top of the
 *  viewport — a stray mark with nothing above it, which is worse than either showing the note or not.
 *  ⚠️ If anything above the trail changes height, re-measure `.rd-scroll` against `.rd-body`. */
const SCROLL_BY = 143

export function RiverResolve({ lang = 'es', static: staticFrame = false }: { lang?: 'es' | 'en'; static?: boolean }) {
  const ui = L[lang]
  const [s, root] = useBeat(LOOP, REST, staticFrame, (t, loop) => {
    const run = loop % 3
    const said = run === 1 ? typed(REASON[lang], t, T_TYPE, PER) : ''
    return {
      loop, run,
      /* RUN 0 — the act */
      over: run === 0 && t >= T_OVER && t < T_PRESS,
      press: run === 0 && t >= T_PRESS && t < T_FIXED,
      fixed: run === 0 && t >= T_FIXED,
      /* RUN 1 — the reason, typed */
      focus: run === 1 && t >= T_FOCUS && t < T_ENTER,
      said,
      given: run === 1 && t >= T_ENTER,
      /* RUN 2 — left alone, and the document scrolls under its own head */
      scroll: run === 2 && t >= T_SCROLL ? SCROLL_BY : 0,
      fade: t >= T_FADE,
    }
  })
  useTakeOver(root)

  /* the money moves ONLY on the act — a reason says the 72 kg was right, and an anxiety nobody
     touched changes nothing at all. Three runs, one boolean. */
  const fixed = s.fixed
  const settled = s.fixed || s.given

  return (
    <div ref={root}>
      {/* ⚠️ RULE 11 · THE STAGE IS THE DOCUMENT'S OWN CONSTANT HEIGHT. 692 → 604, and the number is
          not a trim: the old island reserved room for its TALLEST beat (the open card), so every
          collapsed frame left the plate showing empty ground — flagged by the page builder against
          rule 11, and it was right. This document is 604 in every frame of every run, because the
          head is fixed, the body is a fixed viewport that SCROLLS rather than grows, and the
          annotation's open and settled states share one height. There is no taller beat to reserve
          for — and 443 is 249 shorter than round 5's card, which is «be efficient» taken at its
          word: the body holds 443px of document in a 300px window, so the comm trail is cut at the
          fold and run 2's scroll has somewhere real to go. */}
      <Fit nw={460} nh={443} className="am-river">
        <div className={'rd' + (s.fade ? ' fade' : '')} key={s.loop}>
          <article className="rd-doc">

            {/* ── THE STICKY HEAD. Name · the time, BIG · where it goes and on what truck · the
                   tarifa as a control · and the print act. It does not scroll. ────────────────── */}
            <div className="rd-head">
              <div className="rd-h-top">
                <span className="rd-who">
                  {WHO}
                  {/* the app's own two-word rubric for why this document stopped — it goes the
                      moment the line is resolved, whichever way it was resolved */}
                  <span className={'rd-flag' + (settled ? ' off' : '')}><i className="rd-dot" />{ui.flag}</span>
                </span>
                <span className="rd-print"><Printer />{ui.print}</span>
              </div>
              {/* «The time of delivery is way too small» — it is the biggest thing on the head now,
                  because it is the fact the morning is organised around. */}
              <span className="rd-when">{ui.when}</span>
              <span className="rd-meta">
                <span className="rd-run">{RUN}</span>
                {/* «the tariff that they run should be selectable» — a control, not a label */}
                <span className="rd-tarifa">{TARIFA}<Chev /></span>
              </span>
            </div>

            {/* ── THE SCROLLING BODY — the products, then the order as its comm trail. ───────── */}
            <div className="rd-body">
              <div className="rd-scroll" style={{ transform: `translateY(${-s.scroll}px)` }}>

                {/* THE COLUMNS, NAMED ONCE AT THE TOP OF THE BODY — the composer's own three */}
                <div className="rd-ch">
                  <span>{ui.colProduct}</span><span className="rd-r">{ui.colQty}</span><span className="rd-r">{ui.colPrice}</span>
                </div>

                {LINES.map((l) => (
                  <div key={l.n}>
                    <div className={'rd-line' + (l.hot ? ' hot' : '')}>
                      <span className="rd-n">{l.n}</span>
                      <span className="rd-q">
                        {l.hot && fixed
                          ? <><s>{l.qty}</s><b>{l.fix}</b> {l.unit}</>
                          : <><b>{l.qty}</b> {l.unit}</>}
                      </span>
                      <span className="rd-a">
                        <b>{l.hot && fixed ? l.fInt : l.int}</b><i>{l.hot && fixed ? l.fDec : l.dec}</i> €
                      </span>
                    </div>

                    {/* ── THE ANXIETY, INLINE, UNDER THE LINE IT IS ABOUT ──────────────────────
                           A slim accent rule, four words, the act and a field. It hangs off the
                           line's own name column, so it can only be read as a note ON that line —
                           which is the entire correction round 7 is making. */}
                    {l.hot && (
                      <div className={'rd-anx' + (settled ? ' done' : '')}>
                        {settled ? (
                          <span className="rd-anx-set">
                            <Tick />
                            {s.fixed ? ui.putOn : <>{ui.leftAt} · <em>{REASON[lang]}</em></>}
                          </span>
                        ) : (
                          <>
                            <span className="rd-anx-why">{ui.why}</span>
                            <span className="rd-anx-do">
                              <span className={'rd-act' + (s.over ? ' over' : '') + (s.press ? ' press' : '')}>{ui.act}</span>
                              {/* THE DISMISSAL IS A FIELD, AND IT IS TYPED INTO — never two chips.
                                  On the runs that do not use it, it simply stands open: a place to
                                  type is the least demanding thing a screen can put in front of
                                  somebody, which is what makes the question ignorable. */}
                              <span className={'rd-say' + (s.focus ? ' on' : '')}>
                                {s.said
                                  ? <span className="rd-said">{s.said}<i className="rd-caret" /></span>
                                  : <span className="rd-ph">{ui.say}{s.focus && <i className="rd-caret" />}</span>}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* THE FOOT — it counts the lines on the document and totals them, and it moves in
                    the same frame as the line, never a beat after it. */}
                <div className="rd-total">
                  <span>{ui.total}</span>
                  <span className="rd-t-v">
                    {fixed ? <><b>505</b><i>,22</i> €</> : <><b>1144</b><i>,82</i> €</>}
                  </span>
                </div>

                {/* ── THE ORDER, AS ITS COMM TRAIL. One place, below the products: what they sent,
                       on the channel they sent it on, and the seat to answer standing open —
                       «desktop always has the keyboard». ─────────────────────────────────────── */}
                <div className="rd-trail">
                  <span className="rd-kc">{ui.order}</span>
                  <div className="rd-msg">
                    <p className="rd-said-msg">
                      {SAID[lang].map(([txt, mark], i) => (
                        mark ? <mark key={i}>{txt}</mark> : <span key={i}>{txt}</span>
                      ))}
                    </p>
                    <span className="rd-chan">{CHANNEL}</span>
                  </div>
                  <div className="rd-seat">
                    <span className="rd-seat-ph">{ui.seat}</span>
                    <span className="rd-seat-key"><Enter /></span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </Fit>
    </div>
  )
}

/* ── the line marks. Lucide at the app's own stroke, never a filled glyph. ─────────────────────
   ⚠️ AND NO CAMERA IN THIS FILE. «the camera icon i said is for the stock shit not the albaran
   field» (Peter, round 6) — the camera belongs to S1's stock door and to nothing else. */
const Printer = () => (
  <svg viewBox="0 0 24 24" className="rd-ic" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
)
const Chev = () => (
  <svg viewBox="0 0 24 24" className="rd-ic rd-chev" fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
)
const Tick = () => (
  <svg viewBox="0 0 24 24" className="rd-ic" fill="none" stroke="currentColor" strokeWidth="2.6"
       strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-10" /></svg>
)
/** lucide `corner-down-left` — the seat's own key, the same one the composer commits a line with */
const Enter = () => (
  <svg viewBox="0 0 24 24" className="rd-ic" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
)
