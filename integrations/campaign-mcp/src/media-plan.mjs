// Candidate upload validation. Never retrieves arbitrary URLs or uploads by itself.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const rules=Object.freeze({'image/jpeg':{bucket:'neo-campaign-images',ext:'jpg',limit:5242880,block:'image'},'application/pdf':{bucket:'neo-campaign-originals',ext:'pdf',limit:5242880,block:'file'},'video/mp4':{bucket:'neo-campaign-originals',ext:'mp4',limit:5242880,block:'file'}});
const fail=()=>{throw Error('INVALID_MEDIA');};
export function planUpload(principal,input){
 if(principal?.environment!=='test'||principal.campaignAdmin!==true||!principal.scopes?.includes('campaigns:drafts')||!uuid(principal.ownerId)||!uuid(principal.id))throw Error('FORBIDDEN');
 if(!input||Object.keys(input).some(k=>!['campaignId','publicationId','blockId','requestId','revision','mime','size','name'].includes(k)))fail();
 const {campaignId,publicationId,blockId,requestId,revision,mime,size,name}=input;
 const r=rules[mime];if(!r||![campaignId,publicationId,blockId,requestId].every(uuid)||!Number.isSafeInteger(revision)||revision<1||!Number.isSafeInteger(size)||size<1||size>r.limit||typeof name!=='string'||!name.trim()||name.length>160||/[/\\\u0000-\u001f]/.test(name))fail();
 return {environment:'test',ownerId:principal.ownerId,connectionId:principal.id,campaignId,publicationId,blockId,requestId,revision,mime,size,name,bucket:r.bucket,path:principal.ownerId+'/'+requestId+'.'+r.ext,blockType:r.block,limit:r.limit};
}
export async function inspectUpload(plan,bytes,declaredMime){
 if(!plan||!rules[plan.mime]||declaredMime!==plan.mime||!(bytes instanceof Uint8Array)||bytes.length!==plan.size||bytes.length>rules[plan.mime].limit)fail();
 const starts=(a,at=0)=>a.every((v,i)=>bytes[at+i]===v);
 const jpeg=starts([255,216,255])&&bytes.length>=5&&starts([255,217],bytes.length-2);
 const pdf=starts([37,80,68,70,45])&&bytes.length>=12&&new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF');
 const mp4=bytes.length>=16&&starts([102,116,121,112],4)&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0)>=8&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0)<=bytes.length;
 if(!(plan.mime==='image/jpeg'?jpeg:plan.mime==='application/pdf'?pdf:mp4))fail();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 return {sha256:digest,size:bytes.length,signatureChecked:true,readyForUpload:false,requiresFullValidation:true};
}
// Binding is only a pure candidate. A trusted uploader must first verify bytes, ownership, ticket, and stored object.
export function prepareAttachment(plan,current,verified){
 if(!plan||!current||!verified||verified.state!=='stored_and_validated'||verified.path!==plan.path||verified.bucket!==plan.bucket||verified.requestId!==plan.requestId||verified.ownerId!==plan.ownerId||verified.connectionId!==plan.connectionId||verified.publicationId!==plan.publicationId||verified.blockId!==plan.blockId||verified.revision!==plan.revision)throw Error('MEDIA_NOT_VERIFIED');
 if(current.ownerId!==plan.ownerId||current.campaignId!==plan.campaignId||current.publicationId!==plan.publicationId||current.revision!==plan.revision||current.status!=='draft'||!Array.isArray(current.draft?.blocks))throw Error('REVISION_CONFLICT');
 const draft=structuredClone(current.draft),matches=draft.blocks.filter(b=>b.id===plan.blockId);
 if(matches.length!==1||matches[0].type!==plan.blockType)fail();
 matches[0].media_path=plan.path;matches[0].name=plan.name;
 return draft;
}
