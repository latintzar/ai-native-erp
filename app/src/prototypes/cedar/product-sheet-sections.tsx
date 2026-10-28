import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import type { Cast, Product } from '../../scenarios/data/cast';
import { LotSplitEditor, sharesOf, lotNumber, roundLot, splitState, type LotShare } from './lot-split-editor';
import { SheetPart, SheetRow } from './product-sheet-parts';
import { SKUUnits } from './product-units';
import { Figure } from './figure';
import { WorkflowDialog } from './workflow-dialog';
import { returnToStockUpdate, useStockEntryIntent, type StockEntryOrigin } from './stock-entry-intent';
import { useHistoryLayer, openSupplierMail } from './anchors';
import { mailsOf } from './inbox';
import { Glyph, STEP } from './glyphs';
import { useConfig } from './config';
import { useRules, parRuleOf, useRuleSaveError } from './rules';
import { useDeclared, buildLedger, rowsOf, recordedStock, lotBook, addition, stocktake, allocateLots, stockRevision, announce } from './incoming';
import { dayFromId, todayId, type Sale } from './sale';
import { nowOf } from './day';
import { useSKURecords } from './sku-record';
import { useUnits } from './units';
import { posthog, isPostHogConfigured } from '../../posthog';

const when = (at: string | Date) =>
  new Date(at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
export function useSKUStock(cast: Cast, product: Product) {
  const { config } = useConfig();
  const declared = useDeclared(cast.sector);
  const rules = useRules();
  const now = React.useMemo(() => {
    const d = dayFromId(todayId(cast));
    const [h, m] = nowOf(cast).split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }, [cast]);
  const rows = React.useMemo(
    () => rowsOf(buildLedger({ cast, config, declared, rules: rules.rules, now }), product.id),
    [cast, config, declared, rules.rules, now, product.id],
  );
  return { rows, now, standing: recordedStock(rows), lots: lotBook(cast, product, rows) };
}

/** Source links use the exact SKU's evidence, never the supplier or family as a shortcut. */
export function SKUSupplierEmails({
  cast,
  product,
  surface = 'plain',
}: {
  cast: Cast;
  product: Product;
  surface?: 'plain' | 'card';
}) {
  const [, theme] = useStyletron();
  const { rows } = useSKUStock(cast, product);
  const mails = React.useMemo(() => mailsOf(cast, rows), [cast, rows]);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => setExpanded(false), [product.id]);
  return <section data-product-sheet-block="sources" style={{ minWidth: 0 }}>
    <SheetPart surface={surface} title="Supplier emails" testid="product-supplier-emails" aside={<Button kind={KIND.tertiary} size={SIZE.mini} data-testid="product-supplier-inbox" onClick={() => openSupplierMail(null, product.id)}>View all</Button>}>
      {mails.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        {(expanded ? mails : mails.slice(0, 3)).map((mail) => <Button key={mail.id} kind={KIND.tertiary} size={SIZE.compact} data-testid="product-supplier-email" data-mail={mail.id} onClick={() => openSupplierMail(mail.id, product.id)} overrides={{ BaseButton: { style: { width: '100%', textAlign: 'left', justifyContent: 'flex-start', paddingLeft: '0', paddingRight: '0', borderRadius: '0' } } }}>
          <span style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: theme.sizing.scale400, minWidth: 0 }}>
            <Glyph id="email" size={STEP.small} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, flex: 1, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{mail.supplier?.name ?? 'Supplier'}</span>
              <span style={{ ...theme.typography.ParagraphSmall, overflowWrap: 'anywhere' }}>{mail.subject}</span>
              {mail.file && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{mail.file.name}</span>}
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flexShrink: 0 }}>{mail.at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </span>
        </Button>)}
        {mails.length > 3 && <Button kind={KIND.tertiary} size={SIZE.mini} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer emails' : `Show all ${mails.length} emails`}</Button>}
      </div> : <p data-testid="product-supplier-emails-empty" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>Supplier emails appear here once one names this product.</p>}
    </SheetPart>
  </section>;
}

export function SKUStock({
  cast,
  product,
  archived,
  sales = [],
  surface = 'plain',
}: {
  cast: Cast;
  product: Product;
  archived: boolean;
  // Folded Albaranes let this read availability commitments without changing physical balance.
  sales?: Sale[];
  surface?: 'plain' | 'card';
}) {
  const [, theme] = useStyletron();
  const { rows, now, standing, lots } = useSKUStock(cast, product);
  const rules = useRules();
  const ruleError = useRuleSaveError();
  const rule = parRuleOf(rules.rules, cast.sector, product.id, now);
  const [ruleEdit, setRuleEdit] = React.useState(false);
  const [level, setLevel] = React.useState('');
  const [ruleTime, setRuleTime] = React.useState('06:00');
  const [mode, setMode] = React.useState<'receive' | 'count' | 'allocate' | null>(null);
  const [quantity, setQuantity] = React.useState('');
  const [productionDate, setProductionDate] = React.useState(() => todayId(cast));
  const [shares, setShares] = React.useState<LotShare[]>([]);
  const [splitTouched, setSplitTouched] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [entryOrigin, setEntryOrigin] = React.useState<StockEntryOrigin | null>(null);
  const revision = React.useRef('');
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState('');

  const movements = rows.filter((row) => row.kind !== 'rule');
  // A saved Albaran allocation is a commitment, not a physical depletion. Keep Recorded balance
  // intact while showing the quantity still available across the active inventory horizon.
  const commitments = React.useMemo(() => {
    const out = new Map<string, number>();
    sales.filter((sale) => !sale.archived).forEach((sale) => {
      sale.lines.filter((line) => !line.off && line.product.id === product.id).forEach((line) => {
        (line.allocations ?? []).forEach((allocation) => out.set(allocation.batch, roundLot((out.get(allocation.batch) ?? 0) + allocation.qty)));
      });
    });
    return out;
  }, [product.id, sales]);
  const projectedLots = lots.map((lot) => {
    const committed = commitments.get(lot.id) ?? 0;
    return { ...lot, committed, available: roundLot(Math.max(0, lot.left - committed)) };
  });
  const availableLots = projectedLots.filter((lot) => lot.available > 0);
  const visibleLots = projectedLots.filter((lot) => lot.left > 0 || lot.committed > 0);
  const lastCount = movements.filter((row) => row.kind === 'counted').slice(-1)[0];
  const lastMovement = movements.filter((row) => row.effect !== 'record').slice(-1)[0];
  const knownStock = !!lastMovement;
  const numberWords = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const begin = (next: 'receive' | 'count' | 'allocate', origin: StockEntryOrigin | null = null) => {
    revision.current = stockRevision(cast.sector);
    setMode(next); setQuantity(next === 'allocate' ? String(standing.standing) : '');
    if (next === 'receive') setProductionDate(todayId(cast));
    setShares(next === 'receive' ? [] : sharesOf(lots)); setSplitTouched(false); setLeaving(false); setError(''); setEntryOrigin(origin);
  };
  const updateQuantity = (value: string) => {
    setQuantity(value);
    if (splitTouched || mode === 'receive') return;
    const entered = lotNumber(value);
    let remainingReduction = Number.isFinite(entered) ? Math.max(0, lots.reduce((sum, lot) => sum + Math.max(0, lot.left), 0) - entered) : 0;
    setShares(sharesOf(lots).map((share) => {
      const before = lotNumber(share.quantity);
      const deduction = Math.min(before, remainingReduction);
      remainingReduction = roundLot(remainingReduction - deduction);
      return { ...share, quantity: String(roundLot(before - deduction)) };
    }));
  };
  const close = () => { if (quantity.trim() && mode !== 'allocate' || splitTouched) setLeaving(true); else { setMode(null); setEntryOrigin(null); } };
  useHistoryLayer({
    id: `sku-stock:${product.id}`,
    active: mode !== null,
    snapshot: { mode },
    onRestore: (value) =>
      setMode(value?.mode === 'count' ? 'count' : value?.mode === 'receive' ? 'receive' : value?.mode === 'allocate' ? 'allocate' : null),
  });
  React.useEffect(() => {
    setMode(null);
    setQuantity('');
    setProductionDate(todayId(cast));
    setShares([]); setSplitTouched(false); setLeaving(false);
    setEntryOrigin(null);
    setSaved('');
    setRuleEdit(false);
  }, [product.id]);
  useStockEntryIntent(cast.sector, product.id, (intent) => begin(intent.mode, intent.origin ?? null));
  const amount = lotNumber(quantity);
  const split = splitState(shares, Number.isFinite(amount) ? amount : 0, lots);
  const changedSplit = lots.some((lot) => Math.abs((shares.find((share) => share.lotId === lot.id) ? lotNumber(shares.find((share) => share.lotId === lot.id)!.quantity) : 0) - lot.left) > 0.000001) || shares.some((share) => !lots.some((lot) => lot.id === share.lotId) && lotNumber(share.quantity) > 0);
  const valid = (mode !== 'allocate' || changedSplit) && quantity.trim() && Number.isFinite(amount) && amount >= 0 && Math.abs(amount - roundLot(amount)) < 0.000001 && (mode !== 'receive' || amount > 0) && split.valid;
  const save = (nextItem = false) => {
    if (!valid || !mode) return;
    try {
      if (stockRevision(cast.sector) !== revision.current) { setError('Stock changed since you opened this form. Your draft is still here. Close it and reopen to review the latest balance before saving.'); return; }
      const base = { sector: cast.sector, product: product.id, unit: product.unit, at: now };
      const targets = shares.filter((share) => lotNumber(share.quantity) > 0).map((share) => ({ lot: share.lotId, code: share.code.trim(), qty: lotNumber(share.quantity) }));
      if (mode === 'receive') {
        announce([...targets.map((share) => addition({ ...base, productionDate, qty: share.qty, lot: share.code, lotId: share.lot })), ...(split.unassigned > 0 ? [addition({ ...base, productionDate, qty: split.unassigned })] : [])]);
      } else {
        const changes = [...lots.map((lot) => ({ lot: lot.id, code: lot.code, qty: roundLot((targets.find((target) => target.lot === lot.id)?.qty ?? 0) - lot.left) })), ...targets.filter((target) => !lots.some((lot) => lot.id === target.lot))];
        // Count deductions describe missing physical stock. Attribution is a separate record,
        // including positive count findings and balanced reassignment. Neither creates a receipt.
        const negative = changes.filter((change) => change.qty < 0);
        const reduction = Math.max(0, standing.standing - amount);
        let availableDeduction = reduction;
        const depletions = negative.map((change) => { const qty = Math.min(-change.qty, availableDeduction); availableDeduction = roundLot(availableDeduction - qty); return { lot: change.lot, qty }; }).filter((item) => item.qty > 0);
        const allocations = changes.map((change) => ({ ...change, qty: roundLot(change.qty + (mode === 'count' ? depletions.find((item) => item.lot === change.lot)?.qty ?? 0 : 0)) }));
        announce([...(mode === 'count' ? stocktake({ ...base, level: amount, standing: standing.standing, lots, depletions }) : []), ...allocateLots({ ...base, origin: mode === 'count' ? 'count' : 'review', allocations })]);
      }
      const savedMode = mode;
      const savedOrigin = entryOrigin;
      if (isPostHogConfigured) {
        posthog.capture('stock_adjustment_saved', {
          adjustment_type: savedMode,
          lot_count: targets.length,
          initiated_from_stock_update: savedOrigin === 'stock-update',
        });
      }
      setSaved(savedMode === 'count' ? `Stock count recorded: ${amount} ${product.unit}.` : savedMode === 'allocate' ? `Lot split saved. Recorded balance stays ${amount} ${product.unit}.` : `Received ${amount} ${product.unit}.`);
      setMode(null); setQuantity(''); setProductionDate(todayId(cast)); setShares([]); setSplitTouched(false); setLeaving(false); setError(''); setEntryOrigin(null);
      /* The next item begins as a new, empty SKU-local draft. A failed write never reaches here. */
      if (nextItem && savedOrigin === 'stock-update') window.setTimeout(() => { returnToStockUpdate(); }, 0);
    } catch { setError('Saving this stock change stalled. Your values are still here.'); }
  };
  return (
    <section data-product-sheet-block="stock" style={{ minWidth: 0 }}>
      <SheetPart
        surface={surface}
        title="Stock & lots"
        testid="product-floor"
        aside={
          !archived && (
            <Button
              kind={KIND.secondary}
              size={SIZE.mini}
              data-testid="sku-receive"
              onClick={() => begin('receive')}
            >
              Receive stock
            </Button>
          )
        }
      >
        <div
          data-testid="sku-stock-summary"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.sizing.scale500,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
            <span style={theme.typography.LabelSmall}>Recorded balance</span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {knownStock
                ? `Receipts and recorded counts · updated ${when(lastMovement!.at)}`
                : 'Stock movements show here'}
            </span>
          </span>
          {knownStock ? (
            <Figure
              value={standing.standing}
              approx={standing.approx}
              unit={product.unit}
              decimals={Number.isInteger(standing.standing) ? 0 : 1}
              locale="en-PE"
              size="large"
            />
          ) : (
            <span style={theme.typography.LabelSmall}>Still to record</span>
          )}
        </div>
        <p data-testid="sku-stock-explanation" style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {lastCount ? `Last physical count: ${numberWords(lastCount.qty)} ${product.unit} · ${when(lastCount.at)}.` : 'Physical count still to record.'}
        </p>
        {saved && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              ...theme.typography.ParagraphSmall,
            }}
          >
            {saved}
            <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => setSaved('')}>
              Dismiss
            </Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          {!archived && (
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              data-testid="sku-count"
              onClick={() => begin('count')}
            >
              Record a stock count
            </Button>
          )}
        </div>
        {/* §196.1 · «no fucking collapsable sections» — the lots stand open under their noun */}
        <section data-testid="sku-lots">
          <h4 data-testid="sku-lots-head" style={{ margin: 0, minHeight: 44, display: 'flex', alignItems: 'center', ...theme.typography.LabelMedium }}>
            {availableLots.length ? 'Available lots · ' + availableLots.length : 'Available lots'}
          </h4>
          <div id="sku-lots-content" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale200 }}>
          {!archived && knownStock && standing.standing > 0 && <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}><Button kind={KIND.secondary} size={SIZE.compact} data-testid="sku-allocate-lots" onClick={() => begin('allocate')}>Assign to lots</Button><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="sku-lot-adjust" onClick={() => begin('count')}>Adjust balance</Button></div>}
          {visibleLots.length ? (
            visibleLots.map((item, i) => (
              <SheetRow
                key={`${item.code}-${i}`}
                testid={`sku-lot-${item.code}`}
                label={item.code}
                sub={`${item.day}${item.supplier ? ` · ${cast.suppliers.find((supplier) => supplier.id === item.supplier)?.name ?? item.supplier}` : ''} · ${item.landed} received${item.attributed ? ` · ${item.attributed > 0 ? "+" : ""}${item.attributed} attributed` : ""} · ${item.drawn} deducted${item.committed ? ` · ${numberWords(item.committed)} allocated` : ''}`}
                value={<span data-testid={`sku-lot-availability-${item.id}`} data-lot-id={item.id} data-free={item.available} data-allocated={item.committed} data-recorded={item.left} data-lot-state={item.available > 0 ? 'free' : 'fully-allocated'} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, alignItems: 'flex-end' }}><span data-testid={`sku-lot-free-${item.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Free</span><Figure value={item.available} approx={item.approx} unit={item.unit} size="compact" locale="en-PE" /></span>{item.committed > 0 && <span data-testid={`sku-lot-allocated-${item.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Allocated {numberWords(item.committed)} {item.unit}</span>}<span data-testid={`sku-lot-remaining-${item.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Remaining · recorded {numberWords(item.left)} {item.unit}</span></span>}
              />
            ))
          ) : (
            <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              Lots show here. Receive stock with a lot number, or assign recorded stock to one.
            </p>
          )}
        </div>
        </section>
        {knownStock && lots.length > 0 && Math.abs(lots.reduce((sum, item) => sum + item.left, 0) - standing.standing) > 0.005 && <p data-testid="sku-lot-unassigned" style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {numberWords(Math.abs(lots.reduce((sum, item) => sum + item.left, 0) - standing.standing))} {product.unit} is unassigned to a lot.
        </p>}
        <section data-testid="sku-replenishment">
          <h4 data-testid="sku-replenishment-head" style={{ margin: 0, minHeight: 44, display: 'flex', alignItems: 'center', ...theme.typography.LabelMedium }}>
            <span>Daily stock estimate</span>{rule ? <span>&nbsp;· {rule.level} {rule.unit} at {rule.replenishAt}</span> : null}
          </h4>
          <div id="sku-replenishment-content" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale200 }}>
          {ruleError && (
            <p role="alert" data-testid="rule-save-error">
              {ruleError}
            </p>
          )}
          <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            How much you usually expect to have at this time each day. This is your team’s estimate; recorded stock stands as it is.
          </p>
          {!archived &&
            (ruleEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
                <label style={theme.typography.LabelSmall}>
                  Expected quantity · {product.unit}
                  <Input
                    value={level}
                    aria-label="Expected quantity"
                    onChange={(e) => setLevel(e.currentTarget.value)}
                  />
                </label>
                <label style={theme.typography.LabelSmall}>
                  Expected each day at
                  <Input
                    value={ruleTime}
                    aria-label="Daily time"
                    type="time"
                    onChange={(e) => setRuleTime(e.currentTarget.value)}
                  />
                </label>
                <div style={{ display: 'flex', gap: theme.sizing.scale200 }}>
                  <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => setRuleEdit(false)}>
                    Cancel
                  </Button>
                  <Button
                    size={SIZE.mini}
                    disabled={
                      !level.trim() ||
                      !Number.isFinite(Number(level.replace(',', '.'))) ||
                      Number(level.replace(',', '.')) < 0 ||
                      !/^([01]\d|2[0-3]):[0-5]\d$/.test(ruleTime)
                    }
                    onClick={() => {
                      const saved = rules.set(
                        {
                          sector: cast.sector,
                          product: product.id,
                          level: Number(level.replace(',', '.')),
                          unit: product.unit,
                          replenishAt: ruleTime,
                        },
                        now,
                      );
                      if (saved) setRuleEdit(false);
                    }}
                  >
                    Save estimate
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: theme.sizing.scale200 }}>
                <Button
                  kind={KIND.secondary}
                  size={SIZE.mini}
                  onClick={() => {
                    setLevel(String(rule?.level ?? ''));
                    setRuleTime(rule?.replenishAt ?? '06:00');
                    setRuleEdit(true);
                  }}
                >
                  {rule ? 'Edit estimate' : 'Set daily estimate'}
                </Button>
                {rule && (
                  <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => rules.stop(rule.id, now)}>
                    Stop estimate
                  </Button>
                )}
              </div>
            ))}
        </div>
        </section>
        {!!movements.length && (
          <section data-testid="sku-movements">
          <h4 data-testid="sku-movements-head" style={{ margin: 0, minHeight: 44, display: 'flex', alignItems: 'center', ...theme.typography.LabelMedium }}>
            Stock history
          </h4>
          <div id="sku-movements-content" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale200 }}>
            {movements
              .slice()
              .reverse()
              .map((row) => (
                <SheetRow
                  key={row.id}
                  label={
                    row.kind === 'allocated'
                      ? row.allocationOrigin === 'count' ? 'Lot quantities from count' : 'Lot allocation changed'
                      : row.kind === 'counted'
                      ? 'Stock count'
                      : row.kind === 'variance'
                        ? 'Count adjustment'
                        : row.kind === 'rule'
                          ? 'Standing rule'
                          : row.kind === 'added'
                            ? 'Stock received'
                            : row.kind === 'email'
                              ? 'Supplier delivery · email'
                              : 'Supplier delivery · photo'
                  }
                  sub={`${when(row.at)}${row.lot ? ` · ${row.lot}` : ''}${row.allocations ? ` · ${row.allocations.map((allocation) => `${allocation.code}: ${allocation.qty > 0 ? '+' : ''}${allocation.qty} ${row.unit}`).join(' · ')}` : ''}`}
                  value={row.kind === 'allocated' ? <span style={theme.typography.ParagraphXSmall}>Balance unchanged</span> : <Figure value={row.qty} unit={row.unit} size="compact" locale="en-PE" />}
                />
              ))}
          </div>
        </section>
        )}
      </SheetPart>
      <WorkflowDialog isOpen={mode !== null} onClose={close} title={mode === 'count' ? 'Record a stock count' : mode === 'allocate' ? 'Assign stock to lots' : 'Receive stock'} actions={leaving ? <div data-testid="stock-unsaved-review" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}><span style={theme.typography.LabelMedium}>Discard your stock changes?</span><span style={theme.typography.ParagraphSmall}>Everything here is still a draft.</span><div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}><Button size={SIZE.compact} onClick={() => setLeaving(false)}>Keep editing</Button><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => { setLeaving(false); setMode(null); setEntryOrigin(null); }}>Discard changes</Button></div></div> : <div style={{ display: 'flex', gap: theme.sizing.scale300, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: theme.colors.backgroundPrimary, paddingTop: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={close}>Cancel</Button>
            {entryOrigin === 'stock-update' && mode !== 'allocate' ? <>
              <Button kind={KIND.secondary} size={SIZE.compact} disabled={!valid} data-testid="sku-stock-save-finish" onClick={() => save(false)}>Save and finish</Button>
              <Button size={SIZE.compact} disabled={!valid} data-testid="sku-stock-save-next" onClick={() => save(true)}>Save &amp; next item</Button>
            </> : <Button size={SIZE.compact} disabled={!valid} data-testid="sku-stock-save" onClick={() => save(false)}>{mode === 'count' ? 'Save count' : mode === 'allocate' ? 'Save lot split' : 'Save receipt'}</Button>}
          </div>}>
        <div data-testid="sku-stock-editor" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{product.name}</span>
          {mode === 'allocate' ? <p style={{ margin: 0, ...theme.typography.ParagraphSmall }}>{numberWords(standing.standing)} {product.unit} to assign · Stock total stays the same</p> : <label style={theme.typography.LabelSmall}>
            {mode === 'count' ? 'Total physically counted' : 'Quantity received'} · {product.unit}
            <Input autoFocus value={quantity} aria-label="Stock quantity" onChange={(event) => updateQuantity(event.currentTarget.value)} overrides={{ Input: { props: { inputMode: 'decimal', 'data-testid': 'sku-stock-quantity' } } }} />
          </label>}
          {mode === 'receive' && <label style={theme.typography.LabelSmall}>
            Production date
            <Input
              type="date"
              value={productionDate}
              aria-label="Production date"
              onChange={(event) => setProductionDate(event.currentTarget.value)}
              overrides={{ Input: { props: { 'data-testid': 'sku-stock-production-date' } } }}
            />
          </label>}
          {mode === 'count' && quantity.trim() && Number.isFinite(amount) && amount >= 0 && <section data-testid="sku-count-review" style={{ padding: theme.sizing.scale400, background: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius300 }}>
            <span style={theme.typography.LabelSmall}>Review this count</span>
            <p style={{ ...theme.typography.ParagraphSmall, marginBottom: 0 }}>{knownStock ? `${numberWords(standing.standing)} → ${numberWords(amount)} ${product.unit} · ${amount >= standing.standing ? '+' : '−'}${numberWords(Math.abs(amount - standing.standing))} ${product.unit} adjustment` : `First physical count: ${numberWords(amount)} ${product.unit}`}</p>
            {lots.length > 0 && <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginBottom: 0 }}>Starting split uses recorded lots, reducing the oldest first if needed. Check each quantity against what you counted.</p>}
          </section>}
          {quantity.trim() && Number.isFinite(amount) && amount >= 0 && <LotSplitEditor total={amount} unit={product.unit} lots={lots} shares={shares} context={mode ?? 'receive'} suggestedLotCode={mode === 'receive' ? todayId(cast).replace(/-/g, '') : undefined} onChange={(next) => { setShares(next); setSplitTouched(true); }} />}
          {mode === 'allocate' && !changedSplit && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Change a lot or quantity to save a new split.</span>}
          {error && <span role="alert">{error}</span>}

        </div>
      </WorkflowDialog>
    </section>
  );
}

/* ── THE CONVERSIONS SURFACE (FEED-IA §196.1) ────────────────────────────────────────────────
 * ⚠ SUPERSEDES the «Edit product» dialog. Identity — name, code, Unit — is now LIVE on the sheet
 * (`product-card.tsx`'s ProductIdentityFields), so the only thing left that is genuinely a
 * sub-object rather than a field is the conversion rule book (UNT-02.1). This dialog keeps that
 * one job, its Back-as-the-single-exit contract and its testid, and asks for nothing else.
 */
export function SKUDetailsEditor({
  cast,
  product,
  isOpen,
  onClose,
}: {
  cast: Cast;
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}) {
  useSKURecords();
  useUnits();
  return <WorkflowDialog isOpen={isOpen} onClose={onClose} showClose={false} onBack={onClose} title="Unit conversions" ariaLabel="Product unit conversions" step="Unit" testId="sku-details-dialog">
    <div data-testid="sku-details-units"><SKUUnits sector={cast.sector} product={product} compact /></div>
  </WorkflowDialog>;
}
