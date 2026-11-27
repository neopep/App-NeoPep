import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditGroupCryptoStore} from '../whatsapp-provider.mjs';
import {createBridge} from '../windows-bridge.mjs';
const jid='123-1@g.us';
test('inventário local conta dispositivos antigos, atuais e sessões sem alterar armazenamento',async()=>{
 const keys=new Map([
 ['device-list:10',['0','1']],['device-list:20',['0']],['session:10@lid:0',new Uint8Array([1])],
 ['sender-key-memory:'+jid,{'10@lid':true,'10:1@lid':true,'20@lid':true,'99:1@lid':true,'555@s.whatsapp.net':true,'bad-private-id':true,'50@lid':false}]
 ]);
 const original=[...keys];const calls=[];
 const repository={jidToSignalProtocolAddress(id){const m=/^(\d+):(\d+)@(.*)$/.exec(id);return m[1]+'@'+m[3]+':'+m[2];},
 async hasSenderKey(args){calls.push(args);return args.meId==='10@lid';}};
 const result=await auditGroupCryptoStore({groupJid:jid,metadata:{participants:[{id:'10@lid'},{id:'20@lid',phoneNumber:'555@s.whatsapp.net'},{id:'30@lid'}]},keys,repository,ownLid:'10@lid',ownPn:'555@s.whatsapp.net'});
 assert.equal(result.store_status,'inspected');assert.equal(result.memory_status,'present');assert.equal(result.memory_entries,6);assert.equal(result.memory_lid,4);assert.equal(result.memory_pn,1);assert.equal(result.memory_other,1);
 assert.equal(result.memory_unmatched,1);assert.equal(result.memory_unparseable,1);assert.equal(result.cached_members,2);assert.equal(result.uncached_members,1);assert.equal(result.cached_devices,3);assert.equal(result.session_records,1);
 assert.equal(result.own_lid_available,true);assert.equal(result.own_lid_key,'present');assert.equal(result.own_pn_key,'absent');assert.equal(calls.length,2);
 assert.deepEqual([...keys],original);assert.equal(JSON.stringify(result).includes('@'),false);assert.equal(JSON.stringify(result).includes('bad-private-id'),false);
});
test('ausência de memória não comprova falha, API de chave indisponível fica desconhecida',async()=>{
 const result=await auditGroupCryptoStore({groupJid:jid,metadata:{participants:[{id:'10@lid'}]},keys:new Map()});
 assert.equal(result.memory_status,'absent');assert.equal(result.session_records,null);assert.equal(result.own_lid_key,'unknown');assert.equal(result.uncached_members,1);
});
test('formato inválido de memória é identificado sem apagar nem expor valor',async()=>{
 const keys=new Map([['sender-key-memory:'+jid,'private-data']]);const result=await auditGroupCryptoStore({groupJid:jid,metadata:{participants:[]},keys});
 assert.equal(result.store_status,'invalid_memory_shape');assert.equal(result.memory_status,'invalid');assert.equal(keys.get('sender-key-memory:'+jid),'private-data');assert.equal(JSON.stringify(result).includes('private-data'),false);
});
test('bridge repassa somente campos numéricos e estados autorizados',async()=>{
 const events=[];const bridge=createBridge({emit:e=>events.push(e),providerFactory:async args=>({start(){args.onState('conectado');},close(){},account(){return {};},async diagnoseGroup(){return {code:'ok',stage:'complete',store_status:'inspected',memory_status:'present',memory_entries:4,memory_lid:3,memory_pn:1,memory_unmatched:2,own_lid_key:'present',own_pn_key:'private',session_records:-1,privateKey:'secret',participants:['10@lid']};}})});
 await bridge.receive({action:'connect'});await bridge.receive({action:'diagnose_group',group_jid:jid});
 const actual=events.find(e=>e.type==='group_diagnostic').value;
 assert.equal(actual.memory_entries,4);assert.equal(actual.memory_unmatched,2);assert.equal(actual.own_lid_key,'present');assert.equal(actual.own_pn_key,'unknown');assert.equal(actual.session_records,null);
 assert.equal(JSON.stringify(actual).includes('secret'),false);assert.equal(JSON.stringify(actual).includes('10@lid'),false);
 await bridge.close();
});
