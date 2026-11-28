const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{transformSync}=require('esbuild');
const candidate=fs.readFileSync('release/pendencias-campanhas-20261127/mercadopago-create.candidate.ts','utf8');
function setup({gate={data:false},url='https://qnuluspqfazdppciermw.supabase.co',auth=true,snapshot={data:{environment:'production'}}}={}){
 let handler;const calls=[];const module={exports:{}};
 const ctx={module,exports:module.exports,Request,Response,URL,console,Deno:{env:{get:k=>k==='SUPABASE_URL'?url:'mock'},serve:fn=>handler=fn},createClient:()=>({auth:{getUser:async()=>({data:{user:auth?{id:'00000000-0000-4000-8000-000000000001'}:null}})},rpc:async(name)=>{calls.push(name);if(name==='neo_staging_checkout_allowed_v1')return gate;if(name==='neo_shop_payment_snapshot_v1')return snapshot;throw Error('unexpected RPC')}}),fetch:async()=>{calls.push('provider');throw Error('unexpected provider call')}};
 vm.createContext(ctx);vm.runInContext(transformSync(candidate.replace(/^import .*;$/gm,''),{loader:'ts',format:'cjs'}).code,ctx);return {handler,calls};
}
const request=(origin='https://teste.app.neopep.com.br',token='mock',body={order_id:'00000000-0000-4000-8000-000000000002'})=>new Request('https://edge.test',{method:'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
test('checkout sandbox recusa origem, projeto, sessão e gate inválidos antes de consultar o provedor',async()=>{
 for(const [opts,req,status,rpcs] of [
 [{},request('https://app.neopep.com.br'),403,[]],
 [{url:'https://cpslafpzjtbpmoxxysaa.supabase.co'},request(),503,[]],
 [{},request(undefined,''),401,[]],
 [{auth:false},request(),401,[]],
 [{gate:{data:false}},request(),403,['neo_staging_checkout_allowed_v1']],
 [{gate:{data:'true'}},request(),403,['neo_staging_checkout_allowed_v1']],
 [{gate:{error:{message:'unavailable'}}},request(),403,['neo_staging_checkout_allowed_v1']],
 [{gate:{data:true}},request(undefined,'mock',{order_id:'invalid'}),400,['neo_staging_checkout_allowed_v1']],
 [{gate:{data:true}},request(),503,['neo_staging_checkout_allowed_v1','neo_shop_payment_snapshot_v1']],
 [{gate:{data:true},snapshot:{error:{message:'not owner'}}},request(),409,['neo_staging_checkout_allowed_v1','neo_shop_payment_snapshot_v1']]
 ]){const s=setup(opts);assert.equal((await s.handler(req)).status,status);assert.deepEqual(s.calls,rpcs);}
});
test('checkout sandbox não reutiliza credenciais de ambiente e mantém gate fechado por padrão',()=>{assert.doesNotMatch(candidate,/MP_ACCESS_TOKEN|MP_COLLECTOR_ID|MP_MODE/);assert.match(candidate,/row\.data\?\.environment!=='test'/);const sql=fs.readFileSync('release/pendencias-campanhas-20261127/staging-checkout-gate.candidate.sql','utf8');assert.match(sql,/enabled boolean not null default false/);assert.match(sql,/staging_checkout_users_v1/);assert.match(sql,/to service_role/);assert.doesNotMatch(sql,/insert into neo_private\.staging_checkout_users_v1/);});
