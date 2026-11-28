import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {syncInstallments} from './installment-sync.ts';
Deno.serve(async(req:Request)=>{
 const out=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(Deno.env.get('SUPABASE_URL')!=='https://cpslafpzjtbpmoxxysaa.supabase.co')return out(503,{error:'environment'});
 if(req.method!=='POST')return out(405,{error:'method'});
 const nonce=req.headers.get('x-neo-job-nonce');
 if(!nonce||!(/^[a-f0-9]{64}$/).test(nonce)||req.headers.has('Origin'))return out(403,{error:'forbidden'});
 try{
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await admin.rpc('neo_installment_job_consume_v1',{p_nonce:nonce});
  if(auth.error||auth.data!==true)return out(403,{error:'forbidden'});
  return out(200,await syncInstallments(admin,'production',false));
 }catch{return out(503,{error:'sync_failed'});}
});
