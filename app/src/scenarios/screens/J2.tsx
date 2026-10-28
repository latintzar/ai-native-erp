/* J2 · Record a preference discovered during an order.
 *
 * `D3.setup`. A person answers a question about one order, and the answer is true about the
 * customer.
 *
 * POSITIVE SPACE. That the moment a one-off answer is given it can be made permanent — AND THAT
 * MAKING IT PERMANENT TAKES NO NAVIGATION. No customer page, no second visit, no «remember to add
 * this later». One control, in the place the answer was already given.
 *
 * NESTED, AND THE NESTING IS THE POINT. The parent is A6 and it is drawn as a skeleton, because
 * A6's anatomy is A6's business. What stands at full fidelity is the tail alone, in exactly the
 * position it occupies inside the parent — so a reader sees where in the undecided page the
 * decided moment lives, which is the method's own rule for a sub-scenario.
 *
 * REDUCTION: **J2 IS NOT A SCREEN.** It is the tail of `U01`, and that tail appears in A6, A9, A11,
 * C7 and F2. Drawn once here as the annotated close-up rather than as a sixth place it exists, and
 * it contributes zero screens to the app.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SnackbarElement } from 'baseui/snackbar';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import { AlwaysTail, Writes, entriesOf, entryText, rank, type Write } from '../canonical/resolution';
import RefChip from '../shell/RefChip';
import { GRegion, GLines, GThread } from '../ghosts/regions';
import { customerOf, familyOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'J2',
  title: 'Record a preference discovered during an order',
  group: 'J',
  frame: 'desk',
  ifText: 'a preference about a customer surfaces while somebody is answering a question on their order',
  dims: ['D3.setup'],
  job: 'Make a one-off answer permanent without leaving the order.',
  decides:
    'that an answer given for today can become the standing answer in one press, in the place it was given',
  inherits: [
    { region: 'the order the answer was given on', ref: 'A6' },
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'where the standing answer lands', ref: 'J1b' },
    { region: 'the same tail on the conversion', ref: 'A9' },
    { region: 'the same tail on the class', ref: 'A11' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U01'],
  kit: ['Tag', 'Button', 'Snackbar', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: "the tail of U01 alone, at full fidelity inside a ghosted A6 — zero screens of its own",
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [4],
  step: 6,
  fills: ['record.preference'],
  reads: ['record'],
  nests: { inside: 'A6' },
  live:
    'press Always and the tag moves from «Saved for this order» to «Saved. This is settled.», the snackbar names the record it changed, and the second write appears',
};

export default function J2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [always, setAlways] = React.useState(false);

  React.useEffect(() => {
    setAlways(false);
  }, [cast.sector]);

  const customer = customerOf(cast, cast.order.customer);
  const line = cast.order.lines[0];
  const product = productOf(cast, line.product);
  const family = familyOf(cast, product);

  /* the answer that was just given upstairs, taken from the same ranking A6 runs, so the two cards
     cannot disagree about what the person pressed */
  const answer = React.useMemo(() => {
    const entries = entriesOf(cast).filter((e) => e.product.family === family.id);
    const top = rank(entries, (e) => e.id, customer.id)[0];
    return top ? entryText(top.item) : product.name;
  }, [cast, family.id, customer.id, product.name]);

  const writes: Write[] = [
    { object: 'This order', text: answer, ref: 'A6' },
    ...(always
      ? [
          {
            object: `${customer.name}'s record`,
            text: `${answer}, and the question stops`,
            ref: 'J1b',
          } as Write,
        ]
      : []),
  ];

  return (
    <DeskChassis dossier selected={2} rows={11} height={860}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        {/* ── THE PARENT, GHOSTED. A6's anatomy is A6's business. ── */}
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius400,
            padding: theme.sizing.scale600,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale500,
            minWidth: 0,
            background: theme.colors.backgroundPrimary,
          }}
        >
          <GRegion to="A6" shape="line" height={theme.sizing.scale900} label="the order's head" />
          <GLines rows={3} />
          <GRegion to="A6" shape="block" height={72} label="the chip row that was just pressed" />

          {/* ── THE TAIL, AT FULL FIDELITY, IN THE PLACE IT LIVES ── */}
          <div
            style={{
              border: `1px solid ${theme.colors.contentPrimary}`,
              borderRadius: theme.borders.radius300,
              padding: theme.sizing.scale500,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale500,
              background: theme.colors.backgroundPrimary,
            }}
          >
            <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ ...theme.typography.LabelSmall }}>{answer}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                what {customer.name} meant, pressed a moment ago
              </span>
            </div>

            <AlwaysTail
              scope={customer.name}
              always={always}
              onAlways={() => setAlways(true)}
              onceText="Saved for this order"
            />

            {always && (
              <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
                <SnackbarElement
                  message={`${customer.name}'s record now says ${answer}.`}
                  actionMessage="Open the record"
                  actionOnClick={() => {
                    window.location.hash = '#/J1b';
                  }}
                />
                <RefChip to="J1b" size="mini">
                  the fact it wrote
                </RefChip>
              </div>
            )}

            <Writes writes={writes} />
          </div>

          <GRegion to="A6" shape="block" height={96} label="the rest of the order" />
        </div>

        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
