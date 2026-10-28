/* THE INSPECTOR — what did Rocoto know, what did it decide, and why did it stop if it stopped.
 *
 * ═══ THE CHECKPOINT'S OWN SPECIFICATION (§10.9) ═════════════════════════════════════════════
 * «The testing surface should make the AI's behavior inspectable without turning into developer
 * tooling. Where useful, show a compact internal panel / metadata beneath the message or order:
 * customer context used; proposed product/SKU; quantity/UOM; ACT / CLARIFY / HOLD / HANDOFF;
 * short reason where Rocoto stopped; resulting structured order. Do not expose chain-of-thought
 * or giant model debug output.»
 *
 * SIX FIELDS. THEY ARE THE WHOLE PANEL, and each one is a fact the reading already carries — no
 * field here is computed a second time and none of them is a number nothing produced.
 *
 * ═══ WHAT IS BANNED, AND IT IS BANNED STRUCTURALLY ══════════════════════════════════════════
 * There is no slot in this component for a token stream, a prompt, a probability or a model's
 * working. `TestReading` has no field that could carry one — the brain hands over a resolved
 * order and a verdict, never a transcript of how it got there — so «no chain-of-thought» is a
 * property of the type rather than a rule somebody has to keep.
 *
 * ═══ ⚠ THE FOUR WORDS ARE GONE FROM THIS PANEL (FEED-IA §120.3 — and this was the leak) ═════
 * What stood here was a `VerdictChip` painting `POLICY_WORD[p.id]`: ACT · CLARIFY · HOLD ·
 * HANDOFF, one chip, on the app's own chip geometry. Peter, on reading it: «The whole "act clarify
 * hold the handoff" is wrong. I told you already: either they need to edit and double-check the
 * delivery note, or they need to reply to the customer. Those are the two actions.»
 *
 * SO THE CHIP IS THE TICK NOW (`tick.tsx`, §120.2). It is the confidence organ: a drawn tick where
 * Rocoto answered and nothing is owed, and the ACTION plus its word where Rocoto held its reply.
 * Two words, closed, in one record; the machine's four survive as `policy.id`, which this panel
 * carries on an attribute and never prints. Nothing here is a colour and nothing here is a number.
 *
 * ═══ AND THE FEEDBACK IS A CORRECTION, NOT A RATING (§10.11 · THE-INTELLIGENCE §1) ══════════
 * «Correcting the line IS the training signal — no thumbs, no ratings.» So «Correct» is an
 * acknowledgement and «Needs correction» OPENS THE FIELD: the word and the amount become editable
 * in place, and what is written is the example. Every row that leaves here is marked test data.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Figure } from './figure';
import { Glyph, STEP } from './glyphs';
import { foldWord } from './catalogue';
import { amountWords, qtyWords, type Sale, type SaleLine } from './sale';
import { ConfidenceTick, OWED_RELEASE, OWED_WORD } from './tick';
import { proposedQty, type Proposed, type TestMark, type TestReading } from './test-chat';

/* ── ONE FIELD OF THE PANEL ───────────────────────────────────────────────────────────────── */

/** A LABEL AND WHAT IT ANSWERS. The label column holds still at one width so the six fields read
 *  as one table rather than six sentences, and every value slot declares its own overflow (§77.2). */
function Row({ label, children, testid }: { label: string; children: React.ReactNode; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          flex: '0 0 92px',
          minWidth: 0,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, minWidth: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentPrimary }}>
        {children}
      </span>
    </div>
  );
}

/** THE PROPOSAL, SAID IN ONE LINE PER THING ASKED FOR: their word, what it resolved to, and what
 *  §80 makes of the pair. A word the list has no row for says so and stops — the panel never
 *  spends a clause on what the reference failed to find. */
function ProposedLine({ p }: { p: Proposed }) {
  const [, theme] = useStyletron();
  return (
    <span data-testid="test-proposed" data-said={p.said} data-sku={p.product?.id ?? 'none'} style={{ display: 'block', minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall }}>{p.product ? p.product.name : p.said}</span>
      {/* THE SKU RIDES THE NAME ONLY WHERE IT ADDS SOMETHING (§25.5). A house whose row for
          «Merluza» is keyed `merluza` would otherwise print the same word twice, an inch apart. */}
      {p.product && foldWord(p.product.id) !== foldWord(p.product.name) && (
        <span style={{ color: theme.colors.contentSecondary }}>
          {` · ${p.product.id}`}
        </span>
      )}
      {!p.product && <span style={{ color: theme.colors.contentSecondary }}> · off the catalogue</span>}
      {p.ambiguous && (
        <span data-testid="test-ambiguous" style={{ display: 'block', color: theme.colors.contentSecondary }}>
          {`they said “${p.said}” · ${p.forms} forms in the house`}
        </span>
      )}
    </span>
  );
}

/* ── THE STRUCTURED ORDER ─────────────────────────────────────────────────────────────────── */

/** THE RESULTING ORDER, in the app's own line grammar: what it is, how much, what it comes to.
 *
 *  ⚠ IT IS DRAWN HERE RATHER THAN MOUNTED FROM `embeds.tsx` — deliberately, and this is the
 *  reason. The readback embed's card is a DOOR: pressing it calls `openSale`, which puts the
 *  document into the frame's open-items strip and walks the desk to Sales. A test order is not in
 *  the ledger, so that door would put a phantom chip in the real work strip — which is exactly the
 *  leak §10.7 and §27.14 forbid. Isolation outranks the convenience of reusing the card, so the
 *  order is drawn in the same grammar and stays inside the panel. The conversation still gets its
 *  order face where §77.5 puts one: the pinned overlay above the composer. */
function OrderLines({ lines }: { lines: SaleLine[] }) {
  const [, theme] = useStyletron();
  return (
    <span data-testid="test-order" data-lines={lines.length} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {lines.map((l) => (
        <span key={l.id} data-testid="test-order-line" style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.product.name}
          </span>
          <span style={{ flex: '0 0 auto', color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
            {l.unreadable ? 'amount owed' : qtyWords(l.given, l.unit)}
          </span>
          <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
            <Figure value={l.given * l.price} unit="S/" decimals={2} size="compact" locale="en-PE" />
          </span>
        </span>
      ))}
      {lines.length === 0 && <span style={{ color: theme.colors.contentSecondary }}>Goods show here.</span>}
    </span>
  );
}

/* ── THE CORRECTION ───────────────────────────────────────────────────────────────────────── */

/** WHAT A CORRECTION EDITS: the two fields the proposal actually asserts. The word is the training
 *  signal (§1 — their word, put back); the amount is a fact about this crate and is recorded
 *  without teaching anything, which is `trace.ts`'s own doctrine said on the surface that writes. */
function Correction({
  line,
  proposed,
  onSave,
  onCancel,
}: {
  line: SaleLine;
  proposed?: Proposed;
  onSave: (next: { word: string; qty: string; unit: string }) => void;
  onCancel: () => void;
}) {
  const [, theme] = useStyletron();
  const [word, setWord] = React.useState(line.product.name);
  const [qty, setQty] = React.useState(line.unreadable ? '' : amountWords(line.given));
  const [unit, setUnit] = React.useState(line.unit);

  return (
    <div
      data-testid="test-correction"
      data-line={line.id}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <Row label="Product">
        <Input
          size={INPUT_SIZE.mini}
          value={word}
          onChange={(e) => setWord(e.currentTarget.value)}
          aria-label="The product, corrected"
          overrides={{ Input: { props: { 'data-testid': 'test-fix-word' } } }}
        />
      </Row>
      <Row label="Quantity">
        <span style={{ display: 'flex', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <Input
              size={INPUT_SIZE.mini}
              value={qty}
              onChange={(e) => setQty(e.currentTarget.value)}
              aria-label="The quantity, corrected"
              overrides={{ Input: { props: { 'data-testid': 'test-fix-qty' } } }}
            />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <Input
              size={INPUT_SIZE.mini}
              value={unit}
              onChange={(e) => setUnit(e.currentTarget.value)}
              aria-label="The unit, corrected"
              overrides={{ Input: { props: { 'data-testid': 'test-fix-unit' } } }}
            />
          </span>
        </span>
      </Row>
      {proposed?.usual !== undefined && (
        <Row label="Their usual">{qtyWords(proposed.usual, proposed.unit)}</Row>
      )}
      <div style={{ display: 'flex', gap: theme.sizing.scale300, minWidth: 0 }}>
        <Button
          kind={KIND.primary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          data-testid="test-fix-save"
          onClick={() => onSave({ word, qty, unit })}
        >
          Save the correction
        </Button>
        <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid="test-fix-cancel" onClick={onCancel}>
          Leave it
        </Button>
      </div>
    </div>
  );
}

/* ── THE PANEL ────────────────────────────────────────────────────────────────────────────── */

export function TestPanel({
  reading,
  mark,
  onAnxious,
  onCorrect,
  onCorrection,
}: {
  reading: TestReading;
  /** what the operator has already said about this one, where they have said anything */
  mark?: TestMark;
  /** WHERE THE TICK LEADS WHEN SOMETHING IS OWED (FEED-IA §127.1). «They click on it, and it shows
   *  the delivery note»: the organ is a DOOR onto the anxiety — the message, the reasoning, the
   *  order with its albarán. The card itself is the CONVERSATION'S, mounted once by the housing,
   *  because a conversation carrying three readings may not carry three cards. */
  onAnxious?: (sale: Sale) => void;
  onCorrect: () => void;
  onCorrection: (fix: { line: string; word: string; qty: string; unit: string }) => void;
}) {
  const [, theme] = useStyletron();
  /* §142: a short tool summary by default; the full metadata is a flat disclosure on request. */
  const [open, setOpen] = React.useState(false);
  const [fixing, setFixing] = React.useState<string | null>(null);

  const { sale, policy, context, proposed } = reading;
  const line = sale.lines.find((l) => l.id === fixing) ?? null;
  const forLine = line ? proposed.find((p) => p.product?.id === line.product.id) : undefined;

  return (
    <div
      data-testid="test-panel"
      data-presentation="tool-trail"
      data-row={reading.row}
      data-cold={reading.cold ? 'yes' : 'no'}
      data-open={open ? 'yes' : 'no'}
      data-marked={mark ? mark.kind : 'none'}
      data-test-data="yes"
      /* WHAT ROCOTO DECIDED, STATED RATHER THAN PRINTED (§61.2 · §120.3). `data-owed` is the
         person's half — `edit` · `reply` · `none` — and `data-policy` is the machine's own
         lower-case id, carried so a harness and a trace still say which of the four it was. */
      data-owed={policy.owed ?? 'none'}
      data-policy={policy.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: open ? theme.sizing.scale400 : 0,
        margin: `${theme.sizing.scale200} ${theme.sizing.scale550} ${theme.sizing.scale400}`,
        padding: 0,
        border: 'none',
        background: 'transparent',
        minWidth: 0,
      }}
    >
      {/* THE HEAD IS THE FOLD, AND IT KEEPS THE TICK WHILE FOLDED — one slim line that still says
          what Rocoto decided, which is the same bargain the order overlay's own fold makes. On a
          settled reading the head is a heading and a small drawn tick, and that is the whole of
          it: «otherwise not an issue» (§120.2). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
        {/* THE ORGAN LEADS THE HEAD (§98.3), and where something is owed it is A DOOR (§127.1) —
            pressing it opens the anxiety rather than folding the panel. A settled tick opens
            nothing, because there is nothing to open: no anxiety, no door. */}
        {policy.owed && onAnxious ? (
          <button
            type="button"
            data-testid="test-tick-door"
            aria-label={`${OWED_WORD[policy.owed]} — open the issue`}
            onClick={() => onAnxious(reading.sale)}
            style={{ display: 'inline-flex', alignItems: 'center', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flex: '0 0 auto', fontFamily: 'inherit' }}
          >
            <ConfidenceTick owed={policy.owed} policy={policy.id} testid="test-tick" />
          </button>
        ) : (
          <ConfidenceTick owed={policy.owed} policy={policy.id} testid="test-tick" />
        )}
        <button
          type="button"
          data-testid="test-panel-toggle"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale300,
            flex: 1,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: theme.colors.contentPrimary,
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            minWidth: 0,
          }}
        >
          <span data-testid="test-tool-summary" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {`Read ${sale.lines.length} ${sale.lines.length === 1 ? 'line' : 'lines'}${mark ? ' · feedback kept' : ''}`}
          </span>
          <span
            aria-hidden="true"
            data-mark={open ? 'fold' : 'unfold'}
            style={{ display: 'inline-flex', flex: '0 0 auto', color: theme.colors.contentTertiary, transform: open ? 'rotate(180deg)' : undefined }}
          >
            <Glyph id="caret" size={STEP.small} />
          </span>
        </button>
      </div>

      {open && (
        <>
          <Row label="Context" testid="test-context">
            {context.length > 0
              ? context.map((s, i) => <span key={i} style={{ display: 'block' }}>{s}</span>)
              : 'The record for this account is empty.'}
          </Row>

          <Row label="Proposed" testid="test-proposed-row">
            {proposed.length > 0
              ? proposed.map((p, i) => <ProposedLine key={i} p={p} />)
              : 'Goods appear here when the message names them.'}
          </Row>

          <Row label="Quantity" testid="test-qty">
            {proposed.length > 0
              ? proposed.map((p, i) => (
                  <span key={i} data-testid="test-qty-line" style={{ display: 'block' }}>
                    {proposedQty(p)}
                    {p.usual !== undefined && (
                      <span style={{ color: theme.colors.contentSecondary }}>
                        {` · their usual ${qtyWords(p.usual, p.unit)}`}
                      </span>
                    )}
                  </span>
                ))
              : '—'}
          </Row>

          {/* THE ONE SENTENCE §10.9 ASKS FOR: «short reason where Rocoto stopped» — and the LABEL
              tells the truth about which question it is answering. Nothing was held back where
              Rocoto answered, so calling its sentence a stop would be the panel misreporting a
              success.
              THE LABEL IS THE RESTRAINT, SAID (§120.4). «In all cases, if it needs to pass
              something to review, it would basically restrain itself from replying» — so a held
              reading says so in the one place a person is already reading the reason, and the
              release line under it says how the restraint ends. */}
          <Row label={policy.owed ? 'Held its reply because' : 'Answered because'} testid="test-because">
            <span data-testid="test-because-words">{policy.because}</span>
            {policy.owed && (
              <span
                data-testid="test-release"
                style={{ display: 'block', color: theme.colors.contentSecondary }}
              >
                {OWED_RELEASE[policy.owed]}
              </span>
            )}
          </Row>

          <Row label="Order" testid="test-order-row">
            <OrderLines lines={sale.lines} />
          </Row>

          {/* ── THE FEEDBACK (§10.11) ──────────────────────────────────────────────────────── */}
          {fixing && line ? (
            <Correction
              line={line}
              proposed={forLine}
              onCancel={() => setFixing(null)}
              onSave={(next) => {
                onCorrection({ line: line.id, ...next });
                setFixing(null);
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
              <Button
                kind={KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                data-testid="test-mark-correct"
                onClick={onCorrect}
              >
                Correct
              </Button>
              <Button
                kind={KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                data-testid="test-mark-wrong"
                disabled={sale.lines.length === 0}
                onClick={() => setFixing(sale.lines[0]?.id ?? null)}
              >
                Needs correction
              </Button>
              {/* WHAT WAS SAID ABOUT IT, once something has been. The mark states that it is test
                  data on the surface as well as in the store — the flag is not a secret. */}
              {mark && (
                <span
                  data-testid="test-mark-said"
                  style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
                >
                  {mark.kind === 'correct'
                    ? `Marked correct at ${mark.at} · kept as test data`
                    : `Corrected at ${mark.at} · kept as test data`}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
