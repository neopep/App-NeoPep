import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {syncInstallments} from './installment-sync.ts';
// Isolated administrative quotation endpoint. Never creates, cancels or modifies payments.
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'',allowed=origin==='https://app.neopep.com.br';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}:{})};
 const out=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers});
 if(Deno.env.get('SUPABASE_URL')!=='https://cpslafpzjtbpmoxxysaa.supabase.co')return out(503,{error:'environment'});
 if(!allowed)return out(403,{error:'origin'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,{error:'method'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
 if(!token)return out(401,{error:'auth'});
 try{
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await admin.auth.getUser(token);
  if(auth.error||!auth.data.user)return out(401,{error:'auth'});
  const role=await admin.rpc('neo_shop_financial_admin_v1',{p_actor:auth.data.user.id});
  if(role.error||role.data!==true)return out(403,{error:'forbidden'});
  const body=await req.json();
  if(body?.action!=='sync'||body.environment!=='production')return out(400,{error:'environment'});
  return out(200,await syncInstallments(admin,'production',true));
 }catch{return out(503,{error:'sync_failed'});}
});
