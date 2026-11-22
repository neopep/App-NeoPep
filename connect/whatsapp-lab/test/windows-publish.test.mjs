import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../windows-bridge.mjs';
import {createBaileysProvider} from '../whatsapp-provider.mjs';
import {EventEmitter} from 'node:events';

const req=(group_jid='123@g.us',text='Teste NeoPep')=>({
 action:'send_text',request_id:'11111111-1111-4111-8111-111111111111',group_jid,text
});

test('bridge envia somente após conexão, devolve aceite sem reenvio',async()=>{
 const output=[];let hooks,count=0;
 const bridge=createBridge({
  emit:m=>output.push(m),
  providerFactory:async options=>{hooks=options;return {
   start(){options.onState('conectado')},close(){},account(){return {}},
   async sendText(jid,text){count++;assert.equal(jid,'123@g.us');assert.equal(text,'Teste NeoPep');return {messageId:'ABCD'};}
  }}
 });
 await bridge.receive(req());
 assert.equal(output.at(-1).type,'send_result');
 assert.equal(output.at(-1).value.status,'rejected');
 assert.equal(count,0);
 await bridge.receive({action:'connect'});
 await bridge.receive(req());
 assert.equal(count,1);
 assert.deepEqual(output.at(-1),{type:'send_result',value:{
  request_id:req().request_id,status:'accepted',message_id:'ABCD'}});
 await bridge.receive(req('invalid','x'));
 assert.equal(count,1);
 assert.equal(output.at(-1).value.status,'rejected');
 await bridge.close();
});

test('bridge sinaliza resultado incerto e não tenta enviar novamente',async()=>{
 let calls=0;
 const output=[];
 const bridge=createBridge({
  emit:m=>output.push(m),
  providerFactory:async o=>({
   start(){o.onState('conectado')},close(){},account(){return {}},
   async sendText(){calls++;throw Error('conteúdo privado que não deve aparecer');}
  })
 });
 await bridge.receive({action:'connect'});
 await bridge.receive(req());
 assert.equal(calls,1);
 assert.equal(output.at(-1).value.status,'uncertain');
 assert.equal(JSON.stringify(output).includes('conteúdo privado'),false);
 await bridge.close();
});

test('provider verifica participação no grupo e evita enviar a destinos externos',async()=>{
 const sends=[],events=new EventEmitter();
 const baileys={
  BufferJSON:{},DisconnectReason:{},initAuthCreds:()=>({registered:true}),
  default:()=>({
   ev:events,end(){},user:{},
   async groupFetchAllParticipating(){return {x:{id:'123@g.us',subject:'Teste'}};},
   async sendMessage(jid,msg){sends.push([jid,msg]);return {key:{id:'ID-OK'}};}
  })
 };
 const provider=await createBaileysProvider({
  onQr(){},onState(){},onCredentials(){}
 },{load:async()=>[baileys,{default:()=>({})}]});
 provider.start();events.emit('connection.update',{connection:'open'});
 await assert.rejects(provider.sendText('456@g.us','Não autorizado'),/participa/);
 await assert.rejects(provider.sendText('123@g.us','   '),/inválida/);
 assert.deepEqual(await provider.sendText('123@g.us',' Alô '),{messageId:'ID-OK'});
 assert.deepEqual(sends,[['123@g.us',{text:'Alô'}]]);
 provider.close();
});
