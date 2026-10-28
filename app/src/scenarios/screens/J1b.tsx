/* J1b · The learned fact.
 *
 * NESTED FULL-FIDELITY INSIDE A GHOSTED J1a, which is the method's own prescription for a
 * sub-scenario: you see exactly where in the undecided page the decided block lives. One block
 * opens; its seven siblings stay ghosted around it.
 *
 * POSITIVE SPACE. The anatomy of a fact the software learned: the value, HOW it was learned, when,
 * and edited in place without leaving the page. The «how» is the whole point — a record that
 * cannot say where a fact came from is a record nobody trusts, and every `U01` chip row in the
 * catalogue is ordered by evidence that is read from here. A chip row whose ordering has no filler
 * on this page is a promise nobody keeps (FLOWS §4b), so one of the two facts drawn here is
 * literally that filler.
 *
 * TWO KINDS OF FACT, AND THE PRODUCT LEARNS THEM DIFFERENTLY:
 *   · one WRITTEN by the customer — the evidence is their own sentence, kept verbatim;
 *   · one COUNTED from history — the evidence is «14 of their last 16 orders», never a score.
 *
 * SECTOR Δ IN ROWS ONLY. A fish house keeps a presentation preference, a meat house a cut spec, a
 * fruit house a ripeness — the same two rows, read from the sector's own order in `cast.ts`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta, SectorId } from '../meta';
import DeskChassis from '../chassis/desk';
import CustomerPage, { type CustomerBlock } from '../canonical/customer-page';
import { customerOf, productOf } from '../data/cast';
import RefChip from '../shell/RefChip';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'J1b',
  title: 'The learned fact',
  group: 'J',
  frame: 'desk',
  ifText: 'the software has learned a fact about a customer and holds it on their record',
  dims: [],
  job: 'Show what a learned fact is made of, and let it be corrected where it stands.',
  decides:
    'the anatomy of a fact the software learned — the value, how it was learned, when, and the edit that happens in place — and that the evidence ordering every chip row in the product is read from here',
  inherits: [
    { region: 'the seven blocks around it', ref: 'J1a' },
    { region: 'where a written preference is first captured', ref: 'J2' },
    { region: 'the chip row this evidence orders', ref: 'A6' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the customer list beside the page', ref: 'OPEN-3' }],
  primitives: [],
  kit: ['Input', 'Button', 'Tag', 'Ghost'],
  canonical: 'customer-page',
  delta: 'control',
  deltaText: 'one block opens at full fidelity while its siblings stay ghosted',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [4],
  step: 6,
  fills: ['record'],
  reads: ['record'],
  live:
    'click a value and it opens for editing where it stands; save it and the «how it was learned» line stays and gains today\'s date, so a corrected fact still says where it came from',
  nests: { inside: 'J1a' },
};

/* ── WHAT THIS CUSTOMER'S RECORD LEARNED ──────────────────────────────────────────────────────
 * The SUBJECT of the written preference is a line of the sector's own order, taken by position so
 * no name is typed; the EVIDENCE is the customer's own second sentence, verbatim from `cast.ts`.
 * The value is the preference itself — a phrase, not a name. */
const WRITTEN: Record<SectorId, { line: number; value: string }> = {
  fish: { line: 0, value: 'Pieces over 1 kg' },
  meat: { line: 2, value: 'Sliced thin' },
  fruit: { line: 1, value: 'Ripe on arrival' },
};

/** the day the sentence was written, and the run the count is taken over */
const LEARNED_ON = '12.08';
const COUNTED = { of: 14, from: 16 };

type Fact = {
  id: string;
  subject: React.ReactNode;
  value: string;
  how: React.ReactNode;
  when: string;
  /** the surface this fact orders, so the promise has a keeper */
  orders?: { ref: string; what: string };
};

export default function J1b() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const customer = customerOf(cast, cast.order.customer);
  const written = WRITTEN[cast.sector];

  const writtenLine = cast.order.lines[written.line] ?? cast.order.lines[0];
  const writtenProduct = productOf(cast, writtenLine.product);
  const countedLine = cast.order.lines[(written.line + 1) % cast.order.lines.length];
  const countedProduct = productOf(cast, countedLine.product);

  /** today, read off the order the page is standing beside */
  const today = cast.order.deliveryDay.split(' ').pop() ?? cast.order.deliveryDay;

  const facts: Fact[] = [
    {
      id: 'written',
      subject: <Name of={writtenProduct} />,
      value: written.value,
      how: <>From what they wrote on {LEARNED_ON}: &laquo;{cast.order.words[1]}&raquo;</>,
      when: LEARNED_ON,
    },
    {
      id: 'counted',
      subject: <Name of={countedProduct} />,
      value: `${countedLine.qty} ${countedLine.unit} every Friday`,
      how: (
        <>
          Counted from their orders — {COUNTED.of} of the last {COUNTED.from}
        </>
      ),
      when: LEARNED_ON,
      orders: { ref: 'A6', what: 'orders the chips on' },
    },
  ];

  const [values, setValues] = React.useState<Record<string, string>>({});
  const [edited, setEdited] = React.useState<Record<string, boolean>>({});
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => {
    setValues({});
    setEdited({});
    setEditing(null);
  }, [cast.sector]);

  const valueOf = (f: Fact) => values[f.id] ?? f.value;

  const renderFull = (block: CustomerBlock) => (
    <div
      style={{
        border: `1px solid ${theme.colors.contentPrimary}`,
        borderRadius: theme.borders.radius300,
        overflow: 'hidden',
      }}
      aria-label={block.title}
    >
      {facts.map((f, i) => (
        <div
          key={f.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: theme.sizing.scale500,
            alignItems: 'flex-start',
            padding: theme.sizing.scale500,
            borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
            <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{f.subject}</div>

            {editing === f.id ? (
              <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', flexWrap: 'wrap' }}>
                <Input
                  size={INPUT_SIZE.compact}
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.currentTarget.value)}
                  overrides={{ Root: { style: { maxWidth: '260px' } } }}
                />
                <Button
                  kind={KIND.primary}
                  size={SIZE.mini}
                  onClick={() => {
                    setValues((v) => ({ ...v, [f.id]: draft.trim() || valueOf(f) }));
                    setEdited((e) => ({ ...e, [f.id]: true }));
                    setEditing(null);
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              /* THE VALUE IS THE CONTROL. Editing happens where the fact stands — no drawer, no
                 second page, and the evidence line underneath never leaves. */
              <span
                role="button"
                tabIndex={0}
                onClick={() => { setEditing(f.id); setDraft(valueOf(f)); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(f.id); setDraft(valueOf(f)); } }}
                style={{
                  ...theme.typography.HeadingXSmall,
                  cursor: 'text',
                  borderBottom: `1px dashed ${theme.colors.borderOpaque}`,
                  alignSelf: 'flex-start',
                }}
              >
                {valueOf(f)}
              </span>
            )}

            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {f.how}
              {edited[f.id] ? ` · edited ${today}` : ''}
            </div>

            {f.orders && (
              <div style={{ display: 'flex', gap: theme.sizing.scale200, alignItems: 'center' }}>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  {f.orders.what}
                </span>
                <RefChip to={f.orders.ref} size="mini" />
              </div>
            )}
          </div>

          <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
            {edited[f.id] ? `edited ${today}` : `learned ${f.when}`}
          </Tag>
        </div>
      ))}
    </div>
  );

  return (
    <DeskChassis
      selected={1}
      rows={12}
      height={1320}
      daybar={false}
      daylist={{ open: 3, label: 'the customers' }}
    >
      <CustomerPage cast={cast} customer={customer} full="preferences" renderFull={renderFull} />
    </DeskChassis>
  );
}
