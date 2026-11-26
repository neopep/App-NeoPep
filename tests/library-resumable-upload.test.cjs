const {test}=require('node:test'),assert=require('node:assert/strict');
const endpoint='https://example.storage.supabase.co/storage/v1/upload/resumable';
const make=async()=>{const {uploadLibraryTus,LIBRARY_CHUNK}=await import('../src/library-upload.mjs');const file=new Blob([new Uint8Array(LIBRARY_CHUNK+13)],{type:'video/mp4'});return {uploadLibraryTus,LIBRARY_CHUNK,file};};
test('TUS resumes after server accepted a block but connection dropped',async()=>{
 const {uploadLibraryTus,LIBRARY_CHUNK,file}=await make();let offset=0,post=0,patches=[],lost=false;const progress=[];
 const ticket={path:'owner/object.mp4'};
 const request=async(url,o)=>{
  assert.equal(o.headers.Authorization,'Bearer test');assert.equal(o.redirect,'error');
  if(o.method==='POST'){post++;return new Response(null,{status:201,headers:{Location:endpoint+'/job'}});}
  if(o.method==='HEAD')return new Response(null,{status:200,headers:{'Upload-Offset':String(offset)}});
  assert.equal(Number(o.headers['Upload-Offset']),offset);patches.push(o.body.size);offset+=o.body.size;
  if(!lost){lost=true;throw Error('lost response');}
  return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});
 };
 const result=await uploadLibraryTus({file,ticket,endpoint,credentials:async()=>({Authorization:'Bearer test'}),valid:()=>true,request,sleep:async()=>{},onProgress:n=>progress.push(n)});
 assert.equal(result,ticket.path);assert.equal(post,1);assert.deepEqual(patches,[LIBRARY_CHUNK,13]);assert.equal(progress.at(-1),file.size);
});
test('retry same draft uses existing URL, not another POST',async()=>{
 const {uploadLibraryTus,LIBRARY_CHUNK,file}=await make();let offset=LIBRARY_CHUNK,patch=0;
 const ticket={path:'owner/object.mp4',url:endpoint+'/job'};
 await uploadLibraryTus({file,ticket,endpoint,credentials:async()=>({}),valid:()=>true,sleep:async()=>{},request:async(url,o)=>{
  assert.notEqual(o.method,'POST');if(o.method==='HEAD')return new Response(null,{headers:{'Upload-Offset':String(offset)}});
  patch++;assert.equal(o.body.size,13);offset+=o.body.size;return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});
 }});assert.equal(patch,1);
});
test('rejects cross-origin Location and changed account before sending credentials',async()=>{
 const {uploadLibraryTus,file}=await make();let n=0;
 const args={file,ticket:{path:'owner/object.mp4'},endpoint,credentials:async()=>({}),valid:()=>true,request:async()=>{n++;return new Response(null,{status:201,headers:{Location:'https://other.example/upload'}})},sleep:async()=>{}};
 await assert.rejects(uploadLibraryTus(args),/Endereço de upload inválido/);assert.equal(n,1);
 await assert.rejects(uploadLibraryTus({...args,valid:()=>false}),/interrompido/);assert.equal(n,1);
});