import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {openAI,clinical,handoffText,origins,responseHeaders,sameSecret} from '../_shared/ai-provider.ts';
import {generate,integrationKey} from '../_shared/agent-providers.ts';
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',secret=Deno.env.get('NEO_AI_CRON_SECRET')||'',received=req.headers.get('x-neo-ai-secret')||'',worker=secret.length>=32&&received.length<=256&&!!received&&await sameSecret(secret,received),headers=responseHeaders(origins().includes(origin)?origin:''),out=(status:number,data:object)=>Response.json(data,{status,headers});
 if(req.method==='OPTIONS'&&origins().includes(origin))return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'method'});if(!worker&&!origins().includes(origin))return out(403,{error:'origin_not_allowed'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});let actor:string|null=null,message:string|null=null;
 if(!worker){const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'authentication_required'});const {data,error}=await admin.auth.getUser(token);if(error||!data.user)return out(401,{error:'invalid_session'});actor=data.user.id;try{const raw=await req.text();if(raw.length>2048)return out(413,{error:'request_too_large'});message=JSON.parse(raw).message_id;if(!/^[a-f0-9-]{36}$/i.test(message||''))return out(400,{error:'invalid_message'});}catch{return out(400,{error:'invalid_request'});}}
 let published=0;
 try{for(let i=0;i<(worker?3:1);i++){
  const claimed=await admin.rpc('neo_ai_claim',{p_actor:actor,p_message:message});if(claimed.error)return out(503,{error:'queue_unavailable'});const job=claimed.data;if(!job)break;
  try{const last=job.messages?.at(-1)?.content||'';let handoff=clinical(last),body:string;if(handoff)body=handoffText;else if(job.integration_id){const saved=await admin.rpc('neo_agent_credentials',{p_id:job.integration_id});if(saved.error||!saved.data||saved.data.revision!==job.integration_revision)throw Error('configuration_changed');body=await generate({...saved.data,model:job.model||saved.data.model},await integrationKey(saved.data),job.instructions,job.messages);}else{const key=Deno.env.get('OPENAI_API_KEY');if(!key)throw Error('configuration_pending');body=await openAI({model:job.model,instructions:job.instructions,messages:job.messages},key);}if(clinical(body)&&!handoff){handoff=true;body=handoffText;}
   const result=await admin.rpc('neo_ai_finish',{p_job:job.id,p_lease:job.lease,p_body:body,p_handoff:handoff,p_failed:false});if(!result.error&&result.data?.published)published++;
  }catch{await admin.rpc('neo_ai_finish',{p_job:job.id,p_lease:job.lease,p_body:'',p_handoff:false,p_failed:true});}
 }return out(200,{published});}catch{return out(503,{error:'assistant_unavailable'});}
});
