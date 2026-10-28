import * as React from 'react';
import { useStyletron } from 'baseui';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useConfig, loadConfig, type ConfigState } from './config';
import { useCompany } from './company';
import { useDay } from './day';
import { useGrants } from './grants';
import { buildSales, type Sale } from './sale';
import { useMoney } from './money-store';
import { ConnectionSetupFrame, SetupDisclosure } from './setup-frame';
import { FeatureArtwork } from './feature-artwork';
import { setWorkspaceCapability, useWorkspaceCapabilities } from './workspace-capabilities';
import { newOnboarding, type OnboardingState } from './onboarding-model';
import { readOnboarding, writeOnboarding } from './onboarding-store';
import onboardingFixture from './fixtures/onboarding-v1.json';

/** The same company, money ledger and capability switches used by the ordinary workspace. */
export function prepareCompletedDemo({ scope, sales, money, onboarding, setConfig }: {
  scope: string; sales: Sale[]; money: ReturnType<typeof useMoney>; onboarding: OnboardingState; setConfig: ConfigState['set'];
}): { ok: true } | { ok: false; error: string } {
  const seeded = money.ensureExamples(sales);
  if (seeded && !seeded.ok) return seeded;
  if (onboarding.step === 'complete' && onboarding.workspacePrepared) return { ok: true };
  if (!onboarding.workspacePrepared) {
    if (!setConfig({ stock: { mode:'none' }, albaran: { ...loadConfig().albaran, values:'valued' } })
      || !setWorkspaceCapability('pricing', true, scope) || !setWorkspaceCapability('inventory', false, scope))
      return { ok: false, error: 'Allow browser storage, then open the workspace.' };
    /* «Open workspace» PREPARES DATA (FEED-IA §247.2). It used to connect three money providers
       and file a WhatsApp channel row in one press, so a person who had authorised nothing read
       ✓Connected on four surfaces. It now writes the business identity and the account's drafted
       name; every connection card stands at the posture its provider reports. */
    const setup = money.state.setup;
    const prepared = money.updateSetup({ sellerName: setup.sellerName || onboarding.businessName,
      ruc: setup.ruc || onboarding.ruc, bank: setup.bank || 'bbva', bankAccountLabel: setup.bankAccountLabel || 'Main receiving account' });
    if (!prepared.ok) return prepared;
  }
  const finished: OnboardingState = { ...onboarding, step:'complete', workspacePrepared:true, catalogue: onboarding.catalogue === 'pending' ? 'sample' : onboarding.catalogue,
    channels: onboarding.channels };
  if (!writeOnboarding(finished)) return { ok: false, error: 'Allow browser storage, then save the setup.' };
  return { ok: true };
}

export function DemoWelcome({ onOnboarding, onStartSelling, autoStart = false }: { onOnboarding: () => void; onStartSelling: () => void; autoStart?: boolean }) {
  const [css, theme] = useStyletron();
  const { config, derived, set } = useConfig();
  const cast = derived.cast;
  const company = useCompany();
  const money = useMoney(cast.sector);
  /* The two tiles describe the walk THIS workspace takes (FEED-IA §247.9): with Money off the
     setup ends at the order channel and the workspace holds orders and customers. */
  const { money: moneyOn } = useWorkspaceCapabilities(cast.sector);
  const edits = useDay(cast.sector), grants = useGrants();
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const [error, setError] = React.useState('');
  const fallback = newOnboarding(cast.sector, { businessName: config.brand.name || company.legalName,
    address: onboardingFixture.addresses[cast.sector], ruc: money.state.setup.ruc });
  const progress = readOnboarding(fallback);
  const start = () => {
    const result = prepareCompletedDemo({ scope:cast.sector,sales,money,onboarding:progress,setConfig:set });
    if (!result.ok) { setError(result.error); return; }
    setError(''); onStartSelling();
  };
  const started = React.useRef(false);
  React.useEffect(() => { if (autoStart && !started.current) { started.current = true; start(); } }, [autoStart]);
  const view = () => {
    if (progress.step === 'complete') {
      if (!writeOnboarding({ ...newOnboarding(cast.sector, { businessName:config.brand.name || company.legalName,
        address:company.fiscalAddress !== cast.house.fiscalAddress ? company.fiscalAddress : progress.address,
        ruc:money.state.setup.ruc || progress.ruc }), workspacePrepared:progress.workspacePrepared })) { setError('Allow browser storage, then begin setup.'); return; }
      try { localStorage.removeItem(`rocoto-cedar-meta-preview-v1:${cast.sector}`); } catch { /* The saved provider preview can still be reviewed. */ }
    }
    onOnboarding();
  };
  return <ConnectionSetupFrame title={`Welcome, ${config.owner.name}`}
    description={fallback.businessName} presentation="page" onClose={start} testId="demo-welcome"
    disclosure={<SetupDisclosure title="About this workspace"><p style={{margin:0}}>This development workspace combines prepared example records with the accounts you choose to connect. Test-data setup rehearses provider screens. Live messages and provider actions use your connected accounts.</p></SetupDisclosure>}>
    <div className={css({display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:theme.sizing.scale500,
      '@media (max-width: 360px)':{gap:theme.sizing.scale300}})}>
      {[{name:'Set up your business',detail:moneyOn?'Connect messages and banking':'Connect your order channel',action:view,testId:'demo-view-onboarding',
        art:<MessageCircle size={64} strokeWidth={1.3} aria-hidden />},
        {name:'Open workspace',detail:moneyOn?'Orders, customers and money':'Orders and customers',action:start,testId:'demo-start-selling',art:<FeatureArtwork kind="delivery" size={112}/>}].map(option=><button key={option.testId} type="button" onClick={option.action} data-testid={option.testId}
          className={css({display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'space-between',gap:theme.sizing.scale600,
            padding:'clamp(16px,3vw,28px)',aspectRatio:'1 / 1',minHeight:'240px',textAlign:'left',minWidth:0,width:'100%',maxWidth:'100%',boxSizing:'border-box',
            backgroundColor:theme.colors.backgroundPrimary,color:theme.colors.contentPrimary,border:`1px solid ${theme.colors.borderOpaque}`,
            borderRadius:theme.borders.radius400,cursor:'pointer',transition:'background-color 400ms ease, border-color 400ms ease',
            ':hover':{backgroundColor:theme.colors.backgroundSecondary,borderColor:theme.colors.contentTertiary},
            '@media (max-width: 520px)':{aspectRatio:'auto',minHeight:'256px',gap:theme.sizing.scale400},
            '@media (prefers-reduced-motion: reduce)':{transition:'none'},
          })}>
          <span className={css({display:'grid',placeItems:'center',height:'112px',width:'112px',maxWidth:'100%',
            '@media (max-width: 520px)':{height:'80px',width:'80px'}})}>{option.art}</span>
          <span style={{display:'grid',gap:theme.sizing.scale300,width:'100%'}}>
            <strong style={{...theme.typography.HeadingXSmall,fontSize:'clamp(17px,2vw,22px)',lineHeight:1.25}}>{option.name}</strong>
            <span className={css({...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,
              '@media (max-width: 520px)':{display:'none'}})}>{option.detail}</span>
            <ArrowRight size={20} aria-hidden style={{marginTop:8}}/>
          </span>
        </button>)}
    </div>
    {error && <p role="alert" style={{ ...theme.typography.ParagraphSmall, margin:0, color:theme.colors.negative }}>{error}</p>}
  </ConnectionSetupFrame>;
}
