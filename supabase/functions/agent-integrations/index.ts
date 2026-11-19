import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {origins,responseHeaders,clinical,handoffText} from '../_shared/ai-provider.ts';
import {encryptKey,integrationKey,generate} from '../_shared/agent-providers.ts';
const modelId=(v:unknown)=>typeof v==='string'&&/^[-A-Za-z0-9._:]{1,100}$/.test(v);
async function availableModels(provider:string,key:string,workspace=''){
 let url='',headers:Record<string,string>={};
 if(provider==='openai'){url='https://api.openai.com/v1/models';headers.Authorization=`Bearer ${key}`;}
 else if(provider==='gemini'){url='https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000';headers['x-goog-api-key']=key;}
 else if(provider==='claude'){url='https://api.anthropic.com/v1/models?limit=1000';headers={'x-api-key':key,'anthropic-version':'2023-06-01',...(workspace?{'anthropic-workspace-id':workspace}:{})};}
 else throw Error('invalid_provider');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 let response:Response;try{response=await fetch(url,{headers,signal:controller.signal});}finally{clearTimeout(timer);}
 if(response.status===401||response.status===403)throw Error('provider_key_invalid');
 if(response.status===429)throw Error('provider_quota_exhausted');
 if(!response.ok)throw Error('model_list_unavailable');
 const body=await response.json();let ids:string[]=[];
 if(provider==='openai')ids=(body.data||[]).map((x:{id?:string})=>x.id).filter(modelId).filter((id:string)=>/^(gpt-|o[1-9]|chatgpt-)/.test(id)&&!/realtime|audio|transcribe|tts|image|search|deep-research/i.test(id));
 if(provider==='gemini')ids=(body.models||[]).filter((x:{supportedGenerationMethods?:string[]})=>x.supportedGenerationMethods?.includes('generateContent')).map((x:{name?:string})=>String(x.name||'').replace(/^models\//,'')).filter(modelId);
 if(provider==='claude')ids=(body.data||[]).map((x:{id?:string})=>x.id).filter(modelId);
 return [...new Set(ids)].sort((a,b)=>a.localeCompare(b)).slice(0,300);
}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',allowed=origins().includes(origin),headers=responseHeaders(allowed?origin:''),out=(status:number,data:object)=>Response.json(data,{status,headers});
 if(!allowed)return out(403,{error:'origin_not_allowed'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out(405,{error:'method'});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'authentication_required'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const identity=await db.auth.getUser(token);if(identity.error||!identity.data.user)return out(401,{error:'invalid_session'});
 const actor=identity.data.user.id,check=await db.rpc('neo_integration_admin',{p_actor:actor});if(check.error||!check.data)return out(403,{error:'administrator_required'});
 try{
  const raw=await req.text();if(raw.length>12000)return out(413,{error:'request_too_large'});const payload=JSON.parse(raw||'{}'),action=payload.action;
  const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
  const rpc=async(action:string,p:object)=>{const r=await db.rpc('neo_agent_integration',{p_actor:actor,p_action:action,p_payload:p});if(r.error)throw Error('configuration_changed');return r.data;};
  if(action==='status')return out(200,{credential_storage_ready:!!Deno.env.get('NEO_AI_ENCRYPTION_KEY')&&(()=>{try{return atob(Deno.env.get('NEO_AI_ENCRYPTION_KEY')!).length===32;}catch{return false;}})()});
  if(action==='models'){
   if(!['openai','gemini','claude'].includes(payload.provider))return out(400,{error:'invalid_provider'});
   let key='',workspace=typeof payload.workspace==='string'?payload.workspace:'';
   if(typeof payload.api_key==='string'&&payload.api_key.trim().length>=10&&payload.api_key.length<=4000)key=payload.api_key.trim();
   else if(uuid(payload.id)){const result=await db.rpc('neo_agent_credentials',{p_id:payload.id});if(result.error||!result.data||result.data.provider!==payload.provider)return out(503,{error:'configuration_pending'});key=await integrationKey(result.data);workspace=result.data.workspace||workspace;}
   else return out(400,{error:'key_required'});
   return out(200,{models:await availableModels(payload.provider,key,workspace)});
  }
  if(action==='save'){
   const id=payload.id||crypto.randomUUID();if(!uuid(id)||!['openai','gemini','claude'].includes(payload.provider)||typeof payload.name!=='string'||!payload.name.trim()||payload.name.length>80||!/^[-A-Za-z0-9._:]{1,100}$/.test(payload.model||'')||typeof (payload.workspace||'')!=='string'||!/^[A-Za-z0-9_-]{0,120}$/.test(payload.workspace||''))return out(400,{error:'invalid_integration'});
   if(payload.api_key!==undefined&&(typeof payload.api_key!=='string'||payload.api_key.length>4000||payload.api_key.trim().length<10))return out(400,{error:'invalid_key'});
   const encrypted=payload.api_key?await encryptKey(payload.api_key.trim(),id):undefined;
   await rpc('save',{id,name:payload.name.trim(),provider:payload.provider,model:payload.model,workspace:payload.workspace||'',expected_revision:payload.expected_revision,...(encrypted?{encrypted_key:encrypted}:{})});
   return out(200,{saved:true,id});
  }
  if(!uuid(payload.id))return out(400,{error:'invalid_id'});
  if(action==='delete'){await rpc('delete',{id:payload.id});return out(200,{deleted:true});}
  if(!['test','preview'].includes(action))return out(400,{error:'invalid_action'});
  if(action==='preview'&&(typeof payload.message!=='string'||payload.message.trim().length<1||payload.message.length>2000))return out(400,{error:'invalid_message'});
  const result=await db.rpc('neo_agent_credentials',{p_id:payload.id});if(result.error||!result.data)return out(503,{error:'configuration_pending'});const integration=result.data;
  const key=await integrationKey(integration);await rpc('reserve_test',{});
  const message=action==='test'?'Teste operacional da conexão. Responda apenas OK.':payload.message;
  const instructions=action==='preview'?(await rpc('prompt',{})).instructions:'';
  const reply=clinical(message)?handoffText:await generate(integration,key,instructions,[{role:'user',content:message}]);
  if(action==='test'){await rpc('validated',{id:integration.id,revision:integration.revision});return out(200,{tested:true,id:integration.id});}
  return out(200,{reply:clinical(reply)?handoffText:reply});
 }catch(e){const code=e instanceof Error?e.message:'';const safe=['encryption_configuration_pending','key_pending','configuration_changed','provider_key_invalid','provider_model_not_found','provider_quota_exhausted','model_list_unavailable'].includes(code)?code:'integration_unavailable';return out(code==='configuration_changed'?409:503,{error:safe});}
});
