/* COMPOSER — the message-writing bar.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * field underneath is their Input's, grown to a textarea; the component is Rocoto's, because Base
 * ships fields but no bar you write a message in.
 *
 * WHAT IT CARRIES:
 *   · IT GROWS UPWARD AND THEN SCROLLS. The field takes the height of what is written, up to five
 *     lines, and after that it scrolls. The ceiling is stated in LINES, measured on the element —
 *     never in pixels, because a pixel ceiling silently changes how many lines you get the moment
 *     the type scale moves. The trailing control sits on the bar's foot, so the line you are
 *     typing stays where it was and the growth happens above it.
 *   · ONE TRAILING SEAT, TWO OCCUPANTS. Write something and the send control is there; empty the
 *     field and the seat goes back to voice. They are the same footprint, so nothing on the bar
 *     moves when they trade places. The voice control itself is a SLOT — the Voice Button is its
 *     own component and mounts in here, and this component never imports it.
 *   · AND THE SEAT BECOMES THE BAR WHILE A TAKE RUNS. One button is the voice control's resting
 *     size, never its recording size: a take is a clock, a live meter, a cancel sentence and, in
 *     hands-free, two verbs under all of it. So `voiceActive` stands the writing surface down and
 *     hands the whole row to the seat, which is the arrangement the Voice Button is drawn for.
 *     The host says when, because the host is what mounts the machine.
 *   · THE ATTACHMENT RIDES INSIDE THE FIELD, AFTER THE INPUT. Base's own enhancer contract, on
 *     the trailing edge: a node that lives inside the field's border and takes the field's
 *     padding. It is the app's decision, kept — that is where people already reach for it.
 *   · WHAT IS ATTACHED IS SHOWN BEFORE IT IS SENT. Staged items sit in their own row above the
 *     field, each removable, and any one of them makes the message sendable with no words at all.
 *   · THE AUTOCOMPLETE IS A SLOT WITH BASE'S COMBOBOX ANATOMY AROUND IT. The host supplies and
 *     filters the options; this component owns the roles, the active descendant, and the keys —
 *     and resolves the one collision a composer creates, which is that Enter already means send.
 *     With a row active, Enter takes the row; with none, Enter sends; Shift+Enter always breaks
 *     the line.
 *
 * COLOUR: the send control is INK. The app paints its send circle saffron; here saffron marks
 * Rocoto's own act and nothing else, and sending is the person's act.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import ArrowUp from 'baseui/icon/arrow-up';
import DeleteIcon from 'baseui/icon/delete';
import { MAX_LINES, STATE, VOICE_SEAT } from './constants';
import {
  Root as StyledRoot,
  Bar as StyledBar,
  Attachments as StyledAttachments,
  Attachment as StyledAttachment,
  AttachmentThumb as StyledAttachmentThumb,
  AttachmentRemove as StyledAttachmentRemove,
  Field as StyledField,
  Input as StyledInput,
  AttachmentSlot as StyledAttachmentSlot,
  Actions as StyledActions,
  Send as StyledSend,
  SendSpinner as StyledSendSpinner,
  VoiceSlot as StyledVoiceSlot,
  ListBox as StyledListBox,
  ListItem as StyledListItem,
  ListItemDescription as StyledListItemDescription,
} from './styled-components';
import type {
  Attachment,
  ComposerProps,
  ListItemStyleProps,
  SharedStyleProps,
  Size,
  State,
  Suggestion,
} from './types';

/* stable empty defaults: a fresh [] on every render would restart the effects below */
const NO_ATTACHMENTS: Attachment[] = [];
const NO_SUGGESTIONS: Suggestion[] = [];

/** THE STATE MATRIX, DERIVED IN ONE PLACE. Exported so a surface can label, test or log the bar's
 *  state with the same names the styled elements switch on. Out of service beats in flight beats
 *  what is in the field. */
export function stateOf(props: {
  disabled?: boolean;
  sending?: boolean;
  value: string;
  attachments?: Attachment[];
}): State {
  if (props.disabled) return STATE.disabled;
  if (props.sending) return STATE.sending;
  if (props.attachments && props.attachments.length > 0) return STATE.attached;
  if (props.value.trim().length > 0) return STATE.typing;
  return STATE.empty;
}

/** the send glyph's edge, per size — Base's own sizing steps */
const GLYPH: Record<Size, string> = {
  compact: 'scale700',
  default: 'scale800',
  large: 'scale900',
};

const Composer = (props: ComposerProps) => {
  const {
    value,
    onChange,
    onSend,
    attachments = NO_ATTACHMENTS,
    onRemoveAttachment,
    attachment,
    voice,
    voiceSeat = VOICE_SEAT.shared,
    voiceActive = false,
    suggestions = NO_SUGGESTIONS,
    onSelectSuggestion,
    sending = false,
    disabled = false,
    maxLines = MAX_LINES,
    size = 'default',
    placeholder = 'Message',
    sendLabel = 'Send',
    attachmentsLabel = 'Attachments',
    suggestionsLabel = 'Suggestions',
    removeLabel = (a: Attachment) => `Remove ${a.label}`,
    id,
    name,
    inputRef,
    onFocus,
    onBlur,
    overrides = {},
  } = props;

  const [, theme] = useStyletron();
  const [isFocused, setIsFocused] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const ownRef = React.useRef<HTMLTextAreaElement>(null);
  const areaRef = inputRef || ownRef;
  const listRef = React.useRef<HTMLUListElement>(null);

  const uid = React.useId();
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-option-${i}`;

  const hasText = value.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const hasContent = hasText || hasAttachments;
  const inert = disabled || sending;
  const state = stateOf({ disabled, sending, value, attachments });

  /* ── THE TRAILING POSITION (constants.ts owns the law; §196.7 · §196.8) ────────────────────
     `shared` — content ⇒ send, empty ⇒ voice, one footprint. A message in flight keeps the send
     seat, because that is the control whose progress is being reported.
     `own` — the mic DICTATES, so it is not an alternative to sending: send is always there and
     the mic stands beside it. This is what keeps a prefilled draft from hiding the transcribe
     control on exactly the messages that have one. */
  const ownSeat = voiceSeat === VOICE_SEAT.own && !!voice;
  /* AND IN ITS OWN SEAT THE SEND IS ALWAYS THERE, DIMMED UNTIL THERE IS SOMETHING TO SEND — the
     port's own line about the editor variant, and the only arrangement that makes sense once the
     seat no longer swaps: a bar that showed the mic alone would be saying the words in the box
     have nowhere to go. `canSend` still gates the press. */
  const showSend = ownSeat || hasContent || sending;
  const showVoice = !!voice && (ownSeat || !showSend);
  const canSend = hasContent && !inert && !!onSend;

  /* THE TAKE TAKES THE BAR. A running take is a full-width instrument — clock, meter, cancel
     sentence, and in hands-free two verbs under it — so for as long as one is running the writing
     surface stands down and the trailing seat spans the row. The alternative is what shipped: a
     48px seat with a 300px instrument inside it, painting over the surface around it. IN THE OWN
     SEAT THE SEND STANDS DOWN WITH THE FIELD, for the same reason: the bar is the instrument. */
  const voiceLeads = showVoice && voiceActive;

  /* the combobox anatomy exists only when the host has opted into it by passing the prop —
     roles and aria-owns on a bar with no list are noise a screen reader has to step over. */
  const isCombobox = props.suggestions !== undefined;
  const open = isOpen && suggestions.length > 0 && !inert;

  const shared: SharedStyleProps = {
    $size: size,
    $state: state,
    $disabled: disabled,
    $sending: sending,
    $isFocused: isFocused,
    $isEmpty: !hasContent,
    $hasAttachments: hasAttachments,
    $isOpen: open,
    $voiceActive: voiceLeads,
    $voiceSeat: ownSeat ? VOICE_SEAT.own : VOICE_SEAT.shared,
  };

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Bar, barProps] = getOverrides(overrides.Bar, StyledBar);
  const [Attachments, attachmentsProps] = getOverrides(overrides.Attachments, StyledAttachments);
  const [AttachmentItem, attachmentItemProps] = getOverrides(
    overrides.Attachment,
    StyledAttachment
  );
  const [AttachmentThumb, thumbProps] = getOverrides(
    overrides.AttachmentThumb,
    StyledAttachmentThumb
  );
  const [AttachmentRemove, removeProps] = getOverrides(
    overrides.AttachmentRemove,
    StyledAttachmentRemove
  );
  const [Field, fieldProps] = getOverrides(overrides.Field, StyledField);
  const [Input, inputProps] = getOverrides(overrides.Input, StyledInput);
  const [AttachmentSlot, slotProps] = getOverrides(
    overrides.AttachmentSlot,
    StyledAttachmentSlot
  );
  const [Actions, actionsProps] = getOverrides(overrides.Actions, StyledActions);
  const [Send, sendProps] = getOverrides(overrides.Send, StyledSend);
  const [SendSpinner, spinnerProps] = getOverrides(overrides.SendSpinner, StyledSendSpinner);
  const [VoiceSlot, voiceProps] = getOverrides(overrides.VoiceSlot, StyledVoiceSlot);
  const [ListBox, listBoxProps] = getOverrides(overrides.ListBox, StyledListBox);
  const [ListItem, listItemProps] = getOverrides(overrides.ListItem, StyledListItem);
  const [ListItemDescription, descriptionProps] = getOverrides(
    overrides.ListItemDescription,
    StyledListItemDescription
  );

  /* ── THE GROWTH ────────────────────────────────────────────────────────────────────────────
     The field takes the height of what is in it and stops at `maxLines`. The ceiling is computed
     from the element's OWN computed line-height and padding rather than stated as a number, so it
     follows the theme's type scale and follows a size change without being told. It watches
     `value` and not the keystroke, so words that arrive some other way — a dictation, a paste, a
     suggestion taken from the list — resize the field exactly as typing does. */
  /* ── AND IT RE-MEASURES WHEN ITS COLUMN CHANGES WIDTH ──────────────────────────────────────
     The growth below runs on RENDER. A housing that settles its width AFTER mount — a panel that
     opens, a dock that is handed back its room — leaves the field measured at a width it no longer
     has, and a four-line message sits in a three-line box with its last line cut in half. That was
     found by LOOKING at 1600 in Messages (FEED-IA §196.7), not by an assertion. So the element
     watches its OWN width: WIDTH ONLY, because height is this effect's own output and a height
     watcher would chase itself. */
  const [measured, remeasure] = React.useReducer((n: number) => n + 1, 0);
  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let was = el.getBoundingClientRect().width;
    const watch = new ResizeObserver(() => {
      const now = el.getBoundingClientRect().width;
      if (Math.abs(now - was) < 1) return;
      was = now;
      remeasure();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [areaRef]);

  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const ceiling = Math.round(line * maxLines + padding);
    const wanted = Math.ceil(el.scrollHeight);
    el.style.height = `${Math.min(wanted, ceiling)}px`;
    /* a field that fits shows no scrollbar — 'auto' alone still paints one on a subpixel
       overshoot, which reads as a broken bar on the very first line */
    el.style.overflowY = wanted > ceiling ? 'auto' : 'hidden';
  }, [areaRef, value, maxLines, size, theme, measured]);

  /* the keyboard's row is dropped whenever the option list itself changes underneath it */
  const optionKey = suggestions.map((s) => s.id).join(' ');
  React.useEffect(() => {
    setActiveIndex(-1);
  }, [optionKey]);

  /* keep the active row in view when the list is taller than its own ceiling */
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const take = (suggestion: Suggestion) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (onSelectSuggestion) onSelectSuggestion(suggestion);
    if (areaRef.current) areaRef.current.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const last = suggestions.length - 1;
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1 > last ? -1 : prev + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 < -1 ? last : prev - 1));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
    }
    /* THE ONE COLLISION A COMPOSER MAKES: Enter already means send. With a row active it takes
       the row instead, because that is the key the person just navigated to it with. Shift+Enter
       is the line break in both cases, so the escape hatch never moves. */
    if (event.key === 'Enter' && !event.shiftKey) {
      const active = open && activeIndex >= 0 ? suggestions[activeIndex] : null;
      if (active) {
        event.preventDefault();
        take(active);
        return;
      }
      event.preventDefault();
      if (canSend && onSend) onSend();
    }
  };

  const glyph = theme.sizing[GLYPH[size] as keyof typeof theme.sizing];

  return (
    <Root data-baseweb="composer" {...shared} {...rootProps}>
      {open && (
        <ListBox
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={suggestionsLabel}
          {...shared}
          {...listBoxProps}
        >
          {suggestions.map((suggestion, index) => {
            const isActive = index === activeIndex;
            const itemShared: ListItemStyleProps = { ...shared, $isActive: isActive };
            return (
              <ListItem
                key={suggestion.id}
                id={optionId(index)}
                role="option"
                aria-selected={isActive}
                // the pointer must not take focus off the field, or the list closes before the
                // click lands — Base solves the same race by inspecting relatedTarget on blur
                onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
                onClick={() => take(suggestion)}
                {...itemShared}
                {...listItemProps}
              >
                {suggestion.label}
                {suggestion.description && (
                  <ListItemDescription {...itemShared} {...descriptionProps}>
                    {suggestion.description}
                  </ListItemDescription>
                )}
              </ListItem>
            );
          })}
        </ListBox>
      )}

      {hasAttachments && (
        <Attachments role="list" aria-label={attachmentsLabel} {...shared} {...attachmentsProps}>
          {attachments.map((item) => (
            <AttachmentItem
              key={item.id}
              aria-label={item.label}
              {...shared}
              {...attachmentItemProps}
            >
              {/* no source ⇒ no <img>: an empty one paints the browser's broken-image mark, which
                  says «this went wrong» about a file that is perfectly fine. The tile's own ground
                  stands in, and the item is named on the row itself. */}
              {item.src && (
                <AttachmentThumb src={item.src} alt={item.label} {...shared} {...thumbProps} />
              )}
              {onRemoveAttachment && (
                <AttachmentRemove
                  type="button"
                  aria-label={removeLabel(item)}
                  disabled={inert}
                  onClick={() => onRemoveAttachment(item.id)}
                  {...shared}
                  {...removeProps}
                >
                  {/* Base's icons carry a default <title>; an empty one drops it, because the
                      button beside it already carries the name a screen reader should hear. */}
                  <DeleteIcon size={theme.sizing.scale600} title="" aria-hidden="true" />
                </AttachmentRemove>
              )}
            </AttachmentItem>
          ))}
        </Attachments>
      )}

      <Bar {...shared} {...barProps}>
        {!voiceLeads && (
          <Field
            {...(isCombobox
              ? {
                  role: 'combobox',
                  'aria-expanded': open,
                  'aria-haspopup': 'listbox',
                  ...(open ? { 'aria-owns': listboxId } : {}),
                }
              : {})}
            {...shared}
            {...fieldProps}
          >
            <Input
              ref={areaRef}
              id={id}
              name={name}
              rows={1}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={sending}
              aria-busy={sending}
              autoComplete="off"
              {...(isCombobox
                ? {
                    'aria-autocomplete': 'list',
                    ...(open ? { 'aria-controls': listboxId } : {}),
                    ...(open && activeIndex >= 0
                      ? { 'aria-activedescendant': optionId(activeIndex) }
                      : {}),
                  }
                : {})}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                onChange(event.target.value);
                if (isCombobox) {
                  setIsOpen(true);
                  setActiveIndex(-1);
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={(event: React.FocusEvent<HTMLTextAreaElement>) => {
                setIsFocused(true);
                if (isCombobox && suggestions.length > 0) setIsOpen(true);
                if (onFocus) onFocus(event);
              }}
              onBlur={(event: React.FocusEvent<HTMLTextAreaElement>) => {
                setIsFocused(false);
                setIsOpen(false);
                setActiveIndex(-1);
                if (onBlur) onBlur(event);
              }}
              {...shared}
              {...inputProps}
            />
            {attachment && (
              <AttachmentSlot {...shared} {...slotProps}>
                {attachment}
              </AttachmentSlot>
            )}
          </Field>
        )}

        {(showSend || showVoice) && (
          <Actions {...shared} {...actionsProps}>
            {/* THE MIC IS FIRST AND THE SEND IS LAST, in both arrangements — the port's own order
                (`🎤  (➤)`), and the one every editor with a dictate control uses. The send stays
                the row's terminal act, so the hand always finds it in the same corner. */}
            {showVoice && (
              <VoiceSlot {...shared} {...voiceProps}>
                {voice}
              </VoiceSlot>
            )}
            {showSend && !voiceLeads && (
              <Send
                type="button"
                aria-label={sendLabel}
                aria-busy={sending}
                disabled={!canSend}
                onClick={() => {
                  if (canSend && onSend) onSend();
                }}
                {...shared}
                {...sendProps}
              >
                {sending ? (
                  <SendSpinner aria-hidden="true" {...shared} {...spinnerProps} />
                ) : (
                  <ArrowUp size={glyph} title="" aria-hidden="true" />
                )}
              </Send>
            )}
          </Actions>
        )}
      </Bar>
    </Root>
  );
};

export default Composer;
