import * as React from 'react';
import {useStyletron} from 'baseui';
import {Button,KIND,SIZE,SHAPE} from 'baseui/button';
import {Input} from 'baseui/input';
import {Phone,PhoneOff,Mic,MicOff,MessageCircle,ChevronDown,Grid3X3,X} from 'lucide-react';
import type {Customer} from '../../scenarios/data/cast';
import {EMAIL} from '../../rocoto-theme';
import {useConfig} from './config';
import {useCompany} from './company';
import {useHistoryLayer} from './anchors';
import {ConnectionSetupFrame} from './setup-frame';
import {FeatureArtwork} from './feature-artwork';
import {callClock,callSeconds,callEnded,type PhoneCall,type LiveUtterance} from './phone-call-model';
import {phoneError,usePhoneCapability} from './phone-runtime';
import {usePhoneSession,mountPhoneSession,startPhoneCall,answerPhoneCall,endPhoneCall,mutePhoneCall,
  sendPhoneDigits,minimisePhoneCall,openPhoneCall,dismissPhoneCall,refreshPhoneCalls,
  registerPhoneDialHost,type PhoneDialRequest} from './phone-session';

const PHONE_MOTION='400ms';
const PHONE_EASE='cubic-bezier(0.22, 1, 0.36, 1)';
/** The setup walk the in-place dial opens. Lazy, so the always-mounted controller carries the
 *  dial's own weight and nothing more until somebody presses `Connect phone`. */
const PhoneSetupDialog=React.lazy(()=>import('./phone-setup').then(module=>({default:module.PhoneSetup})));

/** One recognisable phone mark for every call entry: handset plus keypad in the channel blue. */
export function PhoneKeypadMark({size=20}:{size?:number}) {
  const [,theme]=useStyletron();
  return <span aria-hidden="true" style={{position:'relative',width:size+8,height:size+8,display:'inline-grid',placeItems:'center',flex:'0 0 auto',color:EMAIL.blue}}>
    <Phone size={size}/>
    <span style={{position:'absolute',right:0,bottom:0,width:Math.max(12,Math.round(size*.68)),height:Math.max(12,Math.round(size*.68)),display:'grid',placeItems:'center',borderRadius:theme.borders.radius100,backgroundColor:theme.colors.backgroundPrimary,boxShadow:`0 0 0 2px ${theme.colors.backgroundPrimary}`}}>
      <Grid3X3 size={Math.max(10,Math.round(size*.55))}/>
    </span>
  </span>;
}

function speakerName(call:PhoneCall,line:Pick<LiveUtterance,'speaker'|'track'>,who:string) {
  if(line.speaker===0)return 'You';
  if(line.speaker===1)return who;
  return (line.track==='inbound')===(call.direction==='outbound')?'You':who;
}

function Transcript({call,who,live}:{call:PhoneCall;who:string;live:boolean}) {
  const [,theme]=useStyletron();
  const rows=call.transcript?.utterances.map((line,index)=>({
    id:`saved-${index}`,speaker:line.speaker,start:line.start,text:line.text,track:(line.speaker===0?'outbound':'inbound') as 'outbound'|'inbound',final:true,
  })) ?? call.liveTranscript?.utterances ?? [];
  const small:React.CSSProperties={...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0};
  if(!rows.length)return <p style={small}>{live?'Words appear here during the call.':'The saved transcript is being prepared.'}</p>;
  return <div data-testid={live?'phone-live-transcript':'phone-saved-transcript'} aria-live={live?'polite':undefined} aria-relevant={live?'additions text':undefined} style={{display:'grid',gap:theme.sizing.scale300}}>
    {rows.map(line=>{
      const name=speakerName(call,line,who),mine=name==='You';
      return <div key={line.id} style={{maxWidth:'88%',justifySelf:mine?'end':'start',padding:`${theme.sizing.scale400} ${theme.sizing.scale500}`,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius400,backgroundColor:mine?theme.colors.backgroundSecondary:theme.colors.backgroundPrimary}}>
        <span style={{...theme.typography.LabelXSmall,display:'block',color:theme.colors.contentSecondary,marginBottom:theme.sizing.scale200}}>{name} · {callClock(Math.floor(line.start))}{line.final?'':' · Listening'}</span>
        <span style={{...theme.typography.ParagraphSmall,overflowWrap:'anywhere'}}>{line.text}</span>
      </div>;
    })}
  </div>;
}

function PhoneKeypad({onDigit,onClose}:{onDigit:(digit:string)=>void;onClose:()=>void}) {
  const [,theme]=useStyletron();
  return <div data-testid="phone-call-keypad" style={{display:'grid',gridTemplateColumns:'repeat(3,56px)',justifyContent:'center',gap:theme.sizing.scale300}}>
    {'123456789*0#'.split('').map(digit=><Button key={digit} kind={KIND.tertiary} shape={SHAPE.circle} aria-label={`Key ${digit}`} onClick={()=>onDigit(digit)} overrides={{BaseButton:{style:{width:'56px',height:'56px',backgroundColor:theme.colors.backgroundSecondary}}}}>{digit}</Button>)}
    <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose} overrides={{BaseButton:{style:{gridColumn:'1 / -1',minHeight:'44px'}}}}>Close keypad</Button>
  </div>;
}

/** The app root's one phone mount: the dial a surface asked for, and the current call. */
export function PhoneCallController() {
  return <><PhoneDialHost/><CallPanel/></>;
}

/* THE DIAL, MOUNTED WHERE A ROUTE CHANGE CANNOT REACH IT. `openPhoneDial` in `phone-session.ts`
   sends a request here whenever the surface that was pressed is an overlay rather than a route, so
   the customer sheet over a product card and the connected inbox keep standing behind the dial. */
function PhoneDialHost() {
  const {derived}=useConfig();
  const company=useCompany();
  const [request,setRequest]=React.useState<PhoneDialRequest|null>(null);
  /* THE WALK FINISHES WHERE IT STANDS. The in-place dial used to have no `onOpenSettings`, so its
     one act fell through to `location.hash='#/admin/connections'` — the single control the overlay's
     dial offers took the overlay away, and landed somewhere different from the identical press on
     the route dial. It gets the route's own door: setup opens INSIDE this mount, above the same
     surface, and closing it returns to the same dial. */
  const [setup,setSetup]=React.useState(false);
  React.useEffect(()=>registerPhoneDialHost(next=>{setRequest(next);setSetup(false);}),[]);
  /* AND IT EARNS ITS OWN BACK STEP. The dial used to watch the ADDRESS alone, and both surfaces it
     exists for are same-address history layers: `customer-sheet-overlay` and the chat panel push
     with `pushState(…, window.location.href)`, so the first browser Back fires `popstate` at an
     unchanged href — the surface went and the dial stayed, floating over whatever was drawn next.
     It takes the step every other in-place surface takes, so ONE Back closes the dial and leaves
     the surface beneath it standing. The `hashchange` drop stays for the addressed areas, whose
     move is a real hash change and carries no layer of its own. */
  useHistoryLayer({
    id:'phone-dial',
    active:Boolean(request),
    onRestore:(saved)=>{if(!saved){setRequest(null);setSetup(false);}},
  });
  React.useEffect(()=>{
    const drop=()=>{setRequest(null);setSetup(false);};
    window.addEventListener('hashchange',drop);
    return()=>window.removeEventListener('hashchange',drop);
  },[]);
  const customers=derived.cast.customers;
  /* The number the entrance carried outranks the account's stored one, exactly as on the route. */
  const initial=React.useMemo(()=>{
    if(!request)return null;
    const match=customers.find(customer=>customer.id===request.customerId);
    if(match)return request.number && match.phone!==request.number?{...match,phone:request.number}:match;
    return request.number?{id:'dial-number',name:'',phone:request.number,channel:'phone' as const,tier:'',settles:'cash on delivery' as const}:null;
  },[customers,request]);
  if(!request)return null;
  if(setup)return <React.Suspense fallback={null}>
    <PhoneSetupDialog presentation="dialog" tenant={derived.cast.sector} sourceNumber={company.phone} members={company.members}
      onClose={()=>setSetup(false)} onComplete={()=>setSetup(false)}/>
  </React.Suspense>;
  return <PhoneDialDialog isOpen onClose={()=>setRequest(null)} customers={customers} initialCustomer={initial}
    onOpenSettings={()=>setSetup(true)}/>;
}

function CallPanel() {
  const [css,theme]=useStyletron(),session=usePhoneSession(),phone=usePhoneCapability();
  const [now,setNow]=React.useState(Date.now()),[transcriptOpen,setTranscriptOpen]=React.useState(false),[keypadOpen,setKeypadOpen]=React.useState(false);
  React.useEffect(()=>{setTranscriptOpen(false);setKeypadOpen(false);},[session.active?.sid]);
  /* THE SESSION FOLLOWS THE ACCOUNT, NOT THE WHOLE WALK. Incoming calls, active-call recovery and
     hang-up need a live provider account for this line; caller-ID and forwarding verification gate
     PLACING a call, which is the dial dialog's own question. */
  React.useEffect(()=>{if(phone.accountReady)return mountPhoneSession();},[phone.accountReady]);
  React.useEffect(()=>{if(!session.active || callEnded(session.active))return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[session.active?.sid,session.active?.status]);
  const call=session.active;if(!call && !session.placing)return null;
  const number=call?.direction==='inbound'?call.from:call?.to || '';
  const who=session.name || number || 'Phone call';
  const ended=call ? callEnded(call) : false;
  const clock=call ? callClock(callSeconds(call,now)) : '0:00';
  const ringing=call?.status==='ringing';
  const status=session.placing?'Starting call':session.incoming?'Incoming call':call?.status==='in-progress'?'On call':ended?'Call ended':ringing?'Ringing':'Connecting';
  const conversation=()=>{window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{number,customerId:session.customerId}}));minimisePhoneCall();};
  const shell=css({
    position:'fixed',zIndex:2200,top:theme.sizing.scale600,right:theme.sizing.scale600,
    width:session.expanded?'min(440px, calc(100vw - 24px))':'min(340px, calc(100vw - 24px))',boxSizing:'border-box',
    backgroundColor:theme.colors.backgroundPrimary,color:theme.colors.contentPrimary,border:`1px solid ${theme.colors.borderOpaque}`,
    borderRadius:theme.borders.radius400,boxShadow:theme.lighting.shadow600,overflow:'hidden',
    transitionProperty:'width, transform, opacity',transitionDuration:PHONE_MOTION,transitionTimingFunction:PHONE_EASE,
    '@media (max-width: 600px)':{top:'auto',right:theme.sizing.scale400,bottom:theme.sizing.scale600,left:theme.sizing.scale400,width:'auto'},
    '@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'},
  });
  const drawer=css({
    display:'grid',gridTemplateRows:session.expanded?'1fr':'0fr',opacity:session.expanded?1:0,
    transitionProperty:'grid-template-rows, opacity',transitionDuration:PHONE_MOTION,transitionTimingFunction:PHONE_EASE,
    visibility:session.expanded?'visible':'hidden',
    '@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'},
  });
  const chevron=css({transitionProperty:'transform',transitionDuration:PHONE_MOTION,transitionTimingFunction:PHONE_EASE,transform:transcriptOpen?'rotate(180deg)':'rotate(0deg)','@media (prefers-reduced-motion: reduce)':{transitionDuration:'0ms'}});
  const small:React.CSSProperties={...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0};
  const blueButton={BaseButton:{style:{backgroundColor:EMAIL.blue,color:EMAIL.onBlue,':hover':{backgroundColor:`color-mix(in srgb, ${EMAIL.blue} 88%, ${theme.colors.contentPrimary})`},':active':{backgroundColor:`color-mix(in srgb, ${EMAIL.blue} 78%, ${theme.colors.contentPrimary})`}}}};
  return <aside className={shell} aria-label="Current phone call" data-testid="phone-call-controller" data-call-status={call?.status || 'placing'} data-expanded={session.expanded?'yes':'no'}>
    <header style={{display:'flex',alignItems:'center',gap:theme.sizing.scale400,padding:theme.sizing.scale500}}>
      <span style={{width:40,height:40,display:'grid',placeItems:'center',borderRadius:theme.borders.radius300,backgroundColor:`color-mix(in srgb, ${EMAIL.blue} 12%, ${theme.colors.backgroundPrimary})`}}><PhoneKeypadMark size={20}/></span>
      <button onClick={conversation} data-testid="phone-call-conversation" aria-label={`Open conversation with ${who}`} style={{appearance:'none',border:0,background:'transparent',color:'inherit',padding:0,textAlign:'left',flex:1,minWidth:0,cursor:'pointer'}}>
        <strong style={{...theme.typography.LabelMedium,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{who}</strong>
        <span style={small}>{status} · <span data-testid="phone-call-duration" style={{fontVariantNumeric:'tabular-nums'}}>{clock}</span></span>
      </button>
      {session.expanded?<Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Minimise call" onClick={minimisePhoneCall} data-testid="phone-call-minimise"><ChevronDown size={20} aria-hidden/></Button>
        :<Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Open call controls" onClick={openPhoneCall} data-testid="phone-call-expand"><Phone size={19} aria-hidden/></Button>}
      {!session.expanded && !ended && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="End call" onClick={()=>void endPhoneCall()} data-testid="phone-call-end-mini"><PhoneOff size={19} aria-hidden/></Button>}
      {!session.expanded && ended && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Close call" onClick={dismissPhoneCall} data-testid="phone-call-dismiss-mini"><X size={19} aria-hidden/></Button>}
    </header>
    <div className={drawer} aria-hidden={!session.expanded}>
      <div style={{minHeight:0,overflowY:'auto',display:'grid',gap:theme.sizing.scale500,padding:theme.sizing.scale500,paddingTop:0,maxHeight:'min(72dvh, 640px)'}}>
        {session.name && number && <p style={small}>{number}</p>}
        {ringing && call?.direction==='inbound' && <p style={small}>Your browser and mobile are ringing. The first answer connects the call.</p>}
        <div style={{display:'grid',gridTemplateColumns:session.incoming?'repeat(2,minmax(0,1fr))':'repeat(3,minmax(0,1fr))',gap:theme.sizing.scale300}}>
          {session.incoming && <Button onClick={()=>void answerPhoneCall()} data-testid="phone-call-answer" startEnhancer={()=><Phone size={18} aria-hidden/>} overrides={blueButton}>Answer here</Button>}
          {!session.incoming && session.route==='browser' && !ended && <Button kind={KIND.secondary} onClick={mutePhoneCall} data-testid="phone-call-mute" startEnhancer={()=>session.muted?<MicOff size={18} aria-hidden/>:<Mic size={18} aria-hidden/>}>{session.muted?'Unmute':'Mute'}</Button>}
          {!session.incoming && session.route==='browser' && call?.status==='in-progress' && <Button kind={KIND.secondary} onClick={()=>setKeypadOpen(value=>!value)} aria-pressed={keypadOpen} data-testid="phone-call-keypad-toggle" startEnhancer={()=><Grid3X3 size={18} aria-hidden/>}>Keypad</Button>}
          {ended?<Button kind={KIND.secondary} onClick={dismissPhoneCall} data-testid="phone-call-dismiss">Close</Button>
            :<Button kind={KIND.secondary} onClick={()=>void endPhoneCall()} data-testid="phone-call-end" startEnhancer={()=><PhoneOff size={18} aria-hidden/>}>{session.incoming?'Decline':'End'}</Button>}
        </div>
        {session.route==='mobile' && !ended && <p style={small}>Use your mobile for audio. Call controls and hang up stay available here.</p>}
        {keypadOpen && <PhoneKeypad onDigit={sendPhoneDigits} onClose={()=>setKeypadOpen(false)}/>}
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={conversation} startEnhancer={()=><MessageCircle size={18} aria-hidden/>}>Return to conversation</Button>
        {call && <section style={{borderTop:`1px solid ${theme.colors.borderOpaque}`,paddingTop:theme.sizing.scale400}}>
          <button type="button" aria-expanded={transcriptOpen} onClick={()=>setTranscriptOpen(value=>!value)} data-testid="phone-call-transcript-toggle" style={{...theme.typography.LabelMedium,display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',minHeight:44,padding:0,border:0,background:'transparent',color:'inherit',cursor:'pointer'}}>
            <span>{call.transcript?'Saved transcript':'Live transcript'}</span><ChevronDown className={chevron} size={18} aria-hidden/>
          </button>
          {transcriptOpen && <Transcript call={call} who={who} live={!call.transcript}/>}
        </section>}
        {session.error && <div role="status" style={{display:'grid',gap:theme.sizing.scale300}}><p style={small}>{session.error}</p><Button kind={KIND.tertiary} size={SIZE.compact} onClick={()=>void refreshPhoneCalls()}>Refresh call</Button></div>}
      </div>
    </div>
  </aside>;
}
export default PhoneCallController;

function DialKeypad({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [,theme]=useStyletron();
  return <div data-testid="phone-dial-keypad" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:theme.sizing.scale300,maxWidth:280,justifySelf:'center',width:'100%'}}>
    {'123456789*0#'.split('').map(digit=><Button key={digit} kind={KIND.tertiary} shape={SHAPE.circle} aria-label={`Key ${digit}`} onClick={()=>onChange(`${value}${digit}`)} overrides={{BaseButton:{style:{width:'56px',height:'56px',justifySelf:'center',backgroundColor:theme.colors.backgroundSecondary}}}}>{digit}</Button>)}
  </div>;
}

export function PhoneDialDialog({isOpen,onClose,initialCustomer,customers,onOpenSettings}: {
  isOpen:boolean;onClose:()=>void;initialCustomer?:Customer|null;customers:Customer[];
  onOpenSettings?:()=>void;onPreview?:()=>void;
}) {
  const [,theme]=useStyletron(),phone=usePhoneCapability(),session=usePhoneSession();
  const initialMatch=initialCustomer ? customers.find(customer=>customer.id===initialCustomer.id || Boolean(initialCustomer.phone && customer.phone===initialCustomer.phone)) : undefined;
  const [number,setNumber]=React.useState(initialCustomer?.phone || ''),[name,setName]=React.useState(initialCustomer?.name || '');
  const [customerId,setCustomerId]=React.useState<string|null>(initialMatch?.id || null);
  const [chosen,setChosen]=React.useState<'browser'|'phone'|null>(null),[error,setError]=React.useState(''),[keypad,setKeypad]=React.useState(false);
  React.useEffect(()=>{if(isOpen){setNumber(initialCustomer?.phone || '');setName(initialCustomer?.name || '');setCustomerId(initialMatch?.id || null);setChosen(null);setError('');setKeypad(false);}},[isOpen,initialCustomer,initialMatch?.id]);
  /* The answering route is a provider fact too: a browser the line has yet to register answers on
     the mobile, so the choice opens where the call can actually land — and returns to the browser
     the moment the line registers it. A one-way effect latched `My mobile` for the rest of the
     dialog's life whenever the first render landed before the provider answered. The person's own
     press is the only thing that outranks the provider. */
  const mode=chosen ?? (phone.browserReady?'browser':'phone');
  const setMode=setChosen;
  if(!isOpen)return null;
  /* ONE PICTURE FOR EVERY POSTURE THAT IS NOT A LINE (§246). Checking, unavailable, setup and a
     half-commissioned line all present the same artwork, the same sentence and the same act — so
     a person who presses Call twice sees the same thing twice, whatever the service is doing. */
  const connected=phone.posture==='ready';
  const canCall=connected && (mode==='phone' || phone.browserReady);
  const valid=/^\+[1-9]\d{6,14}$/.test(number.replace(/[\s()-]/g,''));
  const dial=async()=>{try{setError('');await startPhoneCall(number,mode,name,customerId || undefined);onClose();}catch(caught){setError(phoneError(caught));}};
  const setup=()=>{if(onOpenSettings){onOpenSettings();return;}onClose();location.hash='#/admin/connections';};
  const blueButton={BaseButton:{style:{backgroundColor:EMAIL.blue,color:EMAIL.onBlue,':hover':{backgroundColor:`color-mix(in srgb, ${EMAIL.blue} 88%, ${theme.colors.contentPrimary})`},':active':{backgroundColor:`color-mix(in srgb, ${EMAIL.blue} 78%, ${theme.colors.contentPrimary})`}}}};
  if(!connected)return <ConnectionSetupFrame presentation="dialog" title="Phone calls" onClose={onClose} testId="phone-dial-dialog">
    <div data-testid="phone-call-setup-state" data-phone-posture={phone.posture} style={{display:'grid',justifyItems:'center',gap:theme.sizing.scale500,textAlign:'center'}}>
      <FeatureArtwork kind="phone" size={184}/>
      <p style={{...theme.typography.ParagraphMedium,color:theme.colors.contentSecondary,margin:0,maxWidth:320}}>Connect your phone with Twilio to make calls.</p>
      <Button onClick={setup} data-testid="phone-call-open-setup" overrides={blueButton}>Connect phone</Button>
      {phone.error && <p role="status" data-testid="phone-call-setup-note" style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0,maxWidth:320}}>{phone.error}</p>}
    </div>
  </ConnectionSetupFrame>;
  return <ConnectionSetupFrame presentation="dialog" title={name?`Call ${name}`:'Call someone'} onClose={onClose} testId="phone-dial-dialog">
    <div style={{display:'grid',gap:theme.sizing.scale500}}>
      {!initialCustomer && <select aria-label="Customer to call" data-testid="phone-call-customer" value={customerId || ''} onChange={event=>{const customer=customers.find(row=>row.id===event.target.value);if(customer){setCustomerId(customer.id);setNumber(customer.phone || '');setName(customer.name);}else{setCustomerId(null);setName('');}}} style={{...theme.typography.ParagraphMedium,minHeight:44,padding:theme.sizing.scale400,color:theme.colors.contentPrimary,background:theme.colors.backgroundPrimary,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius200}}>
        <option value="">Choose a customer or enter a number</option>{customers.filter(customer=>customer.phone).map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}
      </select>}
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 48px',gap:theme.sizing.scale300}}>
        <Input value={number} onChange={event=>{setNumber(event.currentTarget.value);setName('');setCustomerId(null);}} type="tel" aria-label="Number to call" placeholder="+34 600 00 00 00" maxLength={40} overrides={{Input:{props:{inputMode:'tel','data-testid':'phone-call-number'}}}}/>
        <Button kind={KIND.secondary} shape={SHAPE.circle} aria-label="Open keypad" aria-pressed={keypad} onClick={()=>setKeypad(value=>!value)} data-testid="phone-dial-keypad-toggle"><Grid3X3 size={20} aria-hidden/></Button>
      </div>
      {keypad && <DialKeypad value={number} onChange={value=>{setNumber(value);setName('');setCustomerId(null);}}/>}
      <p style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0}}>Caller ID: {phone.callerId}</p>
      {/* A read that could not confirm the line keeps the dial exactly as it is and says so once. */}
      {phone.stale && <p role="status" data-testid="phone-dial-stale" style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0}}>Checking…</p>}
      <strong style={theme.typography.LabelMedium}>Answer on</strong>
      <div role="group" aria-label="Answer call on" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:theme.sizing.scale300}}>{(['browser','phone'] as const).map(value=><Button key={value} kind={mode===value?KIND.primary:KIND.secondary} onClick={()=>setMode(value)} aria-pressed={mode===value} disabled={value==='browser' && !phone.browserReady} data-testid={`phone-answer-${value}`}>{value==='browser'?'This browser':'My mobile'}</Button>)}</div>
      <Button onClick={()=>void dial()} disabled={!canCall || !valid || (Boolean(session.active) && !callEnded(session.active!))} isLoading={session.placing} data-testid="phone-place-call" startEnhancer={()=><PhoneKeypadMark size={18}/>} overrides={blueButton}>Call {name || number || 'number'}</Button>
      {/* A stale read has already said «Checking…» one line up, so it says nothing twice. What
          reaches the alert is a call that actually failed, or a connection the provider answered
          about. */}
      {(error || (!phone.stale && phone.error)) && <p role="alert" style={{...theme.typography.ParagraphSmall,color:theme.colors.negative,margin:0}}>{error || phone.error}</p>}
    </div>
  </ConnectionSetupFrame>;
}
