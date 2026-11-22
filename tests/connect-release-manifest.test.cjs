const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const shared=import('../supabase/functions/connect-release-draft/manifest.mjs');

test('manifesto assinado vincula versão, artefato e bytes ao pacote privado',async()=>{
 const {parseManifest,canonical,verifyManifest,verifyObject,precedes}=await shared;
 const algorithm={name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:Uint8Array.of(1,0,1),hash:'SHA-256'};
 const keys=await webcrypto.subtle.generateKey(algorithm,true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
 const bytes=Buffer.from('installer-fixture');
 const m={version:'0.2.6',profile:'staging',channel:'stable',bytes:bytes.length,artifact:'run-123',sha256:createHash('sha256').update(bytes).digest('hex')};
 m.signature=Buffer.from(await webcrypto.subtle.sign(algorithm,keys.privateKey,Buffer.from(canonical(m)))).toString('base64');
 assert.deepEqual(parseManifest(m),m);
 assert.equal(await verifyManifest(m,jwk,webcrypto.subtle),true);
 for(const changed of [{artifact:'outro'},{version:'0.2.7'},{signature:'A'.repeat(344)}])
  assert.equal(await verifyManifest({...m,...changed},jwk,webcrypto.subtle),false);
 for(const changed of [{version:'../a'},{version:'0.2.5'},{profile:'production'},{channel:'beta'},{bytes:52428801}])
  assert.throws(()=>parseManifest({...m,...changed}));
 assert.equal(await verifyObject(new Response(bytes).body,m,createHash('sha256')),true);
 assert.equal(await verifyObject(new Response(Buffer.alloc(bytes.length)).body,m,createHash('sha256')),false);
 assert.equal(await verifyObject(new Response(Buffer.concat([bytes,bytes])).body,m,createHash('sha256')),false);
 assert.equal(precedes('0.2.9','0.2.10'),true);
});

test('Edge nega produção, anônimo e não administrador antes de acessar Storage',async()=>{
 const {readFileSync}=require('node:fs');
 const {runInNewContext}=require('node:vm');
 const {transformSync}=require('esbuild');
 const service=await shared;
 const source=readFileSync('supabase/functions/connect-release-draft/index.ts','utf8').replace(/^import .*;\n/gm,'');
 let handler,stage=service.staging;const operations=[];
 runInNewContext(transformSync(source,{loader:'ts'}).code,{
  ...service,Request,Response,URL,createHash,AbortSignal,TextDecoder,
  Deno:{serve(fn){handler=fn;},env:{get(key){return key==='SUPABASE_URL'?stage:'fixture';}}},
  createClient(){return {auth:{async getUser(){return {data:{user:{id:'fixture'}}};}},
   async rpc(_,params){operations.push(params.p_action);return {error:{code:'42501'}};}}},
  fetch(){assert.fail('Storage não pode ser consultado');}
 });
 const invoke=(headers={},method='POST')=>handler(new Request(service.staging,{method,headers,body:'{}'}));
 assert.equal((await invoke()).status,401);
 assert.equal((await invoke({Origin:'https://app.neopep.com.br'})).status,403);
 assert.equal((await invoke({Authorization:'Bearer '+'a'.repeat(40)})).status,403);
 assert.deepEqual(operations,['list']);
 stage='https://example.invalid';
 assert.equal((await invoke({Authorization:'Bearer '+'a'.repeat(40)})).status,404);
});

test('Edge só registra rascunho depois de verificar o objeto e tolera reimportação idêntica',async()=>{
 const {readFileSync}=require('node:fs');
 const {runInNewContext}=require('node:vm');
 const {transformSync}=require('esbuild');
 const service=await shared;
 const source=readFileSync('supabase/functions/connect-release-draft/index.ts','utf8').replace(/^import .*;\n/gm,'');
 const bytes=Buffer.from('object-fixture');
 const manifest={version:'0.2.6',profile:'staging',channel:'stable',bytes:bytes.length,
  sha256:createHash('sha256').update(bytes).digest('hex'),artifact:'artifact-1',signature:'A'.repeat(344)};
 let handler,stored=bytes,releases=[];
 const operations=[];
 const path=manifest.version+'/'+service.fileName;
 runInNewContext(transformSync(source,{loader:'ts'}).code,{
  ...service,async verifyManifest(){return true;},Request,Response,URL,createHash,AbortSignal,TextDecoder,
  Deno:{serve(fn){handler=fn;},env:{get(key){return key==='SUPABASE_URL'?service.staging:'{}';}}},
  createClient(){return {auth:{async getUser(){return {data:{user:{id:'admin'}}};}},
   async rpc(_,params){
    operations.push(params.p_action);
    if(params.p_action==='list')return {data:{releases}};
    assert.equal(params.p_action,'register');
    releases=[{...params.p_data,distribution_state:'draft'}];
    return {data:{ok:true}};
   },
   storage:{from(bucket){
    assert.equal(bucket,service.bucket);
    return {
     async exists(){return {data:false,error:{}};},
     async createSignedUploadUrl(object,options){
      assert.equal(object,path);assert.equal(options.upsert,false);
      return {data:{signedUrl:service.staging+'/storage/v1/object/upload/sign/'+bucket+'/'+path+'?token=fixture'}};
     }
    };
   }}
  };},
  async fetch(url){
   assert.equal(url,service.staging+'/storage/v1/object/authenticated/'+service.bucket+'/'+path);
   return new Response(stored);
  }
 });
 const call=(data=manifest,suffix='')=>handler(new Request(service.staging+'/'+suffix,
  {method:'POST',headers:{Authorization:'Bearer '+'a'.repeat(40)},body:JSON.stringify(data)}));
 assert.equal((await call(manifest,'?action=upload')).status,200);
 assert.deepEqual(operations,['list']);
 stored=Buffer.alloc(bytes.length);
 assert.equal((await call()).status,422);
 assert.deepEqual(operations,['list','list']);
 stored=bytes;
 const first=await call();
 assert.equal(first.status,201);assert.equal((await first.json()).state,'draft');
 assert.equal((await call()).status,200);
 assert.equal((await call({...manifest,artifact:'different'})).status,409);
 assert.equal(operations.filter(action=>action==='register').length,1);
});
