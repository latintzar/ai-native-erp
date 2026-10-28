"""Compose rendered Cedar components from the pinned, completed local artifact.

Network is confined to the supplied loopback origin; mutating requests receive
an empty local fixture reply. Source code, records and assets stay unchanged.
"""
from pathlib import Path
from hashlib import sha256
from urllib.request import urlopen
import json
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parent
ORIGIN='http://127.0.0.1:18721'
PIN='12d77d610c82a21c602a7706861f043e16607a74'
SEED={
 'rocoto-app-front-door':'months',
 'rocoto-app-config':{'version':1,'sector':['fish'],'cast':'fish'},
 'rocoto-workspace-capabilities:fish':{'version':1,'pricing':True,'inventory':True,'money':False,'country':'spain','moneyByCountry':{'peru':True,'spain':False}},
}
COMMON='''
html,body{margin:0!important;background:transparent!important;}
#erp-composition{box-sizing:border-box;padding:4px;background:transparent;font-family:Inter,system-ui,sans-serif;color:#1a1413;}
#erp-composition *,#erp-composition *::before,#erp-composition *::after{box-sizing:border-box;}
#erp-composition button{pointer-events:none;}
'''
ORDER='''
#erp-composition [data-testid="document"]{width:100%;box-shadow:none!important;border:1px solid #e4e3e1!important;border-radius:12px!important;overflow:hidden;}
#erp-composition [data-testid="document-head"]{position:relative!important;gap:6px!important;padding:24px!important;}
#erp-composition [data-testid="head-acts"],#erp-composition [data-testid="map-square"],#erp-composition [data-testid="head-workflow-actions"],#erp-composition [data-testid="detail-viewed-by"],#erp-composition [data-testid="head-settings"],#erp-composition [data-testid="add-line-seat"],#erp-composition [data-testid^="line-tail-"]{display:none!important;}
#erp-composition [data-testid="document-who"]{font-size:32px!important;line-height:40px!important;}
#erp-composition [data-testid="document-when"]{font-size:20px!important;line-height:28px!important;}
#erp-composition [data-testid="state-row"]{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid="document-number"]{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid^="line-card-"]{min-height:132px!important;padding:16px 24px!important;gap:20px!important;align-items:center!important;}
#erp-composition [data-testid^="face-"]{width:88px!important;height:88px!important;flex:0 0 88px!important;}
#erp-composition [data-face]{width:100%!important;height:100%!important;}
#erp-composition [data-face] img{width:100%!important;height:100%!important;object-fit:contain!important;}
#erp-composition [data-testid^="line-l"]{grid-template-columns:minmax(220px,1fr) minmax(220px,max-content)!important;gap:12px!important;}
#erp-composition [data-testid^="line-title-"],#erp-composition [data-testid^="line-money-"],#erp-composition [data-testid^="line-quantity-"]{font-size:22px!important;line-height:28px!important;}
#erp-composition [data-testid^="row-rate-"]{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid="document-total"]{padding:20px 24px!important;}
#erp-composition [data-testid="document-total"]>span{font-size:18px!important;line-height:24px!important;}
#erp-composition [data-testid="document-total"] [data-testid="document-line-count"]{font-size:18px!important;}
#erp-composition[data-phone="yes"] [data-testid="document-head"]{padding:20px!important;}
#erp-composition[data-phone="yes"] [data-testid="document-who"]{font-size:28px!important;line-height:36px!important;}
#erp-composition[data-phone="yes"] [data-testid="document-when"]{font-size:18px!important;line-height:26px!important;}
#erp-composition[data-phone="yes"] [data-testid^="line-card-"]{padding:16px 16px!important;min-height:142px!important;gap:14px!important;}
#erp-composition[data-phone="yes"] [data-testid^="face-"]{width:68px!important;height:68px!important;flex-basis:68px!important;}
#erp-composition[data-phone="yes"] [data-testid^="line-l"]{grid-template-columns:minmax(0,1fr)!important;gap:8px!important;}
#erp-composition[data-phone="yes"] [data-line-identity]{padding-right:0!important;}
#erp-composition[data-phone="yes"] [data-testid^="line-title-"]{font-size:18px!important;line-height:24px!important;}
#erp-composition[data-phone="yes"] [data-testid^="line-money-"],#erp-composition[data-phone="yes"] [data-testid^="line-quantity-"]{font-size:19px!important;line-height:26px!important;}
#erp-composition[data-phone="yes"] [data-testid^="row-rate-"]{font-size:14px!important;line-height:20px!important;}
'''
CATALOGUE='''
#erp-composition .goods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;}
#erp-composition [data-testid="product-row-hit"]{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:16px!important;min-height:360px!important;padding:20px!important;border:1px solid #e4e3e1!important;border-radius:12px!important;background:white!important;}
#erp-composition [data-face]{width:100%!important;height:200px!important;}
#erp-composition [data-face] img{width:100%!important;height:100%!important;object-fit:contain!important;}
#erp-composition [data-testid="product-row-hit"]>span:nth-child(2){flex:0 0 auto!important;gap:8px!important;}
#erp-composition [data-testid="product-row-hit"]>span:nth-child(2)>span:first-child{font-size:22px!important;line-height:28px!important;}
#erp-composition [data-product-fact]{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-product-unit]{font-size:16px!important;line-height:24px!important;align-self:flex-start!important;}
#erp-composition[data-phone="yes"] .goods{grid-template-columns:1fr;gap:12px;}
#erp-composition[data-phone="yes"] [data-testid="product-row-hit"]{flex-direction:row!important;align-items:center!important;min-height:132px!important;padding:16px!important;gap:16px!important;}
#erp-composition[data-phone="yes"] [data-face]{width:88px!important;height:88px!important;flex:0 0 88px!important;}
#erp-composition[data-phone="yes"] [data-testid="product-row-hit"]>span:nth-child(2){flex:1 1 auto!important;}
#erp-composition[data-phone="yes"] [data-testid="product-row-hit"]>span:nth-child(2)>span:first-child{font-size:18px!important;line-height:24px!important;}
#erp-composition[data-phone="yes"] [data-product-unit]{align-self:center!important;}
'''

IMPORT="""
#erp-composition [data-testid="panel"]{width:100%!important;max-width:none!important;min-width:0!important;max-height:none!important;overflow:visible!important;border:1px solid #e4e3e1!important;border-radius:12px!important;background:white!important;box-shadow:none!important;}
#erp-composition [data-testid="panel"]>header{padding:20px 24px!important;border-bottom:1px solid #e4e3e1!important;}
#erp-composition [data-testid="panel"]>header h2{font-size:28px!important;line-height:36px!important;}
#erp-composition [data-testid="close-panel"],#erp-composition [data-testid="panel-back-bar"],#erp-composition [data-testid="catalogue-intake-sources"],#erp-composition [data-testid="catalogue-raw-source"]{display:none!important;}
#erp-composition [data-testid="workflow-body"]{padding:24px!important;overflow:visible!important;max-height:none!important;}
#erp-composition [data-testid="csv-read"]>header>span:first-child{font-size:20px!important;line-height:28px!important;}
#erp-composition [data-testid="csv-read"]>header>span:last-child{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid="catalogue-review-queue"]{border:none!important;padding:0!important;gap:12px!important;}
#erp-composition [data-testid="catalogue-review-row"]{border:1px solid #e4e3e1!important;margin:0!important;padding:16px!important;width:100%!important;gap:12px!important;}
#erp-composition [data-testid="catalogue-review-row"]>div:first-child{grid-template-columns:72px minmax(0,1fr) auto!important;gap:16px!important;}
#erp-composition [data-face]{width:72px!important;height:72px!important;}
#erp-composition [data-face] img{width:100%!important;height:100%!important;object-fit:contain!important;}
#erp-composition [data-testid="catalogue-review-row"]>div:first-child>span:nth-child(2)>span:first-child{font-size:20px!important;line-height:28px!important;}
#erp-composition [data-testid="catalogue-review-row"]>div:first-child>span:nth-child(2)>span:last-child{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid="catalogue-readback-confirmation"]{padding-top:12px!important;}
#erp-composition [data-testid="catalogue-readback-confirmation"] label{font-size:16px!important;line-height:24px!important;}
#erp-composition [data-testid="catalogue-readback-confirmation"]>span{display:none!important;}
#erp-composition [data-testid="csv-import"]{font-size:18px!important;line-height:24px!important;padding:14px 20px!important;}
#erp-composition[data-phone="yes"] [data-testid="panel"]>header,#erp-composition[data-phone="yes"] [data-testid="workflow-body"]{padding:16px!important;}
#erp-composition[data-phone="yes"] [data-testid="catalogue-review-row"]>div:first-child{grid-template-columns:56px minmax(0,1fr)!important;gap:12px!important;}
#erp-composition[data-phone="yes"] [data-face]{width:56px!important;height:56px!important;}
#erp-composition[data-phone="yes"] [data-testid="catalogue-review-row"]>div:first-child>span:nth-child(2)>span:first-child{font-size:18px!important;line-height:24px!important;}
#erp-composition[data-phone="yes"] [data-testid="catalogue-review-row"]>div:first-child>span:nth-child(2)>span:last-child{font-size:14px!important;line-height:20px!important;}
"""


def components(page,kind,width):
 return page.evaluate('''({kind,width})=>{
 const originals=kind==='order'?[document.querySelector('[data-testid="document"]')]:kind==='import'?[document.querySelector('[data-testid="panel"]')]:[...document.querySelectorAll('[data-testid="product-row-hit"]')].filter(e=>['PV-1001','PV-1003','PV-1005'].some(code=>e.querySelector(`[data-product-code="${code}"]`)));
 if(!originals.length||originals.some(e=>!e))throw Error('Source component absent');
 const before=originals.map(e=>({text:e.innerText,html:e.outerHTML,images:[...e.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight}))}));
 const stage=document.createElement('main');stage.id='erp-composition';stage.dataset.phone=width===390?'yes':'no';stage.style.width=width+'px';
 const target=kind!=='catalogue'?stage:document.createElement('div');if(kind==='catalogue'){target.className='goods';stage.append(target);}
 originals.forEach(e=>target.append(e.cloneNode(true)));
 [...document.body.children].forEach(e=>e.style.display='none');document.body.append(stage);window.scrollTo(0,0);
 return before;
 }''',{'kind':kind,'width':width})


def run():
 proof={'source_commit':PIN,'origin':ORIGIN+'/cedar/','renderer':{},'seed':SEED,'composition':'Whole rendered Cedar components cloned into a chromeless stage; capture CSS changes spacing, typography and artwork seats. Record text, amounts and painting sources are preserved. Catalogue shows three existing coded fixture SKUs.','artwork_boundary':'sku-artwork.tsx is a local design store for requests/review/upload; this presentation shows existing catalogue library artwork, not a provider-generated job.','captures':[]}
 prototype=json.loads(urlopen(ORIGIN+'/cedar/prototype.json').read());assert prototype['sourceCommit']==PIN
 entry=urlopen(ORIGIN+'/cedar/').read();assert sha256(entry).hexdigest()==prototype['entrySha256']
 proof['prototype']=prototype;proof['entry_sha256']=sha256(entry).hexdigest()
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/snap/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);proof['renderer']={'engine':'Chromium','version':browser.version,'dpr':2}
  for kind in ['order','catalogue','import']:
   for width in [896,390]:
    external=[];posts=[];errors=[];responses={}
    context=browser.new_context(viewport={'width':1600 if width==896 else 390,'height':1100},device_scale_factor=2,service_workers='block',reduced_motion='reduce')
    def route(r):
     if not r.request.url.startswith((ORIGIN+'/','data:','blob:')):external.append({'url':r.request.url,'method':r.request.method});r.abort();return
     if r.request.method not in ('GET','HEAD'):posts.append({'url':r.request.url,'method':r.request.method});r.fulfill(status=204,body='');return
     r.continue_()
    context.route('**/*',route)
    context.route_web_socket('**/*',lambda ws:ws.close())
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    def response(r):
     if r.url.startswith(ORIGIN+'/') and r.request.method=='GET':
      try:responses[r.url.removeprefix(ORIGIN)]={'status':r.status,'sha256':sha256(r.body()).hexdigest()}
      except Exception:pass
    page.on('response',response)
    page.add_init_script(''.join('localStorage.setItem('+json.dumps(k)+','+json.dumps(v if isinstance(v,str) else json.dumps(v,separators=(',',':')))+');' for k,v in SEED.items()))
    page.goto(ORIGIN+'/cedar/',wait_until='networkidle');page.evaluate('document.fonts.ready');page.get_by_text('Cafè Pagès',exact=True).first.click();page.wait_for_timeout(200)
    if kind in ('catalogue','import'):
     if width==390:
      # Native phone: close the order, then use its existing navigation control.
      page.locator('[data-testid="close-detail"]').first.click();page.wait_for_timeout(100)
     page.get_by_text('Products',exact=True).first.click();page.wait_for_timeout(200)
    if kind=='import':
     page.locator('[data-testid=new-product]').click();page.get_by_text('Upload a product list',exact=True).click()
     page.locator('[data-testid=catalogue-paste]').fill('Product name\tCode\tUnit\nMerluza\tPV-1001\tkg\nPulpo\tPV-1003\tkg\nLubina de estero\tPV-1005\tkg')
     page.locator('[data-testid=catalogue-paste-review]').click();page.locator('[data-testid=catalogue-readback-confirmed]').check()
     assert page.locator('[data-testid=csv-import]').is_enabled()
     assert page.locator('[data-testid=catalogue-review-row]').count()==3
    page.mouse.move(0,0)
    page.evaluate('document.activeElement?.blur()')
    originals=components(page,kind,width)
    page.add_style_tag(content=COMMON+(ORDER if kind=='order' else IMPORT if kind=='import' else CATALOGUE))
    page.evaluate('document.fonts.ready');page.wait_for_timeout(200)
    page.mouse.move(0,0)
    stage=page.locator('#erp-composition')
    stage.evaluate('e=>Promise.all([...e.querySelectorAll("img")].map(i=>i.decode().catch(()=>{})))')
    geometry=stage.evaluate('e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,text:e.innerText,images:[...e.querySelectorAll("img")].map(i=>({src:i.getAttribute("src"),complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),lineCount:e.querySelectorAll("[data-line]").length})')
    assert geometry['scrollWidth']<=geometry['clientWidth'],geometry
    assert all(i['naturalWidth'] for i in geometry['images']),geometry
    if kind=='order':assert geometry['lineCount']==3 and '359,54' in geometry['text']
    filename=kind+('-desktop' if width==896 else '-phone')+'.png'
    stage.screenshot(path=str(OUT/filename),omit_background=True)
    (OUT/(filename+'.source.html')).write_text(stage.evaluate('e=>e.outerHTML'))
    proof['captures'].append({'file':filename,'sha256':sha256((OUT/filename).read_bytes()).hexdigest(),'css_width':width,'geometry':geometry,'original_components':originals,'page_errors':errors,'blocked_external':external,'fixture_mutating_requests':posts,'resources':responses})
    context.close()
  browser.close()
 for name in ['merluza','pulpo','lubina']:
  data=urlopen(ORIGIN+'/paintings/'+name+'.webp').read();(OUT/(name+'.webp')).write_bytes(data)
 proof['capture_script_sha256']=sha256(Path(__file__).read_bytes()).hexdigest();proof['css_sha256']={'common':sha256(COMMON.encode()).hexdigest(),'order':sha256(ORDER.encode()).hexdigest(),'catalogue':sha256(CATALOGUE.encode()).hexdigest(),'import':sha256(IMPORT.encode()).hexdigest()}
 (OUT/'capture.css').write_text(COMMON+ORDER+CATALOGUE+IMPORT)
 (OUT/'capture-proof.json').write_text(json.dumps(proof,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps({'files':[x['file'] for x in proof['captures']],'errors':[x['page_errors'] for x in proof['captures']],'external_attempts':sum(len(x['blocked_external']) for x in proof['captures'])},indent=2))

if __name__=='__main__':run()
