import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {normalizeInstallments} from './installments.ts';
import {shopPaymentConfig} from '../_shared/shop-payment-config.ts';
import {encryptKey,decryptKey} from '../_shared/agent-providers.ts';
Deno.serve(async(req:Request)=>{
 const app=Deno.env.get('SHOP_APP_URL')||'',allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);try{allowed.push(new URL(app).origin)}catch{}const origin=req.headers.get('Origin')||'',permitted=!!origin&&allowed.includes(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(permitted?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}:{})},out=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers});
 if(!permitted)return out(403,{error:'origin'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'method'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'auth'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return out(401,{error:'auth'});
 try{const body=await req.json(),action=String(body.action||'status');await admin.rpc('neo_integration_admin',{p_actor:auth.data.user.id}).then((r:any)=>{if(r.error)throw Error('forbidden')});
  if(action==='status'){const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'status',p_payload:{}});if(r.error)throw r.error;return out(200,{...r.data,webhook_url:new URL('/functions/v1/mercadopago-webhook',Deno.env.get('SUPABASE_URL')).href})}
  if(action==='installments'){
   const environment=body.environment,bin=String(body.bin||''),amount=Number(body.amount_cents);
   if(!['test','production'].includes(environment)||!/^[0-9]{8}$/.test(bin)||!Number.isSafeInteger(amount)||amount<1||amount>100000000)return out(400,{error:'installments_input'});
   const config=await shopPaymentConfig(admin,false,environment);
   if(config.mode!==environment)return out(409,{error:'environment_mismatch'});
   const headers={Authorization:'Bearer '+config.access};
   const seller=await fetch('https://api.mercadopago.com/users/me',{headers,signal:AbortSignal.timeout(15000)});
   if(!seller.ok||String((await seller.json()).id)!==config.collector)return out(503,{error:'provider_key_invalid'});
   const url=new URL('https://api.mercadopago.com/v1/payment_methods/installments');url.searchParams.set('bin',bin);url.searchParams.set('amount',(amount/100).toFixed(2));
   const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
   if(!response.ok)return out(502,{error:'installments_unavailable'});
   return out(200,{rows:normalizeInstallments(await response.json()),observed_at:new Date().toISOString(),environment});
  }
  if(action==='save'){const environment=body.environment;if(!['test','production'].includes(environment))return out(400,{error:'environment'});const payload:any={environment};if(body.access_token){if(String(body.access_token).length<20)return out(400,{error:'access_token'});payload.encrypted_access=await encryptKey(String(body.access_token).trim(),'mercadopago:access')}if(body.webhook_secret){if(String(body.webhook_secret).length<16)return out(400,{error:'webhook_secret'});payload.encrypted_webhook=await encryptKey(String(body.webhook_secret).trim(),'mercadopago:webhook')}const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'save',p_payload:payload});if(r.error)throw r.error;return out(200,{ok:true,environment})}
  if(action==='test'){const environment=body.environment;if(!['test','production'].includes(environment))return out(400,{error:'environment'});const row=await admin.rpc('neo_shop_payment_credentials',{p_environment:environment});if(row.error||!row.data?.encrypted_access||!row.data?.encrypted_webhook)throw Error('configuration_pending');const access=await decryptKey(row.data.encrypted_access,'mercadopago:access');await decryptKey(row.data.encrypted_webhook,'mercadopago:webhook');const response=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});if(response.status===401||response.status===403)return out(400,{error:'provider_key_invalid'});if(!response.ok)throw Error('provider');const account=await response.json();const saved=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'validated',p_payload:{environment,collector_id:String(account.id)}});if(saved.error)throw saved.error;return out(200,{ok:true,collector_id:String(account.id),environment})}
  if(action==='activate'){const environment=body.environment;if(!['test','production'].includes(environment))return out(400,{error:'environment'});const r=await admin.rpc('neo_shop_payment_integration',{p_actor:auth.data.user.id,p_action:'activate',p_payload:{environment}});if(r.error)throw r.error;return out(200,r.data)}
  return out(400,{error:'action'});
 }catch(e){const code=e instanceof Error?e.message:'failed';return out(code==='forbidden'?403:503,{error:code})}
});
