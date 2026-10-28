/** The development workspace's operator. Shared scenario people keep their own identities. */
export const CEDAR_OPERATOR_NAME = 'Peter';
export const cedarOperator = <T extends { name: string }>(person: T): T => ({ ...person, name: CEDAR_OPERATOR_NAME });
export function cedarOperatorName(value: unknown, previousDefault: string): string {
  if (typeof value !== 'string' || !value.trim() || value === previousDefault || value === 'User') return CEDAR_OPERATOR_NAME;
  return value;
}
