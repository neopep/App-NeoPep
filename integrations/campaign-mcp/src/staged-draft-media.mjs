// Reuse native draft addition and resolve tickets only through the trusted media service.
import {prepareDraftAddition} from './draft-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
export async function prepareStagedDraftAddition(principal,input,resolve){
 if(typeof resolve!=='function'||!Array.isArray(input.blocks)||!input.blocks.length||input.blocks.length>6)throw Error('INVALID_DRAFT');
 const proxies=input.blocks.map(b=>{
  if(!b||typeof b!=='object')throw Error('INVALID_DRAFT');
  if(!Object.hasOwn(b,'mediaTicketId')){
   if(Object.hasOwn(b,'albumId'))throw Error('INVALID_DRAFT'); // never mix legacy media references with staged tickets
   return b;
  }
  if(!uuid(b.mediaTicketId)||typeof b.text!=='string'||b.text.length>1000||Object.keys(b).some(k=>!['id','text','mediaTicketId','albumId'].includes(k)))throw Error('INVALID_DRAFT');
  return {id:b.id,text:'Media'};
 });
 const native=prepareDraftAddition({...input,blocks:proxies,ownerId:principal.ownerId});
 const groups=new Map(),used=new Set();
 for(let i=0;i<input.blocks.length;i++){
  const b=input.blocks[i];if(!Object.hasOwn(b,'mediaTicketId'))continue;
  if(used.has(b.mediaTicketId))throw Error('INVALID_DRAFT');used.add(b.mediaTicketId);
  const receipt=await resolve(principal,b.mediaTicketId,{channel:input.channel,campaignId:input.campaignId,publicationId:input.publicationId,blockId:b.id,revision:0});
  if(receipt?.state!=='stored_and_validated'||receipt.requestId!==b.mediaTicketId||receipt.ownerId!==principal.ownerId||receipt.connectionId!==principal.id||receipt.blockId!==b.id||receipt.publicationId!==input.publicationId||receipt.campaignId!==input.campaignId||receipt.revision!==0||receipt.channel!==input.channel)throw Error('MEDIA_NOT_VERIFIED');
  const type=receipt.blockType;
  if(!['image','file'].includes(type)||type==='file'&&input.channel!=='whatsapp')throw Error('INVALID_DRAFT');
  const out={id:b.id,type,text:b.text,media_path:receipt.path,layout:b.text.trim()?'caption':'separate'};
  if(type==='file')out.name=receipt.name;
  if(b.albumId!==undefined){
   if(input.channel!=='whatsapp'||type!=='image'||!uuid(b.albumId))throw Error('INVALID_DRAFT');
   const a=groups.get(b.albumId)||{last:i-1,count:0,size:0};if(a.last!==i-1)throw Error('INVALID_DRAFT');
   a.last=i;a.count++;a.size+=receipt.size;groups.set(b.albumId,a);out.album_id=b.albumId;
  }
  native.p_data.draft.blocks[i]=out;
 }
 for(const a of groups.values())if(a.count<2||a.count>4||a.size>10485760)throw Error('INVALID_DRAFT');
 return native;
}
