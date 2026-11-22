const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('esbuild'),{webcrypto}=require('node:crypto');
const PROVIDER_ORDER='ORD12345678901';
const O='10000000-0000-4000-8000-000000000001';
const env={SHOP_APP_URL:'https://app.test/neo/',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',MP_ACCESS_TOKEN:'server-only-mp',MP_WEBHOOK_SECRET:'webhook-secret-only-on-server',MP_COLLECTOR_ID:'999',MP_MODE:'production'};
function setup(name,{settings=env,payment={},providerFail=false,orderOverrides={},candidate=false}={}){let handler;const calls=[],http=[];const order={id:O,environment:'production',items:[{product_id:'sku',name:'Produto',quantity:2,unit_price_cents:1990}],shipping_cents:500,total_cents:4480,email:'buyer@example.test',expires_at:new Date(Date.now()+1800000).toISOString(),...orderOverrides};const sdk={auth:{getUser:async token=>token==='valid-user'?{data:{user:{id:'verified-owner'}},error:null}:{data:{user:null},error:Error('auth')}},rpc:async(name,args)=>{calls.push([name,args]);return {data:['neo_shop_payment_claim','neo_shop_payment_claim_v2'].includes(name)?order:{ok:true},error:null}}};const context={module:{exports:{}},Deno:{env:{get:k=>settings[k]},serve:fn=>handler=fn},createClient:()=>sdk,crypto:webcrypto,TextEncoder,Uint8Array,URL,Date,AbortSignal,Response,fetch:async(url,options)=>{http.push([url,options]);if(providerFail)return new Response('{}',{status:503});if(url.endsWith('/v1/payment_methods'))return Response.json([{id:'pix',payment_type_id:'bank_transfer',status:'active'},{id:'visa',payment_type_id:'credit_card',status:'active'},{id:'bolbradesco',payment_type_id:'ticket',status:'active'}]);if(url.endsWith('/users/me'))return Response.json({id:999,tags:['normal']});return Response.json(name==='mercadopago-create'?{id:PROVIDER_ORDER,checkout_url:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=x'}:{id:PROVIDER_ORDER,user_id:999,currency:'BRL',live_mode:true,external_reference:O,total_amount:'44.80',status:'pending',...payment})}};vm.createContext(context);const code=fs.readFileSync(candidate?`release/production/optional-finance/${name}/index.ts`:`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*;$/gm,'');vm.runInContext(esbuild.transformSync(code,{loader:'ts',format:'cjs'}).code,context);return {handle:req=>handler(req),calls,http,api:context.module.exports}}
async function signature(id=PROVIDER_ORDER,timestamp=String(Date.now())){const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.MP_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${id.toLowerCase()};request-id:req-1;ts:${timestamp};`)));return `ts=${timestamp},v1=${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`}
const webhook=async(sig)=>new Request('https://edge.test?data.id='+PROVIDER_ORDER+'&type=order',{method:'POST',headers:{'x-request-id':'req-1','x-signature':sig||await signature(),'Content-Type':'application/json'},body:JSON.stringify({status:'approved',transaction_amount:0.01})});
test('checkout autentica o usuário e usa somente itens e valores do servidor',async()=>{const s=setup('mercadopago-create');const request=token=>new Request('https://edge.test',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({order_id:O,total:1,user_id:'forged'})});assert.equal((await s.handle(request('wrong'))).status,401);assert.equal(s.http.length,0);const response=await s.handle(request('valid-user'));assert.equal(response.status,200);assert.equal(s.calls[0][1].p_user,'verified-owner');const sent=JSON.parse(s.http.find(c=>c[0].endsWith('/v1/orders'))[1].body);assert.equal(sent.items[0].unit_price,'19.90');assert.equal(sent.items[0].quantity,2);assert.equal(sent.items[1].unit_price,'5.00');assert.equal(sent.external_reference,O);assert.equal(sent.total_amount,'44.80');assert.equal(new URL(sent.config.online.success_url).origin,'https://app.test');assert.equal(s.calls.at(-1)[1].p_preference,PROVIDER_ORDER);assert.ok(!(await response.text()).includes('server-only'));});
test('webhook exige assinatura atual e busca a situação real, ignorando status do corpo',async()=>{const s=setup('mercadopago-webhook');assert.equal((await s.handle(await webhook('bad'))).status,401);assert.equal(s.http.length,0);assert.equal((await s.handle(await webhook(await signature(PROVIDER_ORDER,String(Date.now()-700000))))).status,401);const response=await s.handle(await webhook());assert.equal(response.status,200);assert.equal(s.calls[0][0],'neo_shop_payment_event_v2');assert.equal(s.calls[0][1].p_status,'pending');assert.equal(s.calls[0][1].p_amount,4480)});
test('recebedor, moeda e modo incompatíveis não confirmam pagamento',async()=>{for(const payment of [{user_id:1},{currency:'USD'},{live_mode:false},{id:'ORD99999999999'}]){const s=setup('mercadopago-webhook',{payment});assert.equal((await s.handle(await webhook())).status,400);assert.equal(s.calls.length,0)}});
test('indisponibilidade do provedor não grava confirmação',async()=>{
 const failed=setup('mercadopago-webhook',{providerFail:true});
 assert.equal((await failed.handle(await webhook())).status,503);
 assert.equal(failed.calls.length,0);
});

test('reembolso parcial em Orders tem precedência sobre aprovação e repete a mesma identidade financeira',async()=>{
 for(const payment of [
  {status:'processed',status_detail:'partially_refunded',transactions:{payments:[{id:'101',status:'processed',status_detail:'accredited'}]}},
  {status:'processed',status_detail:'accredited',transactions:{payments:[{id:'101',status:'processed',status_detail:'partially_refunded'}]}},
  {status:'processed',transactions:{payments:[{id:'101',status:'processed',refunded_amount:'5.00'}]}}
 ]){
  const s=setup('mercadopago-webhook',{payment,candidate:true});
  for(let i=0;i<2;i++)assert.equal((await s.handle(await webhook())).status,200);
  assert.equal(s.calls.length,2);
  assert.deepEqual(s.calls[0][1],s.calls[1][1]);
  assert.equal(s.calls[0][1].p_status,'partially_refunded');
  assert.equal(s.calls[0][1].p_amount,4480);
  assert.equal(s.calls[0][1].p_payment,'101');
 }
});

test('reembolso integral e chargeback de Orders preservam seus estados terminais',async()=>{
 for(const status of ['refunded','charged_back']){
  const s=setup('mercadopago-webhook',{payment:{status,status_detail:'partially_refunded'},candidate:true});
  assert.equal((await s.handle(await webhook())).status,200);
  assert.equal(s.calls[0][1].p_status,status);
 }
});

test('credencial produtiva não é usada como se fosse conta de teste',async()=>{const s=setup('mercadopago-create',{settings:{...env,MP_MODE:'test'}});const r=await s.handle(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer valid-user','Content-Type':'application/json'},body:JSON.stringify({order_id:O})}));assert.equal(r.status,503);assert.ok(!s.http.some(c=>c[0].endsWith('/v1/orders')))});

test('checkout envia o total descontado em centavos, inclusive quando o pedido selecionou Pix',async()=>{const s=setup('mercadopago-create',{orderOverrides:{discount_cents:398,total_cents:4082,payment_method:'pix'}});const response=await s.handle(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer valid-user','Content-Type':'application/json'},body:JSON.stringify({order_id:O})}));assert.equal(response.status,200);const sent=JSON.parse(s.http.find(c=>c[0].endsWith('/v1/orders'))[1].body);assert.equal(sent.items[0].quantity,1);assert.equal(sent.items[0].unit_price,'35.82');assert.equal(sent.items[1].unit_price,'5.00');assert.equal(sent.total_amount,'40.82');});
test('webhook informa a forma efetivamente verificada no provedor',async()=>{for(const [payment,method] of [[{id:'pix',type:'bank_transfer'},'pix'],[{id:'visa',type:'credit_card'},'credit_card'],[{id:'bolbradesco',type:'ticket'},'boleto']]){const s=setup('mercadopago-webhook',{payment:{transactions:{payments:[{id:'101',payment_method:payment}]}}});assert.equal((await s.handle(await webhook())).status,200);assert.equal(s.calls[0][1].p_method,method);}});

test('origem externa é recusada e preflight autorizado não consulta o provedor',async()=>{
 const s=setup('mercadopago-create');
 for(const [origin,status] of [['https://other.test',403],['https://app.test',204]]){
  assert.equal((await s.handle(new Request('https://edge.test',{method:'OPTIONS',headers:{Origin:origin}}))).status,status);
 }
 assert.equal(s.calls.length,0);assert.equal(s.http.length,0);
});

test('a tentativa de criar o pagamento usa a mesma chave do pedido se o link ainda não foi salvo',async()=>{
 const s=setup('mercadopago-create',{candidate:true});
 for(let i=0;i<2;i++){
  const response=await s.handle(new Request('https://edge.test',{method:'POST',headers:{
   Origin:'https://app.test',Authorization:'Bearer valid-user','Content-Type':'application/json'
  },body:JSON.stringify({order_id:O})}));
  assert.equal(response.status,200);
 }
 const requests=s.http.filter(([url])=>url.endsWith('/v1/orders'));
 assert.equal(requests.length,2);
 assert.equal(requests[0][1].headers['X-Idempotency-Key'],O);
 assert.equal(requests[1][1].headers['X-Idempotency-Key'],O);
 assert.equal(requests[0][1].body,requests[1][1].body);
});
