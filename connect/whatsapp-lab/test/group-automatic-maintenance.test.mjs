import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {planDistributionMaintenance,createBaileysProvider} from '../whatsapp-provider.mjs';
const jid='123-1@g.us',other='123-2@g.us',pn='555@s.whatsapp.net',lid='10@lid';
const metadata={id:jid,addressingMode:'lid',announce:true,restrict:true,participants:[{id:lid,admin:'admin'},{id:'20@lid'}]};
test('prune only exact obsolete LID records, preserve active entries and flags',()=>{
 const raw={'10@lid':true,'10:1@lid':false,'20:2@lid':true,'99:1@lid':true};
 assert.deepEqual(planDistributionMaintenance(metadata,raw),{next:{'10@lid':true,'10:1@lid':false,'20:2@lid':true},before:4,after:3,removed:1});
 assert.equal(Object.keys(raw).length,4);
});
test('ambiguous metadata or distribution format cannot be pruned',()=>{
 assert.equal(planDistributionMaintenance({...metadata,addressingMode:'pn'},{'99@lid':true}),null);
 assert.equal(planDistributionMaintenance({...metadata,participants:[{id:'20@lid'},{id:'20:1@lid'}]},{'99@lid':true}),null);
 assert.equal(planDistributionMaintenance(metadata,{'99@s.whatsapp.net':true}),null);
 assert.equal(planDistributionMaintenance(metadata,{'99@lid':'unknown'}),null);
});
async function fixture({enabled=true,fresh=metadata,record={'10@lid':true,'20@lid':true,'99@lid':true},keyPresent=true}={}){
 const ev=new EventEmitter(),writes=[],saved=[],calls=[],events=[],payloads=[];let config;
 const initial=[['sender-key-memory:'+jid,record],['sender-key-memory:'+other,{'30@lid':true}],['sender-key:preserve','secret'],['session:preserve','session']];
 const socket={ev,user:{id:pn,lid},end(){},async groupFetchAllParticipating(){calls.push('list');return {x:metadata};},
 async groupMetadata(){calls.push('metadata');return fresh;},signalRepository:{async hasSenderKey(){return keyPresent;}},
 async sendMessage(id,payload){payloads.push(payload);calls.push('send');await config.cachedGroupMetadata(id);return {key:{id:'message1'}};}};
 const provider=await createBaileysProvider({onQr(){},onState(){},onCredentials:v=>saved.push(JSON.parse(v)),onMaintenance:v=>events.push(v),automaticMaintenance:enabled,serialized:JSON.stringify({creds:{me:{id:pn,lid}},keys:initial})},{load:async()=>[{default:opts=>{config=opts;socket.authState={keys:{get:opts.auth.keys.get,async set(data){writes.push(data);await opts.auth.keys.set(data);},async transaction(fn,key){assert.equal(key,pn);return fn();}}};return socket;},BufferJSON:{replacer:(k,v)=>v,reviver:(k,v)=>v},DisconnectReason:{},proto:{WebMessageInfo:{Status:{SERVER_ACK:2,ERROR:0}}}},{default:()=>({})}]});
 provider.start();ev.emit('connection.update',{connection:'open'});return {provider,writes,saved,calls,events,ev,initial,payloads};
}
test('automatic maintenance preserves keys and other groups and sends only original authorized request',async()=>{
 const f=await fixture();
 try{await f.provider.sendText(jid,'test');
 assert.deepEqual(f.writes,[{'sender-key-memory':{[jid]:{'10@lid':true,'20@lid':true}}}]);
 assert.deepEqual(f.saved.at(-1).keys.filter(([k])=>k!=='sender-key-memory:'+jid),f.initial.filter(([k])=>k!=='sender-key-memory:'+jid));
 assert.equal(f.calls.filter(v=>v==='send').length,1);assert.equal(f.events[0].code,'pruned');assert.equal(f.events[0].removed,1);
 }finally{f.provider.close();}
});
test('disabled maintenance and healthy group do not change distribution',async()=>{
 for(const options of [{enabled:false},{record:{'10@lid':true,'20@lid':true}},{keyPresent:false}]){
 const f=await fixture(options);try{await f.provider.sendText(jid,'test');assert.equal(f.writes.length,0);assert.equal(f.calls.filter(v=>v==='send').length,1);}finally{f.provider.close();}
 }
});
test('preflight permission failure prevents transmission and writes',async()=>{
 const f=await fixture({fresh:{...metadata,participants:[{id:lid},{id:'20@lid'}]}});
 try{await assert.rejects(f.provider.sendText(jid,'test'));assert.equal(f.writes.length,0);assert.equal(f.calls.includes('send'),false);}finally{f.provider.close();}
});
test('421 stops later requests in same provider even if maintenance is disabled',async()=>{
 const f=await fixture({enabled:false});
 try{await f.provider.sendText(jid,'test');
 f.ev.emit('messages.update',[{key:{fromMe:true,remoteJid:jid,id:'message1'},update:{status:0,messageStubParameters:['421']}}]);
 assert.deepEqual(await f.provider.sendText(jid,'test'),{blocked:'previous_421'});assert.equal(f.calls.filter(v=>v==='send').length,1);assert.equal(f.events.at(-1).code,'previous_421');
 }finally{f.provider.close();}
});

test('revalidation needs official confirmation, never transmits, and does not repeatedly reopen after a new rejection',async()=>{
 const f=await fixture({enabled:false});
 try{
 await f.provider.sendText(jid,'test');
 const reject=()=>f.ev.emit('messages.update',[{key:{fromMe:true,remoteJid:jid,id:'message1'},update:{status:0,messageStubParameters:['421']}}]);
 reject();
 assert.equal((await f.provider.revalidateGroupAvailability(jid,false)).code,'unavailable');
 assert.deepEqual(await f.provider.sendText(jid,'test'),{blocked:'previous_421'});
 assert.equal((await f.provider.revalidateGroupAvailability(jid,true)).code,'local_pause_cleared');
 assert.equal(f.calls.filter(v=>v==='send').length,1);
 assert.equal(f.writes.length,0);
 await f.provider.sendText(jid,'new authorized request');
 reject();
 assert.equal((await f.provider.revalidateGroupAvailability(jid,true)).code,'rejected_again');
 assert.deepEqual(await f.provider.sendText(jid,'test'),{blocked:'previous_421'});
 assert.equal(f.calls.filter(v=>v==='send').length,2);
 }finally{f.provider.close();}
});

test('video transport never sends MOV or oversized MP4 as a document',async()=>{
 const f=await fixture({enabled:false});
 try{
 const mp4=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const mov=Buffer.from([0,0,0,16,102,116,121,112,113,116,32,32,0,0,0,0]);
 const big=Buffer.alloc(16*1024*1024+1);mp4.copy(big);
 assert.deepEqual(await f.provider.sendFile(jid,'caption',mov,'video/quicktime','v.mov'),{blocked:'video_conversion'});
 assert.deepEqual(await f.provider.sendFile(jid,'caption',big,'video/mp4','v.mp4'),{blocked:'video_conversion'});
 assert.equal(f.payloads.length,0);
 await f.provider.sendFile(jid,'caption',mp4,'video/mp4','v.mp4');
 assert.equal(f.payloads[0].video,mp4);assert.equal(f.payloads[0].document,undefined);
 assert.equal(f.payloads[0].caption,'caption');
 const pdf=Buffer.from('%PDF-1.4\n%%EOF');
 await f.provider.sendFile(jid,'pdf',pdf,'application/pdf','p.pdf');
 assert.equal(f.payloads[1].document,pdf);assert.equal(f.payloads[1].video,undefined);
 }finally{f.provider.close();}
});
