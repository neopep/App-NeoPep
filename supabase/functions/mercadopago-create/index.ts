import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {paymentMethodForPolicy,providerPolicyMatches} from './installment-policy.ts';
import {providerExpiration,verifyClosedOrder} from './renewal.ts';
import {shopPaymentConfig} from '../_shared/shop-payment-config.ts';
export const paymentURL=(url:string)=>/^https:\/\/(www\.|sandbox\.)?mercadopago\.com(\.br)?\//.test(url);
Deno.serve(async(req:Request)=>{
 const app=Deno.env.get('SHOP_APP_URL')||'',allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);try{allowed.push(new URL(app).origin)}catch{}const origin=req.headers.get('Origin')||'',permitted=!!origin&&allowed.includes(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(permitted?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}:{})};
 const out=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers});
 if(!permitted)return out(403,{error:'Origem não autorizada.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'Método inválido.'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'Entre na conta.'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return out(401,{error:'Sessão inválida.'});
 let activeOrder='';try{
 const envAccess=Deno.env.get('MP_ACCESS_TOKEN'),envCollector=Deno.env.get('MP_COLLECTOR_ID'),envMode=(Deno.env.get('MP_MODE')||'test') as 'test'|'production';const {access,collector,mode}=envAccess&&envCollector?{access:envAccess,collector:envCollector,mode:envMode}:await shopPaymentConfig(admin);
 const body=await req.json();if(!/^[a-f0-9-]{36}$/.test(body.order_id))return out(400,{error:'Pedido inválido.'});activeOrder=body.order_id;
 const accountResponse=await fetch('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});if(!accountResponse.ok)throw Error('account');const account=await accountResponse.json();if(String(account.id)!==collector)return out(503,{error:'Confira a conta vendedora configurada no Mercado Pago.'});
 const user=auth.data.user.id;
 const args={p_order:activeOrder,p_user:user};
 const snap=await admin.rpc('neo_shop_payment_snapshot_v1',args);
 if(snap.error)return out(409,{error:'Não foi possível conferir este pedido.'});
 const previous=snap.data;
 if(previous.environment!==mode)return out(503,{error:'Ambiente de pagamento não corresponde à configuração da loja.'});
 if(body.renew===true){
  if(previous.status!=='expired')return out(409,{error:'Somente pedidos expirados podem ser retomados. Atualize Meus pedidos.'});
  if(previous.child_id){
   if(!['awaiting_payment','pending'].includes(previous.child_status)||Date.parse(previous.child_expires_at)<=Date.now())return out(409,{error:'Pedido já retomado. Consulte o pedido mais recente.'});
   activeOrder=previous.child_id;
  }else{
   let proof:string;
   if(previous.never_created===true)proof='never_created';
   else if(previous.preference_id&&await verifyClosedOrder(previous,collector,access))proof='closed';
   else return out(409,{error:'Pagamento anterior ainda não encerrado ou sem confirmação. Confira Meus pedidos ou contate a loja.'});
   const renewed=await admin.rpc('neo_shop_payment_renew_v1',{...args,p_preference:previous.preference_id??null,p_proof:proof});
   if(renewed.error)return out(409,{error:renewed.error.message||'Não foi possível reservar o estoque novamente.'});
   activeOrder=renewed.data.id;
  }
 }
 const claim=await admin.rpc('neo_shop_payment_claim_v60',{p_order:activeOrder,p_user:user});
 if(claim.error)return out(409,{error:claim.error.message||'Este pedido não pode ser retomado agora.'});
 const order=claim.data;
 if(order.environment!==mode)return out(503,{error:'Ambiente de pagamento não corresponde à configuração da loja.'});
 if(order.payment_url){if(!paymentURL(order.payment_url))throw Error('redirect');return out(200,{payment_url:order.payment_url,environment:mode,order_id:order.id});}
 if(!/^[a-f0-9-]{36}$/.test(order.create_key||''))throw Error('idempotency');
 const base=new URL(app);base.hash='';base.search='';const paymentReturn=(result:'success'|'pending'|'failure')=>{const url=new URL('payment-return.html',base);url.searchParams.set('result',result);url.searchParams.set('order',order.id);return url.href};
 const items=order.discount_cents>0?[{id:order.id,title:order.items.map((i:{payment_name?:string,name:string})=>i.payment_name||i.name).join(' + ').slice(0,120),quantity:1,currency_id:'BRL',unit_price:(order.total_cents-order.shipping_cents)/100}]:order.items.map((i:{product_id:string,name:string,payment_name?:string,quantity:number,unit_price_cents:number})=>({id:i.product_id,title:i.payment_name||i.name,quantity:i.quantity,currency_id:'BRL',unit_price:i.unit_price_cents/100}));
 if(order.shipping_cents>0)items.push({id:'shipping',title:'Entrega',quantity:1,currency_id:'BRL',unit_price:order.shipping_cents/100});
 const sum=items.reduce((n:number,i:{quantity:number,unit_price:number})=>n+Math.round(i.unit_price*100)*i.quantity,0);if(sum!==order.total_cents||sum<=0)throw Error('amount');
 const terms=await admin.rpc('neo_shop_order_installments_v1',{p_order:order.id,p_user:user});if(terms.error)return out(409,{error:'Condição de parcelamento indisponível. Confira o pedido com a loja.'});
 const paymentMethod=paymentMethodForPolicy(terms.data);
 const attemptKey=order.create_key;
 const response=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','X-Idempotency-Key':attemptKey},body:JSON.stringify({type:'online',processing_mode:'manual',capture_mode:'automatic_async',expiration_time:providerExpiration(order.expiration_seconds),total_amount:(order.total_cents/100).toFixed(2),external_reference:order.id,description:'Pedido NeoPeptídeos',payer:{email:order.email},items:items.map((i:{id:string;title:string;quantity:number;unit_price:number},index:number)=>({external_code:`item-${index+1}`,title:i.title,quantity:i.quantity,unit_price:i.unit_price.toFixed(2)})),config:{...(paymentMethod?{payment_method:paymentMethod}:{}),online:{success_url:paymentReturn('success'),pending_url:paymentReturn('pending'),failure_url:paymentReturn('failure'),auto_return:'approved'}}}),signal:AbortSignal.timeout(20000)});
 const providerText=await response.text();if(!response.ok){await admin.rpc('neo_shop_payment_release',{p_order:order.id,p_user:auth.data.user.id,p_force:true});console.error('mercadopago order rejected',response.status,providerText.slice(0,1000));let detail:any={};try{detail=JSON.parse(providerText)}catch{}const reason=String(detail.errors?.[0]?.details?.[0]||detail.errors?.[0]?.message||detail.message||detail.error||detail.cause?.[0]?.description||'revise a configuração da aplicação').slice(0,240);return out(response.status===401?503:422,{error:'Mercado Pago recusou a criação do pagamento: '+reason})}const providerOrder=JSON.parse(providerText),url=providerOrder.checkout_url;
 if(!paymentURL(url)||!/^ORD[A-Z0-9]{10,60}$/i.test(String(providerOrder.id)))throw Error('provider response');
 if(!providerPolicyMatches(terms.data,providerOrder))return out(409,{error:'Mercado Pago não confirmou a condição de parcelamento. Nenhum link foi liberado; contate a loja.'});
 const saved=await admin.rpc('neo_shop_payment_link',{p_order:order.id,p_preference:String(providerOrder.id),p_url:url});if(saved.error)throw Error('save');
 return out(200,{payment_url:url,environment:mode,order_id:order.id});
 }catch(err){/* Do not clear another request's lease after an uncertain provider call. The persisted key permits safe retry. */console.error('mercadopago create failed',String(err));return out(502,{error:'Não foi possível preparar o pagamento. Aguarde a conferência e tente novamente sem criar outro pedido.'})}
});
