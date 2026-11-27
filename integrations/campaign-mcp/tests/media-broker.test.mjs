import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaBroker,createMediaBrokerClient} from '../src/media-broker.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('private media broker rejects unauthorized connection and only calls fixed parameterized RPC',async()=>{
 let calls=[];
 const handle=createMediaBroker({authorize:async(i,o)=>i===id(1)&&o===id(2),sql:async(parts,...params)=>{calls.push({query:parts.join('?'),params});return [{value:{state:'issued'}}]}});
 const client=createMediaBrokerClient(async(path,d)=>{assert.equal(path,'media/ticket');const r=await handle(d);if(!r.ok)throw Error(String(r.status));return r.json();});
 const p={id:id(1),ownerId:id(2)};
 await assert.rejects(client.ticket({...p,ownerId:id(8)},id(3),'inspect',{}),/403/);
 await assert.rejects(client.ticket(p,id(3),'delete',{}),/400/);
 assert.equal(calls.length,0);
 assert.deepEqual(await client.ticket(p,id(3),'inspect',{}),{state:'issued'});
 assert.match(calls[0].query,/connect_ai_media_ticket/);
 assert.deepEqual(calls[0].params,[id(1),id(2),id(3),'inspect','{}']);
});
