/** Cedar's development capability profile. Availability here selects prototype UI; provider
 * authorization and maintained-product release evidence remain separate runtime boundaries.
 * FEED-IA §232 enables pricing and valued Delivery Notes; stock retains its workspace switch.
 */
export type ProfileCapability = 'available' | 'planned';

export type ActiveProductProfile = {
  id: 'cedar-commerce';
  literalProducts: ProfileCapability;
  reviewedArtwork: ProfileCapability;
  inboundOrderReview: ProfileCapability;
  albaranEditing: ProfileCapability;
  nativeHandoff: ProfileCapability;
  internalCopilot: ProfileCapability;
  printFileOutput: ProfileCapability;
  pricing: ProfileCapability;
  inventory: ProfileCapability;
  supplierIntake: ProfileCapability;
  customerOutbound: ProfileCapability;
  albaranValues: ProfileCapability;
  erpAutomation: ProfileCapability;
  scheduledSubcontractorEmail: ProfileCapability;
};

export const ACTIVE_PRODUCT_PROFILE: ActiveProductProfile = {
  id: 'cedar-commerce',
  literalProducts: 'available',
  reviewedArtwork: 'available',
  inboundOrderReview: 'available',
  albaranEditing: 'available',
  nativeHandoff: 'available',
  internalCopilot: 'available',
  printFileOutput: 'available',
  /* E191 exposes the complete books behind persisted workspace switches. The switches hide the
     surfaces without deleting their ledgers, which is the production contract for an account
     that starts with order review and enables commercial operations later. */
  pricing: 'available',
  inventory: 'available',
  supplierIntake: 'planned',
  customerOutbound: 'planned',
  albaranValues: 'available',
  erpAutomation: 'planned',
  scheduledSubcontractorEmail: 'planned',
};

export const capabilityAvailable = (
  capability: keyof Omit<typeof ACTIVE_PRODUCT_PROFILE, 'id'>,
): boolean => ACTIVE_PRODUCT_PROFILE[capability] === 'available';

export const PLANNED_CAPABILITY_HELP = 'Planned for after order review.';
