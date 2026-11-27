import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {compareGroupMetadata,createBaileysProvider} from '../whatsapp-provider.mjs';
import {createBridge} from '../windows-bridge.mjs';

const jid='1200-10@g.us',self='10@lid',other='20@lid',third='30@lid';
const metadata=(members=[self,other],mode='lid',role='admin')=>({
 id:jid,addressingMode:mode,announce:true,restrict:true,
 participants:members.map(id=>({id,admin:id===self?role:null}))
});
test('metadados LID iguais e administrador autorizado',()=>{
 const result=compareGroupMetadata(metadata(),metadata(),[self]);
 assert.equal(result.code,'ok');
 assert.equal(result.fresh_count,2);
 assert.equal(result.lid_count,2);
 assert.equal(result.pn_count,0);
 assert.equal(result.members_changed,false);
 assert.equal(JSON.stringify(result).includes('@lid'),false);
});
test('mesmo total não esconde troca de participantes',()=>{
 const result=compareGroupMetadata(metadata(),metadata([self,third]),[self]);
 assert.equal(result.code,'membership_refreshed');
 assert.equal(result.members_changed,true);
 assert.equal(result.fresh_count,2);
});
test('saída de participante aceita apenas snapshot atual e autorizado',()=>{
 assert.equal(compareGroupMetadata(metadata([self,other,third]),metadata(),[self]).code,'membership_refreshed');
});
test('divergência de modo bloqueia o relay sem forçar PN ou LID',()=>{
 assert.equal(compareGroupMetadata(metadata(),metadata([self,other],'pn'),[self]).code,'mode_mismatch');
});
test('grupo alterado durante a consulta não dispara mensagem',()=>{
 assert.equal(compareGroupMetadata(metadata(),metadata(),[self],true).code,'membership_changed_during_read');
});
test('não envia em grupo restrito se o administrador não for confirmado',()=>{
 assert.equal(compareGroupMetadata(metadata(),metadata([self,other],'lid',null),[self]).code,'permission_unverified');
 assert.equal(compareGroupMetadata(metadata(),metadata([other,third]),[self]).code,'permission_unverified');
});
test('snapshot de grupo errado ou com participante inválido é recusado',()=>{
 assert.equal(compareGroupMetadata(metadata(),{...metadata(),id:'1200-99@g.us'},[self]).code,'metadata_invalid');
 assert.equal(compareGroupMetadata(metadata(),metadata([self,self]),[self]).code,'metadata_invalid');
});
async function fixture(fresh,options={}){
 const ev=new EventEmitter(),checks=[],calls=[];
 let config;
 const socket={ev,user:{id:self},end(){},
  async groupFetchAllParticipating(){return {[jid]:metadata(options.listed||[self,other])};},
  async groupMetadata(target){assert.equal(target,jid);calls.push('metadata');if(options.changed)ev.emit('group-participants.update',{id:jid});return fresh;},
  async sendMessage(target,payload,opts){
   assert.equal(target,jid);assert.equal(opts.useCachedGroupMetadata,true);
   const snapshot=await config.cachedGroupMetadata(target);
   calls.push('relay');assert.equal(snapshot,fresh);
   assert.equal(payload.text,'teste');
   return {key:{id:'message1'}};
  }
 };
 const provider=await createBaileysProvider({onState(){},onQr(){},onGroupCheck:row=>checks.push(row)},{
  load:async()=>[{default:opts=>{config=opts;return socket;},initAuthCreds:()=>({me:{id:self,lid:self}}),
   BufferJSON:{replacer:(k,v)=>v,reviver:(k,v)=>v},DisconnectReason:{},proto:{}},{default:()=>({})}]
 });
 provider.start();ev.emit('connection.update',{connection:'open'});
 return {provider,checks,calls};
}
test('envio usa snapshot individual fresco no relay, sem repetir',async()=>{
 const {provider,checks,calls}=await fixture(metadata([self,third]),{listed:[self,other]});
 try{assert.equal((await provider.sendText(jid,'teste')).messageId,'message1');
 assert.deepEqual(calls,['metadata','relay']);assert.equal(checks[0].code,'membership_refreshed');}
 finally{provider.close();}
});
test('divergência PN/LID não gera tentativa de relay',async()=>{
 const {provider,checks,calls}=await fixture(metadata([self,other],'pn'));
 try{await assert.rejects(provider.sendText(jid,'teste'));
 assert.deepEqual(calls,['metadata']);assert.equal(checks[0].code,'mode_mismatch');}
 finally{provider.close();}
});
test('evento de saída durante consulta interrompe antes do relay',async()=>{
 const {provider,checks,calls}=await fixture(metadata(),{changed:true});
 try{await assert.rejects(provider.sendText(jid,'teste'));
 assert.deepEqual(calls,['metadata']);assert.equal(checks[0].code,'membership_changed_during_read');}
 finally{provider.close();}
});
test('bridge mantém só campos agregados, descarta ids, conteúdo e chaves',async()=>{
 let callbacks;const events=[];
 const bridge=createBridge({emit:event=>events.push(event),providerFactory:async args=>{
 callbacks=args;return {start(){args.onState('conectado');},close(){},account(){return {};}};}});
 await bridge.receive({action:'connect'});
 callbacks.onGroupCheck({group_jid:jid,code:'ok',listed_mode:'lid',fresh_mode:'lid',listed_count:2,fresh_count:2,lid_count:2,pn_count:0,members_changed:false,
  participant_ids:[self,other],secret:'do-not-log',body:'private'});
 const actual=events.find(x=>x.type==='group_check').value;
 assert.deepEqual(actual,{group_jid:jid,code:'ok',listed_mode:'lid',fresh_mode:'lid',listed_count:2,fresh_count:2,lid_count:2,pn_count:0,members_changed:false});
 await bridge.close();
});
