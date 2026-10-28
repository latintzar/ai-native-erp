/* THE STOCK ANNOUNCEMENT — one typed number, two meanings.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright
 * (c) Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs;
 * the tabs are Base's own Segmented Control and the entry is Base's own Input, both unmodified.
 * The component is Rocoto's, because Base has no instrument for a declaration whose meaning is
 * chosen after the number is written.
 *
 * WHY IT EXISTS (THE-ALBARAN-THESIS §5). For the albarán, stock is not needed. For MAKING THE
 * SALE it is — «telling customers "let me check if we actually have some", and it puts that order
 * for review because it knows it's out of stock». Stock reaches us two ways: a feed of incoming
 * documents, or a person telling us what is there. The second is an OVERRIDE of the first.
 *
 * WHAT IT CARRIES:
 *   · THE FLIP. Two modes as tabs, and THE TYPED NUMBER SURVIVES THE FLIP — only the meaning of
 *     submit changes. The number therefore lives one level ABOVE the tabs in this component's
 *     state, which is the whole trick expressed as a data structure. Type 40 against 72 on hand:
 *     one tab says stock becomes 40, the other says stock becomes 112, and 40 never moves.
 *   · THE ASYMMETRY, WHERE THERE IS NO FILM. The camera sits under the entry on the ADD tab and
 *     nowhere else: a photo is evidence of an arrival, and an arrival is an addition, so the tab
 *     that cannot describe an arrival has nothing to photograph. ⚠ WHERE THE PANEL NAMES ITS GOODS
 *     (§113 · §115.5) the camera moves to the NAME BEAT instead — «the field where they choose the
 *     product OR take a photo» — which is the moment a hand actually reaches for the paper.
 *   · THE DOCUMENT PROPOSES. A photographed document is read and its quantity ARRIVES in the
 *     entry, attributed to the document in the accent — the one act on this panel the machine
 *     performed by itself. A hand may then change it, and the attribution moves to the hand while
 *     the document's own number stays offered.
 *   · THE MOMENT. Announcing is inherently time-stamped: it is a statement about NOW, so the
 *     panel keeps a live clock rather than a value somebody set once.
 *
 * ═══ AND IT IS A FILM NOW (FEED-IA §115.5 · §115.6, off S1: «this is extremely confusing») ═══
 * «I want to see the field where they choose the product or take a photo, then choose it, and then
 * it shows how much stock they just added and the number they are choosing. Think about these
 * pragmatically, even the way I am describing them. I'm describing it like a film, almost. You
 * should be thinking that way.» And, in the same breath, what the panel must never be: «Multiple
 * numbers is a ridiculous thing. Like, what? They all look the same, with the same boxes and the
 * same size.»
 *
 * THE BEATS, NAMED BEFORE ANYTHING IS LAID OUT (§115.6):
 *
 *   BEAT 1 · THE FIELD   One question and nothing else: WHAT are you telling us about? The field
 *                        is handed in by the surface — the albarán's own organ, so a person who
 *                        has written one line already knows this one (§113's second general) —
 *                        and THE CAMERA STANDS BESIDE IT, because «choose the product OR take a
 *                        photo» is one question with two answers. Whatever is OFFERED lives in
 *                        the field's own dropdown and never as a row of chips (§113's first).
 *
 *   BEAT 2 · THE NUMBER  The goods are chosen and said back, quietly, at the head. ONE number
 *                        leads — the one being typed, at HeadingLarge — and everything else on
 *                        the beat is context underneath it at a smaller step (§76: «the primary
 *                        value gets visual priority; secondary context sits underneath»). The
 *                        two claims stay Base's own segmented control, because the tab IS the
 *                        claim being made and there are exactly two of them.
 *
 *   BEAT 3 · THE LANDING «You just added 80 kg.» One scene, centred, THE NUMBER at the size of
 *                        the thing that just happened, the goods and where stock now stands
 *                        underneath it in one quiet line. It is the scene's last beat and it
 *                        NAMES THE QUANTITY. No progress bar, and nothing asks whether they are
 *                        sure — the review was the populated beat before it (§115.3 · §76).
 *
 * A PANEL GIVEN NO GOODS TO NAME OPENS ON BEAT 2, which is exactly the instrument that stood here
 * before, and it lands on the same scene. The film is opt-in at the seam and total inside it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { SegmentedControl, Segment, FILL } from 'baseui/segmented-control';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Button, KIND as BUTTON_KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Spinner } from 'baseui/spinner';
import { Figure } from '../figure';
import { OverlayCard, PLACEMENT, SIZE as OVERLAY_SIZE } from '../overlay-card';
import { CameraGlyph, DocumentGlyph, TrashGlyph } from './glyphs';
import {
  Root as StyledRoot,
  Standing as StyledStanding,
  StandingLabel as StyledStandingLabel,
  Modes as StyledModes,
  Body as StyledBody,
  Entry as StyledEntry,
  Attribution as StyledAttribution,
  AttributionMark as StyledAttributionMark,
  Camera as StyledCamera,
  Naming as StyledNaming,
  Chosen as StyledChosen,
  Landed as StyledLanded,
  LandedSaid as StyledLandedSaid,
  LandedNote as StyledLandedNote,
  Chip as StyledChip,
  ChipPreview as StyledChipPreview,
  ChipThumb as StyledChipThumb,
  ChipLabel as StyledChipLabel,
  ChipTrash as StyledChipTrash,
  Consequence as StyledConsequence,
  Stamp as StyledStamp,
  Submit as StyledSubmit,
  Preview as StyledPreview,
  PreviewImage as StyledPreviewImage,
  PreviewCaption as StyledPreviewCaption,
} from './styled-components';
import { MODE, SOURCE, PHOTO_STATUS, BEAT, MODE_LABEL, SUBMIT_LABEL, LANDED_LABEL } from './constants';
import { useControlled, sanitise, isApprox, toNumber, hasNumber, toEntry, readAsDataURL, formatStamp, formatTime } from './utils';
import type { StockAnnouncementProps, SharedStyleProps, StockPhoto, StockSubmission, Mode, Source, PhotoStatus, Beat } from './types';

let panelSeq = 0;

/* The mode sentence is longer than a segment usually carries, and it is meant to be: it is the
 * claim the person is making. So it wraps and reads left, rather than being truncated into a word
 * that would leave the two tabs looking like a filter.
 *
 * The disabled colour is the second half of the same override, and it is there because Base
 * deliberately leaves the ACTIVE segment enabled when the control is disabled — `disabled={!isActive
 * && disabled}` in its own source — so the current claim stays focusable and announced. Correct for
 * the keyboard, and it left the tab reading at full strength inside a panel that moves nothing. The
 * override dims it; Base's structure is untouched. */
const segmentOverridesFor = (disabledColor?: string) => ({
  Segment: { style: { whiteSpace: 'normal' as const } },
  Label: {
    style: { whiteSpace: 'normal' as const, textAlign: 'left' as const, ...(disabledColor ? { color: disabledColor } : {}) },
  },
});

/** The block Base slides behind the active segment is drawn in the interaction colour, so in a
 *  disabled panel it stayed a full-strength ring around a claim nobody can change. Dimmed through
 *  the control's own `Active` override. */
const controlOverridesFor = (disabledColor?: string) =>
  disabledColor ? { Active: { style: { borderColor: disabledColor } } } : undefined;

const StockAnnouncement = (props: StockAnnouncementProps) => {
  const {
    onHand,
    onHandNote,
    unit,
    decimals = 0,
    locale = 'en-GB',
    mode: modeProp,
    initialMode = MODE.now,
    onModeChange,
    value: valueProp,
    initialValue = '',
    onChange,
    source: sourceProp,
    photo: photoProp,
    initialPhoto = null,
    onPhotoChange,
    photoStatus: photoStatusProp,
    propose,
    onPhotoSelect,
    previewOpen: previewOpenProp,
    initialPreviewOpen = false,
    onPreviewOpenChange,
    previewContainer,
    previewFocusLock,
    at: atProp,
    naming,
    lot,
    unitControl,
    beat: beatProp,
    onBeatChange,
    onDone,
    onSubmit,
    disabled = false,
    labels = {},
    overrides = {},
  } = props;

  const [, theme] = useStyletron();

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Standing, standingProps] = getOverrides(overrides.Standing, StyledStanding);
  const [StandingLabel, standingLabelProps] = getOverrides(overrides.StandingLabel, StyledStandingLabel);
  const [Modes, modesProps] = getOverrides(overrides.Modes, StyledModes);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledBody);
  const [Entry, entryProps] = getOverrides(overrides.Entry, StyledEntry);
  const [Attribution, attributionProps] = getOverrides(overrides.Attribution, StyledAttribution);
  const [AttributionMark, attributionMarkProps] = getOverrides(overrides.AttributionMark, StyledAttributionMark);
  const [Camera, cameraProps] = getOverrides(overrides.Camera, StyledCamera);
  const [Naming, namingProps] = getOverrides(overrides.Naming, StyledNaming);
  const [Chosen, chosenProps] = getOverrides(overrides.Chosen, StyledChosen);
  const [Landed, landedProps] = getOverrides(overrides.Landed, StyledLanded);
  const [LandedSaid, landedSaidProps] = getOverrides(overrides.LandedSaid, StyledLandedSaid);
  const [LandedNote, landedNoteProps] = getOverrides(overrides.LandedNote, StyledLandedNote);
  const [Chip, chipProps] = getOverrides(overrides.Chip, StyledChip);
  const [ChipPreview, chipPreviewProps] = getOverrides(overrides.ChipPreview, StyledChipPreview);
  const [ChipThumb, chipThumbProps] = getOverrides(overrides.ChipThumb, StyledChipThumb);
  const [ChipLabel, chipLabelProps] = getOverrides(overrides.ChipLabel, StyledChipLabel);
  const [ChipTrash, chipTrashProps] = getOverrides(overrides.ChipTrash, StyledChipTrash);
  const [Consequence, consequenceProps] = getOverrides(overrides.Consequence, StyledConsequence);
  const [Stamp, stampProps] = getOverrides(overrides.Stamp, StyledStamp);
  const [Submit, submitProps] = getOverrides(overrides.Submit, StyledSubmit);
  const [Preview, previewProps] = getOverrides(overrides.Preview, StyledPreview);
  const [PreviewImage, previewImageProps] = getOverrides(overrides.PreviewImage, StyledPreviewImage);
  const [PreviewCaption, previewCaptionProps] = getOverrides(overrides.PreviewCaption, StyledPreviewCaption);

  /* A figure paints its own ink by design — it is a display primitive, and it has no idea it is
   * sitting in a panel nobody may touch. Inside a disabled panel it would be the one thing still
   * at full strength, so the disabled colour is handed to it the way Base hands any component its
   * exceptions: through the overrides contract. */
  const dimmed = disabled
    ? {
        Value: { style: { color: theme.colors.contentStateDisabled } },
        Unit: { style: { color: theme.colors.contentStateDisabled } },
        Was: { style: { color: theme.colors.contentStateDisabled } },
      }
    : undefined;
  const segmentOverrides = segmentOverridesFor(disabled ? theme.colors.contentStateDisabled : undefined);
  const controlOverrides = controlOverridesFor(disabled ? theme.colors.contentStateDisabled : undefined);

  const word = {
    onHand: 'On hand',
    now: MODE_LABEL.now,
    add: MODE_LABEL.add,
    camera: 'Photograph the document',
    reading: 'Reading the document',
    fromDocument: 'From the document',
    byHand: 'Set by hand',
    restore: 'Use',
    becomes: 'Stock becomes',
    stays: 'Stock stays at',
    submitNow: SUBMIT_LABEL.now,
    submitAdd: SUBMIT_LABEL.add,
    /* «Continue», never «Next» (§108.1) — his word, on every beat that moves the film on */
    continue: 'Continue',
    landedNow: LANDED_LABEL.now,
    landedAdd: LANDED_LABEL.add,
    preview: 'Preview',
    remove: 'Remove',
    close: 'Close',
    ...labels,
  };

  /* THE NUMBER LIVES ABOVE THE TABS. Everything the flip changes is derived from `mode`; nothing
   * the flip changes is stored. That is why the entry cannot lose what was typed. */
  const [mode, setOwnMode] = useControlled<Mode>(modeProp, initialMode);
  const [value, setOwnValue] = useControlled<string>(valueProp, initialValue);
  const [ownSource, setOwnSource] = React.useState<Source>(SOURCE.hand);
  const source: Source = sourceProp === undefined ? ownSource : sourceProp;
  const [photo, setOwnPhoto] = useControlled<StockPhoto | null>(photoProp, initialPhoto);
  const [ownStatus, setOwnStatus] = React.useState<PhotoStatus>(initialPhoto ? PHOTO_STATUS.attached : PHOTO_STATUS.none);
  const status: PhotoStatus = photoStatusProp === undefined ? ownStatus : photoStatusProp;
  const [previewOpen, setOwnPreviewOpen] = useControlled<boolean>(previewOpenProp, initialPreviewOpen);

  /* THE CLOCK. A declaration is a statement about now, so a stamp that was written once and left
   * there would be a false one. It ticks on the minute boundary the panel is actually on. */
  const [tick, setTick] = React.useState<Date>(() => atProp ?? new Date());
  React.useEffect(() => {
    if (atProp) return undefined;
    const id = window.setInterval(() => setTick(new Date()), 30000);
    return () => window.clearInterval(id);
  }, [atProp]);
  const at = atProp ?? tick;

  /* ── THE FILM'S OWN STATE (FEED-IA §115.5 · §115.6) ────────────────────────────────────────
   * Which beat is playing, and what the last one landed. A panel given no goods to name has no
   * first beat to play, so it opens on the number — which is exactly the instrument that stood
   * here before this became a film. */
  const [ownBeat, setOwnBeat] = useControlled<Beat>(beatProp, naming ? BEAT.name : BEAT.amount);
  const beat: Beat = beatProp === undefined ? ownBeat : beatProp;
  /** what the submit put down, held for the landing to say back — one number, his own sentence */
  const [landing, setLanding] = React.useState<StockSubmission | null>(null);

  const changeBeat = (next: Beat) => {
    if (next === beat) return;
    if (beatProp === undefined) setOwnBeat(next);
    onBeatChange?.({ beat: next });
  };

  const idRef = React.useRef<string>('');
  if (!idRef.current) idRef.current = `stock-announcement-${++panelSeq}`;
  const consequenceId = `${idRef.current}-consequence`;

  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const amount = toNumber(value);
  const entered = hasNumber(value);
  const result = !entered ? onHand : mode === MODE.add ? onHand + amount : amount;
  /* «WE HAVE ABOUT 60 BOXES» (§17.4). The mark is part of what was typed, so the consequence
     underneath inherits it: about-60 added to what is on the floor is an about, and printing the
     sum sharp would be the panel claiming a count nobody made. */
  const about = entered && isApprox(value);
  /* The entry is carrying the document's own number, untouched. The moment a hand changes it this
   * is false, and the accent leaves the panel with it. */
  const proposed = source === SOURCE.document && photo?.proposed !== undefined;

  const shared: SharedStyleProps = {
    $mode: mode,
    $source: source,
    $status: status,
    $disabled: disabled,
    $proposed: proposed,
  };

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    if (modeProp === undefined) setOwnMode(next);
    onModeChange?.({ mode: next });
  };

  const changeValue = (next: string, nextSource: Source) => {
    if (valueProp === undefined) setOwnValue(next);
    if (sourceProp === undefined) setOwnSource(nextSource);
    onChange?.({ value: next, source: nextSource });
  };

  const changePhoto = (next: StockPhoto | null, nextStatus: PhotoStatus) => {
    if (photoProp === undefined) setOwnPhoto(next);
    if (photoStatusProp === undefined) setOwnStatus(nextStatus);
    onPhotoChange?.({ photo: next });
  };

  const changePreview = (isOpen: boolean) => {
    if (previewOpenProp === undefined) setOwnPreviewOpen(isOpen);
    onPreviewOpenChange?.({ isOpen });
  };

  /* THE CAMERA'S MECHANICS, which are Base's file uploader's: a hidden `input[type=file]` and a
   * real button in front of it. `capture="environment"` opens the rear camera on a phone straight
   * at the document, and on a desk the same control opens the picker. */
  const onFile = async (file: File) => {
    onPhotoSelect?.({ file });
    changePhoto(null, PHOTO_STATUS.attaching);
    let src = '';
    try {
      src = await readAsDataURL(file);
    } catch {
      /* the picture could not be read; the chip goes and the camera stands ready again */
      changePhoto(null, PHOTO_STATUS.none);
      return;
    }
    const quantity = propose ? await propose({ file, src }) : undefined;
    const next: StockPhoto = { src, name: file.name, alt: file.name, proposed: quantity, at: new Date() };
    changePhoto(next, PHOTO_STATUS.attached);
    if (quantity !== undefined) changeValue(toEntry(quantity, decimals), SOURCE.document);
  };

  const removePhoto = () => {
    changePreview(false);
    changePhoto(null, PHOTO_STATUS.none);
    /* the number stays — it is the person's own now, and taking it away would be an edit nobody
     * asked for. Only the attribution moves. */
    if (sourceProp === undefined) setOwnSource(SOURCE.hand);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    if (!entered || disabled) return;
    const put: StockSubmission = { mode, amount, result, at, photo, approx: about };
    onSubmit?.(put);
    /* ── AND THE FILM PLAYS ITS LAST BEAT (§115.5) ────────────────────────────────────────
     * «Then it shows how much stock they just added and the number.» The landing is the scene's
     * ending, not a receipt bolted on: it names the quantity, it holds the goods, and nothing
     * asked whether they were sure on the way (§115.3). */
    setLanding(put);
    changeBeat(BEAT.landed);
  };

  /** the landing has been read; the panel goes again from its own first beat */
  const done = () => {
    const said = landing;
    setLanding(null);
    changeBeat(naming ? BEAT.name : BEAT.amount);
    onDone?.(said);
  };

  /* ── THE CAMERA'S SEAT (FEED-IA §113 · §115.5) ──────────────────────────────────────────────
   * «The field where they choose the product OR TAKE A PHOTO» — so where the panel has a naming
   * beat, the camera stands ON IT, beside the field, which is where a hand reaches for the paper
   * in front of it. A panel with no naming beat keeps the camera where it always was: under the
   * entry, on the add tab, because a photograph is evidence of an arrival and an arrival is an
   * addition. One control, one meaning, two seats decided by which film is playing.
   *
   * ⚠ AND WHERE THE FIELD HANDED IN CARRIES ITS OWN (§111.2 · §119.2), THE NAMING BEAT DRAWS
   * NONE: the albarán's organ grew the control inside its right edge, and a button underneath it
   * would be two controls for one act.
   *
   * ⚠⚠ BUT THE CAPTURE BEAT KEEPS ITS OWN (FEED-IA §127.4d, off S1: «why does the document only
   * appear when we're trying to select a product, so that it captures it from the product?»).
   * The paper is reached for when the QUANTITY is being written off it — that is the capture —
   * so the camera and whatever document is standing are on the number beat as well, which is
   * where they always were. Naming a product is one place a hand reaches for the paper; it is
   * not the only one. */
  const cameraAtName = Boolean(naming) && !naming?.photographs;
  const showCamera = beat === BEAT.name ? cameraAtName : mode === MODE.add;
  const showChip = showCamera && (status !== PHOTO_STATUS.none || photo !== null);

  const camera = (
    <Camera {...shared} {...cameraProps}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = e.target.files && e.target.files[0];
          if (picked) void onFile(picked);
        }}
      />
      <Button
        kind={BUTTON_KIND.secondary}
        size={BUTTON_SIZE.compact}
        disabled={disabled || status === PHOTO_STATUS.attaching}
        startEnhancer={() => <CameraGlyph size={18} />}
        overrides={{ BaseButton: { style: { width: '100%' }, props: { 'data-testid': 'stock-photograph' } } }}
        onClick={() => fileRef.current?.click()}
      >
        {word.camera}
      </Button>
    </Camera>
  );

  const documentChip = showChip ? (
    <Chip {...shared} {...chipProps}>
      {status === PHOTO_STATUS.attaching ? (
        <React.Fragment>
          <ChipPreview $as="div" {...shared} {...chipPreviewProps}>
            <Spinner $size={theme.sizing.scale800} $borderWidth={theme.sizing.scale0} />
            <ChipLabel {...shared} {...chipLabelProps}>{word.reading}</ChipLabel>
          </ChipPreview>
          <ChipTrash
            type="button"
            aria-label={`${word.remove} — ${word.reading}`}
            disabled={disabled}
            onClick={removePhoto}
            {...shared}
            {...chipTrashProps}
          >
            <TrashGlyph size={16} />
          </ChipTrash>
        </React.Fragment>
      ) : photo ? (
        <React.Fragment>
          <ChipPreview
            type="button"
            aria-label={`${word.preview}: ${photo.name}`}
            disabled={disabled}
            onClick={() => changePreview(true)}
            {...shared}
            {...chipPreviewProps}
          >
            <ChipThumb src={photo.src} alt="" {...shared} {...chipThumbProps} />
            <ChipLabel {...shared} {...chipLabelProps}>{photo.name}</ChipLabel>
          </ChipPreview>
          <ChipTrash
            type="button"
            aria-label={`${word.remove}: ${photo.name}`}
            disabled={disabled}
            onClick={removePhoto}
            {...shared}
            {...chipTrashProps}
          >
            <TrashGlyph size={16} />
          </ChipTrash>
        </React.Fragment>
      ) : null}
    </Chip>
  ) : null;

  return (
    <Root
      data-baseweb="stock-announcement"
      /* WHICH BEAT IS PLAYING, ON THE PANEL ITSELF (§115.5 · §119.1). One question is on screen
         at a time, and this is the number a drive reads to hold us to it. */
      data-beat={beat}
      role="group"
      aria-label={props['aria-label']}
      {...shared}
      {...rootProps}
    >
      {/* ══ BEAT 1 · THE FIELD (FEED-IA §115.5) ══════════════════════════════════════════════
          «I want to see the field where they choose the product or take a photo.» One question,
          all the room it wants, and two ways to answer it. The FIELD is the surface's own organ
          (§113's second general: the same grammar as the albarán's line, so a person who has
          written one line already knows this), and whatever it OFFERS lives in its own dropdown
          behind its own in-field control — never as a row of chips above the panel. */}
      {beat === BEAT.name && naming ? (
        <Naming {...shared} {...namingProps}>
          {/* ── THE QUESTION, DRAWN (FEED-IA §119.1 — «one question at a time like typeform») ──
              A typeform's whole shape is a question with one answer under it, so the beat says
              what it is asking IN TYPE rather than only to a screen reader. It is the heading
              step, because on this beat it is the most important thing on the panel (§98.3). */}
          {naming.label && (
            <span
              data-testid="stock-question"
              style={{ ...theme.typography.HeadingXSmall, color: theme.colors.contentPrimary }}
            >
              {naming.label}
            </span>
          )}
          <div data-testid="stock-name-field">{naming.field}</div>
          {showCamera && camera}
          {documentChip}
          {/* what the words landed on, said back — a CAPTURED fact and never an offer (§113).
              THE SEAT IS ALWAYS HERE AND ONLY THE WORDS COME AND GO (§119.2 · §37.3): a line
              that appeared mid-sentence moved the field a person was typing into. */}
          <Chosen
            data-testid="stock-chosen"
            data-goods={naming.chosen ? naming.chosen.id : undefined}
            data-landed={naming.chosen ? 'yes' : 'no'}
            {...shared}
            {...chosenProps}
          >
            {naming.chosen && <span>{naming.chosen.label}</span>}
            {naming.chosen?.note && (
              <span style={{ color: theme.colors.contentTertiary }}>{naming.chosen.note}</span>
            )}
          </Chosen>
          <Button
            disabled={disabled || !naming.chosen}
            size={BUTTON_SIZE.compact}
            overrides={{ BaseButton: { style: { width: '100%' }, props: { 'data-testid': 'stock-continue' } } }}
            onClick={() => { naming.onChosen?.({ beat: BEAT.amount }); changeBeat(BEAT.amount); }}
          >
            {word.continue}
          </Button>
        </Naming>
      ) : beat === BEAT.landed && landing ? (
        /* ══ BEAT 3 · THE LANDING (FEED-IA §115.5) ═══════════════════════════════════════════
           «Then it shows how much stock they just added and the number.» ONE SCENE, centred, and
           THE NUMBER is the whole of it — at the size of the thing that just happened, with the
           goods and where stock now stands in one quiet line underneath (§76: the primary value
           gets priority, the context sits under it). «Multiple numbers is a ridiculous thing…
           they all look the same, with the same boxes and the same size» — so there is exactly
           one figure on this beat, and the rest is a sentence. */
        <Landed data-testid="stock-landed" data-mode={landing.mode} {...shared} {...landedProps}>
          <LandedSaid {...shared} {...landedSaidProps}>
            {landing.mode === MODE.add ? word.landedAdd : word.landedNow}
          </LandedSaid>
          <Figure
            value={landing.mode === MODE.add ? landing.amount : landing.result}
            approx={landing.approx}
            unit={unit}
            decimals={decimals}
            locale={locale}
            size="display"
          />
          <LandedNote data-testid="stock-landed-note" {...shared} {...landedNoteProps}>
            {naming?.chosen ? `${naming.chosen.label} · ` : ''}
            {`${word.becomes} `}
            {landing.result.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
            {unit ? ` ${unit}` : ''}
          </LandedNote>
          <Button
            size={BUTTON_SIZE.compact}
            kind={BUTTON_KIND.secondary}
            overrides={{ BaseButton: { style: { width: '100%' }, props: { 'data-testid': 'stock-done' } } }}
            onClick={done}
          >
            {word.continue}
          </Button>
        </Landed>
      ) : (
        <React.Fragment>
          {/* ══ BEAT 2 · THE NUMBER ═════════════════════════════════════════════════════════
              The goods are chosen, so the panel asks the one thing left. ONE number leads — the
              one being typed — and everything else on this beat is context at a smaller step. */}

          {/* what the flip is reckoned against — one fact, label left, figure right.
              ── AND THE GOODS ARE THE WAY BACK (FEED-IA §43 · §119.1 · round 4) ───────────────
              «Every named thing is a door», and round 4 made it general: «everything should be
              clickable, everything should always be editable from the get-go — you shouldn't
              need to confirm anything.» The goods on this row ARE the answer the first question
              took, so pressing them stands in that question again with the words still in it.
              It is the typeform's back, and it costs no second control: a breadcrumb pill above
              the panel would have put the same word on the screen twice (§78.1's own lesson —
              one word paid for twice is the thing that gets noticed). */}
          <Standing {...shared} {...standingProps}>
            {naming?.chosen ? (
              <StandingLabel
                $as="button"
                type="button"
                data-testid="stock-back"
                data-goods={naming.chosen.id}
                aria-label={`Change the goods · ${naming.chosen.label}`}
                onClick={() => changeBeat(BEAT.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.sizing.scale200,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: theme.colors.contentPrimary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                {...shared}
                {...standingLabelProps}
              >
                <span>{naming.chosen.label}</span>
                <span aria-hidden="true" style={{ display: 'inline-flex', opacity: 0.55 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </StandingLabel>
            ) : (
              <StandingLabel {...shared} {...standingLabelProps}>
                {word.onHand}
                {onHandNote ? ` · ${onHandNote}` : ''}
              </StandingLabel>
            )}
            <Figure value={onHand} unit={unit} decimals={decimals} locale={locale} size="mini" overrides={dimmed} />
          </Standing>

          {/* THE TWO CLAIMS. Base's Segmented Control, whole: the sliding block, the arrow keys and
              the roving tab index are its own. The labels are the founder's sentences, at full size,
              because the tab IS the claim being made. */}
          <Modes {...shared} {...modesProps}>
            <SegmentedControl
              activeKey={mode}
              disabled={disabled}
              fill={FILL.fixed}
              onChange={({ activeKey }) => changeMode(String(activeKey) as Mode)}
              overrides={controlOverrides}
            >
              {/* the sentence wraps rather than truncates: it is the claim, not a chip */}
              <Segment key={MODE.now} label={word.now} overrides={segmentOverrides} />
              <Segment key={MODE.add} label={word.add} overrides={segmentOverrides} />
            </SegmentedControl>
          </Modes>

          <Body {...shared} {...bodyProps}>
            {/* THE ENTRY. One field, one number, and it belongs to neither tab. It is the ONLY
                thing on this beat drawn at heading size — the primary value gets the priority
                and every other figure here is context (§76 · §115.5). */}
            <Entry {...shared} {...entryProps}>
              <Input
                value={value}
                disabled={disabled}
                size={INPUT_SIZE.large}
                inputMode="decimal"
                placeholder="0"
                aria-label={mode === MODE.now ? word.now : word.add}
                aria-describedby={consequenceId}
                /* ── THE UNIT IS EDITABLE (FEED-IA §127.4b, V4: «kg should unit should be
                     editable in all») ────────────────────────────────────────────────────────
                     It still shares the number's line — the price-unit law, kept — and where the
                     surface hands a control in, that is what stands there. The organ takes a NODE
                     rather than growing a picker of its own: the registers a unit is drawn from
                     belong to the house, and this component has never known one. */
                endEnhancer={unitControl ?? unit}
                autoFocus={Boolean(naming)}
                onChange={(e) => changeValue(sanitise((e.target as HTMLInputElement).value), SOURCE.hand)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                overrides={{
                  Root: { style: { height: theme.sizing.scale1200 } },
                  Input: {
                    props: { 'data-testid': 'stock-amount' },
                    style: {
                      ...theme.typography.HeadingLarge,
                      fontVariantNumeric: 'tabular-nums',
                      fontFeatureSettings: '"tnum" 1',
                      /* MONZO-STYLE CENTRED (§127.4d). The amount a sheet is about sits on the
                         card's own axis; the unit stays on its right, sharing the line. */
                      textAlign: 'center',
                    },
                  },
                  /* the unit shares the number's line: no box of its own, no rule between them */
                  EndEnhancer: {
                    style: {
                      ...theme.typography.LabelLarge,
                      color: disabled ? theme.colors.contentStateDisabled : theme.colors.contentSecondary,
                      backgroundColor: 'transparent',
                      paddingLeft: theme.sizing.scale0,
                    },
                  },
                }}
              />
            </Entry>

            {/* WHERE THE NUMBER CAME FROM. Present only once a document has said something about it. */}
            {photo?.proposed !== undefined && (
              <Attribution {...shared} {...attributionProps}>
                <AttributionMark {...shared} {...attributionMarkProps}>
                  <DocumentGlyph size={14} />
                </AttributionMark>
                {proposed ? (
                  <span>{word.fromDocument}</span>
                ) : (
                  <React.Fragment>
                    <span>{word.byHand}</span>
                    <Button
                      kind={BUTTON_KIND.tertiary}
                      size={BUTTON_SIZE.mini}
                      disabled={disabled}
                      onClick={() => changeValue(toEntry(photo.proposed as number, decimals), SOURCE.document)}
                    >
                      {word.restore}&nbsp;
                      <Figure value={photo.proposed as number} decimals={decimals} locale={locale} size="mini" overrides={dimmed} />
                    </Button>
                  </React.Fragment>
                )}
              </Attribution>
            )}

            {/* THE CAMERA — where the panel has no naming beat, it stands here, on the add tab
                and nowhere else, exactly as it always did. */}
            {!cameraAtName && showCamera && camera}
            {!cameraAtName && documentChip}

            {/* THE ARRIVAL'S OWN LOTE (§5.6 · §113.2) — under the entry, on the ADD claim, because
                a lote belongs to an arrival and to nothing else. Already answered by Rocoto's own
                suggestion; the hand overrules it in place. */}
            {mode === MODE.add && lot ? (
              <div data-testid="stock-lot">{lot}</div>
            ) : null}

            {/* THE CONSEQUENCE — the sentence the flip rewrites. Announced politely, so the flip is
                heard as well as seen. It is a SENTENCE with a figure in it, at the smallest step
                the panel has: the number being typed above is the one that leads (§115.5). */}
            <Consequence id={consequenceId} aria-live="polite" {...shared} {...consequenceProps}>
              <span>{entered ? word.becomes : word.stays}</span>
              <Figure value={result} approx={about} unit={unit} decimals={decimals} locale={locale} size="mini" overrides={dimmed} />
            </Consequence>

            <Stamp {...shared} {...stampProps}>{`As of ${formatStamp(at, locale)}`}</Stamp>

            <Submit {...shared} {...submitProps}>
              <Button
                disabled={disabled || !entered}
                size={BUTTON_SIZE.compact}
                overrides={{ BaseButton: { style: { width: '100%' }, props: { 'data-testid': 'stock-submit' } } }}
                onClick={submit}
              >
                {mode === MODE.now ? word.submitNow : word.submitAdd}
              </Button>
            </Submit>
          </Body>
        </React.Fragment>
      )}

      {/* THE PREVIEW. Rocoto's own chromeless overlay, given the document at full size and the
          way to throw it away and take it again. */}
      {photo && (
        <OverlayCard
          isOpen={previewOpen && !disabled}
          onClose={() => changePreview(false)}
          mountNode={previewContainer}
          focusLock={previewFocusLock ?? !previewContainer}
          placement={PLACEMENT.center}
          size={previewContainer ? OVERLAY_SIZE.full : OVERLAY_SIZE.default}
          ariaLabel={`${word.preview}: ${photo.name}`}
        >
          <Preview {...shared} {...previewProps}>
            <PreviewImage src={photo.src} alt={photo.alt} {...shared} {...previewImageProps} />
            <PreviewCaption {...shared} {...previewCaptionProps}>
              <DocumentGlyph size={14} />
              <span>{photo.name}</span>
              {photo.at && <span>{formatTime(photo.at, locale)}</span>}
            </PreviewCaption>
            <div style={{ display: 'flex', gap: theme.sizing.scale300 }}>
              <Button
                kind={BUTTON_KIND.secondary}
                size={BUTTON_SIZE.compact}
                startEnhancer={() => <TrashGlyph size={16} />}
                onClick={removePhoto}
              >
                {word.remove}
              </Button>
              <Button kind={BUTTON_KIND.tertiary} size={BUTTON_SIZE.compact} onClick={() => changePreview(false)}>
                {word.close}
              </Button>
            </div>
          </Preview>
        </OverlayCard>
      )}
    </Root>
  );
};

export default StockAnnouncement;
