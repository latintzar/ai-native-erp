import type {CopilotAsk,CopilotContextOrder,CopilotAnswer} from '../runtime-client';
import type {CopilotMessage} from './types';
import type {PreviewCopilotAnswer} from './preview-types';
export function askPreviewTurn(a:{gatewayOrigin:string;nativeAsk:CopilotAsk;orders:CopilotContextOrder[];localTurn:()=>CopilotMessage;turnOf:(a:CopilotAnswer|PreviewCopilotAnswer,o:CopilotContextOrder[])=>CopilotMessage}):Promise<{turn:CopilotMessage;posture:'preview'|'offline'}>;
