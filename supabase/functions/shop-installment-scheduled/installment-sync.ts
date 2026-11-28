import {normalizeInstallments} from './installments.ts';
import {decryptKey} from '../_shared/agent-providers.ts';
// Teste only: use validated credentials from the same Teste database as checkout.
// No environment-variable fallback, even if legacy MP_MODE defaults to test.
export async function productionInstallmentConfig(admin:any){
 if(Deno.env.get('SUPABASE_URL')!=='https://cpslafpzjtbpmoxxysaa.supabase.co')throw Error('configuration_pending');
 const row=await admin.rpc('neo_shop_payment_credentials',{p_environment:'production'});
 const data=row.data;
 if(row.error||data?.environment!=='production'||!data.encrypted_access||!data.validated_at||!/^[0-9]{1,30}$/.test(String(data.collector_id??'')))throw Error('configuration_pending');
 const access=await decryptKey(data.encrypted_access,'mercadopago:access');
 if(typeof access!=='string'||access.length<20)throw Error('configuration_pending');
 return {access,collector:String(data.collector_id),mode:'production'};
}
// The ordinary installments endpoint is a quotation API, not a confirmed universal seller-rate table.
// Never infer a formula or substitute a fixed BIN. Probe authenticated brand-specific quotes without BIN; generic amount-only calls are unsupported.
export function retrySeconds(value:string|null,now=Date.now()){
 const n=value&&/^\d+$/.test(value)?Number(value):value?Math.ceil((Date.parse(value)-now)/1000):1800;
 return Number.isFinite(n)?Math.min(604800,Math.max(1800,n)):1800;
}
export async function syncInstallments(admin:any,environment:'production',manual=false,fetcher=fetch){
 const call=async(action:string,payload:any)=>{const r=await admin.rpc('neo_shop_installment_worker_v1',{p_action:action,p_payload:{environment,...payload}});if(r.error)throw Error('sync_database');return r.data;};
 const claim=await call('claim',{manual});
 if(claim.status!=='claimed')return claim;
 const quotes:any[]=[];let result='success',retry=1800;
 try{
  // Use the exact credentials the hosted checkout uses. Never cross environments.
  if(environment!=='production')throw Error('configuration_pending');
  const config=await productionInstallmentConfig(admin);
  if(config.mode!==environment||config.collector!==String(claim.collector))throw Error('configuration_pending');
  const headers={Authorization:'Bearer '+config.access};
  const seller=await fetcher('https://api.mercadopago.com/users/me',{headers,signal:AbortSignal.timeout(10000)});
  if(seller.status===429){retry=retrySeconds(seller.headers.get('Retry-After'));result='rate_limited';}
  else if(!seller.ok||String((await seller.json()).id)!==config.collector)result='configuration_pending';
  else for(const amount of claim.amounts.slice(0,6)){
   const rows:any[]=[];
   for(const method of ['visa','master']){
    const url=new URL('https://api.mercadopago.com/v1/payment_methods/installments');
    url.searchParams.set('amount',(amount/100).toFixed(2));url.searchParams.set('payment_method_id',method);
    const response=await fetcher(url,{headers,signal:AbortSignal.timeout(8000)});
    if(response.status===429){retry=retrySeconds(response.headers.get('Retry-After'));result='rate_limited';break;}
    if([400,403,404,422].includes(response.status)){result='unsupported';break;}
    if(!response.ok){result='provider_error';break;}
    const parsed=await response.json();
    const offers=new Map<string,any>();
    for(const row of normalizeInstallments(parsed)){
     if(row.method!==method||row.total_cents<amount||Math.abs(row.installment_cents*row.installments-row.total_cents)>row.installments)continue;
     const key=[row.method,row.installments,row.buyer_rate,row.installment_cents,row.total_cents].join(':');
     if(!offers.has(key))offers.set(key,{...row,issuer:'',issuer_count:0});
     offers.get(key).issuer_count++;
    }
    rows.push(...offers.values());
   }
   if(result!=='success')break;
   if(rows.length)quotes.push({amount_cents:amount,rows:rows.slice(0,240)});
  }
  if(result==='success'&&quotes.length!==claim.amounts.length)result=quotes.length?'partial':'no_options';
 }catch(e){result=e instanceof Error&&e.message==='configuration_pending'?'configuration_pending':'provider_error';}
 return await call('finish',{lease:claim.lease,result,quotes:result==='unsupported'?[]:quotes,retry_seconds:retry});
}
