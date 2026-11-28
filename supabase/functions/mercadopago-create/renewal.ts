// Reuse the existing Mercado Pago Orders flow; only an explicitly confirmed expired order can be renewed.
export function providerOrderState(order:any,expected:{id:string,preference_id:string,total_cents:number,environment:string},collector:string):'open'|'closed'|'uncertain' {
 if(!order||String(order.id)!==expected.preference_id||String(order.external_reference)!==expected.id||String(order.user_id)!==collector||
  (order.currency??order.currency_id)!=='BRL'||Math.round(Number(order.total_amount)*100)!==expected.total_cents||
  (typeof order.live_mode==='boolean'&&order.live_mode!==(expected.environment==='production')))return 'uncertain';
 const tx=order.transactions?.payments??[];
 if(!Array.isArray(tx))return 'uncertain';
 const status=String(order.status||'').toLowerCase(),detail=String(order.status_detail||'').toLowerCase();
 if(order.total_paid_amount!==undefined&&Number(order.total_paid_amount)!==0)return 'uncertain';
 if(tx.some((p:any)=>!p||Number(p.paid_amount??0)!==0||!['created','canceled','cancelled','expired','failed','rejected'].includes(String(p.status||'').toLowerCase())))return 'uncertain';
 if(status==='created'&&detail==='created'&&tx.every((p:any)=>String(p.status).toLowerCase()==='created'))return 'open';
 if(['canceled','cancelled','expired','failed'].includes(status)&&tx.every((p:any)=>['canceled','cancelled','expired','failed','rejected'].includes(String(p.status).toLowerCase())))return 'closed';
 return 'uncertain';
}
export function providerExpiration(seconds:number):string{
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>3600)throw Error('invalid_expiration');
 return seconds===3600?'PT1H':'PT'+seconds+'S';
}
export async function verifyClosedOrder(expected:any,collector:string,access:string,fetcher=fetch):Promise<boolean>{
 if(!/^ORD[A-Z0-9]{10,60}$/.test(expected.preference_id||''))return false;
 const url='https://api.mercadopago.com/v1/orders/'+expected.preference_id;
 const headers={Authorization:'Bearer '+access};
 const load=async()=>{const response=await fetcher(url,{headers,signal:AbortSignal.timeout(15000)});if(!response.ok)return null;return await response.json();};
 const first=await load(),state=providerOrderState(first,expected,collector);
 if(state==='closed')return true;
 if(state!=='open')return false;
 // A customer explicitly resuming an expired order authorizes retirement of its unused checkout.
 // Never cancel a pending/processed order. Refetch after cancellation; an ambiguous result is fail-closed.
 const cancelKey=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('neopep-renew-cancel:'+expected.preference_id));
 const key=Array.from(new Uint8Array(cancelKey),v=>v.toString(16).padStart(2,'0')).join('');
 await fetcher(url+'/cancel',{method:'POST',headers:{...headers,'X-Idempotency-Key':key},signal:AbortSignal.timeout(15000)}).catch(()=>null);
 return providerOrderState(await load(),expected,collector)==='closed';
}
