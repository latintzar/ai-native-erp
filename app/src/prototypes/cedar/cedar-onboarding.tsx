import * as React from 'react';
import {useStyletron} from 'baseui';
import {Button,KIND} from 'baseui/button';
import {ArrowRight,Upload,PackageOpen,Landmark} from 'lucide-react';
import {useConfig} from './config';
import {useCompany,setCompany} from './company';
import {useDay} from './day';
import {useGrants} from './grants';
import {buildSales} from './sale';
import {useMoney} from './money-store';
import {openWhatsAppConnection,useWhatsAppCapability} from './whatsapp-connection';
import {useEmailCapability} from './email-provider';
import {EmailSetupState} from './email-setup-state';
import {usePhoneCapability} from './phone-runtime';
import {ConnectionSetupFrame,SetupChoice,SetupChoices} from './setup-frame';
import {MoneySetup} from './money-setup';
import {connectedChannelCount,connectedChannelsOf,newOnboarding,ONBOARDING_STEPS,parseOnboarding,saveChannel,type OnboardingChannel,type OnboardingState,type OnboardingStep} from './onboarding-model';
import {useOnboarding} from './onboarding-store';
import {setWorkspaceCapability,useWorkspaceCapabilities} from './workspace-capabilities';
import whatsappBusinessLogo from './connections/assets/whatsapp-business.webp';
import onboardingFixture from './fixtures/onboarding-v1.json';
import {FeatureArtwork} from './feature-artwork';

const OnboardingCatalogue=React.lazy(()=>import('./onboarding-catalogue').then(module=>({default:module.OnboardingCatalogue})));
const PhoneSetup=React.lazy(()=>import('./phone-setup').then(module=>({default:module.PhoneSetup})));
const EmailConnection=React.lazy(()=>import('./email-connection').then(module=>({default:module.EmailConnection})));
const InvoiceHistoryUpload=React.lazy(()=>import('./invoice-history-upload').then(module=>({default:module.InvoiceHistoryUpload})));

const CHANNELS=[
  {id:'whatsapp',name:'WhatsApp Business',logo:whatsappBusinessLogo},
  {id:'email',name:'Email',logo:'/connection-brands/gmail.png'},
  {id:'phone',name:'Phone',logo:'/connection-brands/twilio.png'},
] as const;
const TITLES:Partial<Record<OnboardingStep,string>>={channel:'Where do orders arrive?','channel-setup':'Connect your order channel',bank:'Connect your bank account',catalogue:'Product catalogue',history:'Invoice history',complete:'Your workspace is ready'};
const stepFromHash=():OnboardingStep|undefined=>{const value=window.location.hash.split('/')[2];return ONBOARDING_STEPS.includes(value as OnboardingStep)?value as OnboardingStep:undefined;};

export function CedarOnboarding({onComplete,onExit}:{onComplete:()=>void;onExit:()=>void}) {
  const [,theme]=useStyletron();
  const {config,derived,set}=useConfig(),cast=derived.cast,company=useCompany(),money=useMoney(cast.sector),edits=useDay(cast.sector),grants=useGrants();
  const sales=React.useMemo(()=>buildSales(cast,edits),[cast,edits,grants]);
  const initial=React.useMemo(()=>newOnboarding(cast.sector,{businessName:config.brand.name||company.legalName,address:onboardingFixture.addresses[cast.sector],ruc:money.state.setup.ruc||'20123456789'}),[cast.sector]);
  /* ── THE WALK THIS WORKSPACE TAKES (FEED-IA §247.9) ───────────────────────────────────────
     «in spains case hides the money shit». The bank step mounts `MoneySetup`, so with Money off it
     is a Money door and the walk is the channel and then the finished workspace. The model answers
     that, and the stored draft is read THROUGH it: `onboarding-store` parses with the model's own
     default, so a draft written while Money was on could still name the bank step here. Normalising
     once at the top gives the screen, the address bar and the next write one answer, and the
     correction is saved rather than re-derived on every load. */
  const {money:moneyEnabled}=useWorkspaceCapabilities(cast.sector);
  const {state:stored,save,error,setError}=useOnboarding(initial);
  const state=React.useMemo(()=>parseOnboarding(stored,initial,moneyEnabled),[stored,initial,moneyEnabled]);
  React.useEffect(()=>{if(state.step!==stored.step)save(state);},[state.step,stored.step]);
  const [historyUploadOpen,setHistoryUploadOpen]=React.useState(false);
  /* §247.2 — the email channel opens on the SAME static state every other email entrance shows,
     and the walk itself starts when the person presses `Connect email`. */
  const [emailSetupOpen,setEmailSetupOpen]=React.useState(false);
  const whatsapp=useWhatsAppCapability(cast.sector),email=useEmailCapability(),phone=usePhoneCapability();
  const providerFinished=React.useRef(false);
  /* ONE PREDICATE PER CHANNEL, AND IT IS THE PROVIDER'S (§246 · §247.2). Email used to read
     `emailStatus.kind==='connected'`, a fourth reading of the mailbox beside Connections, the
     setup card and the connected inbox; it reads the one capability now, like the phone above.
     WhatsApp joined them: `whatsappCapabilityOf` applies the strict workspace match this screen
     already applied, and the Business setup card reads the same fold through
     `connectedChannelsOf`, so two surfaces can no longer give one account two answers. */
  const connected=connectedChannelsOf({whatsappBound:whatsapp.bound,emailConnected:email.posture==='ready',phoneReady:phone.posture==='ready'});
  const connectedCount=connectedChannelCount(connected);
  /* The live mailbox names itself; the typed company address is the fallback, never the witness. */
  const contactFor=(channel:OnboardingChannel)=>channel==='email'?(email.address||company.email):channel==='phone'?phone.callerId||company.phone:whatsapp.number||company.whatsapp[0]?.number||company.phone;
  React.useEffect(()=>{money.ensureExamples(sales);},[cast.sector,sales]);
  const latest=React.useRef(state);latest.current=state;
  React.useEffect(()=>{
    /* ── A HASH NAMING A STEP THIS WORKSPACE CANNOT STAND ON RETURNS TO THE QUESTION (§246) ───
       `#/onboarding/channel-setup` is reachable directly, and with no channel chosen the model
       sent the STATE back to the question while the URL stayed on the setup step — so Back, a
       reload and a shared link all landed on a step that was already over. The model's answer
       moves the address bar too: one step, one question, one answer.

       ⚠ AND IT REPLACES THE ENTRY RATHER THAN PUSHING ONE. Assigning `location.hash` PUSHES, so
       the redirect left [ …, the deep link, the question ] in history: Back returned to the deep
       link, this reader fired again, pushed the question back on top and truncated the forward
       entry — every press landed the person where they already were, and whatever preceded the
       link (a sale, an email, the opener of a shared link) was unreachable for ever.
       `move()` keeps its push, because a step a PERSON takes is a place they came from. */
    const read=()=>{
      const step=stepFromHash();
      if(!step||step===latest.current.step)return;
      const valid=parseOnboarding({...latest.current,step},initial,moneyEnabled);
      save(valid);
      if(valid.step!==step)window.location.replace(`#/onboarding/${valid.step}`);
    };
    read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);
  },[cast.sector,moneyEnabled]);
  React.useEffect(()=>{setHistoryUploadOpen(false);setEmailSetupOpen(false);},[state.step,cast.sector]);
  const move=(next:OnboardingState)=>{const valid=parseOnboarding(next,initial,moneyEnabled);if(!save(valid))return false;if(window.location.hash.startsWith('#/onboarding'))window.location.hash=`/onboarding/${valid.step}`;return true;};
  const go=(step:OnboardingStep)=>move({...state,step});
  const recordChannel=(channel:OnboardingChannel,status:'sample'|'prepared'|'connected',selectedContact=contactFor(channel))=>{
    const value=selectedContact.trim();
    if(!value){setError('Enter the address or number your customers use.');return;}
    if(channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){setError('Enter your business email address.');return;}
    if(channel!=='email'&&value.replace(/\D/g,'').length<7){setError('Enter your business phone number with its country code.');return;}
    if(status==='connected'){
      const companyPatch=channel==='email'?{email:value}:channel==='phone'?{phone:value}:{whatsapp:company.whatsapp.some(row=>row.number===value)?company.whatsapp:[...company.whatsapp,{number:value}]};
      if(!setCompany(companyPatch)){setError('Allow browser storage, then save this channel again.');return;}
    }
    providerFinished.current=true;
    /* WITH MONEY OFF THE CHANNEL IS THE LAST STEP, so the act that records it is the act that
       prepares the workspace — the job the bank step does where Money is on. */
    const next=saveChannel(state,{channel,status},moneyEnabled);
    if(!(moneyEnabled?move(next):finish(next)))providerFinished.current=false;
  };
  const providerClose=()=>{if(!providerFinished.current)go('channel');};
  const openWhatsApp=()=>openWhatsAppConnection({presentation:'page',onClose:providerClose,
    onComplete:connection=>recordChannel('whatsapp','connected',connection.number),
    onTestComplete:number=>recordChannel('whatsapp','sample',number)});
  const chooseChannel=(channel:OnboardingChannel)=>{
    providerFinished.current=false;
    if(!move({...state,selectedChannel:channel,step:'channel-setup'}))return;
    if(channel==='whatsapp')openWhatsApp();
  };
  const finish=(base:OnboardingState=state)=>{
    if(!set({stock:{mode:'none'},albaran:{...config.albaran,values:'valued'}})||!setWorkspaceCapability('pricing',true,cast.sector)||!setWorkspaceCapability('inventory',false,cast.sector)||!move({...base,step:'complete',workspacePrepared:true})){setError('Allow browser storage, then finish your workspace setup.');return false;}
    return true;
  };
  const paragraph:React.CSSProperties={...theme.typography.ParagraphMedium,color:theme.colors.contentSecondary,margin:0};
  const small:React.CSSProperties={...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0};
  const stack={display:'grid',gap:theme.sizing.scale600} as const;

  if(state.step==='channel-setup'&&state.selectedChannel==='phone')return <React.Suspense fallback={<p>Opening phone setup…</p>}><PhoneSetup presentation="page" onClose={providerClose} onComplete={({mode,sourceNumber})=>recordChannel('phone',mode,sourceNumber)} tenant={cast.sector} sourceNumber={contactFor('phone')} members={company.members} officeHours={company.hours.office} onPrepared={prepared=>recordChannel('phone','prepared',prepared.sourceNumber)}/></React.Suspense>;
  if(state.step==='channel-setup'&&state.selectedChannel==='email'){
    /* ONE PICTURE AND ONE ACT, HERE TOO (§247.2). A workspace with a live mailbox walks straight
       into its accounts; every other posture meets the envelope and `Connect email` first, which
       is what a person sees from Connections, the connected inbox and the customer sheet. */
    if(email.posture!=='ready'&&!emailSetupOpen)return <ConnectionSetupFrame title="Connect email" presentation="page" onClose={onExit} onBack={()=>go('channel')} testId="cedar-onboarding">
      <div data-testid="onboarding-step" data-step="channel-setup" data-channel="email" style={stack}>
        <EmailSetupState onOpenSetup={()=>setEmailSetupOpen(true)}/>
      </div>
    </ConnectionSetupFrame>;
    return <React.Suspense fallback={<p>Opening email setup…</p>}><EmailConnection scope={cast.sector} presentation="page" onClose={providerClose} onSampleComplete={()=>recordChannel('email','sample')} onComplete={status=>{const account=status.accounts.find(item=>item.status==='connected');if(account)recordChannel('email','connected',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.label)?account.label:contactFor('email'));}}/></React.Suspense>;
  }
  if(state.step==='history'&&historyUploadOpen)return <React.Suspense fallback={<p>Opening invoice upload…</p>}><InvoiceHistoryUpload presentation="page" onClose={()=>setHistoryUploadOpen(false)} onBack={()=>setHistoryUploadOpen(false)} onResults={()=>{setHistoryUploadOpen(false);go('complete');}}/></React.Suspense>;
  if(moneyEnabled&&state.step==='bank')return <MoneySetup kind="payments" presentation="page" onClose={onExit} onComplete={()=>finish()} doneLabel="Finish setup" defaultAccountLabel="Main receiving account" identityCollected onEditIdentity={()=>{window.location.hash='#/admin/business';}} onBackToPrevious={()=>go('channel')}/>;

  const title=TITLES[state.step]||'Business setup';
  return <ConnectionSetupFrame title={title} presentation="page" onClose={onExit} onBack={state.step==='channel-setup'?()=>go('channel'):state.step==='catalogue'||state.step==='history'?()=>go('complete'):undefined} testId="cedar-onboarding">
    <div data-testid="onboarding-step" data-step={state.step} style={stack}>
      {error&&<p role="alert" style={{...small,color:theme.colors.negative}}>{error}</p>}
      {state.step==='channel'&&<>
        <SetupChoices testId="onboarding-channel-choices">
          {CHANNELS.map(({id,name,logo})=><SetupChoice key={id} variant="tile" connected={connected[id]} name={name} logo={logo} onClick={()=>chooseChannel(id)} testId={`onboarding-channel-${id}`}/>)}
        </SetupChoices>
        {connectedCount>0&&<>
          <p style={small} data-testid="onboarding-connected-count">{connectedCount} connected</p>
          {/* ── THE PERSON PICKS THEIR ORDER CHANNEL, RATHER THAN THE ARRAY (§246 acceptance 5) ──
              Continue used to take `CHANNELS.find(row=>connected[row.id])!.id` — the first entry in
              DECLARATION order. With phone genuinely connected and WhatsApp connected too it
              recorded WhatsApp, because WhatsApp is written first in this file. The count above
              describes a SET, and one act that silently picks a member of it is a decision the
              person should be making. One connected channel keeps one Continue; several put the
              channel's own name on each act, so the menu appears exactly when there is a choice. */}
          {connectedCount===1
            ? <Button data-testid="onboarding-use-connected" onClick={()=>{const only=CHANNELS.find(row=>connected[row.id]);if(only)recordChannel(only.id,'connected');}} endEnhancer={()=><ArrowRight size={18} aria-hidden/>}>Continue</Button>
            : <div data-testid="onboarding-connected-choice" style={{display:'grid',gap:theme.sizing.scale300}}>
                {CHANNELS.filter(row=>connected[row.id]).map(row=><Button key={row.id} data-testid={`onboarding-use-${row.id}`}
                  onClick={()=>recordChannel(row.id,'connected')} endEnhancer={()=><ArrowRight size={18} aria-hidden/>}>Continue on {row.name}</Button>)}
              </div>}
        </>}
      </>}
      {/* ── THE STEP'S ONE ACT MATCHES THE CHANNEL THAT WAS CHOSEN (§246) ──────────────────────
          Phone and email take their own early returns above; anything else fell through to a
          hardcoded WhatsApp button, so a step titled «Connect your order channel» offered WhatsApp
          whatever the person had picked. The act stands for a WhatsApp choice, and every other
          case is walked back to the question the step is an answer to. */}
      {state.step==='channel-setup'&&state.selectedChannel==='whatsapp'&&
        <Button onClick={openWhatsApp} data-testid="onboarding-provider-setup" endEnhancer={()=><ArrowRight size={18} aria-hidden/>}>Connect WhatsApp Business</Button>}
      {state.step==='channel-setup'&&state.selectedChannel!=='whatsapp'&&
        <Button kind={KIND.secondary} data-testid="onboarding-choose-channel" onClick={()=>go('channel')}>Choose your order channel</Button>}
      {state.step==='catalogue'&&<>
        <p style={paragraph}>Add the products and prices customers order.</p>
        <React.Suspense fallback={<p style={small}>Opening product catalogue…</p>}><OnboardingCatalogue cast={cast} onDone={catalogue=>move({...state,catalogue,step:'complete'})}/></React.Suspense>
      </>}
      {state.step==='history'&&<>
        <p style={paragraph}>Bring earlier customer and supplier invoices into your records.</p>
        <Button onClick={()=>setHistoryUploadOpen(true)} startEnhancer={()=><Upload size={18} aria-hidden/>} data-testid="onboarding-upload-invoices">Upload invoices</Button>
      </>}
      {state.step==='complete'&&<>
        <FeatureArtwork kind="delivery" size={132}/>
        <Button onClick={onComplete} data-testid="onboarding-start-selling" endEnhancer={()=><ArrowRight size={18} aria-hidden/>}>Open workspace</Button>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))',gap:theme.sizing.scale300}}>
          <Button kind={KIND.secondary} onClick={()=>{window.location.hash='#/admin/business';}} startEnhancer={()=><Landmark size={18} aria-hidden/>}>Business details</Button>
          <Button kind={KIND.secondary} onClick={()=>go('catalogue')} startEnhancer={()=><PackageOpen size={18} aria-hidden/>}>Product catalogue</Button>
          <Button kind={KIND.secondary} onClick={()=>go('history')} startEnhancer={()=><Upload size={18} aria-hidden/>}>Invoice history</Button>
        </div>
      </>}
    </div>
  </ConnectionSetupFrame>;
}
