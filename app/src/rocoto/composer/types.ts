/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, STATE, VOICE_SEAT } from './constants';

export type Size = keyof typeof SIZE;
export type State = keyof typeof STATE;
/** which arrangement the trailing position is in — see `constants.ts` for the law */
export type VoiceSeat = keyof typeof VOICE_SEAT;

/** One staged item in the preview row above the field. It is staged, not sent: it can still be
 *  removed, and it is what makes a message sendable with no words in it at all. */
export type Attachment = {
  id: string;
  /** the thumbnail source. Absent = a file with no preview, and the tile stands in for it. */
  src?: string;
  /** what a screen reader hears, and what the remove control names */
  label: string;
};

/** One row of the autocomplete listbox. The host owns the filtering — this component owns the
 *  combobox anatomy around it (roles, active descendant, the keys). */
export type Suggestion = {
  id: string;
  label: string;
  /** a quieter second line under the label */
  description?: string;
};

export type ComposerOverrides = {
  Root?: Override;
  /** the preview row above the field */
  Attachments?: Override;
  /** one staged item */
  Attachment?: Override;
  /** the thumbnail inside a staged item */
  AttachmentThumb?: Override;
  /** the control that unstages an item */
  AttachmentRemove?: Override;
  /** the row that holds the field and the trailing control */
  Bar?: Override;
  /** the bordered writing surface — Base's input Root, grown to a textarea */
  Field?: Override;
  /** the textarea itself */
  Input?: Override;
  /** the enhancer-style slot that rides inside the field, after the input */
  AttachmentSlot?: Override;
  /** the trailing control column, outside the field */
  Actions?: Override;
  /** the send control */
  Send?: Override;
  /** the ring that turns while a message is in flight */
  SendSpinner?: Override;
  /** the seat the voice control sits in while the field is empty */
  VoiceSlot?: Override;
  /** the autocomplete listbox, opening upward from the bar */
  ListBox?: Override;
  /** one option in the listbox */
  ListItem?: Override;
  /** an option's quieter second line */
  ListItemDescription?: Override;
};

export type ComposerProps = {
  /** what is written. The composer is controlled — it never holds the text itself. */
  value: string;
  /** every keystroke, and the words dictation appends */
  onChange: (value: string) => void;
  /** Enter, or the send control. The host clears `value` and empties `attachments`. */
  onSend?: () => void;
  /** staged items, drawn in the preview row above the field */
  attachments?: Attachment[];
  /** present ⇒ each staged item carries a remove control */
  onRemoveAttachment?: (id: string) => void;
  /** a control that rides INSIDE the field, after the input — where the app puts its clip */
  attachment?: React.ReactNode;
  /** the control that takes the trailing position while the field is empty. A slot, not an
   *  import: the Voice Button is its own component and mounts here. */
  voice?: React.ReactNode;
  /** WHETHER THE VOICE CONTROL SHARES THE TRAILING SEAT WITH SEND OR KEEPS ITS OWN BESIDE IT
   *  (§196.7 · §196.8). `shared` is the messenger idiom and the default: the take IS the message.
   *  `own` is the dictation idiom: the take becomes words in the box, so send is always present
   *  and the mic stands beside it — which is what stops a prefilled draft from hiding the mic. */
  voiceSeat?: VoiceSeat;
  /** THE SEAT BECOMES THE BAR. The voice control's resting state is one round button, so its seat
   *  is one button wide; its recording and hands-free states are the WHOLE BAR — a live meter, a
   *  running clock, a cancel sentence, two verbs. Say `voiceActive` while a take is running and
   *  the writing surface stands down and the seat spans the bar, which is the arrangement the
   *  Voice Button is drawn for. Left false, a take is squeezed into one button's width and paints
   *  outside it — which is the bug this prop exists to make impossible. */
  voiceActive?: boolean;
  /** options for the autocomplete listbox. The host filters; this component owns the anatomy. */
  suggestions?: Suggestion[];
  /** an option was taken, by click or by Enter on the active row */
  onSelectSuggestion?: (suggestion: Suggestion) => void;
  /** the message is in flight: the field is inert and the send control shows progress */
  sending?: boolean;
  /** the whole bar is out of service */
  disabled?: boolean;
  /** how many lines the field grows to before it scrolls */
  maxLines?: number;
  size?: Size;
  placeholder?: string;
  /** aria-label for the send control */
  sendLabel?: string;
  /** aria-label for the preview row */
  attachmentsLabel?: string;
  /** aria-label for the autocomplete listbox */
  suggestionsLabel?: string;
  /** aria-label for one item's remove control, given that item */
  removeLabel?: (attachment: Attachment) => string;
  id?: string;
  name?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  overrides?: ComposerOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  /** the state matrix, named — see constants.ts */
  $state: State;
  $disabled: boolean;
  $sending: boolean;
  $isFocused: boolean;
  $isEmpty: boolean;
  $hasAttachments: boolean;
  /** the autocomplete listbox is open */
  $isOpen: boolean;
  /** the voice control has the bar: the field stands down and the seat spans the row */
  $voiceActive: boolean;
  /** `own` ⇒ the mic and the send stand side by side in the trailing position (§196.7) */
  $voiceSeat: VoiceSeat;
};

export type ListItemStyleProps = SharedStyleProps & {
  /** the option the keyboard is on, and the one Enter takes */
  $isActive: boolean;
};
