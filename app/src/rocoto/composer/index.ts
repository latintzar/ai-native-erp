/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as Composer, stateOf } from './composer';
// Constants
export { SIZE, STATE, MAX_LINES } from './constants';
// Styled elements
export {
  Root as StyledRoot,
  Bar as StyledBar,
  Attachments as StyledAttachments,
  Attachment as StyledAttachment,
  AttachmentThumb as StyledAttachmentThumb,
  AttachmentRemove as StyledAttachmentRemove,
  Field as StyledField,
  Input as StyledInput,
  AttachmentSlot as StyledAttachmentSlot,
  Actions as StyledActions,
  Send as StyledSend,
  SendSpinner as StyledSendSpinner,
  VoiceSlot as StyledVoiceSlot,
  ListBox as StyledListBox,
  ListItem as StyledListItem,
  ListItemDescription as StyledListItemDescription,
  controlEdge,
  step,
} from './styled-components';
// Types
export * from './types';
