import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {shopPaymentConfig} from '../_shared/shop-payment-config.ts';
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
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),url=new URL(req.url),reference=url.searchParams.get('data.external_reference')||'';let orderMode:'test'|'production'|undefined;if(/^[a-f0-9-]{36}$/i.test(reference)){const found=await admin.rpc('neo_shop_payment_environment',{p_order:reference});if(!found.error&&['test','production'].includes(found.data))orderMode=found.data}let config;try{const envSecret=Deno.env.get('MP_WEBHOOK_SECRET'),envAccess=Deno.env.get('MP_ACCESS_TOKEN'),envCollector=Deno.env.get('MP_COLLECTOR_ID'),envMode=(Deno.env.get('MP_MODE')||'test') as 'test'|'production';config=envSecret&&envAccess&&envCollector?{secret:envSecret,access:envAccess,collector:envCollector,mode:envMode}:await shopPaymentConfig(admin,true,orderMode)}catch{return out(503,{error:'configuration_pending'})}const {secret,access,collector,mode}=config;
 const id=url.searchParams.get('data.id')||'';
 if(!await verifySignature(secret,id,req.headers.get('x-request-id')||'',req.headers.get('x-signature')||''))return out(401,{error:'signature'});
 try{
 const response=await fetch('https://api.mercadopago.com/v1/orders/'+id,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('provider');const providerOrder=await response.json();
 if(String(providerOrder.id)!==id||String(providerOrder.user_id)!==collector||providerOrder.currency!=='BRL'||(typeof providerOrder.live_mode==='boolean'&&providerOrder.live_mode!==(mode==='production'))||!/^[a-f0-9-]{36}$/.test(providerOrder.external_reference))return out(400,{error:'payment_mismatch'});
 const cents=Math.round(Number(providerOrder.total_amount)*100);if(!Number.isSafeInteger(cents)||cents<=0)return out(400,{error:'amount'});
 const transaction=providerOrder.transactions?.payments?.find((p:any)=>['processed','approved'].includes(String(p.status).toLowerCase()))||providerOrder.transactions?.payments?.[0]||{},detail=String(providerOrder.status_detail||transaction.status_detail||'').toLowerCase(),providerStatus=String(providerOrder.status||'').toLowerCase(),transactionStatus=String(transaction.status||'').toLowerCase();const partial=[providerStatus,transactionStatus,detail,String(transaction.status_detail||'').toLowerCase()].includes('partially_refunded');const status=partial?'partially_refunded':(['processed','approved'].includes(providerStatus)||['processed','approved'].includes(transactionStatus))&&(!detail||['accredited','approved','processed'].includes(detail))?'approved':providerStatus==='cancelled'?'cancelled':providerStatus==='refunded'?'refunded':providerStatus==='failed'||transactionStatus==='rejected'?'rejected':'pending';
 const type=transaction.payment_method?.type,idMethod=transaction.payment_method?.id,method=idMethod==='pix'?'pix':type==='credit_card'?'credit_card':type==='ticket'?'boleto':'other',args={p_order:providerOrder.external_reference,p_payment:await paymentID(String(transaction.id||id)),p_status:status,p_amount:cents,p_environment:mode};let saved=await admin.rpc('neo_shop_payment_event_v2',{...args,p_method:method});if(saved.error&&['PGRST202','42883'].includes(saved.error.code))saved=await admin.rpc('neo_shop_payment_event',args);if(saved.error){console.error('payment event rejected',saved.error.code,saved.error.message,saved.error.details);return out(409,{error:'order_mismatch'})}
 return out(200,{received:true});
 }catch{return out(503,{error:'verification_pending'})}
});
