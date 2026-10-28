/* MESSAGE — the unit of conversation.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships controls and surfaces but nothing that holds a turn of
 * speech — and this product is a conversation before it is an application.
 *
 * WHAT IT CARRIES:
 *   · FOUR STANDINGS in one component, so a thread can map straight over its data: the near hand,
 *     the far hand, Rocoto itself, and the thread talking about itself. One component rather than
 *     four, because the ROW is the same row — the same shape, the same rhythm, the same meta — and
 *     a fork would have to re-earn all three. The app has already been forked once this way (two
 *     hand-drawn typing indicators, one per surface) and a change to the bubble left one behind.
 *   · THE GROUPING RHYTHM. `grouped` says «this continues the same speaker», and it does two
 *     things at once: it tightens the row against the one above it, and it drops the notch. A
 *     burst therefore reads as one turn with several lines rather than as several turns.
 *   · THE MEASURED META. The stamp rides INSIDE the last line of text, via a shim of exactly the
 *     stamp's rendered width — the Compose layout the app ports, reproduced. A short message keeps
 *     its time beside it; a long one wraps around it.
 *   · ONE PLACE FOR SAFFRON. The identity mark, the streaming caret, and the dots while the AI
 *     thinks. A failed send is ink, because colour is not a status system here.
 *   · A SLOT, NOT AN IMPORT. A voice note is passed in through `slot`. The Waveform is being grown
 *     beside this file; coupling them would mean neither could be rebuilt alone.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { HOLD_DRIFT, HOLD_MS, STATUS_LABEL } from './constants';
import {
  Root as StyledRoot,
  Identity as StyledIdentity,
  IdentityMark as StyledIdentityMark,
  Bubble as StyledBubble,
  Content as StyledContent,
  Body as StyledBody,
  Text as StyledText,
  Caret as StyledCaret,
  MetaShim as StyledMetaShim,
  Meta as StyledMeta,
  Time as StyledTime,
  Status as StyledStatus,
  Payload as StyledPayload,
  MediaFrame as StyledMediaFrame,
  Image as StyledImage,
  Attachment as StyledAttachment,
  AttachmentIcon as StyledAttachmentIcon,
  AttachmentName as StyledAttachmentName,
  AttachmentDetail as StyledAttachmentDetail,
  Footer as StyledFooter,
  Caption as StyledCaption,
  Typing as StyledTyping,
  TypingDot as StyledTypingDot,
  System as StyledSystem,
  Retry as StyledRetry,
  Action as StyledAction,
} from './styled-components';
import type { MessageProps, SharedStyleProps, Status as StatusValue } from './types';

/* ── THE META SHIM, MEASURED ONCE PER DISTINCT STAMP ───────────────────────────────────────────
 * Ported from the app's own Bubbles.tsx, including the lesson written into it: someone two years
 * into using this opens a thread of thousands of messages, so one resize listener and one forced
 * layout PER BUBBLE is ruinous. A thread contains a handful of distinct stamps, and the width of
 * a given string in a given face is the same wherever it appears — so it is measured once per
 * distinct string and read from the cache after that.
 *
 * The cache is cleared, and every mounted shim re-run, on the two events that actually move a
 * text's width: the webfonts landing, and a resize (page zoom raises one).
 */
const shimWidths = new Map<string, number>();
const shimSubs = new Set<() => void>();
let shimFrame = 0;
let shimBound = false;

function remeasureShims(): void {
  if (shimFrame || typeof window === 'undefined') return;
  shimFrame = window.requestAnimationFrame(() => {
    shimFrame = 0;
    shimWidths.clear();
    for (const run of shimSubs) run();
  });
}

/** ONE listener for the whole thread, bound the first time a message mounts. */
function bindShimInvalidation(): void {
  if (shimBound || typeof window === 'undefined') return;
  shimBound = true;
  window.addEventListener('resize', remeasureShims);
  void window.document.fonts?.ready.then(remeasureShims);
}

/* ── THE GLYPHS ───────────────────────────────────────────────────────────────────────────────
 * Line art at a single stroke weight, drawn to fill their box, so every coordinate lives in the
 * viewBox and the only size in code is a step on Base's scale. They take `currentColor`, which is
 * what lets the failed one step up to full ink without the drawing knowing anything about it.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const StatusGlyph = ({ status }: { status: StatusValue }) => (
  <svg width="100%" height="100%" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    {status === 'sent' && <path d="M3 8.3 6.4 11.7 13 4.6" {...stroke} />}
    {status === 'sending' && (
      <>
        <circle cx="8" cy="8" r="5" {...stroke} />
        <path d="M8 5.2V8l2 1.4" {...stroke} />
      </>
    )}
    {status === 'error' && (
      <>
        <circle cx="8" cy="8" r="5.2" {...stroke} />
        <path d="M8 5.3v3.3" {...stroke} />
        <circle cx="8" cy="11" r="0.8" fill="currentColor" />
      </>
    )}
  </svg>
);

const DocumentGlyph = () => (
  <svg width="100%" height="100%" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M4.5 2h4.2L12 5.3V14H4.5z" {...stroke} />
    <path d="M8.5 2v3.4H12" {...stroke} />
  </svg>
);

const Message = (props: MessageProps) => {
  const {
    author = 'received',
    children,
    photo,
    // aliased: `document` is the right UI name for the row, and shadowing the global inside a
    // component that measures rendered text is exactly the kind of trap that costs an afternoon
    document: file,
    slot,
    time,
    status,
    streaming = false,
    typing = false,
    grouped = false,
    identity,
    action,
    onHold,
    onOpenPhoto,
    onRetry,
    disabled = false,
    typingLabel = 'Typing',
    retryLabel = 'Retry',
    overrides = {},
  } = props;

  const [, theme] = useStyletron();
  const [held, setHeld] = React.useState(false);
  const [engaged, setEngaged] = React.useState(false);

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Identity, identityProps] = getOverrides(overrides.Identity, StyledIdentity);
  const [IdentityMark, markProps] = getOverrides(overrides.IdentityMark, StyledIdentityMark);
  const [Bubble, bubbleProps] = getOverrides(overrides.Bubble, StyledBubble);
  const [Content, contentProps] = getOverrides(overrides.Content, StyledContent);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledBody);
  const [Text, textProps] = getOverrides(overrides.Text, StyledText);
  const [Caret, caretProps] = getOverrides(overrides.Caret, StyledCaret);
  const [MetaShim, shimProps] = getOverrides(overrides.MetaShim, StyledMetaShim);
  const [Meta, metaProps] = getOverrides(overrides.Meta, StyledMeta);
  const [Time, timeProps] = getOverrides(overrides.Time, StyledTime);
  const [Status, statusProps] = getOverrides(overrides.Status, StyledStatus);
  const [Payload, payloadProps] = getOverrides(overrides.Payload, StyledPayload);
  const [MediaFrame, frameProps] = getOverrides(overrides.MediaFrame, StyledMediaFrame);
  const [Image, imageProps] = getOverrides(overrides.Image, StyledImage);
  const [Attachment, attachmentProps] = getOverrides(overrides.Attachment, StyledAttachment);
  const [AttachmentIcon, iconProps] = getOverrides(overrides.AttachmentIcon, StyledAttachmentIcon);
  const [AttachmentName, nameProps] = getOverrides(overrides.AttachmentName, StyledAttachmentName);
  const [AttachmentDetail, detailProps] = getOverrides(
    overrides.AttachmentDetail,
    StyledAttachmentDetail
  );
  const [Footer, footerProps] = getOverrides(overrides.Footer, StyledFooter);
  const [Caption, captionProps] = getOverrides(overrides.Caption, StyledCaption);
  const [Typing, typingProps] = getOverrides(overrides.Typing, StyledTyping);
  const [TypingDot, dotProps] = getOverrides(overrides.TypingDot, StyledTypingDot);
  const [System, systemProps] = getOverrides(overrides.System, StyledSystem);
  const [Retry, retryProps] = getOverrides(overrides.Retry, StyledRetry);
  const [Action, actionProps] = getOverrides(overrides.Action, StyledAction);

  const payload = Boolean(photo || file || slot);
  const shared: SharedStyleProps = {
    $author: author,
    $grouped: grouped,
    $status: status,
    $disabled: disabled,
    $payload: payload,
    $typing: typing,
    $held: held,
    $engaged: engaged,
  };

  /* A message still arriving has no stamp yet — the time it was sent has not happened. */
  const showMeta = Boolean(time || status) && !typing && !streaming;
  const showShim = showMeta && !payload;

  const shimRef = React.useRef<HTMLSpanElement | null>(null);
  const metaRef = React.useRef<HTMLDivElement | null>(null);
  const gap = theme.sizing.scale300;

  React.useLayoutEffect(() => {
    if (!showShim) return undefined;
    const run = () => {
      const meta = metaRef.current;
      const shim = shimRef.current;
      if (!meta || !shim) return;
      const key = `${time ?? ''}|${status ?? ''}`;
      let width = shimWidths.get(key);
      if (width == null) {
        width = meta.getBoundingClientRect().width + parseFloat(gap);
        shimWidths.set(key, width);
      }
      shim.style.width = `${width}px`;
    };
    run();
    bindShimInvalidation();
    shimSubs.add(run);
    return () => {
      shimSubs.delete(run);
    };
  }, [showShim, time, status, gap]);

  /* ── THE HOLD ───────────────────────────────────────────────────────────────────────────────
   * A press past the threshold fires `onHold`; a press that TRAVELS was a scroll and is
   * abandoned. Right-click and the keyboard's context-menu key arrive as `contextmenu` and fire
   * it straight away, which is what makes the gesture reachable without a mouse. What OPENS is
   * the surface's business — this component owns the gesture and the slot, never the menu.
   */
  const holdTimer = React.useRef<number | null>(null);
  const holdOrigin = React.useRef<{ x: number; y: number } | null>(null);

  const clearHold = React.useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdOrigin.current = null;
    setHeld(false);
  }, []);

  React.useEffect(() => clearHold, [clearHold]);

  const holdable = Boolean(onHold) && !disabled;

  const onPointerDown = (event: React.PointerEvent) => {
    if (!holdable) return;
    holdOrigin.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setHeld(true);
      if (onHold) onHold();
    }, HOLD_MS);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const origin = holdOrigin.current;
    if (!origin || holdTimer.current === null) return;
    const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (travelled > HOLD_DRIFT) clearHold();
  };

  const onContextMenu = (event: React.MouseEvent) => {
    if (!holdable) return;
    event.preventDefault();
    clearHold();
    if (onHold) onHold();
  };

  /* The system line takes no side, no bubble and no meta: it is not a turn of speech. */
  if (author === 'system') {
    return (
      <Root data-baseweb="message" {...shared} {...rootProps}>
        <System {...shared} {...systemProps}>
          {children}
        </System>
      </Root>
    );
  }

  const mark =
    author === 'ai' ? (
      <Identity {...shared} {...identityProps}>
        {/* reserved on every AI row, painted only on the first of a run — four messages from
            Rocoto stay in one column under one mark rather than repeating it four times */}
        {grouped ? null : identity ?? <IdentityMark {...shared} {...markProps} />}
      </Identity>
    ) : null;

  const meta = showMeta ? (
    <Meta ref={metaRef} {...shared} {...metaProps}>
      {time && (
        <Time {...shared} {...timeProps}>
          {time}
        </Time>
      )}
      {status && (
        <Status role="img" aria-label={STATUS_LABEL[status]} {...shared} {...statusProps}>
          <StatusGlyph status={status} />
        </Status>
      )}
    </Meta>
  ) : null;

  const actionSlot = action ? (
    <Action {...shared} {...actionProps}>
      {action}
    </Action>
  ) : null;

  const bubble = (
    <Bubble
      tabIndex={holdable ? 0 : undefined}
      aria-busy={streaming || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      onContextMenu={onContextMenu}
      {...shared}
      {...bubbleProps}
    >
      {typing ? (
        <Typing role="status" aria-label={typingLabel} {...shared} {...typingProps}>
          <TypingDot $index={0} {...shared} {...dotProps} />
          <TypingDot $index={1} {...shared} {...dotProps} />
          <TypingDot $index={2} {...shared} {...dotProps} />
        </Typing>
      ) : (
        <>
          {payload && (
            <Payload {...shared} {...payloadProps}>
              {photo && (
                <MediaFrame
                  $as={onOpenPhoto ? 'button' : 'div'}
                  type={onOpenPhoto ? 'button' : undefined}
                  onClick={onOpenPhoto}
                  disabled={onOpenPhoto && disabled ? true : undefined}
                  aria-label={onOpenPhoto ? photo.alt : undefined}
                  style={{ aspectRatio: String(photo.aspectRatio ?? 1) }}
                  {...shared}
                  {...frameProps}
                >
                  <Image src={photo.src} alt={photo.alt} {...shared} {...imageProps} />
                </MediaFrame>
              )}
              {file && (
                <Attachment {...shared} {...attachmentProps}>
                  <AttachmentIcon {...shared} {...iconProps}>
                    <DocumentGlyph />
                  </AttachmentIcon>
                  <span style={{ minWidth: 0 }}>
                    <AttachmentName {...shared} {...nameProps}>
                      {file.name}
                    </AttachmentName>
                    {file.detail && (
                      <AttachmentDetail {...shared} {...detailProps}>
                        {file.detail}
                      </AttachmentDetail>
                    )}
                  </span>
                </Attachment>
              )}
              {slot}
            </Payload>
          )}

          {payload ? (
            (children || meta) && (
              <Footer {...shared} {...footerProps}>
                {children && (
                  <Caption {...shared} {...captionProps}>
                    {children}
                  </Caption>
                )}
                {meta}
              </Footer>
            )
          ) : (
            <Content {...shared} {...contentProps}>
              <Body {...shared} {...bodyProps}>
                <Text {...shared} {...textProps}>
                  {children}
                </Text>
                {streaming && <Caret {...shared} {...caretProps} />}
                {showShim && <MetaShim ref={shimRef} {...shared} {...shimProps} />}
                {meta}
              </Body>
              {status === 'error' && onRetry && (
                <Retry
                  type="button"
                  disabled={disabled}
                  onClick={disabled ? undefined : onRetry}
                  {...shared}
                  {...retryProps}
                >
                  {retryLabel}
                </Retry>
              )}
            </Content>
          )}
        </>
      )}
    </Bubble>
  );

  return (
    <Root
      data-baseweb="message"
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      // focus moving from the bubble to the affordance inside it is not leaving the row — without
      // the containment test the slot blinks out from under the very Tab that reached for it
      onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEngaged(false);
      }}
      {...shared}
      {...rootProps}
    >
      {author === 'sent' ? (
        <>
          {actionSlot}
          {bubble}
        </>
      ) : (
        <>
          {mark}
          {bubble}
          {actionSlot}
        </>
      )}
    </Root>
  );
};

/** THE RUN, computed once for a whole thread.
 *
 *  Grouping is a property of the SEQUENCE, not of a message, so every surface that renders a
 *  thread would otherwise re-derive it — and derive it slightly differently. A system line always
 *  breaks a run: the thread interrupted the speaker, so whoever speaks next is starting again.
 */
export const groupThread = (authors: Array<MessageProps['author']>): boolean[] =>
  authors.map(
    (author, i) => i > 0 && author === authors[i - 1] && author !== 'system'
  );

export default Message;
