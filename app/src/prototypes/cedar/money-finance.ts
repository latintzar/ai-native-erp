/** Working capital: the advance a workspace is OFFERED, and the plan it is GRANTED (FEED-IA §249,
 *  «the loan is offered and is granted, just like in monzo»).
 *
 *  Two pure pieces and no imports, so `app/tools/test-money-finance.mjs` runs them against the
 *  seeded book itself: `advanceLimitOf` reads the seller's own sales and answers how much stands
 *  available today, and `createAdvance` / `parseAdvance` build and validate the plan record the
 *  browser stores. Every amount is an exact PEN minor unit; accepted pricing is immutable.
 *
 *  `source` is the stored discriminator that tells a priced plan from the interest-free plan an
 *  earlier version wrote. Version 2 wrote the word `future` until FEED-IA §247.8 took that word
 *  out of Cedar. A plan a browser saved before this release still holds it, and it names this same
 *  priced shape, so `parseAdvance` accepts it and writes `plan` back: the record upgrades itself
 *  the first time Money reads it, and a person keeps the plan they accepted. Version 1 and 2 both
 *  carry the single S/ 1,000 principal those releases offered, and they keep it. */
export type AdvanceCount = 1 | 3 | 6;
export type AdvancePurpose = 'stock' | 'prebuy' | 'payroll' | 'other';
export const ADVANCE_PURPOSES: readonly AdvancePurpose[] = ['stock', 'prebuy', 'payroll', 'other'];

/* THE ADVANCE'S WHOLE ARITHMETIC, in PEN minor units, in one place. */
/** The grain a person chooses in, and the slider's step: S/ 100. */
export const ADVANCE_STEP_MINOR = 10_000;
/** The smallest advance: S/ 500. */
export const ADVANCE_MINIMUM_MINOR = 50_000;
/** The grain a limit is stated in: S/ 500. */
export const ADVANCE_GRAIN_MINOR = 50_000;
/** The smallest limit a connected book earns: S/ 1,000. */
export const ADVANCE_FLOOR_MINOR = 100_000;
/** The ceiling on a first advance: S/ 20,000. */
export const ADVANCE_CEILING_MINOR = 2_000_000;
/** Four weeks of the seller's own sales, the reference day included. */
export const ADVANCE_WINDOW_DAYS = 28;
/** Half of that book. */
export const ADVANCE_SHARE_BASIS_POINTS = 5_000;
/** Each plan repaid on time raises the limit by a tenth, so the ceiling moves with the record. */
export const ADVANCE_REPAID_BONUS_BASIS_POINTS = 1_000;
/** One payment is interest free; three carry 0.5 % total; six carry 0.9 % total. */
export const ADVANCE_INTEREST_BASIS_POINTS: Record<AdvanceCount, number> = { 1: 0, 3: 50, 6: 90 };

export type AdvancePlan = {
  version: 1 | 2 | 3; scope: string; source: 'preview' | 'plan'; currency: 'PEN'; principalMinor: number;
  createdAt: string; count: AdvanceCount; paidCount: number;
  interestBasisPoints: number; interestMinor: number; totalRepaymentMinor: number;
  installments: { dueAt: string; amountMinor: number }[];
  /** Version 3 records what the money is for, the moment repayment was authorized and the limit
   *  that stood at the grant. A version 1 or 2 record predates all three and keeps them empty,
   *  because a consent it never took is a consent nobody gave. */
  purpose?: AdvancePurpose; consentAt?: string; limitMinor?: number;
};

/** What a person asks for: the amount, the plan, the purpose and the authorization behind it. */
export type AdvanceRequest = {
  scope: string; principalMinor: number; count: AdvanceCount; createdAt: string;
  purpose: AdvancePurpose; consentAt: string; limitMinor: number;
};

function monthAfter(date: Date, months: number): string {
  const month = date.getUTCMonth() + months;
  const end = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), month, Math.min(date.getUTCDate(), end))).toISOString().slice(0, 10);
}

function instantOf(value: unknown, message: string): Date {
  const at = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (!Number.isFinite(at.getTime()) || at.getUTCFullYear() < 2000 || at.getUTCFullYear() > 2200) throw new Error(message);
  return at;
}

type AdvanceDraft = {
  scope: string; principalMinor: number; count: AdvanceCount; createdAt: string;
  purpose?: AdvancePurpose; consentAt?: string; limitMinor?: number;
};

function buildAdvance(draft: AdvanceDraft, version: 1 | 2 | 3): AdvancePlan {
  const { scope, count, principalMinor } = draft;
  if (!([1, 3, 6] as number[]).includes(count) || !scope || scope.length > 120) throw new Error('Choose a repayment plan.');
  const at = instantOf(draft.createdAt, 'Choose a valid repayment date.');
  if (version === 3) {
    const limitMinor = draft.limitMinor ?? NaN;
    if (!draft.purpose || !ADVANCE_PURPOSES.includes(draft.purpose)) throw new Error('Choose what this advance is for.');
    instantOf(draft.consentAt, 'Authorize repayment from incoming payments to continue.');
    if (!Number.isSafeInteger(limitMinor) || limitMinor < ADVANCE_MINIMUM_MINOR) throw new Error('Choose an amount your limit covers.');
    if (!Number.isSafeInteger(principalMinor) || principalMinor % ADVANCE_STEP_MINOR !== 0
      || principalMinor < ADVANCE_MINIMUM_MINOR || principalMinor > limitMinor) throw new Error('Choose an amount your limit covers.');
  } else if (principalMinor !== 100_000) throw new Error('Choose an amount your limit covers.');
  const interestBasisPoints = version === 1 ? 0 : ADVANCE_INTEREST_BASIS_POINTS[count];
  const interestMinor = Math.round(principalMinor * interestBasisPoints / 10_000);
  const totalRepaymentMinor = principalMinor + interestMinor;
  const floor = Math.floor(totalRepaymentMinor / count), remainder = totalRepaymentMinor % count;
  const plan: AdvancePlan = { version, scope, source: version === 1 ? 'preview' : 'plan', currency: 'PEN', principalMinor,
    createdAt: at.toISOString(), count, paidCount: 0, interestBasisPoints, interestMinor, totalRepaymentMinor,
    installments: Array.from({ length: count }, (_, index) => ({ dueAt: monthAfter(at, index + 1), amountMinor: floor + (index < remainder ? 1 : 0) })) };
  return version === 3
    ? { ...plan, purpose: draft.purpose, consentAt: new Date(draft.consentAt as string).toISOString(), limitMinor: draft.limitMinor }
    : plan;
}

/** The grant: one request in, one immutable plan out. */
export const createAdvance = (request: AdvanceRequest): AdvancePlan => buildAdvance(request, 3);

/** Legacy accepted plans retain their own terms. Rebuild and validate all amounts. */
export function parseAdvance(raw: unknown, scope: string): AdvancePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<AdvancePlan>;
  /* One read of the stored discriminator, off the raw record rather than the current type, because
     one of the words it can hold is a word this release retired (see the file header). */
  const stored = (raw as { source?: unknown }).source;
  const version: 0 | 1 | 2 | 3 = value.version === 1 && stored === 'preview' ? 1
    : value.version === 2 && (stored === 'plan' || stored === 'future') ? 2
      : value.version === 3 && stored === 'plan' ? 3 : 0;
  if (!version || value.scope !== scope || value.currency !== 'PEN'
    || ![1, 3, 6].includes(value.count ?? 0) || typeof value.createdAt !== 'string'
    || !Number.isInteger(value.paidCount) || value.paidCount! < 0 || value.paidCount! > value.count!
    || !Array.isArray(value.installments) || value.installments.length !== value.count) return null;
  try {
    const canonical = buildAdvance({ scope, principalMinor: value.principalMinor as number, count: value.count!,
      createdAt: value.createdAt, purpose: value.purpose, consentAt: value.consentAt, limitMinor: value.limitMinor }, version);
    for (const key of ['interestBasisPoints', 'interestMinor', 'totalRepaymentMinor'] as const) {
      if ((version !== 1 || value[key] !== undefined) && value[key] !== canonical[key]) return null;
    }
    if (value.installments.some((item, index) => !item || item.dueAt !== canonical.installments[index].dueAt
      || item.amountMinor !== canonical.installments[index].amountMinor)) return null;
    return { ...canonical, paidCount: value.paidCount! };
  } catch { return null; }
}

/** Everything still to repay on this plan, interest included. */
export const advanceOutstanding = (plan: AdvancePlan): number =>
  plan.installments.slice(plan.paidCount).reduce((total, item) => total + item.amountMinor, 0);

/** The share of the PRINCIPAL still standing. A limit measures exposure, so the interest a plan
 *  prices on top of its principal leaves the limit alone and each repayment returns its share:
 *  a S/ 5,000 advance on a S/ 20,000 limit leaves S/ 15,000 available. */
export const advancePrincipalOutstanding = (plan: AdvancePlan): number =>
  plan.principalMinor - Math.round(plan.principalMinor * plan.paidCount / plan.count);

export const recordAdvanceRepayment = (plan: AdvancePlan): AdvancePlan =>
  plan.paidCount >= plan.count ? plan : { ...plan, paidCount: plan.paidCount + 1 };

/** One order in the seller's own book, structurally typed so this module keeps no dependency on
 *  Sales: `MoneySourceSale` satisfies it. `figure` is the order's value in the workspace's soles. */
export type AdvanceBookSale = {
  day: string; figure: number;
  messageOnly?: boolean; archived?: unknown;
  customer?: { id?: string }; lines?: readonly unknown[];
};

export type AdvanceBook = {
  /** The seller's own calendar day, `YYYY-MM-DD` — the workspace clock's day. */
  day: string;
  sales: readonly AdvanceBookSale[];
  /** Every plan this workspace holds. */
  plans?: readonly (AdvancePlan | null | undefined)[];
};

export type AdvanceLimit = {
  /** The four-week window the book was read over, both days included. */
  from: string; to: string;
  /** The value of the orders inside it. */
  bookMinor: number;
  /** What this book earns, a multiple of S/ 500. */
  limitMinor: number;
  /** Plans repaid on time, and the principal standing on the plans still running. */
  repaidCount: number; drawnMinor: number;
  /** What can be taken today, a multiple of S/ 100. */
  availableMinor: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayShift = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const grainOf = (minor: number, size: number): number => Math.floor(minor / size) * size;

/** THE OFFER. Half of the last four weeks of the seller's own sales, in S/ 500 steps, between the
 *  S/ 1,000 floor and the S/ 20,000 ceiling, raised a tenth for each plan repaid on time, less the
 *  principal already standing. Every input is the workspace's own book; the answer is the amount
 *  the Working capital card states and the dialog's slider runs to. */
export function advanceLimitOf(book: AdvanceBook): AdvanceLimit {
  const to = DAY.test(book.day) ? book.day : '';
  const from = to ? dayShift(to, 1 - ADVANCE_WINDOW_DAYS) : '';
  let bookMinor = 0;
  if (to) for (const sale of book.sales) {
    if (!sale || typeof sale.day !== 'string' || sale.day < from || sale.day > to) continue;
    /* An order is an order: it names a customer, it holds lines, it stands in the book. A message
       and an archived draft are neither, so neither counts towards what the seller can borrow. */
    if (sale.messageOnly || sale.archived || !sale.customer?.id || !sale.lines?.length) continue;
    const minor = Math.round(sale.figure * 100);
    if (Number.isSafeInteger(minor) && minor > 0) bookMinor += minor;
  }
  const plans = (book.plans ?? []).filter((plan): plan is AdvancePlan => Boolean(plan));
  const repaidCount = plans.filter(plan => plan.paidCount >= plan.count).length;
  const drawnMinor = plans.reduce((total, plan) => total + advancePrincipalOutstanding(plan), 0);
  const earned = grainOf(Math.floor(bookMinor * ADVANCE_SHARE_BASIS_POINTS / 10_000), ADVANCE_GRAIN_MINOR);
  const base = Math.min(ADVANCE_CEILING_MINOR, Math.max(ADVANCE_FLOOR_MINOR, earned));
  const limitMinor = grainOf(Math.floor(base * (10_000 + ADVANCE_REPAID_BONUS_BASIS_POINTS * repaidCount) / 10_000), ADVANCE_GRAIN_MINOR);
  const availableMinor = grainOf(Math.max(0, limitMinor - drawnMinor), ADVANCE_STEP_MINOR);
  return { from, to, bookMinor, limitMinor, repaidCount, drawnMinor, availableMinor };
}

/** The amount a route, a campaign card or a chase carried, put on the grain a person chooses in
 *  and held inside what the book offers. */
export const clampAdvanceAmount = (minor: number, availableMinor: number): number => {
  const ceiling = Math.max(ADVANCE_MINIMUM_MINOR, grainOf(availableMinor, ADVANCE_STEP_MINOR));
  const asked = Number.isFinite(minor) ? Math.round(minor / ADVANCE_STEP_MINOR) * ADVANCE_STEP_MINOR : ADVANCE_FLOOR_MINOR;
  return Math.min(ceiling, Math.max(ADVANCE_MINIMUM_MINOR, asked));
};
