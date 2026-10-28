/* TU NEGOCIO — THE COMPANY'S OWN CARD (FEED-IA §53 · THE-ADMIN-CANON §1, §2.1, §3).
 *
 * «Your business is a SUPER important card… the name of your business, all your CIF, all the fiscal
 * stuff. Although we don't handle fiscal things, we do want the main info to be there: the main
 * address, PUT THEM ON THE MAP» — the same way customers have a map.
 *
 * ═══ THE FIVE CLAUSES, ON ONE SURFACE (§53's style, THE-ADMIN-CANON §1) ═════════════════════
 * «Each thing having a card · how that thing is summarized into its parts · how that thing is
 * connected to other parts · made within those parts · actions you can take, which are connected
 * across different surfaces.» This seat is the worked example of all five:
 *
 *   A CARD                the identity block at the head — the house's face, its legal name, its
 *                         CIF, and its almacén on a real map.
 *   SUMMARIZED INTO ITS   the PARTS strip: the headcount, the zones covered, the rails alive, what
 *   PARTS                 the agent handles. Every figure COUNTED off the same stores the seats
 *                         that own them draw from, so no two surfaces can disagree.
 *   CONNECTED TO OTHER    every one of those four figures is a DOOR into the seat it summarizes,
 *   PARTS                 and those seats door back here.
 *   MADE WITHIN           every field is edited on the card itself, in place (§31.3's immersion
 *   THOSE PARTS           edit), never on a separate «edit business» screen.
 *   ACTIONS ACROSS        an address changed here moves the pin; the payment terms set here are
 *   SURFACES              what the agent answers «¿cómo os pago?» with.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 *
 *   ┌─ TU NEGOCIO · one column, scrolling (§87) ───────────────────────────────────────────────┐
 *   │ BAR      the seat's name, in the day bar — the frame draws it (§36.1)                     │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ CARD     [LOGO 48]  Nombre comercial            HeadingSmall     ┌──────────┐             │
 *   │                     Razón social · CIF          Fact ×2          │ WHERE 72 │ ← the pin   │
 *   │                     (label over figure, LabelXSmall / LabelMedium)└──────────┘            │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ PARTS    Team · Zones · Connections · What Rocoto handles     — four Facts, four DOORS    │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ SECTION  Identidad fiscal      razón social · CIF · registro mercantil                    │
 *   │ SECTION  Direcciones           domicilio fiscal · almacén (1…n) · the map                 │
 *   │ SECTION  Cobro                 IBAN · condiciones de pago por defecto                     │
 *   │ SECTION  Contacto público      teléfono · WhatsApp · email  (hours are Operations', §132.1) │
 *   │ SECTION  Tu firma              the albarán sign-off line · sector · the house's own name   │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingSmall (the house's name) · HeadingXSmall (a section) · LabelMedium (a row's
 *                label and a fact's figure) · LabelXSmall (a fact's label) · ParagraphXSmall (the
 *                one line under a row). Five steps, and the seat types no sixth.
 *   STATES       every value is `Editable` — underline at rest, ring under the pointer, box when
 *                open (§51.14, the one grammar, lifted from `detail.tsx`). A field with nothing in
 *                it yet draws QUIET and HOLDS ITS CELL: a fact that vanishes when it is empty moves
 *                the two beside it, which is the «you don't even have the same thing» §51.24 names.
 *   NO NEGATIVES anywhere. An empty field says what it wants («Add the address»), never what it
 *                lacks.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { CASTS, SECTORS } from '../../../../scenarios/data/cast';
import { useConfig } from '../../config';
import { useGrants, liveQuestions } from '../../grants';
import PinMap, { MAP_CREDIT } from '../../pin-map';
import { Editable, Fact, Facts, List, Row, Section } from '../../rows';
import { anchorId, openCompany, useSetupTail } from '../../anchors';
import { ADMIN, type AreaMeta } from '../../shell/area';
import { usePhone } from '../../shell/viewport';
import {
  PAYMENT_TERMS, mainNumber, useCompany, setCompany, type Company, type PaymentTerms,
} from '../../company';

export const meta: AreaMeta = {
  id: 'business',
  title: 'Your business',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

/* ── WHERE THE HOUSE IS, AS A SMALL SQUARE (FEED-IA §39.1, §25.4) ─────────────────────────────
 * «The LOCATION becomes a small square top-right — clicking it opens the big map in a modal.»
 *
 * IT IS THE CUSTOMER SHEET'S OWN SQUARE, TO THE PIXEL, and that is the whole point of drawing it
 * here rather than inventing one: `detail.tsx` settled this control, `areas/customers.tsx` took it
 * unchanged as the second caller, and the house is the FOURTH. 72px, captionless, a hover label
 * carrying the place and OpenStreetMap's credit, and the full map on the app's own Overlay Card at
 * 320. «PUT THEM ON THE MAP, the same way customers have a map» is a claim about the CODE.
 *
 * WHERE THE CREDIT GOES. A 72px square has no line to put ODbL's attribution on, so the credit
 * rides the control's own hover label and the full-size map carries it in the ordinary way — which
 * is `pin-map.tsx`'s own stated answer, not a decision taken again here.
 */
const MAP_SQUARE = 72;

export function WhereSquare({
  at,
  name,
  note,
}: {
  at: { lat: number; lng: number };
  /** what the place is called, for the hover label and the modal's heading */
  name: string;
  /** the one line under the big map */
  note: string;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* AND ITS CREDIT IS `MAP_CREDIT` (AUDIT-2 C31). Same stale literal as the truck chip's: the
          tile provider joined the attribution and this copy of it never heard. */}
      <StatefulTooltip content={`${name} · ${MAP_CREDIT}`} placement={TOOLTIP_PLACEMENT.left} showArrow>
        <button
          type="button"
          data-testid="map-square"
          aria-label={`${name} · open the map`}
          onClick={() => setOpen(true)}
          style={{
            flex: '0 0 auto',
            width: MAP_SQUARE,
            height: MAP_SQUARE,
            padding: 0,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundSecondary,
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'block',
          }}
        >
          <PinMap at={at} height={MAP_SQUARE} caption={false} pin={20} />
        </button>
      </StatefulTooltip>

      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        scrim={SCRIM.dim}
        size={560}
        ariaLabel={`Where ${name} is`}
      >
        <div
          data-testid="where-modal"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{name}</h2>
          <PinMap at={at} note={note} height={320} />
        </div>
      </OverlayCard>
    </>
  );
}

/* ── A VALUE ON THE CARD ──────────────────────────────────────────────────────────────────────
 * The ONE editable grammar (§51.14), lifted from `detail.tsx` and given a small card to type into.
 * A field is a BUTTON at rest — underlined, the app's mark for «this is yours to change» — and a
 * press opens the card that holds the input. It is deliberately not an always-live `<input>`: a
 * page of thirty live text boxes is a form, and §53 asked for a CARD.
 *
 * ═══ IT IS EXPORTED, FOR ONE CALLER AND ONE REASON (THE CHECKPOINT §4 · MAP 2.4) ═════════════
 * The PLAN seat's «Paying for it» carries the billing address, because a person thinking about an
 * invoice is standing there and not on the company card. Two editable values over one field is
 * fine; two EDITORS over one field is where the two seats start disagreeing about what «open» and
 * «save» mean. So Plan imports this one — the liftout law, applied inside the administration.
 */
export function Value({
  value,
  label,
  placeholder,
  onSave,
  testid,
  multiline = false,
  token = false,
}: {
  value: string;
  /** what the field is, said as a noun — the accessible name and the card's heading */
  label: string;
  /** what the field wants when it is empty. AFFIRMATIVE: «Add the address», never «no address». */
  placeholder: string;
  onSave: (v: string) => void;
  testid: string;
  multiline?: boolean;
  /** ONE IDENTIFIER, NEVER BROKEN (§77.2, AUDIT-2 C21). See `Row`'s own `token`. */
  token?: boolean;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value, open]);
  const empty = !value.trim();

  return (
    <>
      <Editable label={label} open={open} onOpen={() => setOpen(true)} testid={testid}>
        <span
          data-empty={empty ? 'yes' : 'no'}
          style={{
            color: empty ? theme.colors.contentTertiary : 'inherit',
            /* A ZERO-FACT HOLDS ITS CELL (§51.24). It goes quiet; it never disappears, because a
               cell that comes and goes moves the two beside it.
               AND IT NEVER ELLIPSISES. The first build clipped the razón social to «Peix Vilalta, .»
               and the IBAN to «ES91 2100 0418 4502 0005 1.» — a fiscal identity a person cannot read
               is not an identity, it is a rumour. The value wraps; the row it sits in says so with
               `wrapValue`.
               AND IT WRAPS AT ITS OWN SPACES (§77.2). `anywhere` let a narrow cell break INSIDE a
               word — «Peix / Vilal / ta, / S.L.» on the company card at 390 — which reads as badly
               as the clip it was put there to avoid. `break-word` keeps the same guarantee against
               overflow and spends the line breaks on the spaces first, so a name comes apart into
               its own words or not at all. */
            /* AND A FISCAL TOKEN DOES NEITHER (C21). The wrap above is right for an address and
               wrong for a CIF: «B-65 428 / 901» is a number nobody can read back. The row it sits
               in has already given it the room (`token`), so here it simply refuses to break. */
            whiteSpace: token ? 'nowrap' : 'normal',
            overflowWrap: token ? 'normal' : 'break-word',
            maxWidth: '100%',
            display: 'block',
          }}
        >
          {value || placeholder}
        </span>
      </Editable>

      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel={label}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{label}</h2>
          <Input
            value={draft}
            onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
            placeholder={placeholder}
            aria-label={label}
            overrides={{ Input: { props: { 'data-testid': `${testid}-input` } } }}
          />
          <div>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              onClick={() => { onSave(draft.trim()); setOpen(false); }}
              data-testid={`${testid}-save`}
            >
              Save
            </Button>
          </div>
        </div>
      </OverlayCard>
    </>
  );
}

/* ── THE IDENTITY STRIP, AND WHY IT IS NOT THE RAILS' ───────────────────────────────────────
 * `Facts` is the PRINT RAILS' grid: three seats of one width, because column 1 of every rail has
 * to start at one x (§51.11). Its cells hold NUMBERS. This card's cells hold a razón social and a
 * CIF, and at 390 the card also carries a 48px monogram and a 72px map — so three equal seats left
 * about fifty pixels each and the values came apart one word, then one SYLLABLE, per line:
 * «Peix / Vilal / ta, / S.L.» over «B- / 65 / 428 / 901». A fiscal identity read down a ladder of
 * fragments is the same failure as the one `Value` already forbids at the other end (clipping it
 * to «Peix Vilalta, .»): both hand back something that is not the number.
 *
 * SO THE PHONE GETS ONE SEAT PER FACT, FULL MEASURE (§77.2 — deliberate, never random). Each value
 * gets the card's whole remaining width, which is more than any of these facts needs, and the desk
 * keeps the three-across reading it was drawn for. Nothing here ellipsises and nothing shatters:
 * the measure is what makes both true.
 */
function IdentityFacts({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  return (
    <div
      data-facts={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
        gap: phone ? theme.sizing.scale400 : theme.sizing.scale600,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** A LABELLED FACT WHOSE FIGURE IS EDITABLE — the `Fact` atom's anatomy (label over figure) with
 *  the figure standing in the editable grammar. It is what makes the identity block a CARD and not
 *  a form: the facts read as facts and each one is still one press from being changed. */
function EditableFact({
  label,
  value,
  placeholder,
  onSave,
  testid,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-fact={testid}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
        <Value value={value} label={label} placeholder={placeholder} onSave={onSave} testid={testid} />
      </span>
    </span>
  );
}

/* ── THE PARTS (§53's clause two, and clause three in the same object) ────────────────────────
 * Four figures, each COUNTED and each a DOOR. It is the row that makes this a company CARD rather
 * than a company FORM: a card summarizes the thing into its parts, and a summary you can press is
 * the same object as the connection to the part it summarizes.
 */
function Parts({ company, handles, total }: { company: Company; handles: number; total: number }) {
  const [, theme] = useStyletron();

  const go = (seat: string) => () => { window.location.hash = `#/${ADMIN}/${seat}`; };

  const part = (seat: string, label: string, value: string) => (
    <button
      type="button"
      data-testid={`part-${seat}`}
      data-part={seat}
      onClick={go(seat)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.sizing.scale100,
        padding: theme.sizing.scale500,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      <span style={{ ...theme.typography.HeadingXSmall, lineHeight: 1.1 }}>{value}</span>
    </button>
  );

  return (
    <div
      data-testid="business-parts"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: theme.sizing.scale400,
        minWidth: 0,
      }}
    >
      {part('team', 'People', String(company.members.length))}
      {part('geography', 'Zones covered', String(company.zones.length))}
      {part('connections', 'Rails in and out', String(2 + company.warehouses.length))}
      {/* THE FIGURE SAYS WHAT IT COUNTS (the walk, P2-8). «Rocoto does alone · 2 of 9» is a
          fraction of something a reader has to go and find; the label names the denominator. */}
      {part('agent', 'Settings Rocoto acts on alone', `${handles} of ${total}`)}
    </div>
  );
}

/** THE REGISTRY ENTRY, AS ONE SENTENCE. A fact that is written a particular way in Spain gets
 *  written that way — «tomo · folio · hoja · inscripción» — and a part nobody has filled in yet
 *  simply does not appear, rather than leaving a label with nothing after it. */
function registryWords(c: Company): string {
  const parts: string[] = [];
  if (c.registry.volume) parts.push(`Tomo ${c.registry.volume}`);
  if (c.registry.folio) parts.push(`folio ${c.registry.folio}`);
  if (c.registry.sheet) parts.push(`hoja ${c.registry.sheet}`);
  if (c.registry.entry) parts.push(`inscripción ${c.registry.entry}`);
  return parts.length ? parts.join(' · ') : 'Add the registry entry';
}

/* ── THE SEAT ─────────────────────────────────────────────────────────────────────────────── */

export default function Business() {
  const [, theme] = useStyletron();
  const company = useCompany();
  const { config, derived, set } = useConfig();
  const grants = useGrants();
  const cast = derived.cast;
  const house = company.warehouses[0];

  /** how many of the live grants say Rocoto acts on its own — the figure the card's fourth part
   *  carries, read off the SAME list the agent seat renders, so the two can never disagree */
  const dials = liveQuestions(grants).length;
  const handles = liveQuestions(grants).filter((q) => q.rocoto(grants)).length;

  const terms = PAYMENT_TERMS.find((t) => t.value === company.terms) ?? PAYMENT_TERMS[1];
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [registryOpen, setRegistryOpen] = React.useState(false);
  const [sectorOpen, setSectorOpen] = React.useState(false);

  /* A DOOR FROM ANOTHER SURFACE ARRIVES WITH THE ANSWER IT WANTS (`anchors.tsx`'s migration map):
     «from your setup» beside a derived catalogue decision lands here and opens the sector. */
  const tail = useSetupTail('business');
  React.useEffect(() => { if (tail === 'sector') setSectorOpen(true); }, [tail]);

  return (
    <div
      data-testid="seat-business"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {/* ── THE CARD ────────────────────────────────────────────────────────────────────────
          The house's face, its two identities and its place, in one block. §53's Stripe lesson,
          literally: the LEGAL identity and the TRADE-FACING one are two facts of one card, and
          the map sits beside them because where a house IS belongs with who it is. */}
      <section
        data-testid="business-card"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.sizing.scale700,
          padding: theme.sizing.scale700,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius400,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        {/* ── THE HOUSE'S OWN FACE, AND NOT OURS ─────────────────────────────────────────────
            The first build put Rocoto's own mark in this tile, which is the exact failure the
            liftout law is about: a logo slot filled with the WRONG COMPANY'S logo says the tenant is
            us. §53's field list has a real `Logo` field and the demo house has no asset for it — so
            the tile draws the house's own MONOGRAM, which is honest at the size of a logo and is
            what every tool does before a real one is uploaded. The day the field takes a file, this
            is where it lands. */}
        <span
          data-testid="business-logo"
          data-monogram={config.brand.name.trim().slice(0, 1).toUpperCase()}
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            boxSizing: 'border-box',
            width: 48,
            height: 48,
            flex: '0 0 auto',
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
            ...theme.typography.HeadingSmall,
          }}
        >
          {config.brand.name.trim().slice(0, 1).toUpperCase()}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingSmall, minWidth: 0 }}>
            <Value
              value={config.brand.name}
              label="The name you trade under"
              placeholder="Business name"
              testid="brand-name"
              onSave={(v) => set({ brand: { ...config.brand, name: v || config.brand.name } })}
            />
          </h2>
          <IdentityFacts testid="business-identity">
            <EditableFact
              label="Razón social"
              value={company.legalName}
              placeholder="Add it"
              testid="legal-name"
              onSave={(legalName) => setCompany({ legalName })}
            />
            <EditableFact
              label="CIF"
              value={company.taxId}
              placeholder="Add it"
              testid="tax-id"
              onSave={(taxId) => setCompany({ taxId })}
            />
            {/* AND THE SECTOR IS LIVE TOO (§122). It stood between two `EditableFact`s as the
                one bare `Fact` on the card — same anatomy, same step, and nothing happened when
                it was pressed, which is the worst kind of dead value: one wearing the clothes of a
                live one. It opens the card the row further down already opens, so there is ONE
                editor for the trade and not two. */}
            {/* ── AND IT STILL CARRIES THE FACT'S OWN ATTRIBUTES (drive-polish P2-1) ────────
                `Fact` stamps `data-label` and `data-value` on its cell, and P2-1 reads the trade
                word off `data-value` — «the sector reads in the trade's own word, never the raw
                enum». Hand-building this cell to make it live (§122) kept the `data-fact` hook and
                DROPPED the other two, so the assertion started reading «» and went red against a
                surface that was drawing correctly. The value is the cell's, not the control's:
                a drive asking what a cell SAYS must not have to know what is inside it. */}
            <span
              data-fact="sector-fact"
              data-label="Sector"
              /* THE CELL STATES ITS OWN VALUE (§122's read-back rule). The words moved inside
                 `Editable` when the sector went live and the attribute did not follow, so the
                 gate that holds this card to the TRADE'S OWN WORD — «Fish», never `fish` — was
                 reading an empty string and failing on an absence rather than on a defect. What a
                 drive reads and what the eye reads are the same string again. */
              data-value={config.sector.map((s) => CASTS[s].trade).join(' · ')}
              style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
            >
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Sector</span>
              <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
                <Editable
                  label="What this house trades in"
                  open={sectorOpen}
                  onOpen={() => setSectorOpen(true)}
                  testid="sector-fact-value"
                >
                  {config.sector.map((s) => CASTS[s].trade).join(' · ')}
                </Editable>
              </span>
            </span>
          </IdentityFacts>
        </div>

        {/* THE PIN (§53: «PUT THEM ON THE MAP»). Real tiles, grayscale, ink pin, honest credit —
            the customer's own control, fourth caller. */}
        {house?.at && (
          <WhereSquare at={house.at} name={house.name} note={house.address} />
        )}
      </section>

      <Parts company={company} handles={handles} total={dials} />

      {/* ── IDENTIDAD FISCAL ────────────────────────────────────────────────────────────────
          «Some legal stuff, their registration number» (§53). VeriFactu 2027 makes fiscal identity
          the data other systems consume, which is why the registry's four are held now rather than
          asked for on the day a footer needs them. */}
      {/* ── THE ROWS DROPPED THEIR SENTENCES (§51.7 · §58.2 · §75.8, AUDIT-2 C20) ─────────────
          Every row in this world carried a period-terminated line under its label — «On every
          albarán and every factura.» · «Your fiscal number, on your documents and Rocoto's
          invoices.» · «Tomo, folio, hoja and inscripción — the whole entry.» (printed directly
          beside a value spelling out those same four words) · «The address your documents carry.»
          · «Where the goods are, and the pin the map draws.» (two ideas, the second narrating the
          thumbnail beside it) · «The account your customers pay into.» · «Where your customers
          write, and where Rocoto writes back.» — a page of thirty rows with thirty explanations
          under them, which is the wall §75.8 names and the prose §51.7 says no part of this app
          should have.

          A ROW IS A LABEL, A VALUE AND A MARK. «Razón social · Peix Vilalta, S.L.» is complete;
          «IBAN de cobro · ES91 …» is complete. WHAT SURVIVES is the handful of lines that say
          something the three cannot: where a setting actually lives («Set in Operations, with the
          rest of your hours»), and what ROCOTO does with a value the reader would otherwise take
          for a passive field («What Rocoto answers when a customer asks how to pay you»). */}
      <Section title="Fiscal identity" testid="fiscal">
        <List testid="fiscal-rows">
          <Row
            testid="legal"
            mark="doc"
            label="Razón social"
            token
            value={<Value token value={company.legalName} label="Razón social" placeholder="Add it" testid="legal-row" onSave={(legalName) => setCompany({ legalName })} />}
          />
          <Row
            testid="cif"
            mark="brand"
            label="CIF"
            token
            value={<Value token value={company.taxId} label="CIF" placeholder="Add it" testid="cif-row" onSave={(taxId) => setCompany({ taxId })} />}
          />
          {/* ── ONE FACT WITH FOUR PARTS, AND THE SCREENSHOT THAT SETTLED IT ────────────────────
              The first build put four editable values side by side in the trailing column, and the
              fourth — the inscripción — fell off the end of the row. A registry entry is ONE fact
              («tomo 44.207, folio 112, hoja B-451.883, inscripción 1ª»); its four parts are how it
              is written, not four settings. So the row states the whole entry and the CARD holds
              the four fields, which is what a card is for. */}
          <Row
            testid="registry"
            mark="file"
            label="Registro mercantil"
            wrapValue
            value={registryWords(company)}
            onOpen={() => setRegistryOpen(true)}
          />
        </List>
      </Section>

      {/* ── DIRECCIONES ─────────────────────────────────────────────────────────────────────
          TWO FIELDS, MODELLED APART. The fiscal domicile goes on documents; the almacén drives the
          logistics and the pin. Conflating them is the classic error, and a house whose invoices go
          to an office and whose crates leave a market pavilion is the ordinary case, not the edge. */}
      <Section title="Addresses" testid="addresses">
        <List testid="address-rows">
          <Row
            testid="fiscal-address"
            mark="sign"
            label="Domicilio fiscal"
            wrapValue
            value={<Value value={company.fiscalAddress} label="Domicilio fiscal" placeholder="Add the address" testid="fiscal-address-value" multiline onSave={(fiscalAddress) => setCompany({ fiscalAddress })} />}
          />
          {/* ── WHERE ROCOTO'S OWN INVOICE GOES (THE CHECKPOINT §2 · §4 · MAP 2.4) ─────────────
              «Businesses need: legal/business name; CIF; address; BILLING ADDRESS.» It is a third
              address and not a reading of the first two: a group whose accounts are done at head
              office bills there, takes delivery at a market pavilion, and is registered at neither.
              It SEEDS from the domicile, because a house that has never said otherwise is billed
              where its paperwork is — which is the pointless field §3 sends this canon after.

              THE PLAN SEAT DRAWS THE SAME VALUE THROUGH THE SAME EDITOR (`Value`, exported for it).
              One field, one store, two places a person can be standing when they think of it —
              never two truths, which is what a second editor would become. */}
          <Row
            testid="billing-address"
            mark="plan"
            label="Dirección de facturación"
            sub="Where Rocoto’s own invoices are made out to."
            wrapValue
            value={<Value value={company.billingAddress} label="Dirección de facturación" placeholder="Add the address" testid="billing-address-value" multiline onSave={(billingAddress) => setCompany({ billingAddress })} />}
          />
          {company.warehouses.map((w, i) => (
            <Row
              key={w.id}
              testid={`warehouse-${w.id}`}
              mark="crate"
              label={i === 0 ? 'Almacén' : `Almacén · ${w.name}`}
              wrapValue
              value={<Value value={w.address} label="Dirección de almacén" placeholder="Add the address" testid={`warehouse-${w.id}-value`} multiline onSave={(address) => setCompany({ warehouses: company.warehouses.map((x) => (x.id === w.id ? { ...x, address } : x)) })} />}
            />
          ))}
        </List>
      </Section>

      {/* ── COBRO ───────────────────────────────────────────────────────────────────────────
          The COLLECTION account — the house charging its restaurants. It is deliberately not the
          card that pays Rocoto: that one lives on the Plan seat, and holding both here would be
          two different money facts wearing one label. */}
      <Section title="Getting paid" testid="cobro">
        <List testid="cobro-rows">
          <Row
            testid="iban"
            mark="price"
            label="IBAN de cobro"
            token
            value={<Value token value={company.iban} label="IBAN de cobro" placeholder="Add the account" testid="iban-value" onSave={(iban) => setCompany({ iban })} />}
          />
          <Row
            testid="terms"
            mark="clock"
            label="Condiciones de pago"
            sub="Payment instructions shown to customers."
            value={terms.label}
            onOpen={() => setTermsOpen(true)}
          />
        </List>
      </Section>

      {/* ── CONTACTO PÚBLICO ────────────────────────────────────────────────────────────────
          What goes on documents and what the agent has in its mouth: three ways to reach the house,
          and nothing else.

          THE HOURS ROW IS GONE, AND THE DOOR WITH IT (FEED-IA §132.1). «Idk why you left it in
          business settings.» It stood here as a door — «Horario de atención · 06:00 – 20:00 · Set
          in Operations» — on the reasoning that a person thinking about the public face would think
          of the hours too. That reasoning makes every seat a copy of every other: a door is still a
          second place the fact is written, and a reader who finds it here has been told twice.

          THE LINE IS BUSINESS = IDENTITY, OPERATIONS = RHYTHM. Hours are rhythm, and Operations now
          holds all four of them — the three places and §132.1's own order cutoff, in one list. */}
      <Section title="Public contact" testid="contact">
        <List testid="contact-rows">
          {/* ── THE THREE OF THEM ARE TOKENS (FEED-IA §132.2) ─────────────────────────────
              Peter's screenshot came off this list: «+34 932 62 18» on one line, «40» on the
              next. All three rows were declared `wrapValue` — a clause — because a phone number
              is written with spaces in it and a clause is what has spaces in it. A phone is ONE
              fact; so is an email; so is a WhatsApp line. They are tokens, they take the room
              they need, and nothing breaks them. */}
          <Row
            testid="phone"
            mark="who"
            label="Teléfono"
            token
            value={<Value token value={company.phone} label="Teléfono" placeholder="Add the number" testid="phone-value" onSave={(phone) => setCompany({ phone })} />}
          />
          {/* THE HOUSE ANSWERS ON A LIST NOW (§22.5), and this row is the first of it — the one
              a person edits where the business card has room for one. The numbers and the people
              who hold them are Connections' own surface. */}
          <Row
            testid="whatsapp"
            mark="chat"
            label="WhatsApp"
            token
            value={(
              <Value
                token
                value={mainNumber(company)}
                label="WhatsApp"
                placeholder="Add the number"
                testid="whatsapp-value"
                onSave={(number) => setCompany((c) => ({
                  whatsapp: c.whatsapp.length
                    ? [{ ...c.whatsapp[0], number }, ...c.whatsapp.slice(1)]
                    : [{ number }],
                }))}
              />
            )}
          />
          <Row
            testid="email"
            mark="at"
            label="Email"
            token
            value={<Value token value={company.email} label="Email" placeholder="Add the address" testid="email-value" onSave={(email) => setCompany({ email })} />}
          />
        </List>
      </Section>

      {/* ── WHAT YOU SELL, AND HOW YOU SIGN ─────────────────────────────────────────────────
          The canon gives this seat «identity, sector, sign-off line», and the sector belongs with
          the identity rather than with the operations: it decides the catalogue the house draws
          from, the traceability the law asks of it, and the hour its morning opens — three facts
          about WHAT THIS HOUSE IS. The sign-off is the last line of the document that carries all
          three out of the door. */}
      <Section title="Your trade" testid="signature">
        <List testid="signature-rows">
          <Row
            id={anchorId('sector')}
            testid="sector"
            mark="crate"
            label="Sector"
            sub="Catalogue, trazabilidad, and the hour your morning opens."
            value={config.sector.map((s) => CASTS[s].trade).join(' · ')}
            wrapValue
            onOpen={() => setSectorOpen(true)}
          />
          <Row
            testid="brand-line"
            mark="sign"
            label="Delivery Note sign-off"
            sub="The line at the foot of every delivery note you print."
            wrapValue
            value={<Value value={config.brand.line} label="Delivery Note sign-off" placeholder="Write one" testid="brand-line-value" multiline onSave={(line) => set({ brand: { ...config.brand, line } })} />}
          />
        </List>
      </Section>

      <OverlayCard
        isOpen={registryOpen}
        onClose={() => setRegistryOpen(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Registro mercantil"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Registro mercantil</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: theme.sizing.scale400, minWidth: 0 }}>
            <EditableFact label="Tomo" value={company.registry.volume} placeholder="Add it" testid="reg-volume" onSave={(volume) => setCompany({ registry: { ...company.registry, volume } })} />
            <EditableFact label="Folio" value={company.registry.folio} placeholder="Add it" testid="reg-folio" onSave={(folio) => setCompany({ registry: { ...company.registry, folio } })} />
            <EditableFact label="Hoja" value={company.registry.sheet} placeholder="Add it" testid="reg-sheet" onSave={(sheet) => setCompany({ registry: { ...company.registry, sheet } })} />
            <EditableFact label="Inscripción" value={company.registry.entry} placeholder="Add it" testid="reg-entry" onSave={(entry) => setCompany({ registry: { ...company.registry, entry } })} />
          </div>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setRegistryOpen(false)} data-testid="registry-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* ── WHAT THE HOUSE SELLS ───────────────────────────────────────────────────────────────
          The identical card Settings kept, moved with its row: the sectors as pills, and — for a
          house that sells more than one — which of them the app DRAWS with. Both are one decision
          seen twice, so they share a card; a house that sells one thing answers it once. */}
      <OverlayCard
        isOpen={sectorOpen}
        onClose={() => setSectorOpen(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="What you sell"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <div>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>What you sell</h2>
            <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
              Catalogue, trazabilidad, and the hour your morning opens.
            </p>
          </div>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            {SECTORS.map((sec) => (
              <span key={sec} data-sector={sec} data-selected={config.sector.includes(sec) ? 'yes' : 'no'}>
                <Button
                  kind={config.sector.includes(sec) ? KIND.primary : KIND.secondary}
                  shape={SHAPE.pill}
                  size={SIZE.compact}
                  data-testid={`sector-${sec}`}
                  onClick={() => {
                    const on = config.sector.includes(sec);
                    const next = on ? config.sector.filter((x) => x !== sec) : [...config.sector, sec];
                    /* a house sells at least one thing, so the last one on stays on */
                    set({ sector: next.length ? next : config.sector });
                  }}
                >
                  {CASTS[sec].trade} · {CASTS[sec].hour}
                </Button>
              </span>
            ))}
          </div>
          {config.sector.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>Drawn with</span>
              {config.sector.map((sec) => (
                <span key={sec} data-cast={sec} data-selected={sec === config.cast ? 'yes' : 'no'}>
                  <Button
                    kind={sec === config.cast ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    data-testid={`cast-${sec}`}
                    onClick={() => set({ cast: sec })}
                  >
                    {CASTS[sec].trade}
                  </Button>
                </span>
              ))}
            </div>
          )}
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setSectorOpen(false)} data-testid="sector-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      <OverlayCard
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Condiciones de pago"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Condiciones de pago</h2>
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
            Payment instructions shown to customers.
          </p>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            {PAYMENT_TERMS.map((t) => (
              <span key={t.value} data-selected={t.value === company.terms ? 'yes' : 'no'}>
                <Button
                  kind={t.value === company.terms ? KIND.primary : KIND.secondary}
                  size={SIZE.compact}
                  data-testid={`terms-${t.value}`}
                  onClick={() => setCompany({ terms: t.value as PaymentTerms })}
                >
                  {t.label}
                </Button>
              </span>
            ))}
          </div>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setTermsOpen(false)} data-testid="terms-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* THE HOUSE IS AN OBJECT, AND AN OBJECT'S OWN SURFACE IS ITS ADDRESS (§43). Standing here
          IS standing on the company, so the seat registers nothing to land on — but the door is
          published from `anchors.tsx` and every other surface presses it. Reading `cast.hour` here
          keeps the fold honest: the morning this house opens on is the sector's, not a string. */}
      <p
        data-testid="business-foot"
        data-house-hour={cast.hour}
        style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
      >
        Your morning opens at {cast.hour}.
      </p>
    </div>
  );
}

/** published so a drive can press the company's door from another surface without importing the
 *  seat — the same shape every object's home keeps */
export { openCompany };
