import { Fit, useBeat, useTakeOver, typed } from './motionkit'

/** ── compras-precio · «pick the product, then walk its tarifas» ───────────────────────────────
 *
 *  ⚠️ RE-CONCEIVED, ROUND 2. The old island ran `Save & next` from one PRODUCT to the next and
 *  counted `1 of 10`, and Peter took the whole premise apart:
 *
 *    «They click Save and Next, and then nothing happens… If it's 3/10, is that the tariff, or
 *     what? I thought you were talking about tariffs here. Why would they change just one tariff
 *     and not change the other? That's silly! They wouldn't be doing Save and Next for individual
 *     products, because what if they just want to change 10 of the 200 products they have? They
 *     wouldn't be following this linear fashion. They only follow it linearly for the tariffs.»
 *
 *  He is describing the real shape of the job, and the island is now that shape:
 *
 *    1 · THE PICK, AD HOC   a house with two hundred products does not walk them. It reaches for
 *                           the one whose price moved this morning. So the film opens on the
 *                           search, `merluza` typed, and ONE product taken out of the hits.
 *    2 · THE WALK, LINEAR   and THEN the linear run begins — and it runs down THAT PRODUCT'S
 *                           TARIFAS, because a price you change on tarifa 1 and leave on 2 and 3
 *                           is a price you have half-changed. `Tarifa 1 of 3` → `2 of 3` →
 *                           `3 of 3`, `Save & next` twice and `Save` once. The counter now says
 *                           what it counts.
 *    3 · BACK TO THE PICK   which is the loop, and also the truth: the run ends with the product,
 *                           not with the catalogue.
 *
 *  ROUND 3 · «decent. make the shit centred tho somehow.» The flow is kept whole and only the
 *  framing moved: the card was 480 inside a 480 stage, so it WAS the frame and had nothing to sit
 *  centred in. It is 420 in a 480 box now — air on all four sides, the composition standing at its
 *  own width in the middle of its plate.
 *
 *  ⚠️ ROUND 5 · CENTRED MEANS THE CONTENT, NOT THE CARD. «again, make the € bigger. Same centered
 *  comment about this. The numbers and stuff should feel better. The tariff should probably be
 *  centered. The image can be bigger for the fish» (Peter).
 *
 *  Round 3 centred the CARD in its plate and left everything inside it hard left, which is why the
 *  note keeps coming back. This card is a Monzo-style single-question sheet — one product, one
 *  number, one act — and a sheet like that has ONE CENTRE AXIS that the goods, the question, the
 *  control, the figure and the button all stand on. Four things moved:
 *    · THE GOODS ARE THE HERO. The painting went 38 → 68 and stands ALONE above the name, centred,
 *      instead of sitting as a 38px avatar in the left of a row. You are pricing a fish; the fish
 *      should be the first thing you see.
 *    · THE FIGURE IS BIGGER, 44 → 62, and it is centred in its box with its unit beside it on the
 *      SAME LINE — never under it (the global price-unit rule).
 *    · THE TARIFA CHIPS ARE CENTRED, so the run reads as a row of three steps rather than as a
 *      left-aligned list, and the counter sits on the same axis above them.
 *    · AND SO IS EVERYTHING ELSE: the kicker, the search, the hits, the previous-price line and the
 *      act. One axis, top to bottom.
 *
 *  THE FIELD IS STILL THE COMPONENT. Empty, it stands YESTERDAY'S PRICE in the box in the same very
 *  large face — so an untouched tarifa already says what the goods cost, and the number to beat is
 *  under the thumb about to type over it (BEATS.md §1: «do not swap it for a small hint»). That is
 *  the one thing round 1 got right and it is untouched.
 *
 *  ⚠️ WHERE THE FIGURES COME FROM.
 *    · `Merluza` · `entera` · the tarifa chips · `16,40 €/kg` typed · `Previous 14,82 €/kg · Today
 *      · Tarifa 1` · `Save & next` / `Done`   — app-frames/compras-precio.png, verbatim.
 *    · the three PREVIOUS prices 14,82 · 15,50 · 16,07 €/kg are Merluza's own three bands off
 *      app-frames/producto-precio.png, which prints them as the product's tarifa structure.
 *    · TODAY'S TARIFA 2 AND 3 are 16,40 through the house's OWN LADDER. producto-precio.png states
 *      the bands are «Set by margin %» off a chain, so the ratios between them are the rule and not
 *      a curve fitted here: 16,40 × (15,50/14,82) = 17,15 and 16,40 × (16,07/14,82) = 17,78.
 *      Arithmetic over verified figures, which is the one thing rule 6 allows.
 *    · the three hits in the picker are Merluza's own three variations, off
 *      app-frames/compras-stock.png («Merluza · 3 variations · 40 kg on the floor»: `entera` ·
 *      `sin cabeza` · `de pincho`).
 *
 *  ══ ROUND 7 · THE PICK IS AN EVENT, THE COUNTER IS NOISE, AND THE PREVIOUS PRICE IS ONE LINE ═══
 *
 *  «this is good. just once they select, make the merluza image go big and centred and then morph
 *   to the other spot, like most selectors. ok? // dont say tarifa one of three when we see them
 *   visually // and the pervious can just be on its own, not today, not tarifa 3. say Last Price:
 *   16,07 as of 02:00 27 Aug»  (Peter, round 6)
 *
 *  THREE CHANGES, AND EACH ONE REMOVES SOMETHING THE FRAME WAS SAYING TWICE.
 *
 *    · THE MORPH. Taking a hit used to cut straight to the sheet, so the product you chose and the
 *      product you are now pricing were two different pictures that happened to share a name. The
 *      painting is now ONE element across the cut: at the take it stands BIG at the card's centre —
 *      the app confirming what you picked at the size of the choice — and then it flies to its
 *      standing spot above the name while the rest of the sheet arrives under it. One shared
 *      element, one transform, no cross-fade; it is the same fish the whole way.
 *    · THE COUNTER IS GONE. `Tarifa 2 of 3` sat directly over three tarifa chips with the second
 *      one filled — «dont say tarifa one of three when we see them visually». The chips ARE the
 *      counter, and a sentence restating a picture is a sentence to cut. What the run's END needed
 *      to say is already said by `All three set` at the foot.
 *    · THE PREVIOUS PRICE IS ITS OWN SENTENCE, and it is Peter's, verbatim: `Last Price: 16,07 as
 *      of 02:00 27 Aug`. It used to read `Previous 16,07 €/kg · Today · Tarifa 3` — three facts
 *      chained onto a fourth, two of which the card already states (which tarifa is filled in the
 *      chips; «today» is the whole sheet). What a person actually needs beside a price they are
 *      about to change is the number it stands at and WHEN it was set. The stamp `02:00 27 Aug` is
 *      Peter's own and ships as he wrote it; the figure is that tarifa's own previous, so on
 *      tarifa 3 the line renders his sentence to the character.
 */

const F = '/assets/app-motion/faces/'

/** THE RUN — one product, its three tarifas, in order. `prev` is what the tarifa stands at now. */
const WALK = [
  { band: 'Tarifa 1', prev: '14,82', today: '16,40' },
  { band: 'Tarifa 2', prev: '15,50', today: '17,15' },
  { band: 'Tarifa 3', prev: '16,07', today: '17,78' },
]
const UNIT = '€/kg'
/** UI CHROME, per language — only the words the FRAME speaks. Everything seeded (Merluza, the
 *  tarifa chips, the figures) is the data and stays as it is in both languages. EN keeps Peter's
 *  own previous-price line to the character: «Last Price: 16,07 as of 02:00 27 Aug» — the stamp
 *  belongs to the price list and not to a tarifa, so it is the same on all three. */
const L = {
  es: {
    kicker: 'Precio de hoy',
    lastPrice: 'Último precio:',
    asOf: 'a las 02:00 del 27 ago',
    save: 'Guardar',
    saveNext: 'Guardar y siguiente',
    next: 'Siguiente',
    done: 'Hecho',
    allSet: 'Las tres tarifas puestas',
  },
  en: {
    kicker: 'Today’s price',
    lastPrice: 'Last Price:',
    asOf: 'as of 02:00 27 Aug',
    save: 'Save',
    saveNext: 'Save & next',
    next: 'Next',
    done: 'Done',
    allSet: 'All three set',
  },
} as const
const PICKED = { name: 'Merluza', word: 'entera', face: F + 'merluza.webp' }
/** the hits the search narrows to — Merluza's own three variations */
const HITS = ['entera', 'sin cabeza', 'de pincho']
const QUERY = 'merluza'

/* ── the beat script, in milliseconds ────────────────────────────────────────────────────────
   0     BEAT 1 — THE PICK. `merluza` already in the search and its three variations under it;
         `entera` is pre-active, the way the app leaves the first hit. Hold 900.
    900  it is taken (press 160)
   1060  ⟳ THE MORPH, BEAT ONE — the hits go and the PAINTING STANDS BIG AT THE CARD'S CENTRE, on
         its own, at 2,35× its standing size. This is the app saying WHICH ONE back at the size of
         the choice, and it is the same element the sheet will carry. Hold 500.
   1560  ⟳ THE MORPH, BEAT TWO — the painting flies to its spot above the name (440 ms on the app's
         own ease) and the sheet arrives under it as it lands.
   2000  BEAT 2 — the sheet stands on Merluza · entera, the field already focused with 14,82
         standing grey in it
   2640  typing: five characters 110 ms apart; the primary flips Next → Save & next on the FIRST
         character (verified at one character, not at a valid number)
   3190  the price is complete — hold 700
   3890  the pointer lands on the primary (#1A1413 → #312B2B), 350
   4240  press, 160
   4400  ⟳ TARIFA 2 — the chip advances and the field falls back to that tarifa's own previous,
         15,50. The card does not move: only what is on it changes.
         …the same 2400 ms beat again on tarifa 2, and again on tarifa 3, whose primary reads
         `Save` because there is no next.
   9200  `All three set` — the run is finished. Hold 900.
  10100  dissolve 400 and play again                                                             */
const T_PICK = 900, T_SHEET = 1060
const T_MORPH = 1560                    // the painting leaves the centre for its standing spot
const T_WALK = 2000                     // it has landed; the run begins
const STEP = 2400                       // one tarifa: type · hold · press · advance
const T_TYPE = 640, PER = 110           // offsets INSIDE a step, from the step's own start
const T_HOVER = 1890, T_PRESS = 2240
const T_DONE = T_WALK + 3 * STEP        // 9200
const T_FADE = 10100, LOOP = 10500
const REST = T_WALK + STEP + 1200       // settled: tarifa 2, typed, `Save & next` standing

export function PrecioLoop({ lang = 'es', static: staticFrame = false }: { lang?: 'es' | 'en'; static?: boolean }) {
  const [s, root] = useBeat(LOOP, REST, staticFrame, (t) => {
    const inRun = t >= T_WALK && t < T_DONE
    /* `Done` HOLDS ON THE LAST TARIFA rather than falling back to the first: a frame reading
       `Done` over Tarifa 1's previous price says the run ended where it started, which is the
       opposite of what just happened. Caught by watching the strip. */
    /* during the FLIGHT the sheet is already tarifa 1's, so the chip it arrives wearing is the
       right one — a frame of three blank chips would be a card with no state for 440 ms */
    const k = inRun ? Math.min(2, Math.floor((t - T_WALK) / STEP))
            : t >= T_DONE ? 2 : t >= T_MORPH ? 0 : -1
    const u = inRun ? (t - T_WALK) % STEP : 0      // where we are inside this tarifa's own beat
    return {
      picking: t < T_SHEET,
      taking: t >= T_PICK && t < T_SHEET,
      /* THE TWO MORPH FRAMES. `big` puts the painting at the card's centre at 2,35×; dropping it
         is the flight, because the transform it transitions back to is the standing one. `held`
         keeps the rest of the sheet out of the frame until the flight starts, so the beat is the
         goods and nothing else. Under `static` neither is ever true: a still preview must show
         the settled sheet, never a fish mid-air. */
      big: !staticFrame && t >= T_SHEET && t < T_MORPH,
      held: !staticFrame && t >= T_SHEET && t < T_MORPH,
      at: k,
      value: k < 0 || u < T_TYPE ? '' : typed(WALK[Math.max(0, k)].today, u, T_TYPE, PER),
      hover: inRun && u >= T_HOVER && u < T_PRESS,
      press: inRun && u >= T_PRESS,
      done: t >= T_DONE && t < T_FADE,
      fade: t >= T_FADE,
    }
  })
  useTakeOver(root)

  const w = WALK[Math.max(0, s.at)]
  const t = L[lang]
  return (
    <div ref={root}>
      <Fit nw={480} nh={470} className="am-precio">
        <div className={'pl-run' + (s.fade ? ' fade' : '')}>
          <div className="pl-card">

            {/* ── BEAT 1 · THE PICK. Two hundred products are reached into, never walked. ──── */}
            {s.picking ? (
              <div className="pl-pick">
                <span className="pl-kc">{t.kicker}</span>
                <div className="pl-search">
                  <Search /><span className="pl-q">{QUERY}<i className="pl-caret" /></span>
                </div>
                <div className="pl-hits">
                  {HITS.map((h, i) => (
                    <span className={'pl-hit' + (i === 0 ? ' on' : '') + (i === 0 && s.taking ? ' press' : '')} key={h}>
                      <img src={PICKED.face} alt="" width={26} height={26} loading="lazy" decoding="async" />
                      <b>Merluza</b><u>{h}</u>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              /* ── BEAT 2 · THE WALK. One product, three tarifas, straight down. ────────────
                     ROUND 7 · AND IT OPENS ON THE MORPH. `.held` keeps everything but the painting
                     out of the frame while the painting stands big at the centre; dropping `.big`
                     flies it home and the sheet arrives with it. */
              <div className={'pl-sheet' + (s.held ? ' held' : '')}>
                {/* THE GOODS, ALONE AND LARGE, ON THE AXIS EVERYTHING ELSE STANDS ON — and the
                    SAME ELEMENT the pick handed over, never a second copy of the fish. */}
                <div className="pl-head">
                  <span className={'pl-face' + (s.big ? ' big' : '')}>
                    <img src={PICKED.face} alt="" width={68} height={68} loading="lazy" decoding="async" />
                  </span>
                  <span className="pl-name">{PICKED.name}</span>
                  <span className="pl-word">{PICKED.word}</span>
                  {/* ⚠️ ROUND 7 KILLED THE COUNTER. «dont say tarifa one of three when we see them
                      visually» — the three chips below ARE the counter, and the filled one is the
                      place in the run. A line restating a picture is a line to cut. */}
                </div>

                {/* the tarifa chips ARE the run: the active one steps along with the counter */}
                <div className="pl-bands">
                  {WALK.map((b, i) => (
                    <span className={'pl-band' + (i === s.at && !s.done ? ' on' : '') + (i < s.at || s.done ? ' set' : '')} key={b.band}>
                      {b.band}{(i < s.at || s.done) && <Tick />}
                    </span>
                  ))}
                </div>

                {/* the figure and its unit share ONE line box, so they baseline-align by inline
                    layout rather than being centred as two boxes — and the unit stays ON the
                    number's own line, which is the standing global rule for a rate */}
                <div className="pl-field">
                  <span className="pl-amt">
                    <span className={'pl-value' + (s.value ? '' : ' ph')}>
                      {s.done ? w.today : s.value || w.prev}
                      {!staticFrame && !s.done && <i className="pl-caret" />}
                    </span>
                    <span className="pl-unit">{UNIT}</span>
                  </span>
                </div>

                {/* ⚠️ PETER'S OWN LINE, VERBATIM: «Last Price: 16,07 as of 02:00 27 Aug». The
                    figure is this tarifa's own standing price and the stamp is when the list was
                    set, so on tarifa 3 this renders his sentence to the character. Nothing else
                    stands on it — «the pervious can just be on its own, not today, not tarifa 3». */}
                <div className="pl-ctx">{t.lastPrice} {w.prev} {t.asOf}</div>

                <div className="pl-foot">
                  <span className={'pl-go' + (s.hover ? ' over' : '') + (s.press ? ' press' : '') + (s.done ? ' off' : '')}>
                    {/* the label cross-fades at the first keystroke and the button keeps its width;
                        on the LAST tarifa there is no next, so it reads `Save` */}
                    {/* `Done` counts as typed, or the finished run would sit under a greyed
                        `Next` — a label that says the opposite of what just happened */}
                    <b className={s.value || s.done ? 'in' : 'out'}>{s.at === 2 ? t.save : t.saveNext}</b>
                    <b className={s.value || s.done ? 'out' : 'in'}>{t.next}</b>
                  </span>
                  <span className="pl-done">{s.done ? t.allSet : t.done}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Fit>
    </div>
  )
}

const Search = () => (
  <svg viewBox="0 0 24 24" className="pl-ic" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
)
const Tick = () => (
  <svg viewBox="0 0 24 24" className="pl-tick" fill="none" stroke="currentColor" strokeWidth="2.6"
       strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-10" /></svg>
)
