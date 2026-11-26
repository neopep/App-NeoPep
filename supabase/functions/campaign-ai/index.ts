// Candidate: separate from agent-integrations and ai-reply. Does not create or send campaigns.
import { createClient } from "npm:@supabase/supabase-js@2.80.0";
import { validateRequest,validateOutput,outputSchema,providerPrompt,MAX_OUTPUT_TOKENS } from "../_shared/campaign-ai-plan.mjs";
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function integrationKey(i:any){
 const raw=Deno.env.get("NEO_AI_ENCRYPTION_KEY")||"";
 const bytes=decode(raw);
 if(bytes.length!==32||!i.encrypted_key?.data||!i.encrypted_key?.iv)throw Error("credential_configuration_pending");
 const master=await crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["decrypt"]);
 const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(i.encrypted_key.iv),additionalData:new TextEncoder().encode(i.id)},master,decode(i.encrypted_key.data));
 return new TextDecoder().decode(clear);
}
const tokens=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;
Deno.serve(async(req)=>{
 const origin=req.headers.get("Origin")||"";
 const allowed=(Deno.env.get("ALLOWED_ORIGINS")||Deno.env.get("ALLOWED_ORIGIN")||"").split(",").map(s=>s.trim()).includes(origin)&&Boolean(origin);
 const headers={"Cache-Control":"no-store","Content-Type":"application/json",...(allowed?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}:{})};
 const out=(status:number,data:unknown)=>Response.json(data,{status,headers});
 if(!allowed)return out(403,{error:"origin_not_allowed"});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return out(405,{error:"method"});
 const jwt=req.headers.get("Authorization")?.replace(/^Bearer /i,"");
 if(!jwt)return out(401,{error:"authentication_required"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const environment=url.includes("qnuluspqfazdppciermw.supabase.co")?"staging":url.includes("cpslafpzjtbpmoxxysaa.supabase.co")?"production":null;
 if(!url||!serviceKey||!publicKey||!environment)return out(503,{error:"configuration_pending"});
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const userDb=createClient(url,publicKey,{global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 const who=await db.auth.getUser(jwt);
 if(who.error||!who.data.user)return out(401,{error:"invalid_session"});
 try{
  const raw=await req.text();if(raw.length>16000)return out(413,{error:"request_too_large"});
  const input=JSON.parse(raw);
  if(input.action==="status"){
   const status=await userDb.rpc("neo_campaign_ai_access_v1",{p_action:"status"});
   if(status.error)return out(403,{error:"campaign_ai_unavailable"});
   return out(200,{integrations:status.data,max_batch:5});
  }
  if(input.action!=="generate"||!uuid(input.integration_id)||!uuid(input.request_id)||Object.keys(input).some(k=>!["action","integration_id","request_id","plan"].includes(k)))return out(400,{error:"invalid_request"});
  let plan;
  try{plan=validateRequest(input.plan);}catch{return out(400,{error:"invalid_plan"});}
  const reserved=await userDb.rpc("neo_campaign_ai_access_v1",{p_action:"reserve",p_integration:input.integration_id,p_request:input.request_id});
  if(reserved.error){const msg=reserved.error.message||"";return out(msg.includes("limit")?429:409,{error:msg.includes("already_reserved")?"request_already_reserved":msg.includes("limit")?"campaign_limit":"campaign_ai_unavailable"});}
  const meta=reserved.data;
  const saved=await db.rpc("neo_agent_credentials",{p_id:meta.id});
  const i=saved.data;
  if(saved.error||!i||i.provider!=="gemini"||i.revision!==meta.revision||i.validated_revision!==i.revision||!i.validated_at||i.model!==meta.model||!/^[-A-Za-z0-9._:]{1,100}$/.test(i.model))return out(409,{error:"configuration_changed"});
  let key:string;try{key=await integrationKey(i);}catch{return out(503,{error:"credential_configuration_pending"});}
  const prompt=providerPrompt(plan),started=performance.now(),callId=crypto.randomUUID();
  let status="error",usage:any={};
  try{
   const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(i.model)+":generateContent",{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:AbortSignal.timeout(45_000),
    body:JSON.stringify({systemInstruction:{parts:[{text:prompt.system}]},contents:[{role:"user",parts:[{text:prompt.user}]}],generationConfig:{maxOutputTokens:MAX_OUTPUT_TOKENS,responseMimeType:"application/json",responseJsonSchema:outputSchema(plan.slots.length,plan.images)}})
   });
   if(!response.ok)return out(response.status===429?429:502,{error:response.status===429?"provider_quota_exhausted":response.status===401||response.status===403?"provider_key_invalid":"provider_unavailable"});
   const body=await response.json();usage=body.usageMetadata||{};
   const candidate=body.candidates?.[0];
   if(!candidate||candidate.finishReason!=="STOP")return out(422,{error:"generation_incomplete"});
   const content=(candidate.content?.parts||[]).filter((p:any)=>!p.thought&&typeof p.text==="string").map((p:any)=>p.text).join("");
   if(content.length>30000)return out(422,{error:"invalid_generation"});
   let publications;try{publications=validateOutput(JSON.parse(content),plan);}catch{return out(422,{error:"invalid_generation"});}
   status="ok";
   return out(200,{publications,usage:{input_tokens:tokens(usage.promptTokenCount),output_tokens:tokens(usage.candidatesTokenCount),total_tokens:tokens(usage.totalTokenCount)},stage:"review",provider:"gemini",model:i.model});
  }catch(err){if(err instanceof Error&&["AbortError","TimeoutError"].includes(err.name))status="timeout";return out(502,{error:status==="timeout"?"generation_timeout":"provider_unavailable"});}
  finally{
   // Best-effort observability. No prompt, publication text, key or member data in logs.
   try{await db.rpc("neo_campaign_ai_record_v1",{p_call:{id:callId,model:i.model,environment,status,duration_ms:Math.round(performance.now()-started),input_tokens:tokens(usage.promptTokenCount),output_tokens:tokens(usage.candidatesTokenCount),cached_tokens:tokens(usage.cachedContentTokenCount),reasoning_tokens:tokens(usage.thoughtsTokenCount),total_tokens:tokens(usage.totalTokenCount)}});}catch{/* monitoring never retries paid generations */}
  }
 }catch{return out(400,{error:"invalid_request"});}
});
