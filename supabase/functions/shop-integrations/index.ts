import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {syncInstallments,stagingInstallmentConfig} from './installment-sync.ts';
import {syncSellerFees} from './seller-fee-sync.ts';
import {normalizeInstallments} from './installments.ts';
import {encryptKey,decryptKey} from '../_shared/agent-providers.ts';
// Safe startup diagnostic: random synthetic value only; never logs keys or credential values.
if(Deno.env.get('SUPABASE_URL')==='https://qnuluspqfazdppciermw.supabase.co'){
 void (async()=>{
  try{
   const fixture=crypto.randomUUID();
   const envelope=await encryptKey(fixture,'staging-payment-crypto-probe');
   const restored=await decryptKey(envelope,'staging-payment-crypto-probe');
   console.info('neo_shop_crypto_probe:'+ (restored===fixture?'ready':'roundtrip_failed'));
  }catch(e){
   console.warn('neo_shop_crypto_probe:'+(e instanceof Error&&e.message==='encryption_configuration_pending'?'missing_or_invalid_master':'crypto_failed'));
  }
 })();
}
Deno.serve(async(req:Request)=>{
 const app=Deno.env.get('SHOP_APP_URL')||'',allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);try{allowed.push(new URL(app).origin)}catch{}const origin=req.headers.get('Origin')||'',permitted=origin==='https://teste.app.neopep.com.br';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(permitted?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}:{})},out=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers});
 if(Deno.env.get('SUPABASE_URL')!=='https://qnuluspqfazdppciermw.supabase.co')return out(503,{error:'environment_mismatch'});
 if(req.method==='POST'&&!origin&&req.headers.has('x-neo-installment-cron')){
  const secret=Deno.env.get('NEO_INSTALLMENT_CRON_SECRET')||'',provided=req.headers.get('x-neo-installment-cron')||'';
  if(secret.length<32||provided!==secret)return out(403,{error:'forbidden'});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  try{const active=await admin.rpc('neo_shop_installment_active_environment_v1');if(active.error||active.data!=='test')return out(200,{status:'disabled'});const quotes=await syncInstallments(admin,active.data,false);let fees;try{fees=await syncSellerFees(admin,'test',()=>stagingInstallmentConfig(admin));}catch{fees={status:'fee_sync_unavailable'}}return out(200,{...quotes,seller_fees:fees});}catch{return out(503,{error:'sync_failed'});}
 }
 if(!permitted)return out(403,{error:'origin'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'method'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'auth'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return out(401,{error:'auth'});
 try{const body=await req.json(),action=String(body.action||'status');const financialAdmin=await admin.rpc('neo_shop_financial_admin_v1',{p_actor:auth.data.user.id});if(financialAdmin.error||financialAdmin.data!==true)throw Error('forbidden');
  if(action==='status'){const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'status',p_payload:{}});if(r.error)throw r.error;return out(200,{...r.data,webhook_url:new URL('/functions/v1/mercadopago-webhook',Deno.env.get('SUPABASE_URL')).href})}
  // Candidate endpoints use the same financial-admin gate and staging credentials.
  if(action==='seller_fees_status'||action==='seller_fees_sync'){
   if(body.environment!=='test')return out(400,{error:'environment'});
   if(action==='seller_fees_sync')return out(200,await syncSellerFees(admin,'test',()=>stagingInstallmentConfig(admin)));
   const fees=await admin.rpc('neo_shop_fee_sync_v1',{p_action:'status',p_environment:'test',p_payload:{}});
   if(fees.error){if(['PGRST202','42883'].includes(fees.error.code))return out(200,{status:'not_installed',enabled:false,rows:[]});throw Error('fee_database');}
   return out(200,fees.data);
  }
  if(action==='installment_sync'){
   const environment=body.environment;if(environment!=='test')return out(400,{error:'environment'});
   return out(200,await syncInstallments(admin,environment,true));
  }
  if(action==='installments'){
   const environment=body.environment,bin=String(body.bin||''),amount=Number(body.amount_cents);
   if(environment!=='test'||!/^[0-9]{8}$/.test(bin)||!Number.isSafeInteger(amount)||amount<1||amount>100000000)return out(400,{error:'installments_input'});
   const config=await stagingInstallmentConfig(admin);
   if(config.mode!==environment)return out(409,{error:'environment_mismatch'});
   const headers={Authorization:'Bearer '+config.access};
   const seller=await fetch('https://api.mercadopago.com/users/me',{headers,signal:AbortSignal.timeout(15000)});
   if(!seller.ok||String((await seller.json()).id)!==config.collector)return out(503,{error:'provider_key_invalid'});
   const url=new URL('https://api.mercadopago.com/v1/payment_methods/installments');url.searchParams.set('bin',bin);url.searchParams.set('amount',(amount/100).toFixed(2));
   const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
   if(!response.ok)return out(502,{error:'installments_unavailable'});
   return out(200,{rows:normalizeInstallments(await response.json()),observed_at:new Date().toISOString(),environment});
  }
  if(action==='save'){const environment=body.environment;if(environment!=='test')return out(400,{error:'environment'});const payload:any={environment};if(body.access_token){if(String(body.access_token).length<20)return out(400,{error:'access_token'});payload.encrypted_access=await encryptKey(String(body.access_token).trim(),'mercadopago:access')}if(body.webhook_secret){if(String(body.webhook_secret).length<16)return out(400,{error:'webhook_secret'});payload.encrypted_webhook=await encryptKey(String(body.webhook_secret).trim(),'mercadopago:webhook')}const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'save',p_payload:payload});if(r.error)throw r.error;return out(200,{ok:true,environment})}
  if(action==='test'){const environment=body.environment;if(environment!=='test')return out(400,{error:'environment'});const row=await admin.rpc('neo_shop_payment_credentials',{p_environment:environment});if(row.error||!row.data?.encrypted_access||!row.data?.encrypted_webhook)throw Error('configuration_pending');const access=await decryptKey(row.data.encrypted_access,'mercadopago:access');await decryptKey(row.data.encrypted_webhook,'mercadopago:webhook');const response=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});if(response.status===401||response.status===403)return out(400,{error:'provider_key_invalid'});if(!response.ok)throw Error('provider');const account=await response.json();const saved=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'validated',p_payload:{environment,collector_id:String(account.id)}});if(saved.error)throw saved.error;return out(200,{ok:true,collector_id:String(account.id),environment})}
  if(action==='activate'){const environment=body.environment;if(environment!=='test')return out(400,{error:'environment'});const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'activate',p_payload:{environment}});if(r.error)throw r.error;return out(200,r.data)}
  return out(400,{error:'action'});
 }catch(e){const code=e instanceof Error?e.message:'failed';return out(code==='forbidden'?403:503,{error:code})}
});
