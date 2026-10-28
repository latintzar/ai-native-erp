/* THE ASSISTANT IS THE COPILOT NOW (FEED-IA §196.2, Peter, 2026-09-04):
 *
 *   «the copilot has to be in the fucking ux ui i told you, properly … the supply issue and the
 *    catalogue shit is just suggestions but it's literally an agent and should have the same shit
 *    like all top agents with other sessions etc.»
 *
 * This file used to BE the surface: a task-card dialog holding a conversation, a thread rail and
 * two modes that replaced the conversation whenever a flow ran. §196.2 repeals that shape. The
 * agent lives in `./copilot/` — sessions, the ported chat and composer, and the supply/catalogue
 * work as cards inside a turn.
 *
 * WHAT STAYS HERE IS THE DOOR AND THE NAMES. `openAssistant` is dispatched from the day bar, the
 * stock toolbar, a category row and the Product Sheet; `AssistantHost` is mounted once by the
 * frame; the runtime seam's types are what a host implements. Every one of those call sites is
 * unchanged, which is the point of keeping this module: the agent moved, the doors did not.
 */
export {
  CopilotHost as AssistantHost,
  openAssistant,
} from './copilot';

export type {
  AssistantContext,
  AssistantDeliveryReceipt,
  AssistantKind,
  AssistantRuntimeAdapter,
  AssistantSendRequest,
  OpenAssistantDetail,
} from './copilot';
