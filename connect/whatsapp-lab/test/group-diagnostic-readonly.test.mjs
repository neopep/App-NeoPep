import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createBaileysProvider} from '../whatsapp-provider.mjs';
import {createBridge} from '../windows-bridge.mjs';

const jid='123-1@g.us',otherGroup='123-2@g.us',self='10@lid';
const group=(id=jid,mode='lid',members=[self,'20@lid'])=>({id,addressingMode:mode,announce:true,restrict:true,participants:members.map(id=>({id,admin:id===self?'admin':null}))});
async function fixture({listed=group(),fresh=group(),listError=false,individualError=false,changed=false}={}){
 const ev=new EventEmitter(),calls=[];
 const socket={ev,user:{id:self},end(){},async groupFetchAllParticipating(){calls.push('list');if(listError)throw Error('private');return {x:listed};},
 async groupMetadata(id){assert.equal(id,jid);calls.push('individual');if(changed)ev.emit('group-participants.update',{id:jid});if(individualError)throw Error('private');return fresh;},
 async sendMessage(){calls.push('FORBIDDEN_SEND');throw Error('not allowed');}};
 const provider=await createBaileysProvider({onState(){},onQr(){}},{load:async()=>[{default:()=>socket,initAuthCreds:()=>({me:{id:self,lid:self}}),BufferJSON:{replacer:(k,v)=>v,reviver:(k,v)=>v},DisconnectReason:{},proto:{}},{default:()=>({})}]});
 provider.start();ev.emit('connection.update',{connection:'open'});
 return {provider,calls};
}
test('diagnóstico independente consulta os dois endpoints sem enviar',async()=>{
 const {provider,calls}=await fixture({fresh:group(jid,'lid',[self,'20@lid','30@s.whatsapp.net'])});
 try{const result=await provider.diagnoseGroup(jid);assert.equal(result.code,'membership_refreshed');assert.equal(result.stage,'complete');assert.equal(result.fresh_count,3);assert.equal(result.lid_count,2);assert.equal(result.pn_count,1);assert.equal(result.role,'admin');assert.equal(result.crypto_status,'not_verified');assert.deepEqual(calls,['list','individual']);assert.equal(JSON.stringify(result).includes('20@lid'),false);}
 finally{provider.close();}
});
test('grupo ausente impede consulta individual',async()=>{
 const {provider,calls}=await fixture({listed:group(otherGroup)});
 try{assert.equal((await provider.diagnoseGroup(jid)).code,'not_participating');assert.deepEqual(calls,['list']);}finally{provider.close();}
});
test('erro de lista ou individual tem estágio explícito',async()=>{
 for(const [options,stage,expected] of [[{listError:true},'list',['list']],[{individualError:true},'individual',['list','individual']]]){
 const {provider,calls}=await fixture(options);
 try{const result=await provider.diagnoseGroup(jid);assert.equal(result.code,'metadata_unavailable');assert.equal(result.stage,stage);assert.deepEqual(calls,expected);}finally{provider.close();}
 }
});
test('detecta mudança de membros durante consulta e modo divergente',async()=>{
 for(const [options,code] of [[{changed:true},'membership_changed_during_read'],[{fresh:group(jid,'pn')},'mode_mismatch']]){
 const {provider,calls}=await fixture(options);
 try{assert.equal((await provider.diagnoseGroup(jid)).code,code);assert.deepEqual(calls,['list','individual']);}finally{provider.close();}
 }
});
test('bridge devolve diagnóstico separado por grupo sem campos privados',async()=>{
 const events=[],calls=[];
 const bridge=createBridge({emit:e=>events.push(e),providerFactory:async args=>({start(){args.onState('conectado');},close(){},account(){return {};},
 async diagnoseGroup(id){calls.push(id);return {code:'ok',stage:'complete',fresh_count:id===jid?2:3,participant_ids:[self],secret:'private',crypto_status:'verified'};},
 sendText(){throw Error('forbidden');}})});
 await bridge.receive({action:'connect'});
 await bridge.receive({action:'diagnose_group',group_jid:jid});
 await bridge.receive({action:'diagnose_group',group_jid:otherGroup});
 const diagnostics=events.filter(e=>e.type==='group_diagnostic').map(e=>e.value);
 assert.deepEqual(calls,[jid,otherGroup]);assert.equal(diagnostics.length,2);
 assert.equal(diagnostics[0].group_jid,jid);assert.equal(diagnostics[1].group_jid,otherGroup);
 assert.equal(diagnostics[0].fresh_count,2);assert.equal(diagnostics[1].fresh_count,3);assert.equal(diagnostics[0].crypto_status,'not_verified');
 assert.equal(JSON.stringify(diagnostics).includes('private'),false);assert.equal(JSON.stringify(diagnostics).includes(self),false);
 await bridge.close();
});
test('bridge responde sem desconectar quando consulta falha',async()=>{
 const events=[];
 const bridge=createBridge({emit:e=>events.push(e),providerFactory:async args=>({start(){args.onState('conectado');},close(){},account(){return {};},async diagnoseGroup(){throw Error('private');}})});
 await bridge.receive({action:'connect'});await bridge.receive({action:'diagnose_group',group_jid:jid});
 assert.equal(events.find(e=>e.type==='group_diagnostic').value.code,'diagnostic_unavailable');
 assert.equal(events.filter(e=>e.type==='state').at(-1).value,'conectado');await bridge.close();
});
