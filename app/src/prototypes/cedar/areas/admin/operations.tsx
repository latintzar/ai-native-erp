/* OPERACIONES — the way the house works (FEED-IA §53 · THE-ADMIN-CANON §2.1).
 *
 * «The way that the business works is probably operations… that has to do with their working
 * style.»
 *
 * ═══ WHAT SEPARATES THIS SEAT FROM «YOUR AGENT» ═════════════════════════════════════════════
 * THE-ADMIN-CANON §5's placement rule, and it is worth stating in full because the two seats look
 * alike and are about opposite things:
 *
 *   TU AGENTE     what ROCOTO may do without being asked. Autonomy. A dial.
 *   OPERACIONES   what the HOUSE does, full stop. A fact about the business, which Rocoto then
 *                 READS — it does not decide it, it obeys it.
 *
 * «Substitution» is the worked example. WHAT TO DO when a line cannot be served is a house rule —
 * a trade decision the gerente makes once — and the agent's job is to carry it out. So the rule
 * lives here, and the agent's LIMIT (how big an order it may answer alone) lives there, and the two
 * door into each other rather than both being half-owned in one list.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ OPERACIONES · one column, scrolling (§87) ──────────────────────────────────────────────┐
 *   │ HOURS       almacén · oficina · atención · ORDERS FOR TOMORROW (§132.1's cutoff, live)    │
 *   │ DELIVERY    the days the van goes out (the promise Rocoto keeps; ≥1 always on)            │
 *   │ PRICING     TARIFAS — the bands the house sells at, their names and their sizes           │
 *   │ CONFIRM     draft-then-confirm vs auto under conditions — the RULE. The agent's LIMIT is  │
 *   │             one door away, and the row says so                                            │
 *   │ SUBSTITUTE  agotado → send the nearest · ask · leave it off (the trade's own judgment)     │
 *   │ ERP         posture · cadence · invoice — three GrantRows, home 'operations'               │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingXSmall (a section) · LabelMedium (a row) · ParagraphXSmall (its line).
 *   STATES       rows read as sentences carrying their value; each value doors into its own card.
 *
 * ═══ WHY THE TARIFAS LANDED HERE (FEED-IA §75.4 · THE-OBJECT-MAP C3) ════════════════════════
 * «Maybe tariffs are a setting yeah — let them enable that they have tariffs for all, super easily
 * tweak them even on their phone, and set a global single tariff.»
 *
 * They stood on a SEAT of Stock, beside the catalogue, which claimed they were a peer of the goods.
 * They are not: the price a band pays for a thing is a subobject OF that thing and lives on its
 * sheet, and what is left at house level — three names and their sizes — is a working-style fact
 * exactly like the delivery days above it. `anchorFor('pricing')` has pointed at this seat since
 * §53, so the migration cost nothing but the row: every «from your setup» door and every tarifa
 * name said anywhere in the app already knew this address.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { GrantQuestion } from '../../capability';
/* §122's own control — a value that is its own field. The cutoff is authored, so it is live. */
import { LiveValue } from '../../live-value';
import { GrantRow, List, Row, Section } from '../../rows';
import { anchorId, useSetupTail } from '../../anchors';
import { ADMIN, type AreaMeta } from '../../shell/area';
import {
  operationsSettings, settingOf, useGrants, type GrantId,
} from '../../grants';
import {
  SUBSTITUTIONS, setCompany, useCompany, type Hours, type Substitution,
} from '../../company';
import { useConfig } from '../../config';
import { CustomerOrderSettings, confirmationPriceMode } from '../../customer-order-policy';
import { useTiers } from '../../tiers';
/* THE HOUSE'S TARIFAS, HOSTED HERE (§75.4 · C3) — the registry component itself, lifted from the
   seat it used to stand on rather than redrawn as a settings-shaped copy of it. */
import { TarifasCard, tarifasLabel, tarifasValue } from '../../stock-tiers';
import { capabilityAvailable, PLANNED_CAPABILITY_HELP } from '../../release-profile';
import { useWorkspaceCapabilities } from '../../workspace-capabilities';

export const meta: AreaMeta = {
  id: 'operations',
  title: 'Operations',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

/** which hour a card is editing. Three of them, because they are three different promises. */
type HourKey = keyof Hours;

/* ── A SUB ONLY WHERE THE LABEL AND THE VALUE CANNOT SAY IT (§51.7, AUDIT-2 C20) ──────────────
 * «Oficina · 09:00–18:00 · When the office is at its desks.» is the surface reading its own row
 * back to the reader — the label is the place, the value is the hours, and the sentence under them
 * spends a line restating both. Same for «Almacén», where the word and the hours are the fact.
 *
 * ATENCIÓN KEEPS ITS LINE, and that is the test the other two failed: those hours are the ones the
 * AGENT speaks from, which is a consequence a person cannot read off «Atención · 08:00–20:00». The
 * sub is where a row says what a reader could not otherwise know.
 */
const HOUR_ROWS: Array<{ key: HourKey; label: string; sub?: string }> = [
  { key: 'warehouse', label: 'Almacén' },
  { key: 'office', label: 'Oficina' },
  { key: 'support', label: 'Atención', sub: 'The hours Rocoto gives a customer who asks.' },
];

/** THE HOUR THE ALMACÉN OPENS, read off the house's own «04:30 – 13:00» (§132.1). The cutoff's line
 *  is stated against the van it feeds, so it takes the real value rather than printing a literal
 *  that a house which loads at 03:00 would read as a lie. */
const loadHour = (warehouse: string): string => warehouse.split(/[–-]/)[0].trim() || warehouse;

export default function Operations() {
  const [, theme] = useStyletron();
  const company = useCompany();
  const grants = useGrants();
  const { config, derived } = useConfig();
  const [customerPolicy, setCustomerPolicy] = React.useState(false);
  const { pricing, inventory } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('pricing') && pricing;
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const supplierIntakeAvailable = capabilityAvailable('supplierIntake');
  const customerOutboundAvailable = capabilityAvailable('customerOutbound');
  const cast = derived.cast;
  /* the tarifa store is read through its hook, so a band renamed inside the card re-labels the row
     behind it in the same pass */
  useTiers();
  const settings = operationsSettings(grants);
  const [card, setCard] = React.useState<GrantId | null>(null);
  const [hourCard, setHourCard] = React.useState<HourKey | null>(null);
  const [subCard, setSubCard] = React.useState(false);
  const [tarifas, setTarifas] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const open = card ? settingOf(card) ?? null : null;
  const substitution = SUBSTITUTIONS.find((s) => s.value === company.substitution) ?? SUBSTITUTIONS[1];

  /* A DOOR FROM ANOTHER SURFACE ARRIVES WITH THE ANSWER IT WANTS (`anchors.tsx`'s migration map).
     Six of the ten setup answers re-seated here, so six «from your setup» links land on this seat
     and open the row they were asking about.
     `pricing` NOW HAS A ROW OF ITS OWN (§75.4 · C3). It used to fall in with the working-style
     group and open the ERP posture card, which is not what a person pressing a tarifa's name is
     asking for — every tarifa door in the app writes this tail, and it opens the tarifas. */
  const tail = useSetupTail('operations');
  React.useEffect(() => {
    if (tail === 'delivery') setCard('days');
    if (tail === 'pricing' && pricingAvailable) setTarifas(true);
    if (tail === 'customer-confirmations' && customerOutboundAvailable) setCustomerPolicy(true);
    if ((tail === 'weighing' || tail === 'goodsIn' || tail === 'stock' || tail === 'lots') && inventoryAvailable) {
      setCard('posture');
    }
  }, [tail, pricingAvailable, customerOutboundAvailable, inventoryAvailable]);

  React.useEffect(() => { if (hourCard) setDraft(company.hours[hourCard]); }, [hourCard, company.hours]);

  return (
    <div
      data-testid="seat-operations"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {/* ── HOURS ──────────────────────────────────────────────────────────────────────────
          Three, and the third is the one the agent has in its mouth: «atención» is what Rocoto may
          honestly say about when a person is here.

          ALL FOUR OF THE HOUSE'S HOURS STAND HERE NOW (FEED-IA §132.1). «Idk why you left it in
          business settings» — the atención row used to be MENTIONED a second time on the business
          card, as a door back to this one. A door is still a second place to look, and hours are
          not identity: Business holds who the house IS, Operations holds how it RUNS. The door is
          gone and this list is the whole answer.

          AND THE FOURTH HOUR IS THE ONE THE TRADE ACTUALLY ASKS ABOUT — the cutoff, below. */}
      <Section title="Your hours" testid="hours">
        <List testid="hours-rows">
          {HOUR_ROWS.map((h) => (
            <Row
              key={h.key}
              testid={`hours-${h.key}`}
              mark="clock"
              label={h.label}
              sub={h.sub}
              value={company.hours[h.key]}
              onOpen={() => setHourCard(h.key)}
            />
          ))}
          {/* ── THE ORDER CUTOFF (FEED-IA §132.1) ─────────────────────────────────────────
              «Every company has their own for when they accept orders for the following morning…
              for 6am delivering for the following morning it's 2hrs later at 8am.»

              IT IS STATED AGAINST THE HOUSE'S OWN RHYTHM, not in the abstract. The line under it
              reads the almacén's own opening hour out of the row three above it, so a house that
              loads at 04:30 is told what 18:00 means for THAT morning. A cutoff printed alone is a
              number; a cutoff printed against the van is a decision.

              IT IS LIVE (§122) — one press, a caret, Enter or blur writes. No card, no confirm:
              the value IS the field, which is what the whole of settings is moving to.

              THE ZONE STILL NARROWS IT. Geography's per-run `cutoff` is the promise a particular
              van makes; this is the house's answer to «¿hasta qué hora puedo pedir?», and the row
              below says where the per-run one lives — the same shape «Days by zone» already uses. */}
          <Row
            testid="order-cutoff"
            mark="clock"
            label="Orders for tomorrow"
            sub={`The van loads at ${loadHour(company.hours.warehouse)}. Later orders go out the morning after.`}
            token
            value={(
              <LiveValue
                value={company.orderCutoff}
                label="The hour you stop taking tomorrow’s orders"
                placeholder="18:00"
                width={96}
                testid="order-cutoff-value"
                onWrite={(orderCutoff) => setCompany({ orderCutoff: orderCutoff || company.orderCutoff })}
              />
            )}
          />
        </List>
      </Section>

      {/* ── THE DAYS THE VAN GOES OUT ──────────────────────────────────────────────────────
          It is a GRANT — `days`, home 'operations' — because it is one of the ten answers the
          contract already carries, and because Rocoto promises a delivery day off it. A zone can
          narrow it further on its own band (Geography), and the row says where that lives. */}
      <Section title="When you go out" testid="delivery">
        <List testid="delivery-rows">
          {settings.filter((q) => q.id === 'days').map((q) => (
            <GrantRow key={q.id} q={q} onOpen={() => setCard(q.id)} />
          ))}
          <Row
            id={anchorId('delivery')}
            testid="zones-door"
            mark="map"
            label="Days by zone"
            sub="Set in Geography, on each zone’s own band."
            value={`${company.zones.length} zones`}
            onOpen={() => { window.location.hash = `#/${ADMIN}/geography`; }}
          />
        </List>
      </Section>

      <Section title="Capabilities" testid="order-review-capabilities">
        <List testid="order-review-capability-rows">
          <Row
            id={anchorId('pricing')}
            testid="tarifas"
            mark="price"
            label="Pricing and tariffs"
            sub={pricingAvailable ? 'Set the price structure your team uses.' : 'Pricing is off for this workspace.'}
            value={pricingAvailable ? tarifasValue(cast) : 'Off'}
            onOpen={pricingAvailable ? () => setTarifas(true) : undefined}
          />
          <Row
            testid="inventory-capability"
            mark="crate"
            label="Inventory and lots"
            sub={inventoryAvailable ? 'Track receipts, counts and lot allocation.' : PLANNED_CAPABILITY_HELP}
            value={inventoryAvailable ? 'Available' : 'Planned'}
          />
          <Row
            testid="supplier-intake-capability"
            mark="email"
            label="Supplier intake"
            sub={supplierIntakeAvailable ? 'Review incoming supplier messages here.' : PLANNED_CAPABILITY_HELP}
            value={supplierIntakeAvailable ? 'Available' : 'Planned'}
          />
          <Row
            testid="customer-outbound-capability"
            mark="chat"
            label="Customer outbound"
            sub={customerOutboundAvailable ? 'Set confirmations and product options.' : PLANNED_CAPABILITY_HELP}
            value={customerOutboundAvailable ? confirmationPriceMode(config, grants) === 'off' ? 'For your team to confirm' : confirmationPriceMode(config, grants) === 'with-prices' ? 'Confirm with prices' : 'Confirm quantities only' : 'Planned'}
            wrapValue
            onOpen={customerOutboundAvailable ? () => setCustomerPolicy(true) : undefined}
          />
        </List>
      </Section>
      {customerOutboundAvailable && <CustomerOrderSettings open={customerPolicy} onClose={() => setCustomerPolicy(false)} onOpen={() => setCustomerPolicy(true)} />}

      {/* ── THE CALLS THE HOUSE MAKES ──────────────────────────────────────────────────────
          The substitution rule is the trade's most common judgment call, and it is the house's to
          make. Rocoto reads it — which is why the row's own line says so, and why the agent's
          limit is a door rather than a second control. */}
      <Section title="The calls you make once" testid="calls">
        <List testid="calls-rows">
          <Row
            testid="substitution"
            mark="catalogue"
            label="What goes out instead"
            sub={substitution.hint}
            value={substitution.label}
            wrapValue
            onOpen={() => setSubCard(true)}
          />
          <Row
            testid="agent-limit-door"
            mark="ceiling"
            label="How much Rocoto answers alone"
            value="Your agent"
            onOpen={() => { window.location.hash = `#/${ADMIN}/agent`; }}
          />
        </List>
      </Section>

      {/* ── YOUR ERP ───────────────────────────────────────────────────────────────────────
          Three GrantRows, all home 'operations': who makes the albarán, when the data travels, and
          when the invoice exists. Read them and you know the house's back office. The rail itself —
          WHICH system, and whether it is plugged in — is a CONNECTION, and lives one seat away. */}
      <Section title="Your back office" testid="erp">
        <List testid="erp-rows">
          {settings.filter((q) => q.id !== 'days').map((q) => (
            <GrantRow key={q.id} q={q} onOpen={() => setCard(q.id)} />
          ))}
          <Row
            testid="erp-rail-door"
            mark="connect"
            connect
            label="Which system it reaches"
            value="Connections"
            onOpen={() => { window.location.hash = `#/${ADMIN}/connections`; }}
          />
        </List>
      </Section>

      {/* ONE DIAL, RE-ANSWERED — the identical component the questionnaire walks */}
      <OverlayCard
        isOpen={open !== null}
        onClose={() => setCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="How the house runs"
      >
        {open ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <GrantQuestion q={open} />
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="grant-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      {/* THE TARIFAS' OWN DRILL-IN. The registry, its names and its sizes, in the card the rest of
          this seat's answers open into — one layer grammar, no second screen. */}
      <OverlayCard
        isOpen={tarifas}
        onClose={() => setTarifas(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Tarifas"
      >
        {tarifas && pricingAvailable ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <TarifasCard cast={cast} />
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setTarifas(false)} data-testid="tarifas-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      <OverlayCard
        isOpen={hourCard !== null}
        onClose={() => setHourCard(null)}
        scrim={SCRIM.dim}
        size={480}
        ariaLabel="Your hours"
      >
        {hourCard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
              {HOUR_ROWS.find((h) => h.key === hourCard)?.label}
            </h2>
            <Input
              value={draft}
              onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
              placeholder="04:30 – 13:00"
              aria-label="Hours"
              overrides={{ Input: { props: { 'data-testid': 'hours-input' } } }}
            />
            <div>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="hours-save"
                onClick={() => {
                  setCompany({ hours: { ...company.hours, [hourCard]: draft.trim() || company.hours[hourCard] } });
                  setHourCard(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      <OverlayCard
        isOpen={subCard}
        onClose={() => setSubCard(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="What goes out instead"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>What goes out instead</h2>
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
            Your call, made once. Rocoto carries it out on every order it touches.
          </p>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            {SUBSTITUTIONS.map((s) => (
              <span key={s.value} data-selected={s.value === company.substitution ? 'yes' : 'no'}>
                <Button
                  kind={s.value === company.substitution ? KIND.primary : KIND.secondary}
                  shape={SHAPE.pill}
                  size={SIZE.compact}
                  data-testid={`substitution-${s.value}`}
                  onClick={() => setCompany({ substitution: s.value as Substitution })}
                >
                  {s.label}
                </Button>
              </span>
            ))}
          </div>
          <p data-testid="substitution-says" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, maxWidth: '58ch' }}>
            {substitution.hint}
          </p>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setSubCard(false)} data-testid="substitution-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* ── THE FOOT IS GONE, AND ITS FACT NEVER LEFT (AUDIT-2 C31 · §3 · §5) ─────────────────
          It read «The house serves monday to saturday.» — a lone sentence four hundred pixels
          under the `days` row that already prints «Days you serve · Monday to Saturday», and it
          spelled the same days a second way on the way past. A helper that repeats what the
          surface shows is the helper the canon deletes, and one that repeats it in different
          casing makes a reader check whether they are two different facts. */}
    </div>
  );
}
