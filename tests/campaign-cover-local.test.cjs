'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
const html=fs.readFileSync('dist/admin/index.html','utf8');
const start=editor.indexOf(' function localCoverBlob('),end=editor.indexOf(' function validLink(',start);
const funcs=editor.slice(start,end);
const make=fetch=>new Function('fetch',funcs+';return {localCoverBlob,referenceCoverBlob};')(fetch);
test('local JPEG and WebP covers are decoded without network fetch under restrictive CSP',async()=>{
 let calls=0;const {referenceCoverBlob}=make(()=>{calls++;throw Error('fetch must not run')});
 for(const type of ['jpeg','webp','png']){
  const blob=await referenceCoverBlob({image:'data:image/'+type+';base64,AQIDBA=='},new AbortController().signal,'https://example.supabase.co');
  assert.equal(blob.type,'image/'+type);assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer())),[1,2,3,4]);
 }
 assert.equal(calls,0);assert.doesNotMatch(html.match(/connect-src [^;]+/)[0],/data:|blob:/);
});
test('reject invalid local covers and disallow arbitrary remote fetch',async()=>{
 let calls=0;const {referenceCoverBlob}=make(()=>{calls++;throw Error('blocked')});
 for(const image of ['data:text/html;base64,AQIDBA==','data:image/jpeg;base64,?','https://evil.example/cover.jpg','https://example.supabase.co/other.jpg']){
  await assert.rejects(referenceCoverBlob({image},new AbortController().signal,'https://example.supabase.co'));
 }
 assert.equal(calls,0);
});
test('authorized remote cover is checked before upload and errors are explained',async()=>{
 const {referenceCoverBlob}=make(async()=>({ok:false}));
 await assert.rejects(referenceCoverBlob({image:'https://example.supabase.co/storage/v1/object/sign/neo-campaign-images/a.jpg'},new AbortController().signal,'https://example.supabase.co'),/rascunho foi mantido/);
 assert.match(editor,/await referenceCoverBlob\(reference,previewAbort.signal,window.NEO_CONFIG\?\.supabaseUrl\)/);
 assert.doesNotMatch(editor,/fetch\(reference.image/);
 assert.match(editor,/Capa estática do vídeo/);
});
