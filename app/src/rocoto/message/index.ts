/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as Message, groupThread } from './message';
// Constants
export { AUTHOR, STATUS, STATUS_LABEL, HOLD_MS, HOLD_DRIFT } from './constants';
// Styled elements
export {
  Root as StyledRoot,
  Identity as StyledIdentity,
  IdentityMark as StyledIdentityMark,
  Bubble as StyledBubble,
  Content as StyledContent,
  Body as StyledBody,
  Text as StyledText,
  Caret as StyledCaret,
  MetaShim as StyledMetaShim,
  Meta as StyledMeta,
  Time as StyledTime,
  Status as StyledStatus,
  Payload as StyledPayload,
  MediaFrame as StyledMediaFrame,
  Image as StyledImage,
  Attachment as StyledAttachment,
  AttachmentIcon as StyledAttachmentIcon,
  AttachmentName as StyledAttachmentName,
  AttachmentDetail as StyledAttachmentDetail,
  Footer as StyledFooter,
  Caption as StyledCaption,
  Typing as StyledTyping,
  TypingDot as StyledTypingDot,
  System as StyledSystem,
  Retry as StyledRetry,
  Action as StyledAction,
} from './styled-components';
// Types
export * from './types';
