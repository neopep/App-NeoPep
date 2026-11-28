const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('esbuild'),{webcrypto}=require('node:crypto');
function setup(env={},jobs=[],communityJobs=[],supportJobs=[],eventJobs=[],noticeCheck={send:true,ttl:300},dispatchGate={data:true}){let handler;const finished=[],sent=[];let claimed=0;const code=fs.readFileSync('supabase/functions/push-dispatch/index.ts','utf8').replace(/^import .*;$/gm,'');const ctx={module:{exports:{}},Request,Response,TextEncoder,Uint8Array,crypto:webcrypto,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},createClient:()=>({rpc:async(name,args)=>{if(name==='neo_staging_push_dispatch_enabled_v1')return dispatchGate;if(name==='neo_push_claim'){claimed++;return {data:jobs}}if(name==='neo_community_push_claim')return {data:communityJobs};if(name==='neo_support_push_claim')return {data:supportJobs};if(name==='neo_event_push_claim')return {data:eventJobs};if(name==='neo_shop_notice_sweep_v1')return {data:0};if(name==='neo_shop_notice_push_check_v1')return noticeCheck?.mockError?{error:{message:'unavailable'}}:{data:noticeCheck};finished.push(args);return {data:null}}}),webpush:{setVapidDetails(){},async sendNotification(sub,payload,options){sent.push({sub,payload,options});if(sub.endpoint.endsWith('gone'))throw {statusCode:410}}}};vm.createContext(ctx);vm.runInContext(esbuild.transformSync(code,{loader:'ts',format:'cjs'}).code,ctx);return {handler,finished,sent,get claimed(){return claimed},api:ctx.module.exports}}
const settings={NEO_PUSH_CRON_SECRET:'x'.repeat(40),NEO_VAPID_PUBLIC_KEY:'public',NEO_VAPID_PRIVATE_KEY:'private',NEO_VAPID_SUBJECT:'mailto:contact@example.com',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-secret'};
const req=secret=>new Request('https://edge.test',{method:'POST',headers:{'x-neo-cron-secret':secret||''}});
test('envio exige segredo de cron e configurações; não acessa assinaturas sem autorização',async()=>{let s=setup();assert.equal((await s.handler(req())).status,503);s=setup(settings);assert.equal((await s.handler(req('wrong'))).status,401);assert.equal(s.claimed,0);assert.equal((await s.handler(new Request('https://edge.test'))).status,405);assert.equal(await s.api.sameSecret('same','same'),true);assert.equal(await s.api.sameSecret('same','other'),false)});
test('envio discreto, descarte de inscrição expirada e bloqueio de endpoint arbitrário',async()=>{const jobs=[{id:'00000000-0000-4000-8000-000000000001',endpoint:'https://web.push.apple.com/valid',keys:{}},{id:'00000000-0000-4000-8000-000000000002',endpoint:'https://web.push.apple.com/gone',keys:{}},{id:'00000000-0000-4000-8000-000000000003',endpoint:'https://127.0.0.1/private',keys:{}}];const s=setup(settings,jobs);const response=await s.handler(req(settings.NEO_PUSH_CRON_SECRET));assert.equal(response.status,200);assert.equal(s.sent.length,2);assert.deepEqual(JSON.parse(s.sent[0].payload),{tag:jobs[0].id});assert.equal(s.sent[0].options.TTL,300);assert.deepEqual(s.finished.map(x=>x.p_outcome).sort(),['gone','retry','sent']);const body=await response.text();assert.ok(!body.includes('endpoint'));assert.ok(!body.includes('private'));assert.equal(s.api.validEndpoint('https://web.push.apple.com.evil.test/a'),false)});

test('postagem da comunidade usa mensagem sem conteúdo pessoal e fila própria',async()=>{const job={id:'00000000-0000-4000-8000-000000000009',endpoint:'https://web.push.apple.com/valid',keys:{},kind:'community'};const s=setup(settings,[],[job]);assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,200);assert.deepEqual(JSON.parse(s.sent[0].payload),{tag:job.id,kind:'community'});assert.equal(s.finished[0].p_id,job.id)});

test('aviso privado usa fila separada e não inclui o conteúdo da conversa',async()=>{const job={id:'00000000-0000-4000-8000-000000000010',endpoint:'https://web.push.apple.com/valid',keys:{},kind:'support',title:'Nome privado',body:'Mensagem privada'};const s=setup(settings,[],[],[job]);assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,200);assert.deepEqual(JSON.parse(s.sent[0].payload),{tag:job.id,kind:'support'});assert.equal(s.finished[0].p_id,job.id)});

test('eventos de biblioteca e loja conservam categoria para o roteamento sem enviar o conteúdo',async()=>{
 const eventJobs=['library','shop'].map((kind,i)=>({
  id:'00000000-0000-4000-8000-00000000002'+i,kind,endpoint:'https://web.push.apple.com/valid',keys:{},title:'Aviso sintético',body:'Evento de teste'
 }));
 const s=setup(settings,[],[],[],eventJobs);
 assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,200);
 assert.deepEqual(s.sent.map(x=>JSON.parse(x.payload)),eventJobs.map(({id,kind})=>({tag:id,kind})));
 assert.deepEqual(s.finished.map(x=>x.p_id),eventJobs.map(x=>x.id));
});

test('lembrete bloqueado não envia push e encerra job',async()=>{const j={id:'00000000-0000-4000-8000-000000000099',kind:'shop',endpoint:'https://web.push.apple.com/valid',keys:{}};const s=setup(settings,[],[],[],[j],{send:false});assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,200);assert.equal(s.sent.length,0);assert.equal(s.finished[0].p_outcome,'sent');});
test('lembrete elegível respeita TTL curto e sinaliza categoria',async()=>{const j={id:'00000000-0000-4000-8000-000000000099',kind:'shop',endpoint:'https://web.push.apple.com/valid',keys:{}};const s=setup(settings,[],[],[],[j],{send:true,ttl:42,notice:'payment_pending'});assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,200);assert.equal(s.sent[0].options.TTL,42);assert.equal(JSON.parse(s.sent[0].payload).notice,'payment_pending');});


test('checagem ambígua, indisponível ou TTL inválido nunca envia push da loja',async()=>{
 const j={id:'00000000-0000-4000-8000-000000000098',kind:'shop',endpoint:'https://web.push.apple.com/valid',keys:{}};
 for(const check of [null,{}, {mockError:true},{send:'true',ttl:42},{send:true},{send:true,ttl:0},{send:true,ttl:-1},{send:true,ttl:301},{send:true,ttl:3.5}]){
  const s=setup(settings,[],[],[],[j],check);
  const response=await s.handler(req(settings.NEO_PUSH_CRON_SECRET));assert.equal(response.status,200);
  assert.equal(s.sent.length,0);assert.equal(s.finished[0].p_outcome,'retry');
 }
});

test('gate Teste fechado ou indisponível não permite acessar filas',async()=>{for(const [gate,status] of [[{data:false},200],[{data:null},200],[{data:'true'},200],[{error:{message:'unavailable'}},503]]){const s=setup(settings,[],[],[],[],{send:true,ttl:300},gate);assert.equal((await s.handler(req(settings.NEO_PUSH_CRON_SECRET))).status,status);assert.equal(s.claimed,0);assert.equal(s.sent.length,0);assert.equal(s.finished.length,0);}});
