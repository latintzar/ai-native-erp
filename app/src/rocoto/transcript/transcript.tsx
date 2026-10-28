/* TRANSCRIPT — the words a recording contained, readable and actable.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships nothing for speech that has already happened.
 *
 * WHAT IT CARRIES:
 *
 *   · WORDS THAT CAN BE ACTED ON. Every utterance is a target: pick one and the sound moves there.
 *     A transcript you can only read makes you scrub for the moment you want; a transcript you can
 *     seek makes the words the index of the sound. That is the whole reason this is a component and
 *     not a paragraph.
 *
 *   · A GAP STAYS A GAP. A run the machine did not hear renders as an empty slot and is left empty.
 *     Filling it with the likeliest word would put an invention inside a record about to be trusted,
 *     and the reader would have no way of telling the invention from the rest. Shown empty, the
 *     reader knows exactly which second to go back to.
 *
 *   · THE SOUND IS SOMEONE ELSE'S JOB. `media` is a bare slot. A Waveform lands in it; this file
 *     imports nothing that draws sound, and holds no opinion about how sound should look. The two
 *     meet only at `currentTime` and `onSeek`, so either can be replaced whole.
 *
 *   · ONE MARK OF SAFFRON, and only while the machine is at work. The playhead is the sound moving,
 *     which is not the AI's act, so it is ink. The empty slot is the machine's honesty, not an
 *     error, so it is ink. What is left — the machine still writing — takes Base's own Spinner,
 *     which the theme already paints saffron.
 *
 *   · TWO HOUSINGS, DECLARED. `housing="card"` is the whole thing: a bare card that can float on a
 *     layer with nothing around it, carrying its single decision at its own foot. `housing="plain"`
 *     drops the surface for a chromed housing — Base's Modal, header and footer and close control —
 *     to supply it. Which one a moment deserves is a design decision, so it is a prop and not an
 *     accident of where the component was dropped.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { Skeleton } from 'baseui/skeleton';
import { Spinner, SIZE as SPINNER_SIZE } from 'baseui/spinner';
import { isFocusVisible } from 'baseui/utils/focusVisible';
import {
  Root as StyledRoot,
  Media as StyledMedia,
  Meta as StyledMeta,
  Duration as StyledDuration,
  Mark as StyledMark,
  List as StyledList,
  Utterance as StyledUtterance,
  Time as StyledTime,
  Body as StyledBody,
  Speaker as StyledSpeaker,
  Words as StyledWords,
  Gap as StyledGap,
  Action as StyledAction,
  SkeletonRow as StyledSkeletonRow,
  ramp,
} from './styled-components';
import type { TranscriptProps, SharedStyleProps, UtteranceStyleProps, Utterance } from './types';

/* m:ss, and h:mm:ss once there is an hour of it. No locale enters here: a position inside a
 * recording is a count of seconds, not a time of day, and every place writes it the same way. */
export const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

/** the index of the utterance holding the playhead, or -1 when the playhead is outside them all */
export const currentUtterance = (utterances: Utterance[], at?: number): number => {
  if (at === undefined) return -1;
  return utterances.findIndex((u) => at >= u.start && at < u.end);
};

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Transcript = (props: TranscriptProps) => {
  const {
    utterances,
    currentTime,
    playing = false,
    onSeek,
    media,
    duration,
    loading = false,
    loadingUtterances = 3,
    disabled = false,
    follow = true,
    gapLabel = 'gap',
    maxHeight,
    action,
    size = 'default',
    housing = 'card',
    overrides = {},
  } = props;

  const [, theme] = useStyletron();

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Media, mediaProps] = getOverrides(overrides.Media, StyledMedia);
  const [Meta, metaProps] = getOverrides(overrides.Meta, StyledMeta);
  const [Duration, durationProps] = getOverrides(overrides.Duration, StyledDuration);
  const [Mark, markProps] = getOverrides(overrides.Mark, StyledMark);
  const [List, listProps] = getOverrides(overrides.List, StyledList);
  const [Row, rowProps] = getOverrides(overrides.Utterance, StyledUtterance);
  const [Time, timeProps] = getOverrides(overrides.Time, StyledTime);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledBody);
  const [Speaker, speakerProps] = getOverrides(overrides.Speaker, StyledSpeaker);
  const [Words, wordsProps] = getOverrides(overrides.Words, StyledWords);
  const [Gap, gapProps] = getOverrides(overrides.Gap, StyledGap);
  const [Action, actionProps] = getOverrides(overrides.Action, StyledAction);
  const [SkeletonRow, skeletonRowProps] = getOverrides(overrides.SkeletonRow, StyledSkeletonRow);

  const seekable = Boolean(onSeek) && !disabled && !loading;
  const shared: SharedStyleProps = { $size: size, $housing: housing, $disabled: disabled, $maxHeight: maxHeight };

  const current = React.useMemo(() => currentUtterance(utterances, currentTime), [utterances, currentTime]);

  /* ROVING TAB STOP. Forty utterances must not be forty stops on the way to the button underneath,
   * so the list is one stop and the arrows move inside it — Base's own menu grammar. The stop
   * follows the playhead, so a reader who tabs in while the sound runs lands on the line being
   * spoken rather than at the top of a recording they are already halfway through. */
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [focusVisibleIndex, setFocusVisibleIndex] = React.useState(-1);
  const rowRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (current >= 0) setFocusIndex(current);
  }, [current]);

  /* FOLLOW. The card scrolls its own list and leaves the page where it was: `scrollIntoView` on a
   * row inside an overlay drags the document behind the scrim too, which moves everything the
   * reader was looking at. The arithmetic below moves the scroller only, and only when the row has
   * left it.
   *
   * `playing` decides the MOTION, and the distinction is real rather than decorative. A playhead
   * running through the words moves continuously, so a glide reads as the list tracking it. A seek
   * is discontinuous — the reader asked to be somewhere else — and a glide there is just the wait
   * before arriving. So: playing glides, seeking cuts. A reader who asked for less motion gets the
   * cut either way. */
  React.useEffect(() => {
    if (!follow || current < 0) return;
    const list = listRef.current;
    const row = rowRefs.current[current];
    if (!list || !row) return;
    const behavior: ScrollBehavior = playing && !reducedMotion() ? 'smooth' : 'auto';
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top, behavior });
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTo({ top: bottom - list.clientHeight, behavior });
  }, [current, follow, playing]);

  const moveFocus = (to: number) => {
    const next = Math.max(0, Math.min(utterances.length - 1, to));
    setFocusIndex(next);
    const row = rowRefs.current[next];
    if (row) row.focus();
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!seekable) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(focusIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(focusIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(utterances.length - 1);
        break;
      default:
        break;
    }
  };

  const r = ramp(size);
  const wordStep = theme.typography[r.words as keyof typeof theme.typography] as { fontSize?: string };
  const labelStep = theme.typography[r.speaker as keyof typeof theme.typography] as { fontSize?: string };

  /* THE SKELETON stands in the real grid at the real heights, so the words arrive into the shape
   * that was already there. Base's own Skeleton draws the bars; nothing is re-drawn here. */
  const skeleton = (
    <List ref={listRef} {...shared} {...listProps}>
      {Array.from({ length: loadingUtterances }).map((_, i) => (
        <SkeletonRow key={i} {...shared} {...skeletonRowProps}>
          <Skeleton animation height={labelStep.fontSize} width={theme.sizing.scale900} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
            <Skeleton animation height={labelStep.fontSize} width={theme.sizing.scale1200} />
            <Skeleton animation height={wordStep.fontSize} width="100%" />
            <Skeleton animation height={wordStep.fontSize} width={i % 2 === 0 ? '62%' : '84%'} />
          </div>
        </SkeletonRow>
      ))}
    </List>
  );

  const rows = (
    <List
      ref={listRef}
      onKeyDown={onListKeyDown}
      {...shared}
      {...listProps}
    >
      {utterances.map((u, i) => {
        const isCurrent = i === current;
        const repeat = i > 0 && utterances[i - 1].speaker === u.speaker;
        const rowShared: UtteranceStyleProps = {
          ...shared,
          $current: isCurrent,
          $seekable: seekable,
          $isFocusVisible: focusVisibleIndex === i,
          $repeat: repeat,
        };
        return (
          <Row
            key={u.id ?? i}
            // a row that cannot be sought is a block of text, not a dead button: read-only words
            // stay in the reading order and out of the tab order entirely.
            $as={onSeek ? 'button' : 'div'}
            {...(onSeek
              ? {
                  type: 'button',
                  disabled,
                  tabIndex: i === focusIndex ? 0 : -1,
                  onClick: () => {
                    if (!seekable || !onSeek) return;
                    setFocusIndex(i);
                    onSeek(u.start, u, i);
                  },
                  onFocus: (event: React.FocusEvent) => {
                    if (isFocusVisible(event)) setFocusVisibleIndex(i);
                  },
                  onBlur: () => setFocusVisibleIndex(-1),
                }
              : null)}
            ref={(node: HTMLButtonElement | null) => {
              rowRefs.current[i] = node;
            }}
            // «the current item in a set» — the honest role for a playhead, and it changes as the
            // sound moves without a live region reading the transcript aloud over the audio the
            // reader is listening to.
            aria-current={isCurrent ? 'location' : undefined}
            {...rowShared}
            {...rowProps}
          >
            <Time {...rowShared} {...timeProps}>
              {clock(u.start)}
            </Time>
            <Body {...rowShared} {...bodyProps}>
              {!repeat && (
                <Speaker {...rowShared} {...speakerProps}>
                  {u.speaker}
                </Speaker>
              )}
              <Words {...rowShared} {...wordsProps}>
                {u.words.map((run, w) => (
                  <React.Fragment key={w}>
                    {w > 0 ? ' ' : null}
                    {run === null ? (
                      // role+label rather than a hidden twin: the slot IS the content, and it has
                      // a name so a reader who cannot see it still learns the record stops here.
                      <Gap role="img" aria-label={gapLabel} {...rowShared} {...gapProps} />
                    ) : (
                      run
                    )}
                  </React.Fragment>
                ))}
              </Words>
            </Body>
          </Row>
        );
      })}
    </List>
  );

  return (
    <Root
      data-baseweb="transcript"
      aria-busy={loading || undefined}
      // the sound's own state, published for whatever is drawing it in the media slot
      data-playing={playing || undefined}
      {...shared}
      {...rootProps}
    >
      {media && (
        <Media {...shared} {...mediaProps}>
          {media}
        </Media>
      )}

      {(duration !== undefined || loading) && (
        <Meta {...shared} {...metaProps}>
          {/* the mark leads and the total trails: the total is pushed to the trailing edge so it
              cannot be read as the first utterance's timestamp */}
          {loading && (
            <Mark {...shared} {...markProps}>
              <Spinner $size={SPINNER_SIZE.small} />
            </Mark>
          )}
          {duration !== undefined && (
            <Duration {...shared} {...durationProps}>
              {clock(duration)}
            </Duration>
          )}
        </Meta>
      )}

      {loading ? skeleton : rows}

      {action && (
        <Action {...shared} {...actionProps}>
          {action}
        </Action>
      )}
    </Root>
  );
};

export default Transcript;
