const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

// Pure preparation only. Do not enable a mutation before native ACL and revision tests.
export function prepareDraftCreation({channel,title,requestId}){
 const value=typeof title==='string'?title.trim():'';
 if(!['app','whatsapp'].includes(channel)||!value||value.length>120||
    typeof requestId!=='string'||!uuid.test(requestId))throw Error('INVALID_DRAFT');
 return {p_action:channel==='app'?'app_create':'create',p_data:{title:value,request_id:requestId}};
}

// The caller must load the authorized native draft and use a revision-checked write.
export function prepareDraftTextEdit({channel,campaignId,publicationId,requestId,revision,current,edits}){
 if(!['app','whatsapp'].includes(channel)||
  ![campaignId,publicationId,requestId].every(value=>typeof value==='string'&&uuid.test(value))||
  !Number.isSafeInteger(revision)||revision<0||current?.revision!==revision||
  current.campaignId!==campaignId||current.publicationId!==publicationId||current.channel!==channel||
  current.status!=='draft'||!Array.isArray(current.draft?.blocks)||
  !Array.isArray(edits)||edits.length<1||edits.length>6)throw Error('INVALID_DRAFT');
 const draft=structuredClone(current.draft);
 const edited=new Set();
 for(const edit of edits){
  if(!edit||typeof edit.id!=='string'||!uuid.test(edit.id)||edited.has(edit.id)||
   typeof edit.text!=='string'||!edit.text.trim()||edit.text.length>2000)throw Error('INVALID_DRAFT');
  const matches=draft.blocks.filter(block=>block.id===edit.id);
  if(matches.length!==1||matches[0].type!=='text')throw Error('INVALID_DRAFT');
  matches[0].text=edit.text;
  edited.add(edit.id);
 }
 return {p_action:channel==='app'?'app_save':'save',p_data:{
  campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision,draft
 }};
}

// Plans each edit independently for review. The returned operations are never dispatched here.
export function reviewDraftTextBatch(items){
 if(!Array.isArray(items)||!items.length||items.length>20)throw Error('INVALID_BATCH');
 const publications=new Set(),requests=new Set();
 return items.map((item,index)=>{
  try{
   const operation=prepareDraftTextEdit(item);
   const {publication_id,request_id}=operation.p_data;
   if(publications.has(publication_id)||requests.has(request_id))throw Error('DUPLICATE_DRAFT');
   publications.add(publication_id);
   requests.add(request_id);
   return {index,eligible:true,operation};
  }catch(error){
   return {index,eligible:false,reason:error.message==='DUPLICATE_DRAFT'?'DUPLICATE_DRAFT':'INVALID_DRAFT'};
  }
 });
}

export function prepareDraftAddition({channel,campaignId,publicationId,requestId,title,blocks,plannedLocal=''}){
 const value=typeof title==='string'?title.trim():'';
 if(!['app','whatsapp'].includes(channel)||![campaignId,publicationId,requestId].every(v=>typeof v==='string'&&uuid.test(v))||
  !value||value.length>120||!Array.isArray(blocks)||!blocks.length||blocks.length>6)throw Error('INVALID_DRAFT');
 if(typeof plannedLocal!=='string'||(plannedLocal&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(plannedLocal)||!Number.isFinite(Date.parse(plannedLocal+':00Z'))||new Date(plannedLocal+':00Z').toISOString().slice(0,16)!==plannedLocal)))throw Error('INVALID_DRAFT');
 const seen=new Set();
 const content=blocks.map(b=>{
  if(!b||Object.keys(b).some(k=>!['id','text'].includes(k))||typeof b.id!=='string'||!uuid.test(b.id)||seen.has(b.id)||typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)throw Error('INVALID_DRAFT');
  seen.add(b.id);return {id:b.id,type:'text',text:b.text};
 });
 return {p_action:channel==='app'?'app_save':'save',p_data:{campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision:0,draft:{title:value,blocks:content,groups:[],audience:'all',timezone:'America/Sao_Paulo',planned_local:plannedLocal}}};
}
