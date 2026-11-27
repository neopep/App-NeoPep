const testOrigin='https://qnuluspqfazdppciermw.supabase.co';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const label=value=>typeof value==='string'?value.slice(0,200):'';
const summary=row=>({
 id:row.campaign_id,title:label(row.title),state:row.archived_at?'archived':'active',channel:'whatsapp'
});

export function createCampaignReader({publishableKey,sessionFor,request=fetch}){
 if(!publishableKey||typeof sessionFor!=='function')throw Error('Incomplete campaign reader configuration');
 return async (principal,operation,input={})=>{
  if(principal?.environment!=='test'||principal.campaignAdmin!==true||
   !principal.scopes?.includes('campaigns:read')||!uuid(principal.ownerId))
   throw Error('FORBIDDEN');
  if(input.channel!=='whatsapp'||!['list_campaigns','get_campaign'].includes(operation))
   throw Error('CAPABILITY_UNAVAILABLE');
  const listing=operation==='list_campaigns';
  if(!listing&&!uuid(input.campaign_id))throw Error('INVALID_INPUT');
  const limit=input.limit??20;
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('INVALID_INPUT');

  const token=await sessionFor(principal.id,principal.ownerId);
  if(!token)throw Error('AUTH_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const options={headers,redirect:'error',signal:AbortSignal.timeout(5000)};
  const identity=await request(testOrigin+'/auth/v1/user',options);
  if(!identity.ok||(await identity.json()).id!==principal.ownerId)throw Error('FORBIDDEN');
  const result=await request(testOrigin+'/rest/v1/rpc/neo_campaign_central_v1',{
   ...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({p_action:listing?'list':'get',p_data:listing?{offset:0}:{campaign_id:input.campaign_id}})
  });
  if(result.status===403||result.status===404)throw Error('NOT_FOUND_OR_FORBIDDEN');
  if(!result.ok)throw Error('UPSTREAM_UNAVAILABLE');
  const data=await result.json();
  if(listing){
   if(!Array.isArray(data))throw Error('UPSTREAM_UNAVAILABLE');
   return {items:data.filter(row=>uuid(row?.campaign_id)).slice(0,limit).map(summary)};
  }
  if(data?.campaign_id!==input.campaign_id||!Array.isArray(data.publications))throw Error('UPSTREAM_UNAVAILABLE');
  return {campaign:summary(data),publications:data.publications.filter(row=>uuid(row?.id)).slice(0,limit)
   .map(row=>({id:row.id,title:label(row.title),revision:Number.isSafeInteger(row.revision)?row.revision:null}))};
 };
}
