const testOrigin='https://qnuluspqfazdppciermw.supabase.co';
const tokenPattern=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function createNeoSession({publishableKey,request=fetch}){
 if(!publishableKey)throw Error('NEOPEP_CONFIGURATION_REQUIRED');
 return async (token,action,{id=null,clientId=null,label=null}={})=>{
  if(typeof token!=='string'||token.length>8192||!tokenPattern.test(token)||
     !['list','register','inspect','revoke'].includes(action))throw Error('NEOPEP_SESSION_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const options={headers,redirect:'error',signal:AbortSignal.timeout(5000)};
  const identity=await request(testOrigin+'/auth/v1/user',options);
  if(!identity.ok)throw Error('NEOPEP_SESSION_REQUIRED');
  const {id:ownerId}=await identity.json();
  if(typeof ownerId!=='string'||!ownerId)throw Error('NEOPEP_SESSION_REQUIRED');
  const response=await request(testOrigin+'/rest/v1/rpc/neo_connect_ai_connections',{
   ...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({p_action:action,p_id:id,p_client:clientId,p_label:label})
  });
  if(!response.ok)throw Error('NEOPEP_CONNECTION_UNAVAILABLE');
  const data=await response.json();
  if(action!=='list'&&data!==null&&data.owner_id!==ownerId)throw Error('NEOPEP_CONNECTION_UNAVAILABLE');
  return {ownerId,data};
 };
}
