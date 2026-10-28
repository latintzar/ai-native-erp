/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { AUTHOR, STATUS } from './constants';

export type Author = keyof typeof AUTHOR;
export type Status = keyof typeof STATUS;

/** A picture in the thread. The ratio is given, never guessed: the frame is drawn before the
 *  bytes land, so the thread never jumps when an image decodes. */
export type MessagePhoto = {
  src: string;
  /** what the picture shows, for the reader who cannot see it */
  alt: string;
  /** width ÷ height. 1 is a square, 4/3 the usual camera frame. */
  aspectRatio?: number;
};

/** A file in the thread, drawn as a row rather than a preview. */
export type MessageDocument = {
  /** the file's own name, as the sending device wrote it */
  name: string;
  /** one quiet line under the name — size, pages, whatever the surface knows */
  detail?: string;
};

export type MessageOverrides = {
  /** the row: side, and the rhythm between this message and the one above it */
  Root?: Override;
  /** the gutter that holds the AI's identity mark */
  Identity?: Override;
  /** the mark itself — the one saffron in an ordinary message */
  IdentityMark?: Override;
  /** the surface: paint, notch, focus ring, held overlay */
  Bubble?: Override;
  /** the text column's padding */
  Content?: Override;
  /** the relative box the meta is positioned against */
  Body?: Override;
  /** the words */
  Text?: Override;
  /** the block that rides the end of a message still arriving */
  Caret?: Override;
  /** the measured reservation that keeps the meta on the last line */
  MetaShim?: Override;
  /** time and delivery, together */
  Meta?: Override;
  Time?: Override;
  Status?: Override;
  /** the uniform nest a photo, a document or a slotted payload sits in */
  Payload?: Override;
  /** the photo's frame — a button when the photo opens */
  MediaFrame?: Override;
  Image?: Override;
  /** the document row */
  Attachment?: Override;
  AttachmentIcon?: Override;
  AttachmentName?: Override;
  AttachmentDetail?: Override;
  /** the row under a payload: the words, then the meta */
  Footer?: Override;
  Caption?: Override;
  /** the three dots */
  Typing?: Override;
  TypingDot?: Override;
  /** the thread talking about itself */
  System?: Override;
  /** the way back from a failed send */
  Retry?: Override;
  /** whatever the surface hangs on a message — a menu trigger, a single button */
  Action?: Override;
};

export type MessageProps = {
  /** who said it. Default `received`. */
  author?: Author;
  /** the words of the message — its text, or its caption when it carries a payload */
  children?: React.ReactNode;
  /** a picture, drawn in its own frame at a known ratio */
  photo?: MessagePhoto;
  /** a file, drawn as a row */
  document?: MessageDocument;
  /**
   * ANY other payload, nested exactly like a photo. This is where a voice note goes: the
   * Waveform is passed IN rather than imported here, so the conversation primitive never
   * depends on the audio one and either can be rebuilt without touching the other.
   */
  slot?: React.ReactNode;
  /** the stamp, already formatted by the surface that knows the reader's locale */
  time?: string;
  /** delivery. Belongs to a `sent` message; a received one has no journey this side owns. */
  status?: Status;
  /** the message is still arriving — a caret rides the end of the words and the stamp waits */
  streaming?: boolean;
  /** the bubble is the three-dot indicator: no words, no stamp, no delivery */
  typing?: boolean;
  /** this message continues the same author's run: tightened against the one above, no notch */
  grouped?: boolean;
  /** replaces the default identity mark on an `ai` message — an avatar, a monogram, a logo */
  identity?: React.ReactNode;
  /** whatever the surface hangs on the message; revealed on hover, and on keyboard focus */
  action?: React.ReactNode;
  /** the long-press / right-click / context-menu-key gesture. The MENU is the surface's. */
  onHold?: () => void;
  /** the photo opens. Given, the frame becomes a real button. */
  onOpenPhoto?: () => void;
  /** the way back from `error` */
  onRetry?: () => void;
  /** the message can be read but no longer acted on */
  disabled?: boolean;
  /** what a screen reader hears in place of the three dots */
  typingLabel?: string;
  /** the retry affordance's own words */
  retryLabel?: string;
  overrides?: MessageOverrides;
};

export type SharedStyleProps = {
  $author: Author;
  $grouped: boolean;
  $status?: Status;
  $disabled: boolean;
  /** the bubble carries a photo, a document or a slot, so the meta takes its own row */
  $payload: boolean;
  /** the bubble is the three-dot indicator, which is shorter than a line of text */
  $typing: boolean;
  /** the pointer is down past the hold threshold */
  $held: boolean;
  /** the pointer is over the row, or something inside it holds focus */
  $engaged: boolean;
};

export type TypingDotStyleProps = SharedStyleProps & {
  /** 0, 1, 2 — which of the three dots, so each one takes its own delay off the motion scale */
  $index: number;
};
