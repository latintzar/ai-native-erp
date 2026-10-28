/// <reference path="../../build-constants.d.ts" />
import type { CallObject, Transcript } from './runtime-client';

export const CALL_STATUSES = ['queued','ringing','in-progress','completed','busy','failed','no-answer','canceled'] as const;
export type PhoneCall = CallObject & {
  status: typeof CALL_STATUSES[number]; answeredAt?: string; endedAt?: string;
  sessionId?: string; parentSid?: string; lineId?: string;
  liveTranscript?: { language:'es';provider:'deepgram';utterances:LiveUtterance[] };
};
export type LiveUtterance = { id:string;track:'inbound'|'outbound';speaker?:number;start:number;end:number;text:string;final:boolean };
export const callEnded = (call: Pick<PhoneCall,'status'>) => ['completed','busy','failed','no-answer','canceled'].includes(call.status);
const text = (value:unknown,max=500): value is string => typeof value === 'string' && value.length <= max;
const seconds = (value:unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 604800;
const date = (value:unknown): value is string => text(value,50) && Number.isFinite(Date.parse(value));
const transcript = (value:Transcript) => value && text(value.transcript,1000000) && value.language === 'es'
  && value.provider === 'deepgram nova-3' && Array.isArray(value.utterances) && value.utterances.length <= 20000
  && value.utterances.every(row=>row && Number.isInteger(row.speaker) && row.speaker >= 0 && seconds(row.start) && seconds(row.end) && row.end >= row.start && text(row.text,10000));

/** Preserve provider evidence as plain text; rendering uses React text nodes throughout. */
export function parsePhoneCall(raw:unknown): PhoneCall {
  if (!raw || typeof raw !== 'object') throw new Error('Refresh the call to read its latest status.');
  const value=raw as PhoneCall;
  if (!text(value.sid,160) || !value.sid || !['inbound','outbound'].includes(value.direction)
    || !text(value.from,120) || !text(value.to,120) || !date(value.startedAt)
    || !CALL_STATUSES.includes(value.status) || !['none','provider','ours'].includes(value.recordingCustody)
    || (value.durationSeconds !== undefined && !seconds(value.durationSeconds))
    || (value.answeredAt !== undefined && !date(value.answeredAt)) || (value.endedAt !== undefined && !date(value.endedAt))
    || (value.sessionId !== undefined && !text(value.sessionId,160)) || (value.parentSid !== undefined && !text(value.parentSid,160))
    || (value.lineId !== undefined && (!text(value.lineId,80) || !/^line_[A-Za-z0-9_-]{16,64}$/.test(value.lineId)))
    || (value.transcript !== undefined && !transcript(value.transcript))
    || (value.liveTranscript !== undefined && (!value.liveTranscript || value.liveTranscript.provider !== 'deepgram'
      || value.liveTranscript.language !== 'es' || !Array.isArray(value.liveTranscript.utterances) || value.liveTranscript.utterances.length > 20000
      || value.liveTranscript.utterances.some(row=>!row || !text(row.id,160) || !['inbound','outbound'].includes(row.track)
        || (row.speaker !== undefined && (!Number.isInteger(row.speaker) || row.speaker < 0))
        || !seconds(row.start) || !seconds(row.end) || row.end < row.start || !text(row.text,10000) || typeof row.final !== 'boolean'))))
    throw new Error('Refresh the call to read its latest status.');
  return value;
}

/** A late poll can add saved words, but cannot move a finished call back to ringing. */
export function mergePhoneCall(previous:PhoneCall|undefined,next:PhoneCall):PhoneCall {
  if (!previous || previous.sid !== next.sid) return next;
  if (callEnded(previous) && !callEnded(next)) return {...next,...previous,transcript:next.transcript ?? previous.transcript};
  return {...previous,...next,transcript:next.transcript ?? previous.transcript};
}
export function callSeconds(call:PhoneCall,now=Date.now()):number {
  if (callEnded(call) && call.durationSeconds !== undefined) return Math.floor(call.durationSeconds);
  if (!call.answeredAt) return 0;
  const end=call.endedAt ? Date.parse(call.endedAt) : now;
  return Math.max(0,Math.floor((end-Date.parse(call.answeredAt))/1000));
}
export const callClock = (seconds:number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export function customerForPhone<T extends {phone?:string}>(customers:T[],number:string):T|undefined {
  const normalise=(input:string) => input.trim().startsWith('+') ? '+'+input.replace(/\D/g,'') : '';
  const key=normalise(number);
  if (!key) return undefined;
  const found=customers.filter(customer=>normalise(customer.phone||'')===key);
  return found.length===1 ? found[0] : undefined;
}
