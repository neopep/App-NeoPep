import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {decryptKey} from '../_shared/agent-providers.ts';
export async function verifySignature(secret:string,id:string,requestID:string,signature:string,now=Date.now()){
 if(!secret||!/^ORD[A-Z0-9]{10,60}$/i.test(id)||!requestID||requestID.length>150)return false;
 const parts=Object.fromEntries(signature.split(',').map(p=>p.trim().split('=')));const ts=parts.ts,v1=parts.v1;if(!/^\d{10}(\d{3})?$/.test(ts||'')||!/^[a-f0-9]{64}$/i.test(v1||''))return false;
 const millis=ts.length===13?Number(ts):Number(ts)*1000;if(Math.abs(now-millis)>600000)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,Uint8Array.from(v1.match(/../g)!,h=>parseInt(h,16)),new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${requestID};ts:${ts};`));
}
async function paymentID(value:string){
 if(/^[0-9]{1,30}$/.test(value))return value;
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 let number=0n;for(const byte of hash.slice(0,12))number=(number<<8n)+BigInt(byte);
 return number.toString();
}
Deno.serve(async(req:Request)=>{
 const out=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return out(405,{error:'method'});
 if(Deno.env.get('SUPABASE_URL')!=='https://qnuluspqfazdppciermw.supabase.co')return out(503,{error:'environment_mismatch'});
 const url=new URL(req.url),id=url.searchParams.get('data.id')||'',requestID=req.headers.get('x-request-id')||'',signature=req.headers.get('x-signature')||'';
 if(!/^ORD[A-Z0-9]{10,60}$/.test(id)||!requestID||requestID.length>150||!signature||signature.length>256)return out(401,{error:'signature'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 let access:string,secret:string,collector:string;
 try{
 const row=await admin.rpc('neo_shop_payment_credentials',{p_environment:'test'});
 if(row.error||row.data?.environment!=='test'||!row.data.encrypted_access||!row.data.encrypted_webhook||!row.data.collector_id||!row.data.validated_at)return out(503,{error:'configuration_pending'});
 secret=await decryptKey(row.data.encrypted_webhook,'mercadopago:webhook');
 if(!await verifySignature(secret,id,requestID,signature))return out(401,{error:'signature'});
 access=await decryptKey(row.data.encrypted_access,'mercadopago:access');collector=String(row.data.collector_id);
 }catch{return out(503,{error:'configuration_pending'});}
 try{
 const response=await fetch('https://api.mercadopago.com/v1/orders/'+id,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('provider');const providerOrder=await response.json();
 if(String(providerOrder.id)!==id||String(providerOrder.user_id)!==collector||providerOrder.currency!=='BRL'||(providerOrder.live_mode!==undefined&&providerOrder.live_mode!==false)||!/^[a-f0-9-]{36}$/.test(providerOrder.external_reference))return out(400,{error:'payment_mismatch'});
 const cents=Math.round(Number(providerOrder.total_amount)*100);if(!Number.isSafeInteger(cents)||cents<=0)return out(400,{error:'amount'});
 const transactions=providerOrder.transactions?.payments;
 if(!Array.isArray(transactions))return out(409,{error:'transaction_pending'});
 // No synthetic payment record for an unused checkout; expiration remains local.
 if(transactions.length===0){if(['created','canceled','cancelled','expired'].includes(String(providerOrder.status)))return out(200,{received:true,unused:true});return out(409,{error:'transaction_pending'});}
 if(transactions.length!==1)return out(409,{error:'multiple_transactions_review'});
 const transaction=transactions[0],detail=String(providerOrder.status_detail||transaction?.status_detail||'').toLowerCase(),providerStatus=String(providerOrder.status||'').toLowerCase(),transactionStatus=String(transaction?.status||'').toLowerCase();
 if(!transaction?.id||!/^[A-Za-z0-9_-]{1,100}$/.test(String(transaction.id)))return out(409,{error:'transaction_pending'});
 let status:string;
 if(detail==='partially_refunded')status='partially_refunded';
 else if(providerStatus==='refunded')status='refunded';
 else if(providerStatus==='charged_back')status='charged_back';
 else if(['processed','approved'].includes(providerStatus)&&['processed','approved'].includes(transactionStatus)&&(!detail||['accredited','approved','processed'].includes(detail)))status='approved';
 else if(['cancelled','canceled'].includes(providerStatus))status='cancelled';
 else if(providerStatus==='failed'||transactionStatus==='rejected')status='rejected';
 else if(['created','processing','action_required','pending','in_process'].includes(providerStatus))status='pending';
 else return out(409,{error:'status_review'});
 const type=transaction.payment_method?.type,idMethod=transaction.payment_method?.id,method=idMethod==='pix'?'pix':type==='credit_card'?'credit_card':type==='ticket'?'boleto':'other';
 const saved=await admin.rpc('neo_staging_shop_payment_event_v1',{p_order:providerOrder.external_reference,p_provider_order:id,p_payment:await paymentID(String(transaction.id)),p_status:status,p_amount:cents,p_method:method});
 if(saved.error)return out(409,{error:'order_mismatch'});
 return out(200,{received:true});
 }catch{return out(503,{error:'verification_pending'})}
});
