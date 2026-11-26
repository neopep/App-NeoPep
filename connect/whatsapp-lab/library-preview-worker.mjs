// Candidate worker orchestration. Transport must be supplied by the authenticated Connect host.
// No WhatsApp calls, credential persistence or external network endpoint in this module.
import {generateVideoPreview,PREVIEW_MAX,PREVIEW_SOURCE_MAX} from './video-preview.mjs';
const uuid='[a-f0-9-]{36}';
const sourcePattern=new RegExp('^'+uuid+'/'+uuid+'\\.[a-z0-9]{1,12}$');
const outputPattern=new RegExp('^'+uuid+'/'+uuid+'/'+uuid+'\\.mp4$');
export async function processOneLibraryPreview({transport,tools,signal,convert=generateVideoPreview}){
 signal?.throwIfAborted();
 const capability={video_preview_v1:true};
 const job=await transport.rpc('claim',capability);
 if(!job)return {state:'idle'};
 const {id,fence,source_path:source,output_path:output}=job;
 if(!new RegExp('^'+uuid+'$').test(id)||!new RegExp('^'+uuid+'$').test(fence)||!sourcePattern.test(source)||!outputPattern.test(output)||!output.endsWith('/'+id+'/'+fence+'.mp4'))throw Error('Invalid preview lease');
 const receipt={...capability,id,fence};
 try{
  signal?.throwIfAborted();
  const bytes=await transport.downloadAuthorized('neo-library',source,PREVIEW_SOURCE_MAX,signal);
  const result=await convert(bytes,{...tools,signal});
  if(!Buffer.isBuffer(result.bytes)||!result.bytes.length||result.bytes.length>PREVIEW_MAX||result.mime!=='video/mp4')throw Error('Preview invalid');
  signal?.throwIfAborted();
  await transport.uploadNew('neo-library-video-previews',output,result.bytes,'video/mp4',signal);
  signal?.throwIfAborted();
 }catch(error){
  // No repeat upload on an uncertain result. The next fenced lease has a distinct destination.
  if(!signal?.aborted)try{await transport.rpc('fail',receipt);}catch{}
  return {state:'failed'};
 }
 // If finish is uncertain, leave lease alone and let the server reconcile; never overwrite.
 const confirmed=await transport.rpc('finish',receipt);
 if(confirmed?.state!=='ready')throw Error('Preview completion uncertain');
 return {state:'ready',id};
}
