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
