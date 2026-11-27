import {testProfile} from './environments.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const label=value=>typeof value==='string'?value.slice(0,200):'';
const states=['archived','paused','needs_attention','scheduled','in_progress','draft','active','unknown'];
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const deliveryStates=new Set(['waiting','leased','started','uncertain','refused','accepted','cancelled','failed']);
const pendingStates=new Set(['waiting','leased','started']);
const failureStates=new Set(['uncertain','refused','failed']);
const batches=row=>Array.isArray(row.batches)?row.batches:[];
const batchStates=batch=>[...new Set((Array.isArray(batch.states)?batch.states:[]).filter(value=>deliveryStates.has(value)))];
const future=batch=>!batch.cancelled_at&&Date.parse(batch.due_at)>Date.now()&&batchStates(batch).some(s=>pendingStates.has(s));
const sortedNext=rows=>rows.map(b=>instant(b.due_at)).filter(Boolean).sort()[0]??null;
const sumState=row=>{
 if(row.archived_at)return 'archived';
 if(row.paused_at)return 'paused';
 if(Number(row.problems)>0)return 'needs_attention';
 if(row.next_at&&Date.parse(row.next_at)>Date.now()&&(row.pending===undefined||Number(row.pending)>0))return 'scheduled';
 if(Number(row.pending)>0)return 'in_progress';
 if(Number(row.drafts)>0&&Number(row.drafts)===Number(row.publications))return 'draft';
 if(Number(row.publications)>0)return 'active';
 return 'unknown';
};
const summary=(row,channel)=>({id:row.campaign_id,title:label(row.title),state:sumState(row),channel,
 next_at:row.archived_at||row.paused_at||!(Date.parse(row.next_at)>Date.now())||(row.pending!==undefined&&Number(row.pending)===0)?null:instant(row.next_at),
 archived_at:instant(row.archived_at),paused_at:instant(row.paused_at)});
const detailSummary=(row,publications)=>({
 ...row,publications:publications.length,drafts:publications.filter(p=>batches(p).length===0).length,
 problems:publications.filter(p=>batches(p).some(b=>batchStates(b).some(s=>failureStates.has(s)))).length,
 pending:publications.filter(p=>batches(p).some(b=>!b.cancelled_at&&batchStates(b).some(s=>pendingStates.has(s)))).length,
 next_at:sortedNext(publications.flatMap(batches).filter(future))
});
const sendStatus=batch=>{
 const s=batchStates(batch);
 if(s.some(v=>failureStates.has(v)))return s.includes('accepted')?'partially_accepted':'needs_attention';
 if(s.includes('accepted')){
  if(s.some(v=>v!=='accepted'))return 'partially_accepted';
  return count(batch.message_count)>0&&count(batch.receipt_count)===batch.message_count&&instant(batch.sent_at)?'accepted_with_receipt':'accepted';
 }
 if(batch.cancelled_at||(s.length&&s.every(v=>v==='cancelled')))return 'cancelled';
 if(s.includes('started')||s.includes('leased'))return 'in_progress';
 if(s.includes('waiting'))return future(batch)?'scheduled':'queued';
 return 'unknown';
};
const schedules=row=>batches(row).slice(0,20).map(batch=>({
 due_at:instant(batch.due_at),cancelled_at:instant(batch.cancelled_at),states:batchStates(batch),
 configured_at:instant(batch.configured_at),sent_at:instant(batch.sent_at),
 origin:['publish','schedule','recurring'].includes(batch.origin)?batch.origin:null,
 delivery_status:sendStatus(batch),message_count:count(batch.message_count),receipt_count:count(batch.receipt_count),
 group_count:count(batch.group_count),group_names:[...new Set((Array.isArray(batch.group_names)?batch.group_names:[])
 .filter(value=>typeof value==='string'&&value.trim()).map(label))].slice(0,100)
}));
const recurrenceDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(value);

export function createCampaignReader({publishableKey,sessionFor,request=fetch,profile=testProfile,channels=['whatsapp'],appRecurrences=false}){
 if(!publishableKey||typeof sessionFor!=='function')throw Error('Incomplete campaign reader configuration');
 return async (principal,operation,input={})=>{
  if(principal?.environment!==profile.name||principal.campaignAdmin!==true||
   !principal.scopes?.includes('campaigns:read')||!uuid(principal.ownerId))
   throw Error('FORBIDDEN');
  const channel=input.channel;
  if(!['app','whatsapp'].includes(channel)||!channels.includes(channel)||!['list_campaigns','get_campaign'].includes(operation))
   throw Error('CAPABILITY_UNAVAILABLE');
  const listing=operation==='list_campaigns';
  if(!listing&&!uuid(input.campaign_id))throw Error('INVALID_INPUT');
  const limit=input.limit??20,offset=input.offset??0;
  if(input.include_recurrences!==undefined&&typeof input.include_recurrences!=='boolean')throw Error('INVALID_INPUT');
  if(input.include_recurrences&&(listing||(channel==='app'&&!appRecurrences)))throw Error('CAPABILITY_UNAVAILABLE');
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||
    (input.state!==undefined&&(!listing||!states.includes(input.state))))throw Error('INVALID_INPUT');
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('INVALID_INPUT');

  const token=await sessionFor(principal.id,principal.ownerId);
  if(!token)throw Error('AUTH_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const options={headers,redirect:'manual',signal:AbortSignal.timeout(5000)};
  const identity=await request(profile.supabaseOrigin+'/auth/v1/user',options);
  if(!identity.ok||(await identity.json()).id!==principal.ownerId)throw Error('FORBIDDEN');
  const prefix=channel==='app'?'app_':'';
  const rpc=async(action,p_data,weekly=false)=>{
   const result=await request(profile.supabaseOrigin+'/rest/v1/rpc/'+(weekly?'neo_campaign_weekly_v1':'neo_campaign_central_v1'),{
    ...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({p_action:action,p_data})
   });
   if(result.status===403||result.status===404)throw Error('NOT_FOUND_OR_FORBIDDEN');
   if(!result.ok)throw Error('UPSTREAM_UNAVAILABLE');
   return result.json();
  };
  const data=await rpc(prefix+(listing?'list':'get'),listing?{offset}:{campaign_id:input.campaign_id});
  if(listing){
   if(!Array.isArray(data))throw Error('UPSTREAM_UNAVAILABLE');
   const items=[];
   let examined=0;
   for(const row of data){
    examined++;
    if(uuid(row?.campaign_id)&&(!input.state||sumState(row)===input.state))items.push(summary(row,channel));
    if(items.length>=limit)break;
   }
   const next=offset+examined;
   return {items,next_offset:next<=10000&&(examined<data.length||data.length===50)?next:null};
  }
  if(data?.campaign_id!==input.campaign_id||!Array.isArray(data.publications))throw Error('UPSTREAM_UNAVAILABLE');
  const publications=data.publications.filter(row=>uuid(row?.id)&&!row.deleted_at);
  const history=(Array.isArray(data.events)?data.events:[]).slice(0,30)
   .filter(event=>typeof event?.event==='string').map(event=>({event:label(event.event),recorded_at:instant(event.recorded_at)}));
  let recurrences=null;
  if(input.include_recurrences){
   const series=channel==='whatsapp'?await rpc('list',{campaign_id:input.campaign_id},true):await rpc('app_repeat_list',{campaign_id:input.campaign_id});
   if(!Array.isArray(series))throw Error('UPSTREAM_UNAVAILABLE');
   recurrences=series.filter(row=>uuid(row?.id)).slice(0,20).map(row=>({
    id:row.id,state:label(row.state),configured_at:instant(row.configured_at),
    timezone:channel==='whatsapp'?'America/Sao_Paulo':null,
    dates:(Array.isArray(row.dates)?row.dates:[]).filter(recurrenceDate).slice(0,60)
   }));
  }
  return {campaign:summary(detailSummary(data,publications),channel),publications:publications.slice(offset,offset+limit)
   .map(row=>({id:row.id,title:label(row.title),revision:Number.isSafeInteger(row.revision)?row.revision:null,schedules:schedules(row)})),
   next_offset:offset+limit<publications.length&&offset+limit<=10000?offset+limit:null,history,recurrences};
 };
}
