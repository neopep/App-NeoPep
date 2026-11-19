import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import webpush from 'npm:web-push@3.6.7';
// Called by a server schedule. No browser credentials or sensitive logs.
export const validEndpoint=(value:string)=>/^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[A-Za-z0-9_/?=&%:.~-]+$/.test(value);
export async function sameSecret(a:string,b:string){const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
Deno.serve(async(req:Request)=>{
 const out=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return out(405,{error:'method'});
 const secret=Deno.env.get('NEO_PUSH_CRON_SECRET')||'';
 if(secret.length<32)return out(503,{error:'configuration_pending'});
 const received=req.headers.get('x-neo-cron-secret')||'';
 if(received.length>256||!await sameSecret(received,secret))return out(401,{error:'unauthorized'});
 const publicKey=Deno.env.get('NEO_VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('NEO_VAPID_PRIVATE_KEY'),subject=Deno.env.get('NEO_VAPID_SUBJECT');
 if(!publicKey||!privateKey||!subject)return out(503,{error:'configuration_pending'});
 try{
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const batch=await client.rpc('neo_push_claim');if(batch.error)throw Error('claim');
 const community=await client.rpc('neo_community_push_claim'); // An unavailable community queue must not stop personal reminders.
 const support=await client.rpc('neo_support_push_claim');
 const events=await client.rpc('neo_event_push_claim');
 const jobs=[...(batch.data||[]),...(community.error?[]:(community.data||[])),...(support.error?[]:(support.data||[])),...(events.error?[]:(events.data||[]))];
 let sent=0,failed=0;
 await Promise.all(jobs.map(async(job:{id:string,endpoint:string,kind?:string,title?:string,body?:string,keys:{p256dh:string,auth:string}})=>{let outcome='retry';
  try{if(!validEndpoint(job.endpoint))throw Error('endpoint');const payload:{tag:string,kind?:string,title?:string,body?:string}={tag:job.id};if(['community','support'].includes(job.kind||'')){payload.kind=job.kind;if(job.title)payload.title=job.title;if(job.body)payload.body=job.body}await webpush.sendNotification({endpoint:job.endpoint,keys:job.keys},JSON.stringify(payload),{TTL:300,urgency:job.kind==='support'?'high':'normal',topic:job.id.replaceAll('-',''),timeout:10000});outcome='sent';sent++;}catch(error){const code=(error as {statusCode?:number}).statusCode;if(code===404||code===410)outcome='gone';failed++;}
  const finish=job.kind==='support'?'neo_support_push_finish':job.kind==='community'?'neo_community_push_finish':['library','shop'].includes(job.kind||'')?'neo_event_push_finish':'neo_push_finish';const done=await client.rpc(finish,{p_id:job.id,p_outcome:outcome});if(done.error)throw Error('finish');
 }));
 return out(200,{sent,failed,...(community.error?{community_available:false}:{})});
 }catch{return out(500,{error:'dispatch_failed'});}
});
