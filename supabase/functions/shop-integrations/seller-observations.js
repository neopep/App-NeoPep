// Candidate read-only Mercado Pago observations. No payment creation, no tariff mutation.
export function moneyCents(v){
 if(typeof v!=='string'&&typeof v!=='number')return null;
 const s=String(v);if(!/^\d{1,12}(\.\d{1,2})?$/.test(s))return null;
 const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)?n:null;
}
export function normalizeSellerPayment(p,o,collector,environment){
 if(!p||String(p.id)!==o.payment_id||String(p.collector_id)!==String(collector)||p.external_reference!==o.order_id||p.currency_id!=='BRL'||p.status!=='approved'||p.live_mode!==(environment==='production')||moneyCents(p.transaction_amount_refunded)!==0)return null;
 const gross=moneyCents(p.transaction_amount),net=moneyCents(p.transaction_details?.net_received_amount),paid=moneyCents(p.transaction_details?.total_paid_amount);
 if(gross!==o.total_cents||gross<=0||net===null||net>gross||paid===null||paid<gross||!Number.isInteger(p.installments)||p.installments<1||p.installments>24||!/^[a-z0-9_]{1,40}$/.test(p.payment_method_id||'')||!/^[a-z0-9_]{1,40}$/.test(p.payment_type_id||''))return null;
 return {order_id:o.order_id,payment_id:o.payment_id,method:p.payment_method_id,payment_type:p.payment_type_id,installments:p.installments,gross_cents:gross,net_cents:net,buyer_paid_cents:paid};
}
export async function syncSellerObservations(admin,config,environment,fetcher=fetch,timeout=()=>AbortSignal.timeout(7000)){
 if(config.mode!==environment||!['test','production'].includes(environment))throw Error('environment_mismatch');
 const rpc=async(action,payload={})=>{const r=await admin.rpc('neo_shop_seller_observations_worker_v1',{p_action:action,p_environment:environment,p_payload:payload});if(r.error)throw Error('observation_database');return r.data;};
 const claim=await rpc('candidates');const orders=claim.orders;
 if(!Array.isArray(orders)||orders.length>12||typeof claim.revision!=='string')throw Error('observation_contract');
 if(!orders.length)return {status:'no_pending_orders',recorded:0,rejected:0};
 const headers={Authorization:'Bearer '+config.access},get=path=>fetcher('https://api.mercadopago.com'+path,{method:'GET',headers,redirect:'error',signal:timeout()});
 const seller=await get('/users/me');if(!seller.ok||String((await seller.json()).id)!==config.collector)return {status:'account_unverified',recorded:0,rejected:0};
 let recorded=0,rejected=0;
 for(const o of orders){
  if(!/^[0-9]{1,30}$/.test(o.payment_id)){rejected++;continue;}
  const response=await get('/v1/payments/'+o.payment_id);
  if(response.status===429)return {status:'rate_limited',recorded,rejected};
  if(!response.ok){rejected++;continue;}
  const observation=normalizeSellerPayment(await response.json(),o,config.collector,environment);
  if(!observation){rejected++;continue;}
  await rpc('record',{revision:claim.revision,observation});recorded++;
 }
 return {status:rejected?'partial':'success',recorded,rejected};
}
