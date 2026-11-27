import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDraftJobBroker,createDraftJobBrokerClient} from '../src/draft-job-broker.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('private jobs adapter rejects wrong owner and arbitrary operations; uses parameterized RPCs',async()=>{
 const calls=[];
 const handle=createDraftJobBroker({authorize:async(i,o)=>i===id(1)&&o===id(2),sql:async(parts,...params)=>{calls.push({query:parts.join('?'),params});return [{value:true}];}});
 const p={id:id(1),ownerId:id(2)};
 const client=createDraftJobBrokerClient(async(path,body)=>{const r=await handle('/'+path,body);if(!r.ok)throw Error(String(r.status));return r.json();});
 await assert.rejects(client.claim({...p,ownerId:id(8)},id(3)),/403/);
 await assert.rejects(client.control(p,id(3),'publish'),/400/);
 await assert.rejects(client.result(p,id(3),id(4),id(5),'retryable',null),/400/);
 assert.equal((await handle('/jobs/dispatch',{...p,jobId:id(3)})).status,404);
 assert.equal(calls.length,0);
 assert.equal(await client.claim(p,id(3)),true);
 assert.match(calls[0].query,/connect_ai_job_claim_payload/);assert.deepEqual(calls[0].params,[id(1),id(2),id(3)]);
 assert.equal(await client.result(p,id(3),id(4),id(5),'uncertain',null),true);
 assert.match(calls[1].query,/connect_ai_job_result/);
});
