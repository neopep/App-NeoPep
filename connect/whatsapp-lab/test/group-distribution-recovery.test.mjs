import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createBaileysProvider} from '../whatsapp-provider.mjs';
import {createBridge} from '../windows-bridge.mjs';
const jid='123-1@g.us',other='123-2@g.us',pn='555@s.whatsapp.net',lid='10@lid';
const metadata={id:jid,addressingMode:'lid',announce:true,restrict:true,participants:[{id:lid,admin:'admin'},{id:'20@lid'}]};
async function fixture({fresh=metadata,record={'10@lid':true,'20@lid':true,'99@lid':true},keyPresent=true,listed=true,changed=false}={}){
 const ev=new EventEmitter(),writes=[],saved=[],calls=[];let config;
 const initial=[['sender-key-memory:'+jid,record],['sender-key-memory:'+other,{'30@lid':true}],['sender-key:preserve','secret'],['session:preserve','session'],['device-list:10',['0']]];
 const socket={ev,user:{id:pn,lid},end(){},async groupFetchAllParticipating(){return listed?{x:metadata}:{};},
 async groupMetadata(){if(changed)ev.emit('group-participants.update',{id:jid});return fresh;},
 signalRepository:{async hasSenderKey(){return keyPresent;}},async sendMessage(){calls.push('FORBIDDEN');throw Error('forbidden');}};
 const provider=await createBaileysProvider({onQr(){},onState(){},onCredentials:v=>saved.push(JSON.parse(v)),serialized:JSON.stringify({creds:{me:{id:pn,lid}},keys:initial})},{load:async()=>[{default:opts=>{config=opts;socket.authState={keys:{get:opts.auth.keys.get,async set(data){writes.push(data);await opts.auth.keys.set(data);},async transaction(fn,key){assert.equal(key,pn);return fn();}}};return socket;},BufferJSON:{replacer:(k,v)=>v,reviver:(k,v)=>v},DisconnectReason:{},proto:{}},{default:()=>({})}]});
 provider.start();ev.emit('connection.update',{connection:'open'});return {provider,writes,saved,calls,initial};
}
test('recovery invalidates only chosen group distribution memory and persists without sending',async()=>{
 const f=await fixture();
 try{assert.deepEqual(await f.provider.recoverGroupDistribution(jid),{code:'recovered',before:3,unmatched:1,after:0});
 assert.deepEqual(f.writes,[{'sender-key-memory':{[jid]:null}}]);
 assert.deepEqual(f.saved.at(-1).keys,f.initial.filter(([k])=>k!=='sender-key-memory:'+jid));
 assert.deepEqual(f.saved.at(-1).creds,{me:{id:pn,lid}});assert.equal(f.calls.length,0);
 assert.equal((await f.provider.recoverGroupDistribution(jid)).code,'already_recovered');assert.equal(f.writes.length,1);
 }finally{f.provider.close();}
});
test('recovery refuses consistent map, missing permission, missing key and membership changes',async()=>{
 for(const [options,code] of [[{record:{'10@lid':true}},'no_mismatch'],[{fresh:{...metadata,participants:[{id:lid},{id:'20@lid'}]}},'metadata_or_permission'],[{keyPresent:false},'identity_unverified'],[{changed:true},'metadata_or_permission'],[{listed:false},'not_participating']]){
 const f=await fixture(options);
 try{assert.equal((await f.provider.recoverGroupDistribution(jid)).code,code);assert.equal(f.writes.length,0);assert.equal(f.calls.length,0);}finally{f.provider.close();}
 }
});
test('bridge requires explicit confirmation and exposes only aggregate recovery result',async()=>{
 const events=[];let calls=0;
 const bridge=createBridge({emit:e=>events.push(e),providerFactory:async args=>({start(){args.onState('conectado');},close(){},account(){return {};},async recoverGroupDistribution(){calls++;return {code:'recovered',before:3,after:0,unmatched:1,secret:'private'};}})});
 await bridge.receive({action:'connect'});
 await bridge.receive({action:'recover_group_distribution',group_jid:jid});assert.equal(calls,0);
 await bridge.receive({action:'recover_group_distribution',group_jid:jid,confirmed:true});assert.equal(calls,1);
 assert.deepEqual(events.at(-1).value,{group_jid:jid,code:'recovered',before:3,after:0,unmatched:1});
 await bridge.close();
});
