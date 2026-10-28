/* THE REGISTRY, and the resolution rule.
 *
 * §7: «A specific species/cut maps to (family, form) + its name; commonest ones get bespoke
 * silhouettes over time.» So resolution walks from most specific to least, and the last step
 * CANNOT MISS:
 *
 *   1. the bespoke drawing for this species IN THIS FORM      merluza + fillet
 *   2. the bespoke drawing for this species, any form          pulpo
 *   3. the generic drawing for (family, form)                  fish + loin
 *   4. the generic drawing for (family, its default form)      fish + whole
 *
 * Step 4 is why there is never an empty box. A product can arrive with a species nobody has
 * drawn, a form this family does not have, or no form at all, and the row still shows what kind
 * of thing it is — which is the entire point of the icon. An icon that sometimes renders nothing
 * would teach the eye to stop looking at the column, and then none of them work.
 */
import { DEFAULT_FORM } from '../constants';
import type { Family, Form } from '../types';
import type { Draw } from './draw';
import { fishWhole, fishFillet, fishLoin, fishDiced } from './fish';
import { shellfishWhole, shellfishPeeled } from './shellfish';
import { meatChunk, meatSteak, meatDiced, meatMinced, meatPieces } from './meat';
import { poultryWhole, poultryPieces, poultryWings } from './poultry';
import { fruitWhole, fruitBunch, fruitBox, vegetableWhole, vegetableBunch, vegetableBox } from './plants';
import { dairyGeneric, dryGeneric } from './pantry';
import {
  merluzaWhole, merluzaFillet, gambaRoja, pulpo, rape, lubina,
  mango, aguacate, tomate, polloWhole, polloWings, lomoCerdo, chuleton,
} from './bespoke';

/** every (family, form) the taxonomy declares — twenty-two drawings, no gaps */
export const GENERIC: Record<string, Draw> = {
  'fish|whole': fishWhole,
  'fish|fillet': fishFillet,
  'fish|loin': fishLoin,
  'fish|diced': fishDiced,
  'shellfish|whole': shellfishWhole,
  'shellfish|peeled': shellfishPeeled,
  'meat|chunk': meatChunk,
  'meat|steak': meatSteak,
  'meat|diced': meatDiced,
  'meat|minced': meatMinced,
  'meat|pieces': meatPieces,
  'poultry|whole': poultryWhole,
  'poultry|pieces': poultryPieces,
  'poultry|wings': poultryWings,
  'fruit|whole': fruitWhole,
  'fruit|bunch': fruitBunch,
  'fruit|box': fruitBox,
  'vegetable|whole': vegetableWhole,
  'vegetable|bunch': vegetableBunch,
  'vegetable|box': vegetableBox,
  'dairy|generic': dairyGeneric,
  'dry|generic': dryGeneric,
};

/** the hand-drawn ones. A key with a form binds to that form only; a key without one answers for
 *  every form of that species, which is right for a pulpo (there is one way to sell it) and wrong
 *  for a merluza (whole and filleted are different objects). */
export const BESPOKE: Record<string, Draw> = {
  'merluza|whole': merluzaWhole,
  'merluza|fillet': merluzaFillet,
  'gamba-roja': gambaRoja,
  pulpo,
  rape,
  lubina,
  mango,
  aguacate,
  tomate,
  'pollo|whole': polloWhole,
  'pollo|wings': polloWings,
  'lomo-cerdo': lomoCerdo,
  chuleton: chuleton,
};

/** the bespoke set, in the shape the kit page and the app's product editor both want */
export const BESPOKE_INDEX: Array<{ species: string; label: string; family: Family; form: Form }> = [
  { species: 'merluza', label: 'Merluza', family: 'fish', form: 'whole' },
  { species: 'merluza', label: 'Merluza en filete', family: 'fish', form: 'fillet' },
  { species: 'lubina', label: 'Lubina', family: 'fish', form: 'whole' },
  { species: 'rape', label: 'Rape', family: 'fish', form: 'whole' },
  { species: 'gamba-roja', label: 'Gamba roja', family: 'shellfish', form: 'whole' },
  { species: 'pulpo', label: 'Pulpo', family: 'shellfish', form: 'whole' },
  { species: 'pollo', label: 'Pollo', family: 'poultry', form: 'whole' },
  { species: 'pollo', label: 'Alitas de pollo', family: 'poultry', form: 'wings' },
  { species: 'lomo-cerdo', label: 'Lomo de cerdo', family: 'meat', form: 'chunk' },
  { species: 'chuleton', label: 'Chuletón', family: 'meat', form: 'steak' },
  { species: 'tomate', label: 'Tomate', family: 'vegetable', form: 'whole' },
  { species: 'aguacate', label: 'Aguacate', family: 'fruit', form: 'whole' },
  { species: 'mango', label: 'Mango', family: 'fruit', form: 'whole' },
];

export type Resolution = {
  draw: Draw;
  /** which step answered — the kit page shows it, and it is the thing to assert in a test */
  source: 'bespoke-form' | 'bespoke' | 'generic' | 'family-default';
  /** the form actually drawn, which is not always the form asked for */
  form: Form;
};

export function resolve(family: Family, form: Form | undefined, species?: string): Resolution {
  const wanted = form ?? DEFAULT_FORM[family];

  if (species) {
    const withForm = BESPOKE[`${species}|${wanted}`];
    if (withForm) return { draw: withForm, source: 'bespoke-form', form: wanted };
    const anyForm = BESPOKE[species];
    if (anyForm) return { draw: anyForm, source: 'bespoke', form: wanted };
  }

  const generic = GENERIC[`${family}|${wanted}`];
  if (generic) return { draw: generic, source: 'generic', form: wanted };

  const fallback = DEFAULT_FORM[family];
  return { draw: GENERIC[`${family}|${fallback}`], source: 'family-default', form: fallback };
}

export type { Draw } from './draw';
