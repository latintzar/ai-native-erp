"""Native guest mount keeps real workspace authority and provider boundaries."""
import tempfile,unittest,uuid
from pathlib import Path
from fastapi.testclient import TestClient
from tools.guest_preview import create

class GuestPreviewTests(unittest.TestCase):
 def test_native_workspace_cookie_and_mount(self):
  with tempfile.TemporaryDirectory(prefix='guest-proof-') as temporary:
   state=Path(temporary);app=create('https://preview.example.test','/apps/sample',state)
   with TestClient(app,base_url='https://preview.example.test',headers={'Origin':'https://preview.example.test'}) as client:
    self.assertEqual(client.get('/apps/sample/api/health').status_code,200)
    a=client.post('/apps/sample/api/cedar/workspaces',json={'scope':'fish'});self.assertEqual(a.status_code,201)
    b=client.post('/apps/sample/api/cedar/workspaces',json={'scope':'fish'});self.assertEqual(b.status_code,201)
    at=a.json()['token'];bt=b.json()['token'];self.assertNotEqual(at,bt)
    payload={'invoice_id':'sample-sale','document_id':'sample-note','seller_name':'Sample shop','description':'Sample shop delivery','customer_name':'Sample customer','amount_minor':10000,'invoice_amount_minor':10000,'currency':'PEN','receiving_bank':'bbva','account_label':'Sample account','reference':'SAMPLE','idempotency_key':uuid.uuid4().hex}
    created=client.post('/apps/sample/api/cedar/requests',headers={'Authorization':'Bearer '+at},json=payload);self.assertEqual(created.status_code,201);row=created.json()
    self.assertTrue(row['buyer_url'].startswith('https://preview.example.test/apps/sample/collect/'))
    from urllib.parse import urlsplit
    buyer=client.get(urlsplit(row['buyer_url']).path);self.assertEqual(buyer.status_code,200);self.assertIn('/apps/sample/assets/cedar-buyer.js',buyer.text)
    foreign=client.get('/apps/sample/api/cedar/requests/'+row['id'],headers={'Authorization':'Bearer '+bt});self.assertIn(foreign.status_code,(403,404))
    self.assertEqual(client.post('/apps/sample/api/cedar/requests/'+row['id']+'/invoice',headers={'Authorization':'Bearer '+at}).status_code,403)
    proof=client.post('/apps/sample/api/proof/session',json={});self.assertEqual(proof.status_code,200)
    cookie=proof.headers['set-cookie'].lower();self.assertIn('__secure-atelier-sample-proof=',cookie);self.assertIn('path=/apps/sample/',cookie);self.assertIn('httponly',cookie);self.assertIn('secure',cookie);self.assertIn('samesite=strict',cookie)
    self.assertEqual(client.post('/apps/sample/api/cedar/access/workspaces',json={}).status_code,201)
    self.assertEqual(client.post('/apps/sample/api/proof/session',content=b'x'*250001).status_code,413)
if __name__=='__main__':unittest.main()
