/* «FROM YOUR SETUP» — the affordance that makes the config visible at its point of effect.
 *
 * THE-APP §"Derivation rules", last bullet: EVERY derived choice renders with a quiet «from your
 * setup» affordance that jumps to its Settings row. A default the person cannot trace is a
 * default they will experience as the software having an opinion of its own; a default with a
 * door back to the sentence that set it is a default they own.
 *
 * THE ANCHOR SCHEME, so the three area packages can link without importing Settings:
 *   · `anchorFor('pricing')` → `#/settings/pricing` — the route Settings reads
 *   · `anchorId('pricing')`  → the DOM id Settings puts on that row
 * Settings opens the named question on arrival and lights its row. Nothing else needs to know how
 * Settings is built.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { QuestionId } from './config';
import { ADMIN, type AdminSeatId } from './shell/area';
import { usePhoneFloor } from './shell/viewport';
export { useHistoryLayer, type LayerSnapshot } from './navigation';

/* ── WHERE AN ANSWER NOW LIVES (FEED-IA §53 · THE-ADMIN-CANON §2) ─────────────────────────────
 * The scheme is unchanged and its destination is not: Settings was ONE seat holding every answer,
 * and the answers are re-seated across the administration's nine. So the anchor map is the
 * migration table, in code — the same table THE-ADMIN-CANON §2 prints in prose — and a surface
 * that says «from your setup» keeps saying it without knowing anything moved.
 *
 * THE TAIL BELONGS TO THE SEAT, exactly as it belongs to an area on the desk: `#/admin/operations/
 * delivery` is the Operations seat, asked to open the delivery answer and light its row. A seat
 * reads its own tail with `useSetupTail` below and opens what it was asked for.
 */
const SEAT_OF: Record<QuestionId, AdminSeatId> = {
  /* what the house sells and the catalogue it draws from — the company's own identity */
  sector: 'business',
  /* how orders reach the house, and who checks one before it proceeds: the agent's business */
  capture: 'agent',
  gate: 'agent',
  /* the working style — how the house prices, weighs, receives, counts and delivers */
  pricing: 'operations',
  weighing: 'operations',
  goodsIn: 'operations',
  stock: 'operations',
  delivery: 'operations',
  lots: 'operations',
  /* the rail out of the house is a CONNECTION before it is a preference */
  erp: 'connections',
};

/** The route that opens the answer to one of the ten questions, wherever it now lives. */
export const anchorFor = (q: QuestionId): string => `#/${ADMIN}/${SEAT_OF[q]}/${q}`;

/** The DOM id the owning seat puts on that row, so a door can land the eye as well as the route. */
export const anchorId = (q: QuestionId): string => `setup-${q}`;

/** WHICH SEAT OWNS AN ANSWER — published so a seat can assert its own share of the table rather
 *  than restating it, and so the migration is checkable from outside. */
export const seatOf = (q: QuestionId): AdminSeatId => SEAT_OF[q];

/**
 * THE SETUP TAIL A SEAT WAS ASKED FOR, or nothing.
 *
 * A seat calls this and opens the named card on arrival. It is a hook rather than a read because
 * the hash can change while the seat is standing — pressing «from your setup» twice from two
 * different surfaces of the same seat has to open the second answer, not sit on the first.
 */
export function useSetupTail(seat: AdminSeatId): string {
  const read = React.useCallback(() => {
    const parts = window.location.hash.replace(/^#\/?/, '').split('/');
    return parts[0] === ADMIN && parts[1] === seat ? (parts[2] ?? '') : '';
  }, [seat]);
  const [tail, setTail] = React.useState(read);
  React.useEffect(() => {
    const on = () => setTail(read());
    on();
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [read]);
  return tail;
}

/* ═══ THE OBJECT DOORS (FEED-IA §43 — THE OBJECT LAW) ════════════════════════════════════════
 * «There's a relationship between orders, customers, and products. Those are objects. Clickable
 * across all… Every appearance of an object anywhere is a door to that object. No dead names.»
 *
 * A door has to work from a surface that is NOT the object's own — a customer's name on a band
 * card, a product's name on a line, an order reference in a thread — so it has two halves that
 * cannot be one: it changes the ROUTE, and then it walks the ARRIVING area to the object. The
 * arriving area is by definition not mounted when the hash lands, so the walk has to be knocked
 * for rather than called.
 *
 * THE SCHEME LIVES HERE for the same reason the Settings anchors do: so no area package ever has
 * to import another one. `#/customers/<id>` is the customer's own address, «the tail belongs to
 * the area» (App.tsx), and the area registers its own landing while it is standing — a call that
 * arrives with the area off screen does nothing at all rather than reaching into a component that
 * is not there.
 *
 * THE AREAS ARE THE OBJECTS' HOMES, one each, and that is the whole map:
 *   the ORDER lives in Sales · the CUSTOMER in Customers · the PRODUCT in Stock ·
 *   the COMPANY in Administration's own card · the USER in Team.
 *
 * ═══ AND THERE ARE FIVE OBJECTS NOW (FEED-IA §53 — THE COMPANY OBJECT) ══════════════════════
 * «Another MAIN object is our company, meaning our customers' company; its sub-objects are THEIR
 * USERS.» Nothing about the scheme changes to hold them — a home, an address, a landing, a door —
 * which is the test that the scheme was the right shape: an object joins the app by joining this
 * map, and §53's five style clauses (a card · summarized into its parts · connected to other parts
 * · made within those parts · actions connected across surfaces) are exactly what the other three
 * already had.
 *
 * A HOME MAY BE TWO SEGMENTS DEEP. The administration is a world, so the company's home is
 * `admin/business` and a user's is `admin/team`. Everything below reads the home as a PREFIX
 * rather than as the first segment, which is the only change the second world cost this file.
 */

export type ObjectKind = 'order' | 'customer' | 'product' | 'company' | 'user';

/** Where each object lives — its area's route, which is also its file name (`App.tsx`). */
export const HOME_OF: Record<ObjectKind, string> = {
  order: 'sales',
  customer: 'customers',
  product: 'stock',
  company: 'admin/business',
  user: 'admin/team',
};

/** The object's own address. One function, so a door and a deep link can never disagree.
 *
 *  THE COMPANY HAS NO ID BECAUSE THERE IS ONE OF IT. Its address is its seat, and an invented
 *  `#/admin/business/house` would be a tail that says nothing — the seat IS the card. Every other
 *  object takes its id, and passing an empty one is how the singular case says so. */
export const addressOf = (kind: ObjectKind, id: string): string =>
  id ? `#/${HOME_OF[kind]}/${id}` : `#/${HOME_OF[kind]}`;

/** The walk each area publishes while it is standing. A registration, never a global. */
const LANDINGS = new Map<ObjectKind, (id: string) => void>();

/** WHAT A DOOR IS STILL WAITING TO BE SERVED, per object. It exists so a landing happens exactly
 *  ONCE: a door pressed while its area is already standing changes the hash, which the area's own
 *  listener answers — and the knock below would then answer it a second time, restarting the
 *  arrival flash on top of itself. Whichever gets there first clears the want; the other stands
 *  down. */
const WANTED = new Map<ObjectKind, string>();

/** THE TAIL THIS AREA WAS ASKED FOR, or nothing. Read at render time by the area that owns it.
 *
 *  IT MATCHES THE HOME AS A PREFIX, not as a segment: an object living in a world has a two-part
 *  home (`admin/team`) and a split-on-slash comparison would have read the world as the area and
 *  the seat as the id. One `startsWith` covers both depths and needs no special case. */
export const tailOf = (kind: ObjectKind): string => {
  const path = window.location.hash.replace(/^#\/?/, '');
  const home = HOME_OF[kind];
  if (path === home) return '';
  return path.startsWith(`${home}/`) ? path.slice(home.length + 1) : '';
};

/**
 * AN AREA'S OWN LANDING — the second half of every object door, registered by the area that owns
 * the object and taken back when it unmounts.
 *
 * It does two jobs that are one job seen from two sides: it answers a door knocked from another
 * surface, and it reads the tail a COLD LOAD arrived with, so `#/stock/p-12` typed into a bar and
 * `#/stock/p-12` written by a product's name on an albarán land in exactly the same place.
 *
 * `walk` is held in a ref by the caller's own convention — this hook re-registers whenever the
 * function identity changes, so an area may pass a fresh closure every render without thought.
 */
export function useLanding(kind: ObjectKind, walk: (id: string) => void, onClear?: () => void): void {
  /* THE REF CARRIES THE LATEST CLOSURE while the registration happens once, so an area whose walk
     reads live state does not re-subscribe on every render of six hundred rows. */
  const held = React.useRef(walk);
  const clear = React.useRef(onClear);
  held.current = walk;
  clear.current = onClear;

  React.useEffect(() => {
    const go = (id: string) => held.current(id);
    LANDINGS.set(kind, go);
    /* THE TAIL IS READ ON ARRIVAL AND ON EVERY HASH AFTER IT. A door pressed while the area is
       already standing changes only the tail, and `App.tsx` routes on the HEAD — so nothing else
       would notice, and the object would never open. */
    const read = () => {
      const id = tailOf(kind);
      if (!id) { clear.current?.(); return; }
      /* served — so the knock that may be in flight for this same id stands down */
      if (WANTED.get(kind) === id) WANTED.delete(kind);
      go(id);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => {
      window.removeEventListener('hashchange', read);
      if (LANDINGS.get(kind) === go) LANDINGS.delete(kind);
    };
  }, [kind]);
}

/** How many sixtieths of a second a door waits for its area to stand up. Ten is long enough for a
 *  route change to mount a surface and short enough that a door onto something that no longer
 *  exists gives up rather than knocking forever. */
const KNOCKS = 10;

/**
 * OPEN AN OBJECT, FROM ANYWHERE.
 *
 * It writes the object's own address and then knocks until the area answers — once, never in a
 * loop: calling a landing twice would light the arrival flash twice, and a door that flashed ten
 * times would be the app celebrating its own routing. A door pressed on the object's OWN surface
 * finds the landing already registered and lands on the first knock, which is why a customer's
 * name inside Customers works exactly like one on a band card.
 */
export function openObject(kind: ObjectKind, id: string): void {
  const want = addressOf(kind, id);
  WANTED.set(kind, id);
  if (window.location.hash !== want) window.location.hash = want;
  let knocks = 0;
  const knock = () => {
    /* the area's own hash listener got there first — nothing left to do */
    if (WANTED.get(kind) !== id) return;
    const walk = LANDINGS.get(kind);
    if (walk) {
      WANTED.delete(kind);
      walk(id);
      return;
    }
    knocks += 1;
    if (knocks < KNOCKS) window.setTimeout(knock, 60);
    else WANTED.delete(kind);
  };
  window.setTimeout(knock, 0);
}

/** The doors, named as the acts they are. Every call site reads as the sentence «open the
 *  customer», which is what §43 says every appearance of a name has to do. */
export const openCustomer = (id: string): void => openObject('customer', id);
export const openProduct = (id: string): void => openObject('product', id);
export const openOrder = (id: string): void => openObject('order', id);

/** Opens a full Albarán on one exact line. The optional source id lives on the origin history entry,
 * so Back returns to the same Product Sheet section after the order handoff. */
export function openOrderLine(id: string, lineId: string, returnAnchor?: string): void {
  if (returnAnchor) {
    window.history.replaceState(
      { ...(window.history.state ?? {}), rocotoReturnAnchor: returnAnchor },
      '',
      window.location.href,
    );
  }
  openOrder(id);
  let attempts = 0;
  const land = () => {
    const row = window.document.querySelector<HTMLElement>(`[data-testid="line-${lineId}"]`);
    if (row) {
      row.scrollIntoView?.({ block: 'center' });
      row.querySelector<HTMLElement>(`[data-testid="line-name-${lineId}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (attempts++ < 10) window.setTimeout(land, 60);
  };
  window.setTimeout(land, 0);
}

/** The source section recorded by openOrderLine, if the user returned to it with Back. */
export function returnAnchor(): string | null {
  const value = (window.history.state as Record<string, unknown> | null)?.rocotoReturnAnchor;
  return typeof value === 'string' ? value : null;
}

/** Supplier messages are evidence below the catalogue, not another product or peer workspace. */
export function supplierMailHref(mailId?: string | null, skuId?: string | null): string {
  const query = new URLSearchParams();
  if (mailId) query.set('message', mailId);
  if (skuId) query.set('product', skuId);
  return `#/stock/supplier-emails${query.size ? `?${query}` : ''}`;
}
export function openSupplierMail(mailId?: string | null, skuId?: string | null): void {
  window.location.hash = supplierMailHref(mailId, skuId);
}


/** A transient reader belongs to the route it was opened from. Destinations move the hash; this
 * hook closes only that reader on the resulting navigation, so an old overlay cannot intercept
 * the newly arrived document. It deliberately has no mutation semantics: dirty forms opt in only
 * after they can preserve or explicitly discard their own draft. */
export function useRouteTransition(onDestination: () => void): void {
  const held = React.useRef(onDestination);
  held.current = onDestination;
  React.useEffect(() => {
    const close = () => held.current();
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
}

/** OPEN THE HOUSE ITSELF (§53). Its seat is its card, so this walks to the seat — there is no
 *  landing to knock for, because there is nothing on that seat to select. */
export const openCompany = (): void => {
  const want = addressOf('company', '');
  if (window.location.hash !== want) window.location.hash = want;
};

/** OPEN ONE OF THE HOUSE'S PEOPLE (§53's sub-objects). Full door machinery, because Team is a
 *  master-detail seat with a selection: a customer's sheet naming their comercial, a zone's band
 *  naming who holds it, an escalation naming who takes it — every one of them lands on that
 *  person's card, from a surface that is not Team. */
export const openUser = (id: string): void => openObject('user', id);

/** THE HOUSE'S OWN TARIFAS — a SETTING, and the door lands on it (FEED-IA §75.4 · OBJECT-MAP C8).
 *
 *  A tier's name is said on customers' rows and sheets all over the app, and a tarifa a person
 *  cannot open is a word they have to already know the meaning of (§43's «no dead names», applied
 *  to the thing a name refers to). So the door stays; its destination moves.
 *
 *  WHAT THIS USED TO BE, AND WHY IT WAS WRONG. It was `openObject('product', 'registry')`: a
 *  RESERVED product id that addressed a surface which is not a product, so the catalogue's own
 *  landing had to hold a branch for a thing that is not in the catalogue. §75.4 settled what the
 *  house-level tarifas ARE — «maybe tariffs are a setting yeah» — and a setting already has an
 *  address in this file: `anchorFor('pricing')`, which the migration map has pointed at Operations
 *  since §53. The pseudo-product dies with the seat it was invented for; the door reads the same
 *  at every call site.
 *
 *  PER-PRODUCT TARIFAS ARE NOT THIS DOOR. They live on the product's own sheet (`ProductTarifas`),
 *  which is where a product's name already takes you — §75.4's «Tariffs are inside each thing». */
export const openTierRegistry = (): void => {
  const want = anchorFor('pricing');
  if (window.location.hash !== want) window.location.hash = want;
};

/* ── WHAT A DOOR LOOKS LIKE (FEED-IA §43) ─────────────────────────────────────────────────────
 * A name on a screen is either a thing you can open or a string somebody typed, and the app is made
 * almost entirely of names. So a name that opens something is a CONTROL, and every one of them
 * carries the same one mark that says so: a hairline underline on hover.
 *
 * WHY IT IS ONE COMPONENT AND NOT A HABIT. «One visual identity per object — recognition before
 * reading.» A door drawn one way on the customers' sheet and another way on a band card is two
 * vocabularies for one law, and a reader then has to learn per-surface which words are pressable —
 * which is the same failure as no doors at all, arriving one screen later.
 *
 * WHAT IT DELIBERATELY IS NOT: a colour, a chevron, or anything that moves. Saffron is Rocoto's own
 * act (§1) and a name is the person's; a chevron is the app's own mark for «this row goes
 * somewhere» and a name inside a row is smaller than a row; and hover may never change geometry
 * (§37.3), which an underline does not — it is drawn in the space the text already reserves.
 */
export const nameDoor = (over: boolean): React.CSSProperties => ({
  /* the words stand in the middle of whatever box the door is given — at rest that is the type's
     own line box, and on a phone it is INTX-12's 44px floor (E193.14) */
  display: 'inline-flex',
  alignItems: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  minWidth: 0,
  textDecoration: over ? 'underline' : 'none',
  textUnderlineOffset: '2px',
  /* ── A DOOR TAKES ITS OWN PRESSES BACK, WHEREVER IT IS STANDING ────────────────────────────
   * A CARD that is itself a door draws its press as a STRETCHED TARGET UNDERNEATH its content and
   * makes the content inert (`pointer-events: none`), because a button may not contain a button —
   * that is the band card's construction (§32) and the river row's. A door dropped into that
   * content therefore renders perfectly, underlines on hover, and CANNOT BE PRESSED: the card's
   * own layer swallows every click before it arrives.
   *
   * It was found by a click, not by a reading — the name resolved, was visible, enabled and stable,
   * and sixty retries later the card's target was still intercepting. So putting the pointer back
   * is part of what a door IS, not something each call site remembers: an object's name is a
   * control everywhere it appears, including on top of a bigger control. */
  position: 'relative',
  pointerEvents: 'auto',
});

export type DoorProps = {
  /** the object this name opens — one of `openCustomer` · `openProduct` · `openOrder`, or a
   *  surface's own act where the object is already in hand */
  onOpen: () => void;
  /** what pressing it does, said as a sentence — the accessible name and the hover label */
  label: string;
  testid?: string;
  /** the name itself. A door draws no words of its own; it makes the ones already there pressable. */
  children: React.ReactNode;
};

export function Door({ onOpen, label, testid, children }: DoorProps) {
  const [over, setOver] = React.useState(false);
  /* ── A NAME IS A CONTROL, AND ON A PHONE A CONTROL IS 44px (INTX-12 · E193.14) ────────────
     §43's whole point is that an object's name is pressable everywhere it appears — so on a
     phone it owes a thumb the same 44px every other press owes it. BOTH AXES, because a name can
     be two letters: «Rape» measured 38px wide on the customer's own history and a 38px target is
     a miss waiting to happen. The words do not move — this style is `inline-flex`, left-aligned
     and transparent, so a short name simply stands at the left of a box big enough to press. */
  const floor = usePhoneFloor();
  return (
    <button
      type="button"
      data-testid={testid}
      data-door="object"
      title={label}
      aria-label={label}
      onClick={(e) => {
        /* a door inside a card that is itself a door owes the outer one nothing */
        e.stopPropagation();
        onOpen();
      }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{ ...nameDoor(over), ...floor }}
    >
      {children}
    </button>
  );
}

/** The quiet door back to the answer that decided this. It is a link and it reads as one: no
 *  icon, no colour, the smallest step on the ramp, an underline on hover. */
export function FromYourSetup({
  q,
  children = 'from your setup',
}: {
  q: QuestionId;
  children?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  return (
    <a
      href={anchorFor(q)}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setOver(true)}
      onBlur={() => setOver(false)}
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        textDecoration: over ? 'underline' : 'none',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {children}
    </a>
  );
}

/** A derived decision, stated and traceable: the sentence, then the door. Areas use this wherever
 *  they act on a default, so the affordance cannot drift from the derivation it explains. */
export function Derivation({
  q,
  children,
  align = 'row',
}: {
  q: QuestionId;
  children: React.ReactNode;
  align?: 'row' | 'stack';
}) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: align === 'row' ? 'row' : 'column',
        alignItems: align === 'row' ? 'baseline' : 'flex-start',
        gap: theme.sizing.scale300,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{children}</span>
      <FromYourSetup q={q} />
    </div>
  );
}
