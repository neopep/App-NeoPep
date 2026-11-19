import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
import {origins,responseHeaders} from '../_shared/ai-provider.ts';
// Only the principal administrators explicitly listed in server Secrets may use this endpoint.
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers=responseHeaders(origins().includes(origin)?origin:''),out=(status:number,data:object)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store'}});
 if(!origins().includes(origin))return out(403,{error:'origin_not_allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,{error:'method'});
 try{
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return out(401,{error:'authentication_required'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error}=await admin.auth.getUser(token);if(error||!identity.user)return out(401,{error:'invalid_session'});
 const allowed=(Deno.env.get('NEO_AUTH_ADMIN_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!allowed.includes(identity.user.id))return out(403,{error:'principal_administrator_required'});
 const check=await admin.rpc('neo_integration_admin',{p_actor:identity.user.id});if(check.error||!check.data)return out(403,{error:'administrator_required'});
 const raw=await req.text();if(raw.length>1024)return out(413,{error:'request_too_large'});let body;try{body=JSON.parse(raw||'{}')}catch{return out(400,{error:'invalid_json'})}
 if(!['status','set'].includes(body.action))return out(400,{error:'invalid_action'});
 const management=Deno.env.get('NEO_SUPABASE_MANAGEMENT_TOKEN'),ref=Deno.env.get('NEO_SUPABASE_PROJECT_REF');
 if(!management||!ref||!/^[a-z0-9]{20}$/.test(ref)||new URL(Deno.env.get('SUPABASE_URL')!).hostname!==ref+'.supabase.co')return out(503,{error:'server_configuration_pending'});
 const endpoint='https://api.supabase.com/v1/projects/'+ref+'/config/auth';
 const read=async()=>{const r=await fetch(endpoint,{headers:{Authorization:'Bearer '+management},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('management_unavailable');const cfg=await r.json();if(typeof cfg.mailer_autoconfirm!=='boolean')throw Error('unknown_state');return !cfg.mailer_autoconfirm;};
 const before=await read();if(body.action==='status')return out(200,{require_email_confirmation:before});
 if(typeof body.require_email_confirmation!=='boolean'||typeof body.expected_confirmation!=='boolean')return out(400,{error:'invalid_setting'});
 if(body.expected_confirmation!==before)return out(409,{error:'configuration_changed_read_again'});
 if(before!==body.require_email_confirmation){
 const changed=await fetch(endpoint,{method:'PATCH',headers:{Authorization:'Bearer '+management,'Content-Type':'application/json'},body:JSON.stringify({mailer_autoconfirm:!body.require_email_confirmation}),signal:AbortSignal.timeout(12000)});
 if(!changed.ok)throw Error('management_unavailable');
 console.info(JSON.stringify({event:'auth_confirmation_change_requested',actor:identity.user.id,before,requested:body.require_email_confirmation,at:new Date().toISOString()}));
 }
 const actual=await read();if(actual!==body.require_email_confirmation)return out(409,{error:'change_not_confirmed_read_again'});
 return out(200,{require_email_confirmation:actual,verified:true});
 }catch{return out(503,{error:'auth_settings_unavailable_read_again'});}
});
