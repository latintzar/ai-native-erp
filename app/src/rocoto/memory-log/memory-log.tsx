/* MEMORY LOG — how a thing that was asked for became a thing that is known.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships nothing for a fact that had to be arrived at.
 *
 * WHY IT EXISTS. What a customer asks for is often not exactly what is in the list, so it has to be
 * matched — and matching runs on MEMORY, on what is known about this customer. Memory is not a
 * lookup table that arrived from somewhere; it is CREATED, one clarification at a time, and every
 * confirmation a person makes becomes an event in it. So the memory IS a log, and this is it.
 *
 * WHAT IT CARRIES:
 *
 *   · THE CHRONOLOGY, IN ORDER, AND ALL OF IT. Receipt → clarification → matching or the lack of
 *     one → the best candidates → confirmation by a person → the match landing on the right one →
 *     saved in memory. The reader can see not just what is known but how it came to be known, and
 *     therefore how much to trust it.
 *
 *   · A GUESS IS SAFFRON. A SETTLED FACT IS INK. The machine's match and the machine's shortlist
 *     are its own acts and take the accent. The instant a person confirms, the very same name is
 *     rewritten in ink and never carries the accent again. That single change of colour is the
 *     whole difference between what was proposed and what is now true, and it needs no words.
 *
 *   · THE EMPTY-SLOT LAW, MADE STRUCTURAL. The outcome row — «Remembered as …» — is always
 *     present, and while the chain is unsettled it holds an EMPTY SLOT. The machine's guess exists
 *     down in the log, marked as a guess; it is never promoted into the answer. Filling that slot
 *     with the likeliest candidate would put an invention inside a record about to be trusted, and
 *     the invention would read exactly like the rest of it.
 *
 *   · A SETTLED MEMORY IS QUIET AND PERMANENT. It sits on its own ground at the end of the chain
 *     with no accent near it. An unsettled one is explicitly open: a ring instead of a dot, the
 *     standing said in words, the slot left blank.
 *
 *   · A MEMORY CAN BE OVERRIDDEN, AND THE PREDECESSOR SURVIVES. A later fact strikes the earlier
 *     one through and stands beside it — Figure's predecessor treatment applied to a name instead
 *     of a number. The pair states the change; there is no arrow and no colour, because a change
 *     of mind is not a status.
 *
 *   · THE CONVERSATION IS SOMEONE ELSE'S JOB. A quoted clarification is drawn by Message, the
 *     numbers by Figure, the standing by Base's Tag, the face by Base's Avatar. This file draws a
 *     spine, a slot and a shortlist, and imports the rest.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { Avatar } from 'baseui/avatar';
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from 'baseui/tag';
import ChevronRight from 'baseui/icon/chevron-right';
import { isFocusVisible } from 'baseui/utils/focusVisible';
import { Figure } from '../figure';
import { Message } from '../message';
import { MARK, OPEN, SETTLES, STANDING } from './constants';
import {
  Root as StyledRoot,
  Head as StyledHead,
  Face as StyledFace,
  Subject as StyledSubject,
  Who as StyledWho,
  Asked as StyledAsked,
  Standing as StyledStanding,
  Outcome as StyledOutcome,
  OutcomeLabel as StyledOutcomeLabel,
  Match as StyledMatch,
  Predecessor as StyledPredecessor,
  Slot as StyledSlot,
  List as StyledList,
  Entry as StyledEntry,
  Time as StyledTime,
  Rail as StyledRail,
  Node as StyledNode,
  Spine as StyledSpine,
  Body as StyledBody,
  Actor as StyledActor,
  Note as StyledNote,
  Said as StyledSaid,
  Candidates as StyledCandidates,
  Candidate as StyledCandidate,
  Rank as StyledRank,
  CandidateBody as StyledCandidateBody,
  CandidateName as StyledCandidateName,
  CandidateDetail as StyledCandidateDetail,
  Strength as StyledStrength,
  Chevron as StyledChevron,
  Memory as StyledMemory,
  MemoryLabel as StyledMemoryLabel,
  Pair as StyledPair,
  ramp,
} from './styled-components';
import type {
  MemoryLogProps,
  MemoryEvent,
  MemoryCandidate,
  SharedStyleProps,
  EntryStyleProps,
  CandidateStyleProps,
  MatchStyleProps,
} from './types';

/** WHAT THE CHAIN HAS SETTLED ON — and the rule that only a person's act may settle anything.
 *
 *  The machine's own match is skipped deliberately: it is a proposal, and a proposal that filled
 *  this in would be a guess wearing the clothes of a fact. `was` carries the predecessor whenever
 *  one memory replaced another, so the outcome can state the change instead of hiding it. */
export const resolve = (events: MemoryEvent[]): { match?: string; was?: string } => {
  let match: string | undefined;
  let was: string | undefined;
  for (const e of events) {
    if (e.kind === 'unmatched') {
      match = undefined;
      was = undefined;
      continue;
    }
    if (SETTLES[e.kind] && e.match) {
      was = e.was ?? (e.kind === 'superseded' ? match : undefined);
      match = e.match;
    }
  }
  return { match, was };
};

/** WHERE THE CHAIN STANDS, read off its last event. Said as what IS — «Open», «Awaiting
 *  confirmation», «Remembered» — never as what it is missing. */
export const standingOf = (events: MemoryEvent[], awaiting: boolean): string => {
  const last = events[events.length - 1];
  if (!last) return 'Unknown';
  if (last.kind === 'candidates' && awaiting) return 'Awaiting confirmation';
  return STANDING[last.kind];
};

/** the index of the shortlist a person can still decide — the last one with nothing settled after it */
export const openShortlist = (events: MemoryEvent[]): number => {
  let at = -1;
  events.forEach((e, i) => {
    if (e.kind === 'candidates') at = i;
    if (SETTLES[e.kind]) at = -1;
  });
  return at;
};

/* Base's Tag reserves a margin so a row of tags spaces itself. Here a Tag stands inside a lockup
 * that already owns its spacing, so the margin is reset and nothing else about the Tag is touched —
 * its paint, its states and its type all stay Base's own. */
const TAG_IN_LOCKUP = {
  Root: { style: { marginTop: '0', marginBottom: '0', marginLeft: '0', marginRight: '0' } },
};

const MemoryLog = (props: MemoryLogProps) => {
  const {
    asked,
    customer,
    customerSrc,
    events,
    onConfirm,
    standing,
    openLabel = 'open',
    proposedLabel = 'Proposed',
    candidatesLabel = 'Candidates',
    memoryLabel = 'Memory',
    outcomeLabel = 'Remembered as',
    head = true,
    disabled = false,
    size = 'default',
    housing = 'card',
    overrides = {},
  } = props;

  const [, theme] = useStyletron();

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Head, headProps] = getOverrides(overrides.Head, StyledHead);
  const [Face, faceProps] = getOverrides(overrides.Face, StyledFace);
  const [Subject, subjectProps] = getOverrides(overrides.Subject, StyledSubject);
  const [Who, whoProps] = getOverrides(overrides.Who, StyledWho);
  const [Asked, askedProps] = getOverrides(overrides.Asked, StyledAsked);
  const [Standing, standingProps] = getOverrides(overrides.Standing, StyledStanding);
  const [Outcome, outcomeProps] = getOverrides(overrides.Outcome, StyledOutcome);
  const [OutcomeLabel, outcomeLabelProps] = getOverrides(overrides.OutcomeLabel, StyledOutcomeLabel);
  const [Match, matchProps] = getOverrides(overrides.Match, StyledMatch);
  const [Predecessor, predecessorProps] = getOverrides(overrides.Predecessor, StyledPredecessor);
  const [Slot, slotProps] = getOverrides(overrides.Slot, StyledSlot);
  const [List, listProps] = getOverrides(overrides.List, StyledList);
  const [Entry, entryProps] = getOverrides(overrides.Entry, StyledEntry);
  const [Time, timeProps] = getOverrides(overrides.Time, StyledTime);
  const [Rail, railProps] = getOverrides(overrides.Rail, StyledRail);
  const [Node, nodeProps] = getOverrides(overrides.Node, StyledNode);
  const [Spine, spineProps] = getOverrides(overrides.Spine, StyledSpine);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledBody);
  const [Actor, actorProps] = getOverrides(overrides.Actor, StyledActor);
  const [Note, noteProps] = getOverrides(overrides.Note, StyledNote);
  const [Said, saidProps] = getOverrides(overrides.Said, StyledSaid);
  const [Candidates, candidatesProps] = getOverrides(overrides.Candidates, StyledCandidates);
  const [Candidate, candidateProps] = getOverrides(overrides.Candidate, StyledCandidate);
  const [Rank, rankProps] = getOverrides(overrides.Rank, StyledRank);
  const [CandidateBody, candidateBodyProps] = getOverrides(overrides.CandidateBody, StyledCandidateBody);
  const [CandidateName, candidateNameProps] = getOverrides(overrides.CandidateName, StyledCandidateName);
  const [CandidateDetail, candidateDetailProps] = getOverrides(overrides.CandidateDetail, StyledCandidateDetail);
  const [Strength, strengthProps] = getOverrides(overrides.Strength, StyledStrength);
  const [Chevron, chevronProps] = getOverrides(overrides.Chevron, StyledChevron);
  const [Memory, memoryProps] = getOverrides(overrides.Memory, StyledMemory);
  const [MemoryLabel, memoryLabelProps] = getOverrides(overrides.MemoryLabel, StyledMemoryLabel);
  const [Pair, pairProps] = getOverrides(overrides.Pair, StyledPair);

  const shared: SharedStyleProps = { $size: size, $housing: housing, $disabled: disabled };

  const settled = React.useMemo(() => resolve(events), [events]);
  const shortlistAt = React.useMemo(() => openShortlist(events), [events]);
  const awaiting = Boolean(onConfirm) && !disabled && shortlistAt >= 0;
  /* WHAT A LATER FACT REPLACED. Walk the settling events in order; the moment one lands on a
   * different name, everything settled before it is struck through where it stands. The chain
   * keeps what it used to think, which is the only way a reader can tell a correction from a
   * first answer — and nothing is struck merely because an override exists somewhere. */
  const replaced = React.useMemo(() => {
    const struck = new Set<number>();
    let current: string | undefined;
    let standing: number[] = [];
    events.forEach((e, i) => {
      if (!SETTLES[e.kind] || !e.match) return;
      if (current !== undefined && e.match !== current) {
        standing.forEach((j) => struck.add(j));
        standing = [];
      }
      current = e.match;
      standing.push(i);
    });
    return struck;
  }, [events]);

  const word = standing ?? standingOf(events, awaiting);

  /* ROVING TAB STOP over the shortlist — Base's own menu grammar. Three candidates must not be
   * three stops on the way past the card, so the group is one stop and the arrows move inside it. */
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [focusVisibleIndex, setFocusVisibleIndex] = React.useState(-1);
  const rowRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (to: number, count: number) => {
    const next = Math.max(0, Math.min(count - 1, to));
    setFocusIndex(next);
    const row = rowRefs.current[next];
    if (row) row.focus();
  };

  const onShortlistKeyDown = (count: number) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!awaiting) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(focusIndex + 1, count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(focusIndex - 1, count);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0, count);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(count - 1, count);
        break;
      default:
        break;
    }
  };

  /* the face takes the same rung the head's own type does, so the picture and the words scale
   * together rather than one of them being sized by hand */
  const faceSize = ramp(size).face;

  /** the pair «what it is now», with whatever it replaced struck through beside it */
  const matchPair = (
    value: string,
    key: { proposed?: boolean; inline?: boolean; struck?: boolean; was?: string }
  ) => {
    const ms: MatchStyleProps = {
      ...shared,
      $proposed: Boolean(key.proposed),
      $superseded: Boolean(key.struck),
      $inline: Boolean(key.inline),
    };
    return (
      <React.Fragment>
        {key.was && (
          <Predecessor {...ms} {...predecessorProps}>
            {key.was}
          </Predecessor>
        )}
        <Match {...ms} {...matchProps}>
          {value}
        </Match>
      </React.Fragment>
    );
  };

  const shortlist = (event: MemoryEvent, es: EntryStyleProps, pickable: boolean) => {
    const list = event.candidates as MemoryCandidate[];
    return (
      <Candidates
        role="group"
        aria-label={candidatesLabel}
        onKeyDown={onShortlistKeyDown(list.length)}
        {...es}
        {...candidatesProps}
      >
        {list.map((c, i) => {
          const cs: CandidateStyleProps = {
            ...shared,
            $pickable: pickable,
            $isFocusVisible: focusVisibleIndex === i,
          };
          return (
            <Candidate
              key={c.id}
              // a candidate that cannot be picked is a row of a record, not a dead button: it
              // stays in the reading order and out of the tab order entirely.
              $as={pickable ? 'button' : 'div'}
              {...(pickable
                ? {
                    type: 'button',
                    disabled,
                    tabIndex: i === focusIndex ? 0 : -1,
                    onClick: () => onConfirm && onConfirm(c, i, event),
                    onFocus: (e: React.FocusEvent) => {
                      if (isFocusVisible(e)) setFocusVisibleIndex(i);
                    },
                    onBlur: () => setFocusVisibleIndex(-1),
                  }
                : null)}
              ref={(node: HTMLButtonElement | null) => {
                rowRefs.current[i] = node;
              }}
              {...cs}
              {...candidateProps}
            >
              <Rank {...cs} {...rankProps}>
                {i + 1}
              </Rank>
              <CandidateBody {...cs} {...candidateBodyProps}>
                <CandidateName {...cs} {...candidateNameProps}>
                  {c.name}
                </CandidateName>
                {c.detail && (
                  <CandidateDetail {...cs} {...candidateDetailProps}>
                    {c.detail}
                  </CandidateDetail>
                )}
              </CandidateBody>
              {c.strength !== undefined && (
                <Strength {...cs} {...strengthProps}>
                  <Figure value={c.strength * 100} decimals={0} unit="%" size="mini" />
                </Strength>
              )}
              {/* the chevron is earned: it appears only where the row actually goes somewhere */}
              {pickable && (
                <Chevron {...cs} {...chevronProps}>
                  <ChevronRight size={theme.sizing.scale600} />
                </Chevron>
              )}
            </Candidate>
          );
        })}
      </Candidates>
    );
  };

  return (
    <Root data-baseweb="memory-log" {...shared} {...rootProps}>
      {head && (
        <Head {...shared} {...headProps}>
          <Face {...shared} {...faceProps}>
            <Avatar name={customer} src={customerSrc} size={faceSize} />
          </Face>
          <Subject {...shared} {...subjectProps}>
            <Who {...shared} {...whoProps}>
              {`${customer} asked for`}
            </Who>
            <Asked {...shared} {...askedProps}>
              {`“${asked}”`}
            </Asked>
          </Subject>
          <Standing {...shared} {...standingProps}>
            <Tag
              closeable={false}
              kind={TAG_KIND.neutral}
              size={TAG_SIZE.small}
              // Base truncates a tag's words at 128px by default, which turned «Awaiting
              // confirmation» into «Awaiting confirm…». A standing the reader cannot finish
              // reading is a standing the card failed to state, so the words are kept whole and
              // the head wraps instead.
              contentMaxWidth={null}
              overrides={TAG_IN_LOCKUP}
            >
              {word}
            </Tag>
          </Standing>
        </Head>
      )}

      {/* THE ANSWER, and the empty-slot law. Announced when it changes, because the answer
          changing is the one thing on this card worth interrupting a reader for. */}
      <Outcome aria-live="polite" {...shared} {...outcomeProps}>
        <OutcomeLabel {...shared} {...outcomeLabelProps}>
          {outcomeLabel}
        </OutcomeLabel>
        {settled.match ? (
          matchPair(settled.match, { was: settled.was })
        ) : (
          // role + label rather than a hidden twin: the slot IS the content, and it has a name, so
          // a reader who cannot see it still learns that this is open.
          <Slot role="img" aria-label={openLabel} {...shared} {...slotProps} />
        )}
      </Outcome>

      <List {...shared} {...listProps}>
        {events.map((e, i) => {
          const last = i === events.length - 1;
          const repeat = i > 0 && Boolean(e.by) && events[i - 1].by === e.by;
          const es: EntryStyleProps = {
            ...shared,
            $mark: MARK[e.kind],
            $open: OPEN[e.kind],
            $last: last,
            $repeat: repeat,
            $superseded: replaced.has(i),
          };
          const proposed = e.kind === 'matched';
          return (
            <Entry key={e.id ?? i} {...es} {...entryProps}>
              <Time {...es} {...timeProps}>
                {e.at}
              </Time>
              <Rail aria-hidden="true" {...es} {...railProps}>
                <Node {...es} {...nodeProps} />
                <Spine {...es} {...spineProps} />
              </Rail>
              <Body {...es} {...bodyProps}>
                {/* the name is said once per run — but the mark is not the name. A second act by
                    the machine still has to be marked as the machine's, so the row survives the
                    repeat with the tag alone in it. */}
                {((e.by && !repeat) || es.$mark === 'accent') && (
                  <Actor {...es} {...actorProps}>
                    {e.by && !repeat ? e.by : null}
                    {es.$mark === 'accent' && (
                      /* the word that names a guess as a guess. Base's own Tag, keyed to the
                         accent, which the theme already paints saffron — nothing is re-drawn
                         here to get the brand colour. */
                      <Tag
                        closeable={false}
                        kind={TAG_KIND.accent}
                        size={TAG_SIZE.xSmall}
                        contentMaxWidth={null}
                        overrides={TAG_IN_LOCKUP}
                      >
                        {proposedLabel}
                      </Tag>
                    )}
                  </Actor>
                )}

                {e.note && (
                  <Note {...es} {...noteProps}>
                    {e.note}
                  </Note>
                )}

                {e.said && (
                  <Said {...es} {...saidProps}>
                    <Message author={e.said.author ?? 'received'} time={e.said.time}>
                      {e.said.text}
                    </Message>
                  </Said>
                )}

                {e.kind === 'unmatched' && (
                  <Slot role="img" aria-label={openLabel} {...shared} {...slotProps} />
                )}

                {e.candidates && e.candidates.length > 0 &&
                  shortlist(e, es, awaiting && i === shortlistAt)}

                {e.kind !== 'settled' && e.match && (
                  <Pair {...es} {...pairProps}>
                    {matchPair(e.match, {
                      proposed,
                      inline: true,
                      struck: es.$superseded,
                      was: e.was,
                    })}
                  </Pair>
                )}

                {e.kind === 'settled' && e.match && (
                  <Memory {...es} {...memoryProps}>
                    <MemoryLabel {...es} {...memoryLabelProps}>
                      {memoryLabel}
                    </MemoryLabel>
                    <Pair {...es} {...pairProps}>
                      <span>{`“${asked}”`}</span>
                      <span aria-hidden="true">{'→'}</span>
                      {matchPair(e.match, { inline: true, struck: es.$superseded })}
                      {/* the number belongs INSIDE the entry it is a fact about: standing on its
                          own under the block, «5 units» has no subject and reads as loose paint */}
                      {e.figure && (
                        <React.Fragment>
                          <span aria-hidden="true">{'·'}</span>
                          <Figure
                            value={e.figure.value}
                            was={e.figure.was}
                            unit={e.figure.unit}
                            decimals={e.figure.decimals ?? 0}
                            size={size === 'compact' ? 'mini' : 'compact'}
                          />
                        </React.Fragment>
                      )}
                    </Pair>
                  </Memory>
                )}

                {e.figure && e.kind !== 'settled' && (
                  <Figure
                    value={e.figure.value}
                    was={e.figure.was}
                    unit={e.figure.unit}
                    decimals={e.figure.decimals ?? 0}
                    size={size === 'compact' ? 'mini' : 'compact'}
                  />
                )}
              </Body>
            </Entry>
          );
        })}
      </List>
    </Root>
  );
};

export default MemoryLog;
