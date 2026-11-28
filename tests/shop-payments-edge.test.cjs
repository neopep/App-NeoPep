const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('esbuild'),{webcrypto}=require('node:crypto');
const ORDER='10000000-0000-4000-8000-000000000001',MP_ORDER='ORDABCDEF0123456789';
const ENV={SHOP_APP_URL:'https://app.test/neo/',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',MP_ACCESS_TOKEN:'server-only-mp',MP_WEBHOOK_SECRET:'webhook-secret-only-on-server',MP_COLLECTOR_ID:'999',MP_MODE:'production'};
const PAYMENT_URL='https://www.mercadopago.com.br/checkout/v1/redirect?order_id='+MP_ORDER;
function setup(name,{settings=ENV,provider={},providerFail=false,orderOverrides={}}={}){
 let handler;const calls=[],http=[];const sandbox=name==='mercadopago-webhook';
 const order={id:ORDER,environment:'production',items:[{product_id:'sku',name:'Produto',payment_name:'Produto de teste',quantity:2,unit_price_cents:1990}],shipping_cents:500,total_cents:4480,email:'buyer@example.test',expires_at:new Date(Date.now()+1800000).toISOString(),...orderOverrides};
 const sdk={auth:{getUser:async token=>token==='valid-user'?{data:{user:{id:'verified-owner'}},error:null}:{data:{user:null},error:Error('auth')}},rpc:async(action,args)=>{calls.push([action,args]);return {data:action==='neo_shop_payment_credentials'&&sandbox?{environment:'test',encrypted_access:{},encrypted_webhook:{},collector_id:'999',validated_at:'now'}:action==='neo_shop_payment_claim_v2'||action==='neo_shop_payment_claim'?order:{ok:true},error:null}}};
 const pay={id:'101',status:'processed',payment_method:{id:'pix',type:'bank_transfer'}};
 const baseProvider={id:MP_ORDER,user_id:999,currency:'BRL',live_mode:!sandbox,external_reference:ORDER,total_amount:'44.80',status:'processed',status_detail:'accredited',transactions:{payments:[pay]},...provider};
 const context={module:{exports:{}},Deno:{env:{get:key=>sandbox&&key==='SUPABASE_URL'?'https://qnuluspqfazdppciermw.supabase.co':settings[key]},serve:fn=>handler=fn},createClient:()=>sdk,decryptKey:async(_value,label)=>label==='mercadopago:webhook'?settings.MP_WEBHOOK_SECRET:settings.MP_ACCESS_TOKEN,crypto:webcrypto,TextEncoder,Uint8Array,URL,Date,AbortSignal,Response,fetch:async(url,options={})=>{
  http.push([url,options]);
  if(url.endsWith('/users/me'))return Response.json({id:999});
  if(providerFail)return Response.json({error:'unavailable'},{status:503});
  if(name==='mercadopago-create'&&url.endsWith('/v1/orders'))return Response.json({id:MP_ORDER,checkout_url:PAYMENT_URL});
  if(name==='mercadopago-webhook'&&url.endsWith('/v1/orders/'+MP_ORDER))return Response.json(baseProvider);
  throw Error('Unexpected provider URL: '+url);
 }};
 vm.createContext(context);
 const source=fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import .*;$/gm,'');
 vm.runInContext(esbuild.transformSync(source,{loader:'ts',format:'cjs'}).code,context);
 return {handle:req=>handler(req),calls,http};
}
async function signature(id=MP_ORDER,timestamp=String(Date.now())){
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(ENV.MP_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode('id:'+id.toLowerCase()+';request-id:req-1;ts:'+timestamp+';')));
 return 'ts='+timestamp+',v1='+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function webhook(sig){
 return new Request('https://edge.test/?type=order&data.id='+MP_ORDER,{method:'POST',headers:{'x-request-id':'req-1','x-signature':sig===undefined?await signature():sig,'Content-Type':'application/json'},body:JSON.stringify({status:'approved',total_amount:'0.01',external_reference:'forged'})});
}
function createRequest(token='valid-user',origin='https://app.test'){
 return new Request('https://edge.test/',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({order_id:ORDER,total:1,user_id:'forged'})});
}
function providerOrdersPost(s){const request=s.http.find(([url,options])=>url.endsWith('/v1/orders')&&options.method==='POST');assert.ok(request,'must create an Orders API order');return {request,payload:JSON.parse(request[1].body)};}
function event(s){const x=s.calls.find(([name])=>name==='neo_staging_shop_payment_event_v1');assert.ok(x,'verified event must reach the server');return x[1];}

test('Orders API: checkout authenticates user and sends only server-priced items',async()=>{
 const s=setup('mercadopago-create');
 assert.equal((await s.handle(createRequest('invalid-user'))).status,401);
 assert.equal((await s.handle(createRequest('valid-user','https://untrusted.test'))).status,403);
 assert.equal(s.http.length,0);
 const response=await s.handle(createRequest());assert.equal(response.status,200);
 const claim=s.calls.find(([action])=>action==='neo_shop_payment_claim_v2');
 assert.equal(claim[1].p_user,'verified-owner');assert.equal(claim[1].p_order,ORDER);
 const {request,payload}=providerOrdersPost(s);
 assert.equal(payload.total_amount,'44.80');assert.equal(payload.external_reference,ORDER);
 assert.equal(payload.items[0].quantity,2);assert.equal(payload.items[0].unit_price,'19.90');
 assert.equal(payload.items[1].unit_price,'5.00');assert.equal(payload.items[0].title,'Produto de teste');
 assert.match(request[1].headers['X-Idempotency-Key'],/^[a-f0-9-]{36}$/);
 assert.equal(s.calls.find(([action])=>action==='neo_shop_payment_link')[1].p_preference,MP_ORDER);
 assert.equal((await response.json()).payment_url,PAYMENT_URL);
 assert.ok(!JSON.stringify(s.calls).includes(ENV.MP_ACCESS_TOKEN));
});

test('Orders API: webhook requires recent valid HMAC and checks provider rather than request body',async()=>{
 const s=setup('mercadopago-webhook');
 assert.equal((await s.handle(await webhook('bad'))).status,401);assert.equal(s.http.length,0);
 assert.equal((await s.handle(await webhook(await signature(MP_ORDER,String(Date.now()-700000))))).status,401);
 assert.equal(s.http.length,0);
 assert.equal((await s.handle(await webhook())).status,200);
 assert.ok(s.http.some(([url])=>url.endsWith('/v1/orders/'+MP_ORDER)));
 const saved=event(s);assert.equal(saved.p_order,ORDER);assert.equal(saved.p_provider_order,MP_ORDER);assert.equal(saved.p_status,'approved');assert.equal(saved.p_amount,4480);
 assert.equal(saved.p_method,'pix');assert.equal(s.calls.filter(([action])=>action==='neo_staging_shop_payment_event_v1').length,1);
});

test('Orders API: recipient, currency and environment mismatch never confirm a payment',async()=>{
 for(const provider of [{user_id:1},{currency:'USD'},{live_mode:true},{external_reference:'another-user'}]){
  const s=setup('mercadopago-webhook',{provider});
  assert.equal((await s.handle(await webhook())).status,400);assert.equal(s.calls.filter(([action])=>action==='neo_staging_shop_payment_event_v1').length,0);
 }
});

test('Orders API: partial refunds require manual review; provider outage must not approve',async()=>{
 const s=setup('mercadopago-webhook',{provider:{status:'processed',status_detail:'partially_refunded',transactions:{payments:[{id:'101',status:'processed',payment_method:{id:'pix',type:'bank_transfer'}}],refunds:[{amount:'5.00',status:'processed'}]}}});
 assert.equal((await s.handle(await webhook())).status,200);
 assert.equal(event(s).p_status,'partially_refunded','partial Orders refund must be classified for paid_review rather than pending/approved');
 const offline=setup('mercadopago-webhook',{providerFail:true});
 assert.equal((await offline.handle(await webhook())).status,503);
 assert.equal(offline.calls.filter(([action])=>action==='neo_staging_shop_payment_event_v1').length,0);
});

test('Orders API: production credentials cannot be passed off as test environment',async()=>{
 const s=setup('mercadopago-create',{settings:{...ENV,MP_MODE:'test'}});
 assert.equal((await s.handle(createRequest())).status,503);
 assert.ok(!s.http.some(([url])=>url.endsWith('/v1/orders')));
});

test('Orders API: discount total and Pix choice remain sourced from server',async()=>{
 const s=setup('mercadopago-create',{orderOverrides:{discount_cents:398,total_cents:4082,payment_method:'pix'}});
 const response=await s.handle(createRequest());assert.equal(response.status,200);
 const {payload}=providerOrdersPost(s);
 assert.equal(payload.total_amount,'40.82');assert.equal(payload.items.length,2);
 assert.equal(payload.items[0].quantity,1);assert.equal(payload.items[0].unit_price,'35.82');
 assert.equal(payload.items[1].unit_price,'5.00');
 assert.equal(payload.external_reference,ORDER);
 // Provider method is checked on webhook; SQL event_v2 mediates mismatched Pix/card payments.
 const sql=fs.readFileSync('supabase/migrations/202611130023_shop_discounts.sql','utf8');
 assert.match(sql,/payment_method/);
});

test('Orders API: webhook forwards verified Pix, credit card and boleto methods',async()=>{
 for(const [payment,method] of [
  [{id:'pix',type:'bank_transfer'},'pix'],
  [{id:'visa',type:'credit_card'},'credit_card'],
  [{id:'bolbradesco',type:'ticket'},'boleto']]){
  const s=setup('mercadopago-webhook',{provider:{transactions:{payments:[{id:101,status:'processed',payment_method:payment}]}}});
  assert.equal((await s.handle(await webhook())).status,200);
  assert.equal(event(s).p_method,method);
 }
});