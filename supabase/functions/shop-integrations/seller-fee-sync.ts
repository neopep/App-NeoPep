// Candidate: reconcile seller costs with provider evidence. No payment mutations.
export function cents(value:any){
 if(typeof value!=='number'&&typeof value!=='string')return null;
 if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value)))return null;
 const n=Math.round(Number(value)*100);return Number.isSafeInteger(n)&&n>=0?n:null;
}
export function normalizeSellerFee(p:any,order:any,collector:string,environment:string){
 if(p?.status!=='approved'||p.currency_id!=='BRL'||String(p.collector_id)!==collector||p.live_mode!==(environment==='production')||p.external_reference!==order.id||p.captured!==true||cents(p.transaction_amount)!==order.total_cents||cents(p.transaction_amount_refunded)!==0||!Array.isArray(p.refunds)||p.refunds.length||!Array.isArray(p.fee_details)||!p.fee_details.length)return null;
 const gross=order.total_cents,net=cents(p.transaction_details?.net_received_amount),method=String(p.payment_method_id||''),installments=Number(p.installments);
 if(net===null||net>gross||!/^[a-z0-9_]{1,40}$/.test(method)||!Number.isInteger(installments)||installments<1||installments>24)return null;
 let processing=0,financing=0,buyer=0;
 for(const fee of p.fee_details){
  const v=cents(fee.amount);if(v===null)return null;
  if(fee.type==='mercadopago_fee'&&fee.fee_payer==='collector')processing+=v;
  else if(fee.type==='financing_fee'&&fee.fee_payer==='collector')financing+=v;
  else if(fee.type==='financing_fee'&&fee.fee_payer==='payer')buyer+=v;
  else return null;
 }
 if(gross-net!==processing+financing)return null;
 return {order_id:order.id,method,installments,gross_cents:gross,net_cents:net,processing_cents:processing,financing_cents:financing,buyer_financing_cents:buyer};
}
export async function syncSellerFees(admin:any,environment:string,getConfig:()=>Promise<any>,fetcher=fetch){
 const call=async(action:string,payload:any={})=>{const r=await admin.rpc('neo_shop_fee_sync_v1',{p_action:action,p_environment:environment,p_payload:payload});if(r.error)throw Error('fee_database');return r.data};
 const claim=await call('claim');if(claim.status!=='claimed')return claim;
 const rows:any[]=[];let result='success';
 try{
  if(!claim.orders.length)return await call('finish',{lease:claim.lease,rows,result:'no_evidence'});
  const config=await getConfig();if(config.mode!==environment)throw Error('environment');
  const headers={Authorization:'Bearer '+config.access};
  const seller=await fetcher('https://api.mercadopago.com/users/me',{headers,signal:AbortSignal.timeout(8000)});
  if(seller.status===429)result='rate_limited';
  else if(!seller.ok||String((await seller.json()).id)!==config.collector)result='provider_error';
  else for(const order of claim.orders){
   const url=new URL('https://api.mercadopago.com/v1/payments/search');url.searchParams.set('external_reference',order.id);url.searchParams.set('limit','50');
   const response=await fetcher(url,{headers,signal:AbortSignal.timeout(8000)});
   if(response.status===429){result='rate_limited';break;}if(!response.ok){result='provider_error';break;}
   const body=await response.json(),payments=body.results;
   if(!Array.isArray(payments)||!Number.isInteger(body.paging?.total)||body.paging.total!==payments.length)continue;
   const approved=payments.filter((p:any)=>p.external_reference===order.id&&p.status==='approved');
   if(approved.length!==1)continue;
   const row=normalizeSellerFee(approved[0],order,config.collector,environment);if(row)rows.push(row);
  }
  if(result==='success'&&rows.length!==claim.orders.length)result=rows.length?'partial':'no_evidence';
 }catch{result='provider_error'}
 return await call('finish',{lease:claim.lease,rows,result});
}
