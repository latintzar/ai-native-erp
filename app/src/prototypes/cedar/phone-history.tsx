import * as React from 'react';
import {useStyletron} from 'baseui';
import {Button,KIND,SIZE} from 'baseui/button';
import {PhoneIncoming,PhoneOutgoing,Phone,ChevronDown} from 'lucide-react';
import {phoneApi,phoneError} from './phone-runtime';
import {callClock,callEnded,type PhoneCall} from './phone-call-model';

const MOTION='400ms';
const EASE='cubic-bezier(0.22, 1, 0.36, 1)';

function callLabel(call:PhoneCall) {
  if(call.status==='completed')return 'Completed';
  if(call.status==='no-answer')return 'Missed';
  if(call.status==='busy')return 'Busy';
  if(call.status==='failed')return 'Needs attention';
  if(call.status==='canceled')return 'Cancelled';
  if(call.status==='in-progress')return 'On call';
  if(call.status==='ringing')return 'Ringing';
  return 'Connecting';
}

function SavedTranscript({call,houseName,themName}:{call:PhoneCall;houseName:string;themName:string}) {
  const [,theme]=useStyletron();
  if(!call.transcript)return <p style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0}}>{callEnded(call)?'The saved transcript is being prepared.':'The transcript will be saved with this call.'}</p>;
  return <div data-testid="connected-phone-transcript" style={{display:'grid',gap:theme.sizing.scale300}}>
    {call.transcript.utterances.map((line,index)=>{
      const mine=line.speaker===0;
      return <div key={`${call.sid}-${index}`} style={{maxWidth:'88%',justifySelf:mine?'end':'start',border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius400,padding:`${theme.sizing.scale400} ${theme.sizing.scale500}`,backgroundColor:mine?theme.colors.backgroundSecondary:theme.colors.backgroundPrimary}}>
        <span style={{...theme.typography.LabelXSmall,color:theme.colors.contentSecondary,display:'block',marginBottom:theme.sizing.scale200}}>{mine?houseName:themName} · {callClock(Math.floor(line.start))}</span>
        <span style={{...theme.typography.ParagraphSmall,overflowWrap:'anywhere'}}>{line.text}</span>
      </div>;
    })}
  </div>;
}

function HistoryCall({call,displayName,open,onToggle,initialTranscript=false}:{call:PhoneCall;displayName:string;open:boolean;onToggle:()=>void;initialTranscript?:boolean}) {
  const [css,theme]=useStyletron();
  const [transcriptOpen,setTranscriptOpen]=React.useState(initialTranscript);
  const drawerRef=React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{if(!open)setTranscriptOpen(false);},[open]);
  React.useEffect(()=>{if(drawerRef.current)drawerRef.current.inert=!open;},[open]);
  const direction=call.direction==='inbound'?'Incoming call':'Outgoing call';
  const duration=callClock(Math.floor(call.durationSeconds || 0));
  const drawer=css({display:'grid',gridTemplateRows:open?'1fr':'0fr',opacity:open?1:0,transitionProperty:'grid-template-rows, opacity',transitionDuration:MOTION,transitionTimingFunction:EASE,visibility:open?'visible':'hidden','@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'}});
  const turn=css({transform:open?'rotate(180deg)':'rotate(0deg)',transitionProperty:'transform',transitionDuration:MOTION,transitionTimingFunction:EASE,'@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'}});
  const transcriptTurn=css({transform:transcriptOpen?'rotate(180deg)':'rotate(0deg)',transitionProperty:'transform',transitionDuration:MOTION,transitionTimingFunction:EASE,'@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'}});
  /* ── THE ROW'S THREE PARTS, AND THE ONE THAT STEPS DOWN WHEN THE GLASS IS NARROW ──────────
     Three columns at every ordinary width. Under 360 px the state word takes a line of its own
     under the date instead of a column beside it: sharing that line left the date 47 px, which
     is narrower than «09/09/2026,» — the text went over the word beside it, and forcing it to
     break inside the date read «09/09/2 · 026,». One line each, whole. */
  const head=css({display:'grid',gridTemplateColumns:'40px minmax(0,1fr) minmax(0,auto)',alignItems:'center',gap:theme.sizing.scale400,
    '@media (max-width: 360px)':{gridTemplateColumns:'40px minmax(0,1fr)'}});
  const said=css({display:'inline-flex',alignItems:'center',gap:theme.sizing.scale300,minWidth:0,
    '@media (max-width: 360px)':{gridColumn:'2 / -1',justifySelf:'start'}});
  return <article data-testid="connected-phone-call" data-call={call.sid} style={{border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius400,overflow:'hidden'}}>
    <button type="button" onClick={onToggle} aria-expanded={open} className={head} style={{appearance:'none',border:0,backgroundColor:'transparent',color:'inherit',font:'inherit',width:'100%',minHeight:72,padding:theme.sizing.scale500,textAlign:'left',cursor:'pointer'}}>
      <span aria-hidden="true" style={{width:40,height:40,display:'grid',placeItems:'center',borderRadius:theme.borders.radius300,backgroundColor:theme.colors.backgroundSecondary}}>{call.direction==='inbound'?<PhoneIncoming size={18}/>:<PhoneOutgoing size={18}/>}</span>
      {/* BOTH SIDES OF THE ROW SHRINK, so neither paints through the other. `minWidth:0` was on the
          inline-flex WRAPPER only; the label inside it is a flex item at the default `min-width:auto`,
          so it refused to go under its min-content width, the wrapper overflowed its own
          `minmax(0,auto)` track, and at 320 px «Transcript saved» landed on top of «09/09/2026,
          05:00:00». Each text span carries its own `minWidth:0` and wraps instead. */}
      <span style={{minWidth:0}}><strong style={{...theme.typography.LabelMedium,display:'block'}}>{direction}</strong><span data-testid="connected-phone-call-when" style={{...theme.typography.ParagraphXSmall,color:theme.colors.contentSecondary,display:'block',minWidth:0,marginTop:theme.sizing.scale200,overflowWrap:'anywhere'}}>{new Date(call.startedAt).toLocaleString('en-GB')} · {duration}</span></span>
      <span className={said}><span data-testid="connected-phone-call-state" style={{...theme.typography.LabelXSmall,color:theme.colors.contentSecondary,minWidth:0,overflowWrap:'anywhere'}}>{call.transcript?'Transcript saved':callLabel(call)}</span><ChevronDown className={turn} size={18} aria-hidden style={{flexShrink:0}}/></span>
    </button>
    <div ref={drawerRef} className={drawer} aria-hidden={!open}><div style={{minHeight:0,overflow:'hidden'}}><div style={{display:'grid',gap:theme.sizing.scale500,padding:theme.sizing.scale500,paddingTop:0,borderTop:`1px solid ${theme.colors.borderOpaque}`}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:theme.sizing.scale300,paddingTop:theme.sizing.scale500}}>
        <span><span style={{...theme.typography.LabelXSmall,color:theme.colors.contentSecondary,display:'block'}}>Result</span><strong style={theme.typography.LabelSmall}>{callLabel(call)}</strong></span>
        <span><span style={{...theme.typography.LabelXSmall,color:theme.colors.contentSecondary,display:'block'}}>Number</span><strong style={{...theme.typography.LabelSmall,overflowWrap:'anywhere'}}>{call.direction==='inbound'?call.from:call.to}</strong></span>
      </div>
      <section>
        <button type="button" onClick={()=>setTranscriptOpen(value=>!value)} aria-expanded={transcriptOpen} data-testid="connected-phone-transcript-toggle" style={{appearance:'none',border:0,backgroundColor:'transparent',color:'inherit',font:'inherit',width:'100%',minHeight:44,padding:0,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}><span style={theme.typography.LabelMedium}>{call.transcript?'Saved transcript':'Transcript'}</span><ChevronDown className={transcriptTurn} size={18} aria-hidden/></button>
        {transcriptOpen && <SavedTranscript call={call} houseName="You" themName={displayName}/>}
      </section>
    </div></div></div>
  </article>;
}

/** Calls are communication objects inside the customer conversation; each transcript stays one level deeper. */
export function PhoneHistory({number='',displayName='Customer',onCall,initialCallSid,heading='Phone calls'}:{number?:string;displayName?:string;onCall?:()=>void;initialCallSid?:string;
  /** the list's own heading; a housing that already names the list passes false (customer sheet: «Calls») */
  heading?:React.ReactNode|false}) {
  const [,theme]=useStyletron();
  const [calls,setCalls]=React.useState<PhoneCall[]>([]),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(true),[openSid,setOpenSid]=React.useState<string|null>(initialCallSid || null);
  React.useEffect(()=>{
    let active=true,running=false;
    setCalls([]);setError('');setLoading(true);setOpenSid(initialCallSid || null);
    const refresh=async()=>{if(running)return;running=true;try{
      const rows=initialCallSid?[await phoneApi.call(initialCallSid)]:await phoneApi.history(number);
      if(active){setCalls(rows.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)));if(initialCallSid)setOpenSid(rows[0]?.sid??null);setError('');}
    }catch(caught){if(active){setCalls([]);setOpenSid(null);setError(initialCallSid?'Call unavailable':phoneError(caught));}}finally{running=false;if(active)setLoading(false);}};
    void refresh();window.addEventListener('rocoto:phone-calls-changed',refresh);
    const reset=()=>{active=false;setCalls([]);setError('Open the current connected account to read its calls.');};
    window.addEventListener('rocoto:channel-workspace-reset',reset);
    return()=>{active=false;window.removeEventListener('rocoto:phone-calls-changed',refresh);window.removeEventListener('rocoto:channel-workspace-reset',reset);};
  },[number,initialCallSid]);
  const small:React.CSSProperties={...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0};
  return <section aria-label="Phone calls" data-testid="connected-phone-history" style={{display:'grid',gap:theme.sizing.scale400}}>
    {(heading!==false || onCall) && <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:theme.sizing.scale400}}>{heading!==false && <h3 style={{...theme.typography.LabelMedium,margin:0}}>{heading}</h3>}{onCall && <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onCall} startEnhancer={()=><Phone size={16} aria-hidden/>}>Call</Button>}</header>}
    {loading?<p style={small}>Reading saved calls…</p>:error?<p role="status" style={small}>{error}</p>:calls.length===0?<p style={small}>Calls with this customer appear here.</p>:calls.map(call=><HistoryCall initialTranscript={Boolean(initialCallSid)} key={call.sid} call={call} displayName={displayName} open={openSid===call.sid} onToggle={()=>setOpenSid(value=>value===call.sid?null:call.sid)}/>) }
  </section>;
}
