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

export function prepareDraftAddition({channel,campaignId,publicationId,requestId,title,blocks,plannedLocal='',ownerId}){
 const value=typeof title==='string'?title.trim():'';
 if(!['app','whatsapp'].includes(channel)||![campaignId,publicationId,requestId].every(v=>typeof v==='string'&&uuid.test(v))||
  !value||value.length>120||!Array.isArray(blocks)||!blocks.length||blocks.length>6)throw Error('INVALID_DRAFT');
 if(typeof plannedLocal!=='string'||(plannedLocal&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(plannedLocal)||!Number.isFinite(Date.parse(plannedLocal+':00Z'))||new Date(plannedLocal+':00Z').toISOString().slice(0,16)!==plannedLocal)))throw Error('INVALID_DRAFT');
 const seen=new Set(),albums=new Map();
 const content=blocks.map((b,index)=>{
  if(!b||typeof b.id!=='string'||!uuid.test(b.id)||seen.has(b.id)||typeof b.text!=='string')throw Error('INVALID_DRAFT');
  seen.add(b.id);
  if(!Object.hasOwn(b,'albumId')){
   if(Object.keys(b).some(k=>!['id','text'].includes(k))||!b.text.trim()||b.text.length>2000)throw Error('INVALID_DRAFT');
   return {id:b.id,type:'text',text:b.text};
  }
  if(channel!=='whatsapp'||typeof ownerId!=='string'||!uuid.test(ownerId)||typeof b.albumId!=='string'||!uuid.test(b.albumId)
   ||Object.keys(b).some(k=>!['id','text','albumId'].includes(k))||b.text.length>1000)throw Error('INVALID_DRAFT');
  const positions=albums.get(b.albumId)||[];
  if(positions.length&&positions.at(-1)!==index-1)throw Error('INVALID_DRAFT');
  albums.set(b.albumId,[...positions,index]);
  return {id:b.id,type:'image',text:b.text,album_id:b.albumId,
   media_path:ownerId+'/'+b.id+'.jpg',layout:b.text.trim()?'caption':'separate'};
 });
 for(const positions of albums.values())if(positions.length<2||positions.length>4)throw Error('INVALID_DRAFT');
 return {p_action:channel==='app'?'app_save':'save',p_data:{campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision:0,draft:{title:value,blocks:content,groups:[],audience:'all',timezone:'America/Sao_Paulo',planned_local:plannedLocal}}};
}

// Media captions use the native block.text field. Separate messages are independent
// text blocks; never reinterpret a flag at dispatch time or modify existing media.
export function prepareMediaCaptionEdit({channel,campaignId,publicationId,requestId,revision,current,blockId,mode,text='',separateBlockId}){
 if(channel!=='whatsapp'||![campaignId,publicationId,requestId,blockId].every(x=>typeof x==='string'&&uuid.test(x))||
  !Number.isSafeInteger(revision)||revision<1||current?.revision!==revision||current.channel!==channel||current.campaignId!==campaignId||current.publicationId!==publicationId||current.status!=='draft'||
  !Array.isArray(current.draft?.blocks)||!['caption','separate','none'].includes(mode)||typeof text!=='string'||text.length>(mode==='separate'?2000:1000))throw Error('INVALID_DRAFT');
 const draft=structuredClone(current.draft),indices=draft.blocks.map((b,i)=>b.id===blockId?i:-1).filter(i=>i>=0);
 if(indices.length!==1||!['image','file'].includes(draft.blocks[indices[0]].type))throw Error('INVALID_DRAFT');
 const i=indices[0],block=draft.blocks[i];
 if(mode==='none'&&text.trim())throw Error('INVALID_DRAFT');
 if(mode==='separate'){
  if(!text.trim()||typeof separateBlockId!=='string'||!uuid.test(separateBlockId)||draft.blocks.some(b=>b.id===separateBlockId)||draft.blocks.length>=32)throw Error('INVALID_DRAFT');
  let after=i+1;
  while(block.album_id&&draft.blocks[after]?.album_id===block.album_id)after++;
  draft.blocks.splice(after,0,{id:separateBlockId,type:'text',text});
 }
 block.text=mode==='caption'?text:'';block.layout=mode==='caption'&&text.trim()?'caption':'separate';
 return {p_action:'save',p_data:{campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision,draft}};
}

export function prepareAlbumDraftEdit({channel,campaignId,publicationId,requestId,revision,current,albumEdit}){
 const {albumId,items}=albumEdit||{};
 if(channel!=='whatsapp'||![campaignId,publicationId,requestId,albumId].every(v=>typeof v==='string'&&uuid.test(v))||
  current?.channel!==channel||current.campaignId!==campaignId||current.publicationId!==publicationId||
  current.revision!==revision||current.status!=='draft'||!Array.isArray(current.draft?.blocks)||
  !Array.isArray(items)||items.length<2||items.length>4)throw Error('INVALID_DRAFT');
 const draft=structuredClone(current.draft);
 const group=draft.blocks.filter(b=>b.album_id===albumId);
 const first=draft.blocks.findIndex(b=>b.album_id===albumId);
 if(group.length!==items.length||group.some((b,i)=>b.type!=='image'||draft.blocks[first+i]!==b))throw Error('INVALID_DRAFT');
 const byId=new Map(group.map(b=>[b.id,b]));
 const ordered=items.map(item=>{
  if(!item||Object.keys(item).some(key=>key!=='id'&&key!=='text')||typeof item.text!=='string'||item.text.length>1000||!byId.has(item.id))throw Error('INVALID_DRAFT');
  const block=byId.get(item.id);
  byId.delete(item.id);
  return {...block,text:item.text,layout:item.text.trim()?'caption':'separate'};
 });
 draft.blocks.splice(first,group.length,...ordered);
 return {p_action:'save',p_data:{campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision,draft}};
}
