import {testProfile} from './environments.mjs';
const tokenPattern=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function createNeoSession({publishableKey,request=fetch,profile=testProfile}){
 if(!publishableKey)throw Error('NEOPEP_CONFIGURATION_REQUIRED');
 return async (token,action,{id=null,clientId=null,label=null}={})=>{
  if(typeof token!=='string'||token.length>8192||!tokenPattern.test(token)||
     !['list','register','register_drafts','inspect','revoke'].includes(action)||(action==='register_drafts'&&profile.name!=='test'))throw Error('NEOPEP_SESSION_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const options={headers,redirect:'manual',signal:AbortSignal.timeout(5000)};
  let identity;
  try{identity=await request(profile.supabaseOrigin+'/auth/v1/user',options);}catch{console.warn('NEO_OAUTH: identity_fetch_failed');throw Error('NEOPEP_SESSION_REQUIRED');}
  if(!identity.ok){console.warn('NEO_OAUTH: identity_http_'+identity.status);throw Error('NEOPEP_SESSION_REQUIRED');}
  console.log('NEO_OAUTH: identity_ok');
  const {id:ownerId}=await identity.json();
  if(typeof ownerId!=='string'||!ownerId)throw Error('NEOPEP_SESSION_REQUIRED');
  const response=await request(profile.supabaseOrigin+'/rest/v1/rpc/neo_connect_ai_connections',{
   ...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({p_action:action,p_id:id,p_client:clientId,p_label:label})
  });
  if(!response.ok){console.warn('NEO_OAUTH: connection_http_'+response.status);throw Error('NEOPEP_CONNECTION_UNAVAILABLE');}
  console.log('NEO_OAUTH: connection_rpc_ok');
  const data=await response.json();
  if(action!=='list'&&data!==null&&data.owner_id!==ownerId)throw Error('NEOPEP_CONNECTION_UNAVAILABLE');
  return {ownerId,data};
 };
}
