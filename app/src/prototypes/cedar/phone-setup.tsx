import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button,KIND,SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Check,ArrowRight } from 'lucide-react';
import type { SectorId } from '../../scenarios/meta';
import { ConnectionSetupFrame,type SetupPresentation } from './setup-frame';
import { savePhoneConnectionConfig,usePhoneConnectionConfig,type PhoneConnectionConfig } from './phone-connection-config';
import { phoneApi,phoneError,usePhoneProvider,acceptPhoneSetup,type PhoneLineEvidence,type PhoneReadiness,type PhoneSetupChoices } from './phone-runtime';
import { phoneLineConnected,phoneRecordingOn,phoneRecordingWire,phoneSetupResumeStep } from './phone-capability';

const phoneNumber=(value:string)=>value.replace(/[\s()-]/g,'');
const validPhone=(value:string)=>/^\+[1-9]\d{6,14}$/.test(phoneNumber(value));
/* ONE QUESTION PER STEP, AND THE QUESTION LEADS (FEED-IA §246).
 *
 * «The flow of connecting should be a single question, a single form prompt … If it's a phone
 *  number, it should say, "Connect phone," then "What's your current phone number?" and go from
 *  there … single steps, so it doesn't even give the extra info.»            — Peter, 2026-09-10
 *
 * So the frame says `Connect phone`, each step asks exactly one thing at full weight, and the
 * explanatory paragraph under every field is gone. Peter's own first prompt ships verbatim. */
/* The caller-ID step stands only while the provider still owes that verification. An operator
 * grant with `issue_number` buys the workspace its own number at step 1 and makes that number the
 * caller ID, so `caller_id_verified` arrives true and step 3 is already answered — the walk goes
 * from forwarding straight to the transcript question. */
const PROMPTS=["What's your current phone number?","What's your mobile number?",'Forward your calls to this number','Verify your caller ID','Save call transcripts?'];
export type PhoneSetupResult={mode:'sample'|'prepared'|'connected';sourceNumber:string;lineId?:string};
type Step='lines'|0|1|2|3|4;

export function PhoneSetup({presentation='page',onClose,onComplete,tenant,sourceNumber,members=[],onPrepared}:{
  presentation?:SetupPresentation;onClose:()=>void;onComplete?:(result:PhoneSetupResult)=>void;tenant:SectorId;sourceNumber:string;
  members?:{id:string;name:string;phone?:string}[];officeHours?:string;onPrepared?:(config:PhoneConnectionConfig)=>void;
}) {
  const [,theme]=useStyletron();
  const stored=usePhoneConnectionConfig(tenant),provider=usePhoneProvider();
  const [step,setStep]=React.useState<Step>(0),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [lineId,setLineId]=React.useState<string|null>(null);
  /* THE LINE THE WALK JUST CREATED IS ITS OWN EVIDENCE. `POST /phone/lines` answers with the whole
     line — its id, its setup and the readiness carrying the number the operator grant just issued —
     and that answer is newer than any snapshot. Holding it here means step 2 states the issued
     number the moment it exists, whatever a still-flying `/phone/setup` read is about to say. */
  const [createdLine,setCreatedLine]=React.useState<PhoneLineEvidence|null>(null);
  const [testMode,setTestMode]=React.useState(false),[testForwarding,setTestForwarding]=React.useState(false),[testCaller,setTestCaller]=React.useState(false);
  const [source,setSource]=React.useState(stored.sourceNumber || sourceNumber);
  const [mobile,setMobile]=React.useState(stored.fallbackNumber || members[0]?.phone || '');
  const [recording,setRecording]=React.useState(false),[live,setLive]=React.useState(false),[code,setCode]=React.useState('');
  const lines=provider.evidence?.lines ?? [];
  const selected=lines.find(line=>line.line_id===lineId) ?? (createdLine && createdLine.line_id===lineId ? createdLine : null);
  const testReadiness:PhoneReadiness={configured:true,account_verified:true,inbound_number:'+51999999000',caller_id:phoneNumber(source),
    caller_id_verified:testCaller,browser_ready:true,forwarding_state:testForwarding?'verified':'not-run',transcription_ready:true};
  const ready=testMode?testReadiness:selected?.readiness;
  const commissioned=testMode||selected?.mode==='commissioned';
  const connected=testMode?Boolean(testCaller&&testForwarding):phoneLineConnected(selected);
  const hydrated=React.useRef(false);

  React.useEffect(()=>{
    if(provider.status!=='ready' || hydrated.current)return;
    hydrated.current=true;
    const saved=provider.evidence?.setup;
    if(saved?.source_number)setSource(saved.source_number);
    if(saved?.fallback_number)setMobile(saved.fallback_number);
    setRecording(phoneRecordingOn(saved?.recording ?? 'off'));setLive(Boolean(saved?.live_transcription));setStep(lines.length?'lines':0);
  },[provider.status,provider.evidence,lines.length]);
  /* RECOVERY, AND ONLY FROM A SNAPSHOT THAT KNEW THE LINE. A line disconnected from another seat
     or by an operator leaves this walk standing on a line that is gone, so the provider's own
     answer returns the person to what still exists.
     ⚠ IT MUST NEVER FIRE ON A SNAPSHOT THAT SIMPLY PREDATES THE LINE. `phoneApi.addLine` publishes
     nothing, so `setLineId` commits a render while the next `/phone/setup` read is still in flight;
     an absence test against that snapshot read the brand-new line as revoked and threw the first
     Connect phone on every sample account back to step 0 under «This line was disconnected».
     A line is revoked when the provider, HAVING REPORTED IT, stops reporting it — so the walk
     remembers whether a snapshot ever carried this id and revokes only after that.
     That ref holds the snapshot that lands BEFORE the first fresh one. The snapshot that lands
     AFTER it is held one level down, by `phone-runtime.ts`'s write stamp: a `/phone/setup` read
     that began before a write is discarded rather than published, so the evidence this effect
     reads never walks backwards past the line's own creation. */
  const reported=React.useRef(false);
  React.useEffect(()=>{
    if(testMode || !lineId || provider.status!=='ready')return;
    if(provider.evidence?.lines.some(row=>row.line_id===lineId)){reported.current=true;return;}
    if(!reported.current)return;
    reported.current=false;
    setLineId(null);setCreatedLine(null);setCode('');setError('This line was disconnected. Connect phone again to place calls.');
    setStep(provider.evidence?.lines.length?'lines':0);
  },[provider.status,provider.evidence,lineId,testMode]);
  React.useEffect(()=>{if(step!==2 || ready?.forwarding_state!=='waiting')return;
    const timer=window.setInterval(()=>{void provider.refresh();},3000);return()=>window.clearInterval(timer);
  },[step,ready?.forwarding_state]);
  /* ── THE STEP'S OWN QUESTION TAKES FOCUS ON EVERY STEP CHANGE (§247.2) ─────────────────────
     `ConnectionSetupFrame` focuses its h1 in an effect keyed on the TITLE, and this walk carries
     one title from start to finish, so a step change unmounted the focused control and left focus
     on the body with the new question unannounced. The step's own prompt takes it instead, in the
     second frame so it lands after the frame's own title focus, and the email walk does exactly
     the same — the two walks read as one design. The first paint keeps the title. */
  const firstStep=React.useRef(true);
  React.useEffect(()=>{
    if(firstStep.current){firstStep.current=false;return undefined;}
    let second=0;
    const first=window.requestAnimationFrame(()=>{
      second=window.requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-testid="phone-setup-prompt"]')?.focus({preventScroll:true}));
    });
    return()=>{window.cancelAnimationFrame(first);window.cancelAnimationFrame(second);};
  },[step]);

  const choices=():PhoneSetupChoices=>({source_number:phoneNumber(source),fallback_number:phoneNumber(mobile),recording:phoneRecordingWire(recording),live_transcription:recording && live});
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(caught){setError(phoneError(caught));}finally{setBusy(false);}};
  const remember=()=>savePhoneConnectionConfig(tenant,{sourceNumber:phoneNumber(source),fallbackNumber:phoneNumber(mobile),prepared:true,
    ownerId:stored.ownerId || members[0]?.id || '',forwardingAcknowledged:ready?.forwarding_state==='verified'});
  const finish=(mode:'prepared'|'connected',id?:string)=>{const saved=remember();if(!saved){setError('Allow browser storage, then save your phone setup.');return;}
    if(onComplete)onComplete({mode,sourceNumber:saved.sourceNumber,lineId:id});else if(onPrepared)onPrepared(saved);else onClose();};
  const loadLine=(line:PhoneLineEvidence)=>{reported.current=true;setLineId(line.line_id);setCreatedLine(line);setSource(line.setup.source_number);setMobile(line.setup.fallback_number);
    setRecording(phoneRecordingOn(line.setup.recording));setLive(line.setup.live_transcription);setCode('');setError('');setStep(phoneSetupResumeStep(line));};
  const addAnother=()=>{reported.current=false;setTestMode(false);setLineId(null);setCreatedLine(null);setSource('');setMobile(members[0]?.phone || '');setRecording(false);setLive(false);setCode('');setError('');setStep(0);};
  const useTestData=()=>{reported.current=false;setTestMode(true);setTestForwarding(false);setTestCaller(false);setLineId('line_test_data_fixture');setCreatedLine(null);
    setSource(validPhone(source)?phoneNumber(source):'+51910000001');setMobile(validPhone(mobile)?phoneNumber(mobile):'+51910000002');
    setRecording(false);setLive(false);setCode('');setError('');setStep(0);};
  const disconnect=(line:PhoneLineEvidence)=>{
    window.dispatchEvent(new CustomEvent('rocoto:phone-disconnect-start',{detail:{lineId:line.line_id}}));
    void run(async()=>{try{
      acceptPhoneSetup(await phoneApi.disconnectLine(line.line_id));
      if(lineId===line.line_id){reported.current=false;setLineId(null);setCreatedLine(null);setStep('lines');}
    }finally{
      window.dispatchEvent(new CustomEvent('rocoto:phone-disconnect-end',{detail:{lineId:line.line_id}}));
    }});
  };
  /* WHERE THE FORWARDING STEP LEADS. The issued number is its own caller ID, so a grant that
     buys the number answers the caller-ID question at the same moment — and a question already
     answered is a step a person never meets. */
  const afterForwarding=(evidence?:PhoneReadiness):Step=>evidence?.caller_id_verified?4:3;
  const next=()=>void run(async()=>{
    if(step==='lines')return;
    if(step===0){if(!validPhone(source))throw new Error('Enter your business number with its country code.');setStep(1);return;}
    if(step===1){
      if(!validPhone(mobile))throw new Error('Enter your mobile number with its country code.');
      if(testMode){setStep(2);return;}
      /* The response IS the evidence for this line. The setup read that follows is issued AFTER
         the write, so it can carry the line; a read already in flight could not, which is exactly
         why the walk holds `createdLine` and never leans on the snapshot for its own line. */
      const line=await phoneApi.addLine(choices());setCreatedLine(line);setLineId(line.line_id);
      try{acceptPhoneSetup(await phoneApi.setup());}catch{/* The created line stands until the next read. */}
      setStep(2);return;
    }
    if(step===2){
      if(testMode){if(!testForwarding){setTestForwarding(true);return;}setStep(3);return;}
      if(!commissioned){finish('prepared',lineId || undefined);return;}
      if(ready?.forwarding_state==='verified'){setStep(afterForwarding(ready));return;}
      if(!lineId)return;
      if(ready?.forwarding_state==='waiting' || ready?.forwarding_state==='received')await provider.refresh();
      else await phoneApi.testLineForwarding(lineId,phoneNumber(mobile));
      const evidence=await phoneApi.setup();acceptPhoneSetup(evidence);
      const fresh=evidence.lines.find(line=>line.line_id===lineId)?.readiness;
      if(fresh)setCreatedLine(current=>current && current.line_id===lineId?{...current,readiness:fresh}:current);
      if(fresh?.forwarding_state==='verified')setStep(afterForwarding(fresh));
      return;
    }
    if(step===3){
      if(testMode){if(!code){setCode('123456');return;}setTestCaller(true);setStep(4);return;}
      if(!commissioned){finish('prepared',lineId || undefined);return;}
      if(ready?.caller_id_verified){setStep(4);return;}
      if(!lineId)return;
      const caller=ready?.caller_id || phoneNumber(source);
      if(!code){const result=await phoneApi.startLineCallerId(lineId,caller);if(typeof result.validation_code!=='string' || !result.validation_code || result.validation_code.length>30)throw new Error('Check the verification call, then refresh its status.');setCode(result.validation_code);return;}
      const result=await phoneApi.checkLineCallerId(lineId,caller);if(result.readiness.caller_id_verified)setStep(4);await provider.refresh();return;
    }
    if(testMode){const saved=remember();if(!saved){setError('Allow browser storage, then save your phone setup.');return;}
      if(onComplete)onComplete({mode:'sample',sourceNumber:saved.sourceNumber});else onPrepared?.(saved);return;}
    if(!lineId){finish('prepared');return;}
    await phoneApi.saveLineSetup(lineId,choices());await provider.refresh();finish(connected?'connected':'prepared',lineId);
  });

  const text:React.CSSProperties={...theme.typography.ParagraphMedium,color:theme.colors.contentSecondary,margin:0};
  const row:React.CSSProperties={...theme.typography.ParagraphMedium,display:'flex',alignItems:'center',gap:theme.sizing.scale400,flexWrap:'wrap'};
  const field=(value:string,onChange:(value:string)=>void,label:string,id:string)=><Input value={value} onChange={event=>onChange(event.currentTarget.value)}
    type="tel" autoComplete="tel" aria-label={label} maxLength={40} overrides={{Input:{props:{'data-testid':id}}}}/>;
  const back=step==='lines'?(presentation==='page'?onClose:undefined):step===0?(lines.length?()=>setStep('lines'):(presentation==='page'?onClose:undefined))
    :()=>setStep((step===4 && afterForwarding(ready)===4?2:step-1) as Step);
  const defaultLine=lines.find(line=>line.line_id===provider.evidence?.default_line_id);
  const defaultConnected=phoneLineConnected(defaultLine);
  const action=step==='lines'?'':step===2&&!commissioned?'Save phone setup':step===2&&ready?.forwarding_state!=='verified'?(testMode?'Run forwarding test':ready?.forwarding_state==='not-run'?'Start forwarding test':'Check forwarding'):
    step===3&&!commissioned?'Save phone setup':step===3&&!ready?.caller_id_verified?(code?'Check verification':'Call me to verify'):step===4?'Done':'Continue';

  return <ConnectionSetupFrame presentation={presentation} title="Connect phone" onClose={onClose} onBack={back} testId="phone-setup">
    {step==='lines'?<div style={{display:'grid',gap:theme.sizing.scale500}}>
      {lines.map(line=>{const isDefault=line.line_id===provider.evidence?.default_line_id;const isConnected=phoneLineConnected(line);
        return <div key={line.line_id} data-testid="phone-connected-line" style={{display:'grid',gap:theme.sizing.scale300,padding:theme.sizing.scale500,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius300}}>
          <button type="button" onClick={()=>loadLine(line)} style={{font:'inherit',textAlign:'left',border:0,padding:0,background:'transparent',color:'inherit',cursor:'pointer'}}>
            {/* THE LINE'S IDENTITY IS THE NUMBER IT ANSWERS ON. An operator grant buys that
                number for the workspace, and it is also the caller ID, so it leads; the business
                number the person typed rides the state line beside it. */}
            <strong style={{...theme.typography.LabelMedium,display:'block',overflowWrap:'anywhere'}}>{line.readiness.inbound_number || line.setup.source_number}</strong>
            <span style={text}>{isConnected?'Connected':line.mode==='prepared'?'Prepared':'Connection needs attention'}{isDefault?' · Outgoing line':''}{line.readiness.inbound_number && line.setup.source_number && line.setup.source_number!==line.readiness.inbound_number?` · ${line.setup.source_number}`:''}</span>
          </button>
          {isConnected&&!isDefault&&<Button kind={KIND.tertiary} size={SIZE.compact} onClick={()=>void run(async()=>{acceptPhoneSetup(await phoneApi.setDefaultLine(line.line_id));})} data-testid="phone-set-default">Use for outgoing calls</Button>}
          {line.mode==='commissioned'&&<Button kind={KIND.tertiary} size={SIZE.compact} disabled={busy} onClick={()=>disconnect(line)} data-testid="phone-disconnect-line">{lines.length===1?'Disconnect phone':'Disconnect line'}</Button>}
        </div>;})}
      <Button onClick={addAnother} data-testid="phone-add-line">{lines.length?'Add another':'Connect phone'}</Button>
      {onComplete&&defaultConnected&&<Button kind={KIND.secondary} onClick={()=>finish('connected',provider.evidence?.default_line_id || undefined)}>Continue</Button>}
      {onPrepared&&<Button kind={KIND.tertiary} onClick={useTestData} data-testid="phone-test-data">Use test data</Button>}
      {(error||provider.error)&&<p role="alert" style={{...text,color:theme.colors.negative}}>{error||provider.error}</p>}
    </div>:<form style={{display:'grid',gap:theme.sizing.scale600}} onSubmit={event=>{event.preventDefault();next();}}>
      {testMode&&<span data-testid="phone-test-data-badge" style={theme.typography.LabelSmall}>Test data</span>}
      <div data-testid="phone-setup-step" data-step={step} style={{display:'grid',gap:theme.sizing.scale500}}>
        <h2 data-testid="phone-setup-prompt" tabIndex={-1} style={{...theme.typography.HeadingSmall,margin:0,outline:'none',overflowWrap:'anywhere'}}>{PROMPTS[step]}</h2>
        {step===0&&field(source,setSource,'Business phone number','phone-source-number')}
        {step===1&&field(mobile,setMobile,'Mobile phone number','phone-mobile-number')}
        {step===2&&<><strong data-testid="phone-forwarding-destination" style={{...theme.typography.HeadingLarge,overflowWrap:'anywhere'}}>{ready?.inbound_number||'Rocoto number awaiting activation'}</strong>
          {commissioned&&<span role="status" data-testid="phone-forwarding-status" style={text}>{ready?.forwarding_state==='verified'?'Forwarding verified':ready?.forwarding_state==='received'?'Test call received':ready?.forwarding_state==='waiting'?`Call ${source} from ${mobile}`:`Start the test, then call ${source} from ${mobile}`}</span>}</>}
        {step===3&&<>{ready?.caller_id_verified&&<span style={row}><Check size={20} aria-hidden/>Caller ID verified</span>}
          {code&&<div role="status" style={{display:'grid',gap:theme.sizing.scale300}}><span style={text}>Enter this code during the call</span><strong data-testid="phone-verification-code" style={theme.typography.HeadingLarge}>{code}</strong></div>}</>}
        {/* ONE CHOICE, AND IT IS THE LINE'S OWN. What a recorded call plays first is the operator's
            commissioning decision (`notice: none | spoken | audio`), so this step promises the
            transcript it actually delivers and leaves the notice to the grant that sets it. */}
        {step===4&&<label style={{...row,...text,alignItems:'flex-start'}}><input type="checkbox" checked={recording} onChange={event=>{setRecording(event.currentTarget.checked);setLive(event.currentTarget.checked);}}
            data-testid="phone-recording-consent" style={{width:20,height:20,flexShrink:0}}/><span>Save call transcripts</span></label>}
      </div>
      {(error||provider.error)&&<p role="alert" style={{...text,color:theme.colors.negative}}>{error||provider.error}</p>}
      <Button type="submit" isLoading={busy} data-testid="phone-setup-continue" endEnhancer={()=><ArrowRight size={18} aria-hidden/>}>{action}</Button>
      {step===0&&onPrepared&&!testMode&&<Button type="button" kind={KIND.tertiary} onClick={useTestData} data-testid="phone-test-data">Use test data</Button>}
      {provider.status==='unavailable'&&<Button type="button" kind={KIND.tertiary} onClick={()=>void provider.refresh()}>Check connection again</Button>}
    </form>}
  </ConnectionSetupFrame>;
}
