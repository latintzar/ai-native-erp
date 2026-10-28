/* THE STOCK ROW — the paper trail and the working reality, on the same line, at the same time.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright
 * (c) Uber Technologies, Inc.
 *
 * WHY IT EXISTS (THE-ALBARAN-THESIS §5). Two different things have to be visibly different here:
 *
 *   · THE PAPER TRAIL — the documented, evidenced stock. Incoming albaranes by email, or a
 *     photographed one. It has a document behind it and that document is reachable.
 *   · THE WORKING REALITY — what the person says is actually there right now.
 *
 * The declaration is an OVERRIDE: «the override lets them MANUALLY override the email-received
 * reality while benefiting from the easy paper trail of the incoming albaranes». So the working
 * reality WINS, deliberately and visibly, and the trail SURVIVES — it stays on the row, struck
 * through beside the number that stands, with its document still one press away. Nothing is
 * erased, and nothing has to be undone to read what the papers said.
 *
 * HOW THE TWO STATES DIFFER, given this product has no traffic light to differ with:
 *   · the mark tile INVERTS — ink filled — when a person is standing in front of the documents
 *   · a rule runs down the row's leading edge
 *   · the figure carries the trail struck through beside the declared number (Figure's own
 *     supersede law, which is exactly this relationship one level down)
 *   · the note line names WHO said it and WHEN, and still names the trail
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import ChevronRight from 'baseui/icon/chevron-right';
import { Figure } from '../figure';
import { DocumentGlyph, HandGlyph, FeedGlyph } from './glyphs';
import {
  LevelRoot as StyledLevelRoot,
  Mark as StyledMark,
  LevelBody as StyledLevelBody,
  LevelName as StyledLevelName,
  Note as StyledNote,
  LevelValue as StyledLevelValue,
  EvidenceButton as StyledEvidenceButton,
} from './styled-components';
import { EVIDENCE, FEED } from './constants';
import { formatTime } from './utils';
import type { StockLevelProps, LevelSharedStyleProps } from './types';

const StockLevel = (props: StockLevelProps) => {
  const {
    name,
    trail,
    evidence,
    declared,
    declaredAt,
    unit,
    decimals = 0,
    locale = 'en-GB',
    feed = FEED.connected,
    onOpenEvidence,
    disabled = false,
    evidenceLabel = 'Open the document',
    labels = {},
    children,
    overrides = {},
  } = props;

  const [, theme] = useStyletron();

  const [Root, rootProps] = getOverrides(overrides.Root, StyledLevelRoot);
  const [Mark, markProps] = getOverrides(overrides.Mark, StyledMark);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledLevelBody);
  const [Name, nameProps] = getOverrides(overrides.Name, StyledLevelName);
  const [Note, noteProps] = getOverrides(overrides.Note, StyledNote);
  const [Value, valueProps] = getOverrides(overrides.Value, StyledLevelValue);
  const [Evidence, evidenceProps] = getOverrides(overrides.Evidence, StyledEvidenceButton);

  const word = { declaredAt: 'Declared at', noTrail: 'Declared by hand', ...labels };

  /* the figure has no idea the row is inert — see the same note in stock-announcement.tsx */
  const dimmed = disabled
    ? {
        Value: { style: { color: theme.colors.contentStateDisabled } },
        Unit: { style: { color: theme.colors.contentStateDisabled } },
        Was: { style: { color: theme.colors.contentStateDisabled } },
      }
    : undefined;

  const hasTrail = trail !== undefined && trail !== null;
  const overridden = declared !== undefined && declared !== null;
  const interactive = Boolean(onOpenEvidence && evidence);

  const shared: LevelSharedStyleProps = {
    $overridden: overridden,
    $feed: feed,
    $disabled: disabled,
    $interactive: interactive,
  };

  /* THE ONE LINE UNDER THE NAME. It always names the trail when there is one, in both states —
   * an override that stops naming what it overrode has quietly destroyed the trail. */
  const trailPhrase = evidence
    ? `${evidence.label}${evidence.at ? `, ${formatTime(evidence.at, locale)}` : ''}`
    : undefined;
  const note = overridden
    ? [declaredAt ? `${word.declaredAt} ${formatTime(declaredAt, locale)}` : word.noTrail, trailPhrase]
        .filter(Boolean)
        .join(' · ')
    : trailPhrase;

  /* THE FIGURE. Declared, with the trail struck through beside it — Figure's own supersede law,
   * which is this exact relationship expressed on one number. */
  const standing = overridden ? (declared as number) : hasTrail ? (trail as number) : 0;
  const superseded = overridden && hasTrail ? (trail as number) : undefined;

  const markGlyph = overridden ? (
    <HandGlyph size={18} />
  ) : evidence?.kind === EVIDENCE.feed && feed === FEED.connected ? (
    <FeedGlyph size={18} />
  ) : (
    <DocumentGlyph size={18} />
  );

  return (
    <Root data-baseweb="stock-level" {...shared} {...rootProps}>
      <Mark aria-hidden="true" {...shared} {...markProps}>
        {markGlyph}
      </Mark>
      <Body {...shared} {...bodyProps}>
        <Name {...shared} {...nameProps}>{name}</Name>
        {note && <Note {...shared} {...noteProps}>{note}</Note>}
        {children}
      </Body>
      <Value {...shared} {...valueProps}>
        <Figure
          value={standing}
          was={superseded}
          unit={unit}
          decimals={decimals}
          locale={locale}
          size="default"
          overrides={dimmed}
        />
      </Value>
      {interactive && (
        <Evidence
          type="button"
          aria-label={evidenceLabel}
          disabled={disabled}
          onClick={onOpenEvidence}
          {...shared}
          {...evidenceProps}
        >
          <ChevronRight size={20} />
        </Evidence>
      )}
    </Root>
  );
};

export default StockLevel;
