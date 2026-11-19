import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {openAI,origins,responseHeaders} from '../_shared/ai-provider.ts';
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers=responseHeaders(origins().includes(origin)?origin:''),out=(status:number,data:object)=>Response.json(data,{status,headers});
 if(!origins().includes(origin))return out(403,{error:'origin_not_allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'method'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'authentication_required'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await admin.auth.getUser(token);if(authError||!identity.user)return out(401,{error:'invalid_session'});
 const {data:cfg,error}=await admin.rpc('neo_integration_admin',{p_actor:identity.user.id});if(error||!cfg)return out(403,{error:'administrator_required'});
 try{const raw=await req.text();if(raw.length>2048)return out(413,{error:'request_too_large'});const action=JSON.parse(raw||'{}').action||'status';
 if(action==='test_ai'){
  if(cfg.ai_provider!=='openai'||!cfg.ai_model||!Deno.env.get('OPENAI_API_KEY'))return out(503,{error:'configuration_pending'});
  await openAI({model:cfg.ai_model,instructions:'',messages:[{role:'user',content:'Teste operacional da conexão. Responda apenas OK.'}]},Deno.env.get('OPENAI_API_KEY')!);
  const verified=await admin.rpc('neo_ai_validated',{p_actor:identity.user.id,p_model:cfg.ai_model});if(verified.error)return out(409,{error:'configuration_changed'});
  return out(200,{tested:true,model:cfg.ai_model});
 }
 if(action!=='status')return out(400,{error:'invalid_action'});
 return out(200,{openai_key_present:!!Deno.env.get('OPENAI_API_KEY'),ai_worker_secret_present:(Deno.env.get('NEO_AI_CRON_SECRET')||'').length>=32,mercadopago_keys_present:!!Deno.env.get('MP_ACCESS_TOKEN')&&!!Deno.env.get('MP_WEBHOOK_SECRET')&&!!Deno.env.get('MP_COLLECTOR_ID'),mercadopago_mode:Deno.env.get('MP_MODE')==='production'?'production':'test',ai_validated_at:cfg.ai_validated_at||null});
 }catch{return out(503,{error:'integration_test_failed'});}
});
