const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const id='11111111-1111-4111-8111-111111111111',fence='22222222-2222-4222-8222-222222222222',owner='33333333-3333-4333-8333-333333333333';
const job={id,fence,source_path:owner+'/'+id+'.mp4',output_path:owner+'/'+id+'/'+fence+'.mp4'};
test('preview worker leases, downloads and uploads only authorized paths, completes once',async()=>{
 const {processOneLibraryPreview}=await import('../connect/whatsapp-lab/library-preview-worker.mjs');
 const calls=[];
 const transport={rpc:async(action,data)=>{calls.push(action);assert.equal(data.video_preview_v1,true);return action==='claim'?job:{state:'ready'};},
 downloadAuthorized:async(bucket,path,max)=>{assert.equal(bucket,'neo-library');assert.equal(path,job.source_path);assert.equal(max,200*1024*1024);calls.push('download');return Buffer.from('video');},
 uploadNew:async(bucket,path,bytes,mime)=>{assert.equal(bucket,'neo-library-video-previews');assert.equal(path,job.output_path);assert.equal(mime,'video/mp4');calls.push('upload');}};
 assert.equal((await processOneLibraryPreview({transport,convert:async()=>({bytes:Buffer.from('preview'),mime:'video/mp4'})})).state,'ready');
 assert.deepEqual(calls,['claim','download','upload','finish']);
 calls.length=0;
 assert.equal((await processOneLibraryPreview({transport,convert:async()=>{throw Error('bad media')}})).state,'failed');
 assert.deepEqual(calls,['claim','download','fail']);
});
test('queue is private, fenced, idempotent and disabled by default',()=>{
 const sql=fs.readFileSync('release/pacote-final-20261125/library_video_preview_queue_candidate.sql','utf8');
 for(const pattern of [/default false/,/for update skip locked/i,/q\.fence=/,/q\.device_id=p_device/,/q\.owner_id=actor/,/on conflict\(source_path,material_id,source_object,source_updated_at,algorithm\) do nothing/,/enable row level security/,/false,512000,array\['video\/mp4'\]/,/neo_library_media_access/,/secret_hash=sha256/])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/for update to authenticated/i);
});
