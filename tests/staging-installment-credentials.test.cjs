const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const worker=fs.readFileSync('supabase/functions/shop-integrations/installment-sync.ts','utf8');
const edge=fs.readFileSync('supabase/functions/shop-integrations/index.ts','utf8');
const start=worker.indexOf('export async function stagingInstallmentConfig('),end=worker.indexOf('// The ordinary installments endpoint',start);
assert.ok(start>=0&&end>start);
const code=worker.slice(start,end).replace('export async function','async function').replace('admin:any','admin');
const good={environment:'test',encrypted_access:{ciphertext:'mock'},validated_at:'2026-11-28T00:00:00Z',collector_id:'42'};
function setup(row,project='https://qnuluspqfazdppciermw.supabase.co',token='mock-sandbox-token-123456789'){
 const calls=[];const admin={rpc:async(name,args)=>{calls.push([name,args]);return row;}};
 const Deno={env:{get:key=>key==='SUPABASE_URL'?project:'legacy-production-credential'}};
 const decryptKey=async(value,label)=>{calls.push(['decrypt',label]);return token;};
 const fn=new Function('Deno','decryptKey',code+';return stagingInstallmentConfig;')(Deno,decryptKey);
 return {calls,run:()=>fn(admin)};
}
test('consultas de parcelas não usam credencial de ambiente nem conta sem validação',async()=>{
 for(const row of [{error:true},{data:null},{data:{...good,environment:'production'}},{data:{...good,validated_at:null}},{data:{...good,encrypted_access:null}},{data:{...good,collector_id:'invalid'}}]){
  const t=setup(row);await assert.rejects(t.run,/configuration_pending/);assert.deepEqual(t.calls,[['neo_shop_payment_credentials',{p_environment:'test'}]]);
 }
 const wrong=setup({data:good},'https://cpslafpzjtbpmoxxysaa.supabase.co');await assert.rejects(wrong.run,/configuration_pending/);assert.deepEqual(wrong.calls,[]);
 const short=setup({data:good},undefined,'short');await assert.rejects(short.run,/configuration_pending/);
 const valid=setup({data:good});assert.deepEqual(await valid.run(),{access:'mock-sandbox-token-123456789',collector:'42',mode:'test'});assert.equal(valid.calls.length,2);
 assert.doesNotMatch(worker+edge,/MP_ACCESS_TOKEN|MP_COLLECTOR_ID|MP_WEBHOOK_SECRET|shopPaymentConfig/);
 assert.match(edge,/await stagingInstallmentConfig\(admin\)/);assert.match(worker,/if\(environment!=='test'\)throw Error\('configuration_pending'\)/);
});
