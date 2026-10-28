#!/usr/bin/env python3
"""Run source-native prototype, proof and collection APIs for an isolated guest mount."""
from __future__ import annotations
import argparse, asyncio, os, re, secrets, sys
from contextlib import AsyncExitStack
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]

def private_key(path:Path)->str:
    from cryptography.fernet import Fernet
    if not path.exists():
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'w') as f:f.write(Fernet.generate_key().decode())
    if path.is_symlink() or path.stat().st_uid!=os.getuid() or path.stat().st_mode & 0o077:raise ValueError('private key file required')
    return path.read_text().strip()

def create(origin:str,prefix:str,state:Path,static_dir:Path|None=None,entry:str="index.html"):
    parsed=urlsplit(origin)
    if parsed.scheme!='https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username:raise ValueError('HTTPS origin required')
    if not re.fullmatch(r'/[a-z0-9-]+(?:/[a-z0-9-]+)*',prefix):raise ValueError('invalid mount')
    state=state.expanduser().absolute();state.mkdir(parents=True,exist_ok=True,mode=0o700)
    if state.is_symlink() or state.stat().st_uid!=os.getuid() or state.stat().st_mode & 0o077:raise ValueError('private state directory required')
    os.umask(0o077)
    # Provider credentials inherited from the operator never enter the guest runtime.
    for key in list(os.environ):
        if any(x in key.upper() for x in ('KEY','TOKEN','SECRET','PASSWORD','PROXY')):os.environ.pop(key,None)
    os.environ.update(ROCOTO_RUNTIME_STATE_DIR=str(state/'prototype'),ROCOTO_RUNTIME_PUBLIC_BASE=origin,
        ROCOTO_EGRESS_SANDBOX='1',BODEGA_BUDDY_LOOP='off',CEDAR_WHATSAPP_BRIDGE_ENABLED='false')
    sys.path[:0]=[str(ROOT/'mock-api'),str(ROOT/'app/src/prototypes/copper'),str(ROOT/'app/src/prototypes/cedar/connections/proof')]
    from app.main import app as prototype
    from runtime.cedar_service import create_app as create_copper
    from runtime.config import Settings
    from service import Config, create_app as create_proof
    copper_state=state/'collections';copper_state.mkdir(mode=0o700,exist_ok=True)
    proof_state=state/'proof';proof_state.mkdir(mode=0o700,exist_ok=True)
    copper=create_copper(Settings(state_dir=copper_state,public_origin=origin,admin_token=secrets.token_urlsafe(48),
        encryption_key=private_key(state/'collections.key'),allow_live=False,sample_bank=True,mp_client_id='',mp_client_secret='',mp_webhook_secret='',poll_seconds=60,cedar_allowed_origins=(origin,)))
    proof=create_proof(Config(public_origin=origin,state_dir=str(proof_state),encryption_key=private_key(state/'proof.key')))
    return GuestApp(prefix,origin,prototype,copper,proof,static_dir,entry)

class GuestApp:
    def __init__(self,prefix,origin,prototype,copper,proof,static_dir,entry):
        self.prefix=prefix;self.origin=origin;self.prototype=prototype;self.copper=copper;self.proof=proof
        self.cookie='__Secure-atelier-'+prefix.rsplit('/',1)[-1]+'-proof'
        self.entry=entry;self.static=None
        if static_dir:
            from starlette.staticfiles import StaticFiles
            self.static=StaticFiles(directory=static_dir,html=True)
    def route(self,path,method):
        if path in ('/api/health','/api/cedar/phone/setup','/api/cedar/email/status') and method=='GET':return self.prototype
        if path in ('/api/cedar/access/workspaces','/api/cedar/access/workspace') and method in ('GET','POST'):return self.prototype
        if path=='/api/bodega/session' and method=='GET':return self.prototype
        if path in ('/api/proof/session','/api/proof/state') and method in ('GET','POST'):return self.proof
        if re.fullmatch(r'/collect/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+(?:/(?:status|qr|approve))?',path) and method in ('GET','POST'):return self.copper
        if path in ('/assets/cedar-buyer.js','/assets/cedar-buyer.css','/assets/rocoto-mark.svg','/assets/yape.png','/assets/plin.png') and method=='GET':return self.copper
        if path.startswith('/api/cedar/'):
            allowed=(r'/api/cedar/(?:workspaces|setup|bank|bank/movements|request-updates|requests|requests/batch|workspace/fixture-rollover|requests/[a-f0-9-]+(?:/receipts)?)')
            if method in ('GET','POST') and re.fullmatch(allowed,path):return self.copper
        return None
    async def __call__(self,scope,receive,send):
        if scope['type']=='lifespan':
            async with AsyncExitStack() as stack:
                for app in (self.prototype,self.copper,self.proof):await stack.enter_async_context(app.router.lifespan_context(app))
                while True:
                    event=await receive()
                    if event['type']=='lifespan.startup':await send({'type':'lifespan.startup.complete'})
                    elif event['type']=='lifespan.shutdown':await send({'type':'lifespan.shutdown.complete'});return
        if scope['type']!='http':return
        path=scope['path'];method=scope['method']
        if path==self.prefix:path+='/'
        if not path.startswith(self.prefix+'/'):return await self.reject(send,404)
        path=path[len(self.prefix):];app=self.route(path,method)
        if app is None and self.static and method in ('GET','HEAD') and not path.startswith('/api/'):
            path='/'+self.entry if path=='/' else path
            return await self.static(dict(scope,path=path,raw_path=path.encode(),root_path=''),receive,send)
        if app is None:return await self.reject(send,403)
        if method=='POST':
            pieces=[];size=0
            while True:
                part=await receive()
                if part['type']=='http.disconnect':return
                size+=len(part.get('body',b''))
                if size>250_000:return await self.reject(send,413)
                pieces.append(part.get('body',b''))
                if not part.get('more_body',False):break
            body=b''.join(pieces);done=False;original_receive=receive
            async def limited_receive():
                nonlocal done
                if done:return await original_receive()
                done=True;return {'type':'http.request','body':body,'more_body':False}
            receive=limited_receive
        headers=[]
        for k,v in scope['headers']:
            if app is self.proof and k.lower()==b'cookie':
                v=re.sub(rb'(?<![A-Za-z0-9_-])'+re.escape(self.cookie.encode())+rb'=',b'__Host-cedar_session=',v)
            headers.append((k,v))
        scope=dict(scope,path=path,raw_path=path.encode(),root_path='',headers=headers)
        pending=None; chunks=[]; rewrite_kind=''
        async def wrapped(message):
            nonlocal pending, rewrite_kind
            if app is self.copper and message['type']=='http.response.start':
                ctype=next((v for k,v in message.get('headers',[]) if k.lower()==b'content-type'),b'')
                if path.startswith('/collect/') and b'text/html' in ctype: pending=message;rewrite_kind='html';return
                if b'application/json' in ctype: pending=message;rewrite_kind='json';return
            if pending is not None and message['type']=='http.response.body':
                chunks.append(message.get('body',b''))
                if message.get('more_body',False):return
                body=b''.join(chunks)
                if rewrite_kind=='html':body=body.replace(b'\"/assets/',b'\"'+self.prefix.encode()+b'/assets/')
                if rewrite_kind=='json':body=body.replace((self.origin+'/collect/').encode(),(self.origin+self.prefix+'/collect/').encode())
                fixed=[(k,v) for k,v in pending.get('headers',[]) if k.lower()!=b'content-length']+[(b'content-length',str(len(body)).encode())]
                await send(dict(pending,headers=fixed));pending=None;return await send({'type':'http.response.body','body':body})
            if message['type']=='http.response.start' and app is self.proof:
                new=[]
                for k,v in message.get('headers',[]):
                    if k.lower()==b'set-cookie' and v.startswith(b'__Host-cedar_session='):
                        v=v.replace(b'__Host-cedar_session=',self.cookie.encode()+b'=',1)
                        v=re.sub(rb'(?i)Path=/',b'Path='+self.prefix.encode()+b'/',v)
                    new.append((k,v))
                message=dict(message,headers=new)
            await send(message)
        await app(scope,receive,wrapped)
    @staticmethod
    async def reject(send,status):
        body=b'{"detail":"This guest route is unavailable."}'
        await send({'type':'http.response.start','status':status,'headers':[(b'content-type',b'application/json'),(b'content-length',str(len(body)).encode())]});await send({'type':'http.response.body','body':body})

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--origin',required=True);parser.add_argument('--prefix',required=True);parser.add_argument('--state',type=Path,required=True);parser.add_argument('--port',type=int,required=True);parser.add_argument('--static',type=Path);parser.add_argument('--entry',default='index.html');args=parser.parse_args()
    import uvicorn
    uvicorn.run(create(args.origin,args.prefix,args.state,args.static,args.entry),host='127.0.0.1',port=args.port,access_log=False)
if __name__=='__main__':main()
