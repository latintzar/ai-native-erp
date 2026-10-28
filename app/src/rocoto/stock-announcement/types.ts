/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { MODE, SOURCE, PHOTO_STATUS, EVIDENCE, FEED, BEAT } from './constants';

export type Mode = keyof typeof MODE;
export type Beat = keyof typeof BEAT;
export type Source = keyof typeof SOURCE;
export type PhotoStatus = keyof typeof PHOTO_STATUS;
export type EvidenceKind = keyof typeof EVIDENCE;
export type Feed = keyof typeof FEED;

/** The document behind an arrival. A photograph of one is evidence, so it travels with the
 *  quantity it proposes and with the moment it was taken. */
export type StockPhoto = {
  /** where the picture lives. A data URI is a source like any other. */
  src: string;
  /** what the document is called, on the chip */
  name: string;
  /** what the picture SHOWS, for a reader who hears it rather than sees it */
  alt: string;
  /** the quantity the document proposes. Present = the entry takes it, attributed to the
   *  document, and a hand may still override it. */
  proposed?: number;
  /** when the picture was taken */
  at?: Date;
};

/* ── BEAT 1 · THE FIELD WHERE THEY CHOOSE THE PRODUCT (FEED-IA §113 · §115.5) ─────────────────
 * «The field where they choose the product or take a photo, then choose it.»
 *
 * THE FIELD IS HANDED IN, NEVER GROWN HERE. The albarán's add-a-line already owns the organ that
 * reads a trade sentence into chips, with its own in-field door for whatever is OFFERED (§113:
 * chips are captured, dropdowns are offered). A second field grown inside this component would be
 * a second parse, a second dropdown and a second set of keys to drift apart from it — so the
 * surface hands the SAME organ in and this panel owns only the BEATS around it. That is what
 * makes «a person who has written one line knows how to log stock» true by construction rather
 * than by resemblance.
 */
export type StockNaming = {
  /** the field itself — the surface's own organ, standing in the panel's first beat */
  field: React.ReactNode;
  /** what the words landed on. Present = the beat is answered and the panel may move on. */
  chosen?: { id: string; label: string; note?: string } | null;
  /** the name is answered and the panel should play on. Absent, the beat's act still advances the
   *  panel's own beat — the surface simply is not told about it. */
  onChosen?: (a: { beat: Beat }) => unknown;
  /** THE FIELD HANDED IN ALREADY CARRIES THE CAMERA (FEED-IA §111.2 · §113 · §119.2). The
   *  albarán's own organ grew the photograph control INSIDE its right edge — «when they type the
   *  name is when they'd have the option of photographing a document» — so a panel that drew its
   *  own button underneath would put two controls on one act, which is the duplication §119.2
   *  killed on the entry field's other mark. Told this, the panel draws none and the field's is
   *  the one road to a picture. */
  photographs?: boolean;
  /** THE QUESTION THIS BEAT ASKS — «What came in?». It is DRAWN, at the heading step, above the
   *  field (§119.1: «one question at a time like typeform»), and it is the field's own name for a
   *  reader who hears it. One string, both jobs, so the two can never say different things. */
  label?: string;
};

/** What the panel says, so a surface too narrow for the mode sentences can shorten them without
 *  the component owning a translation table. The defaults are the founder's own words. */
export type StockAnnouncementLabels = {
  /** the row above the tabs, naming the number both modes reckon against */
  onHand?: string;
  /** the two tabs */
  now?: string;
  add?: string;
  /** the camera, under the entry, on the add tab */
  camera?: string;
  /** the chip while the picture is being read */
  reading?: string;
  /** the attribution under the entry when a document proposed the number */
  fromDocument?: string;
  /** the attribution once a hand has changed it */
  byHand?: string;
  /** the offer to put the document's own number back */
  restore?: string;
  /** the consequence, which is the sentence the flip rewrites */
  becomes?: string;
  /** the consequence when the entry is empty */
  stays?: string;
  /** the verbs on the button */
  submitNow?: string;
  submitAdd?: string;
  /** the first beat's act, and the landing's — «Continue», never «Next» (§108.1) */
  continue?: string;
  /** the landing's own sentence, over the figure it is about (§115.5) */
  landedNow?: string;
  landedAdd?: string;
  /** what the preview and the trash are called, for a reader who hears them */
  preview?: string;
  remove?: string;
  close?: string;
};

/* The callback arguments are NAMED types rather than inline objects, and that is not a style
 * preference: `tools/extract-props.mjs` reads this file to generate the component's spec, and an
 * inline `{ file: File; src: string }` inside a prop's signature is read as more props — the
 * table grew a phantom `src`, `amount` and `result` and mis-marked what was required. A spec that
 * can drift is worse than none, so the shapes are declared once, here. */

/** What the machine is handed to read: the picture, and a source it can paint. */
export type StockProposalArg = { file: File; src: string };

/** What submit hands over: the claim, the number, what it comes to, and the moment. */
export type StockSubmission = {
  mode: Mode;
  /** what was typed */
  amount: number;
  /** what the stock comes to once this is submitted */
  result: number;
  at: Date;
  photo: StockPhoto | null;
  /** THE NUMBER WAS GIVEN AS AN ABOUT (§17.4 · §17.8) — «~60». The claim travels with the figure
   *  so the ledger can hold it, and every reading downstream draws it rather than rounding it
   *  into a precision the house never offered. */
  approx: boolean;
};

export type StockAnnouncementOverrides = {
  /** the panel */
  Root?: Override;
  /** the row above the tabs: what the number stands at now */
  Standing?: Override;
  StandingLabel?: Override;
  /** the two tabs — Base's own Segmented Control sits inside this */
  Modes?: Override;
  /** everything the tabs govern */
  Body?: Override;
  /** BEAT 1 · the field where they choose the product, and the camera under it */
  Naming?: Override;
  /** what the words landed on, said back */
  Chosen?: Override;
  /** BEAT 3 · the landing scene */
  Landed?: Override;
  LandedSaid?: Override;
  LandedNote?: Override;
  /** the number entry — Base's own Input sits inside this */
  Entry?: Override;
  /** the line under the entry that says where its number came from */
  Attribution?: Override;
  /** the mark on that line. The accent lives here and nowhere else in the panel. */
  AttributionMark?: Override;
  /** the camera, below the entry, on the add tab only */
  Camera?: Override;
  /** the attached document */
  Chip?: Override;
  ChipPreview?: Override;
  ChipThumb?: Override;
  ChipLabel?: Override;
  ChipTrash?: Override;
  /** the sentence the flip rewrites */
  Consequence?: Override;
  /** the moment the announcement is about */
  Stamp?: Override;
  /** the button whose meaning the flip changes */
  Submit?: Override;
  /** the document at full size — Rocoto's own Overlay Card sits inside this */
  Preview?: Override;
  PreviewImage?: Override;
  PreviewCaption?: Override;
};

export type StockAnnouncementProps = {
  /** what the stock stands at — the number BOTH modes reckon against, and the reason the same
   *  typed figure means two different things. */
  onHand: number;
  /** where that standing number came from, on its own line */
  onHandNote?: string;
  /** «units», «kg», «cases» — shares the number's line, always */
  unit?: string;
  /** decimal places; a count is 0, a weight is 2 or 3 */
  decimals?: number;
  /** the surface's locale, for the figures and the stamp */
  locale?: string;

  /** which claim is being made. Controlled/uncontrolled pair, Base's own idiom. */
  mode?: Mode;
  initialMode?: Mode;
  onModeChange?: (a: { mode: Mode }) => unknown;

  /** what is typed, as it is typed. The SAME string survives every mode change — that is the
   *  whole instrument, so it is deliberately one state above the tabs. */
  value?: string;
  initialValue?: string;
  onChange?: (a: { value: string; source: Source }) => unknown;
  /** where the current entry came from. Given only when `value` is controlled too. */
  source?: Source;

  /** the attached document, `null` for none */
  photo?: StockPhoto | null;
  initialPhoto?: StockPhoto | null;
  onPhotoChange?: (a: { photo: StockPhoto | null }) => unknown;
  /** whether a document is on its way. Given only when `photo` is controlled too. */
  photoStatus?: PhotoStatus;
  /** the machine's own act: read the picture and say what quantity the document states. The
   *  panel holds the chip in its reading state until this settles. Absent, a photograph is
   *  evidence and proposes nothing. */
  propose?: (a: StockProposalArg) => Promise<number | undefined> | number | undefined;
  /** called with the file the camera or the picker handed over, before it is read */
  onPhotoSelect?: (a: { file: File }) => unknown;

  /** whether the document is open at full size. Controlled/uncontrolled pair. */
  previewOpen?: boolean;
  initialPreviewOpen?: boolean;
  onPreviewOpenChange?: (a: { isOpen: boolean }) => unknown;
  /** where the preview opens. Given an element, it fills THAT element instead of the viewport —
   *  the element needs its own positioning context. */
  previewContainer?: HTMLElement;
  /** whether the open preview holds the keyboard inside itself. Defaults to true for a preview
   *  over the whole viewport, which IS document-modal, and to false for one contained in a pane,
   *  which is not: a card covering one pane has no business seizing the keyboard from the rest of
   *  the page, and a reference page showing an open preview beside eleven other states proves it. */
  previewFocusLock?: boolean;

  /** the moment the announcement is about. Left out, the panel keeps its own clock, because a
   *  declaration is a statement about now and a stale stamp would be a false one. */
  at?: Date;

  /* ── THE FILM (FEED-IA §115.5 · §115.6) ────────────────────────────────────────────────────
   * Given `naming`, the panel plays three beats: the field where they choose the product or take
   * a photo · the number · «you just added X». Given none, it opens on the number, which is
   * exactly the instrument that stood here before, and lands on the same scene. */
  naming?: StockNaming;
  /* ── THE ARRIVAL'S OWN LOTE, ON THE NUMBER'S BEAT (§5.6 · §113.2) ────────────────────────────
   * A lote belongs to an ARRIVAL and to nothing else, so it is drawn under the entry on the ADD
   * claim and nowhere else. It is not a fourth question: Rocoto has already answered it with a
   * suggested code and the hand may overrule — «populate in place → confirm what was captured →
   * it lands», which is the capture beat and not an interrogation.
   * ⚠ IT USED TO REACH ITS SEAT THROUGH THE `Camera` OVERRIDE, and that broke the moment the
   * camera moved to the naming beat (§115.5): the lote went with it and stood on the FIRST
   * question, which is two questions on a screen that may hold one (§119.1). A slot of its own
   * cannot travel. */
  lot?: React.ReactNode;
  /* ── THE UNIT, AS A CONTROL (FEED-IA §127.4b — V4: «kg should unit should be editable in all»)
   * Given, this stands where `unit` would, on the number's own line. The organ takes a NODE and
   * never a register: which units a house may say is the house's business, and §122's own
   * `LiveChoice` is the instrument every other editable fact in the app already uses. Absent, the
   * unit is the plain word it always was. */
  unitControl?: React.ReactNode;
  /** which beat is playing. Controlled/uncontrolled pair, Base's own idiom. */
  beat?: Beat;
  onBeatChange?: (a: { beat: Beat }) => unknown;
  /** the landing has been read and the panel is free to go again. The surface decides what that
   *  means — another arrival, or the door closing behind them. */
  onDone?: (a: StockSubmission | null) => unknown;

  /** submit. The panel hands over what was typed and what it means. */
  onSubmit?: (a: StockSubmission) => unknown;

  /** the panel stands and reads, and moves nothing */
  disabled?: boolean;

  labels?: StockAnnouncementLabels;
  /** what the panel is called, for a reader who hears it */
  'aria-label'?: string;
  overrides?: StockAnnouncementOverrides;
};

/* ONE shared shape, Base's own convention (see `modal/types.ts`): every styled element takes the
 * same object, and the members that only mean something to one of them are optional. */
export type SharedStyleProps = {
  $mode: Mode;
  $source: Source;
  $status: PhotoStatus;
  $disabled: boolean;
  /** the entry is carrying a number a document proposed, untouched by any hand */
  $proposed: boolean;
};

/* ── THE ROW: paper trail vs working reality ───────────────────────────────────────────────── */

/** How a trail number is evidenced, and how to reach the thing that evidences it. */
export type StockEvidence = {
  kind: EvidenceKind;
  /** what to call it on the row's own line */
  label: string;
  /** when it landed */
  at?: Date;
};

export type StockLevelOverrides = {
  Root?: Override;
  /** the icon tile that opens the row, Monzo's own grammar */
  Mark?: Override;
  Body?: Override;
  Name?: Override;
  /** the one line under the name: the attribution, and nothing else */
  Note?: Override;
  /** the trailing figure — Rocoto's own Figure sits inside this */
  Value?: Override;
  /** the way to the document */
  Evidence?: Override;
};

export type StockLevelProps = {
  /** what this row counts */
  name: string;
  /** what the documents say is there. Absent means nothing has been documented yet. */
  trail?: number | null;
  /** what evidences that number */
  evidence?: StockEvidence;
  /** what the person says is there right now. Present, it STANDS, and the trail stays legible
   *  beside it struck through — overridden, never erased. */
  declared?: number | null;
  /** when they said it */
  declaredAt?: Date;
  unit?: string;
  decimals?: number;
  locale?: string;
  /** whether incoming documents reach the trail on their own */
  feed?: Feed;
  /** reach the evidence. Given, the row carries the way to it — in BOTH states, because an
   *  override that hides the document it overrides has destroyed the trail. */
  onOpenEvidence?: () => unknown;
  disabled?: boolean;
  /** what the row's evidence control is called, for a reader who hears it */
  evidenceLabel?: string;
  /** the words for the note line, so a surface can shorten them */
  labels?: { declaredAt?: string; noTrail?: string };
  children?: React.ReactNode;
  overrides?: StockLevelOverrides;
};

export type LevelSharedStyleProps = {
  /** a person is standing in front of the documents on this row */
  $overridden: boolean;
  $feed: Feed;
  $disabled: boolean;
  /** the row has a way to its evidence */
  $interactive: boolean;
};
