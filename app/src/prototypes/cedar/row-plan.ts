/* THE ROW PLAN'S OWN ARITHMETIC — one calibration, wherever a document plans its columns
 * (FEED-IA §194.2 · §195)
 *
 *     «we have like 6 digits in some stuff, and units that use like 6 letters like manojo … and
 *      skus that are like 40 characters. it STILL has to look and fit good and well planned like
 *      when its short so think strategically where to put everything.»          — Peter, §194.2
 *
 * ═══ WHY THESE THREE NUMBERS LIVE HERE ═══════════════════════════════════════════════════════
 * A column plan is measured, not chosen: the widest value ON THE SHEET decides the track, so a
 * «4 kg» line and a «12.500,5 unidades» line put their figures in the same column and the document
 * reads down like an invoice. That measurement needs the width of one tabular digit at the
 * figure's own step and the width of one letter of the unit at the step's sub — and those are
 * FACTS ABOUT THE TYPE, not facts about the albarán.
 *
 * They stood inside `detail.tsx`, calibrated against the rendered «12.500,5 unidades» at 390.
 * The read-back review (E196.30) plans the same kind of column over the same faces, and a second
 * copy of a calibration is a drift waiting for the first type change. So the numbers move here and
 * both surfaces read them. Nothing else about either plan moves: the albarán's `columnPlanOf`
 * keeps its own arithmetic, the review keeps its own, and they agree about the type.
 *
 * ⚠ THESE ARE MEASURED, NOT DERIVED. They were read off a rendered sheet, and a type change must
 * re-measure them rather than reason about them.
 */

/** one tabular digit at the figure's step (LabelLarge 18 / LabelMedium 16) */
export const LINE_FIGURE_PX = { default: 10.8, compact: 9.6 } as const;
/** one letter of the unit at the step's sub (LabelSmall 14 / LabelXSmall 12) */
export const LINE_UNIT_PX = { default: 7.4, compact: 6.6 } as const;
/** CALIBRATION MARGIN: the rendered «12.500,5 unidades · 123.379,93 €» measured 300px against an
 *  estimate of 287 at 390 — separators, fraction digits and button padding round up. A plan
 *  decides against reality with this margin, so one line on a sheet never wraps alone. */
export const LINE_PLAN_MARGIN = 16;

export type FigureStep = keyof typeof LINE_FIGURE_PX;

/** WHAT A FIGURE'S LOCKUP TAKES: the digits at the figure's step, the unit at its sub, and the
 *  air between and around them. One expression, so two surfaces cannot round it two ways. */
export const figureTrackPx = (digits: number, unitLetters: number, step: FigureStep): number =>
  digits * LINE_FIGURE_PX[step] + 8 + (unitLetters ? 4 + unitLetters * LINE_UNIT_PX[step] + 8 : 0);
