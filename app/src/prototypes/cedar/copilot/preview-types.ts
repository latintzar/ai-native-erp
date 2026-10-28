export type PreviewTransport = {provider:'openai';model:string;operation:'customer-today-reading'};
export type PreviewCopilotAnswer = {reply:{text:string};proposals:[];preview:PreviewTransport};
