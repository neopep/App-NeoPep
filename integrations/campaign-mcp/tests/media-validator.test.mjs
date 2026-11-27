import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaValidator} from '../src/media-validator.mjs';
const bytes=new Uint8Array([255,216,255,255,217]);
const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const valid={policy:'neopep-media-validation-v1',valid:true,mime:'image/jpeg',size:bytes.length,sha256,fullParse:true,contentSafety:true};
test('private validator requires complete response bound to exact bytes',async()=>{
 assert.equal(createMediaValidator(null),undefined);
 const f=createMediaValidator({fetch:async req=>{assert.equal(req.url,'https://media-validator.internal/validate');assert.equal(req.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await req.arrayBuffer()),bytes);return Response.json(valid);}});
 assert.equal(await f('image/jpeg',bytes),true);
 assert.equal(await f('image/png',bytes),false);
 for(const change of [{fullParse:false},{contentSafety:false},{sha256:'0'.repeat(64)},{mime:'application/pdf'},{size:1},{policy:'old'},{valid:false}]){
  assert.equal(await createMediaValidator({fetch:async()=>Response.json({...valid,...change})})('image/jpeg',bytes),false);
 }
});
test('validator outage or oversized receipt fails closed',async()=>{
 assert.equal(await createMediaValidator({fetch:async()=>{throw Error('timeout');}})('image/jpeg',bytes),false);
 assert.equal(await createMediaValidator({fetch:async()=>Response.json({...valid,extra:'x'.repeat(3000)})})('image/jpeg',bytes),false);
});
