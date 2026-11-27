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

test('provider cria álbum nativo, associa cada imagem e preserva aceite parcial',async()=>{
 const sends=[],events=new EventEmitter();
 const parent={id:'album-parent',remoteJid:'123@g.us',fromMe:true};
 const baileys={
  BufferJSON:{},DisconnectReason:{},initAuthCreds:()=>({registered:true}),
  default:()=>({
   ev:events,end(){},
   async groupFetchAllParticipating(){return {x:{id:'123@g.us'}};},
   async sendMessage(jid,content){
    sends.push(content);
    if(sends.length===1)return {key:parent};
    if(sends.length===2)return {key:{id:'first'}};
    throw Error('simulated transport error');
   }
  })
 };
 const provider=await createBaileysProvider({onQr(){},onState(){}},{load:async()=>[baileys,{default:()=>({})}]});
 provider.start();events.emit('connection.update',{connection:'open'});
 const image=Buffer.from([255,216,255,255,217]);
 const images=[{image,caption:'*Foto* _um_ 🌿\nhttps://example.invalid'},{image,caption:''},{image,caption:'Terceira'}];
 await assert.rejects(provider.sendAlbum('456@g.us',images),/participa/);
 assert.equal(sends.length,0);
 assert.deepEqual(await provider.sendAlbum('123@g.us',images),{
  status:'uncertain',messageId:'album-parent',media:[{index:0,messageId:'first'}]
 });
 assert.deepEqual(sends[0],{album:{expectedImageCount:3,expectedVideoCount:0}});
 assert.equal(sends[1].albumParentKey,parent);
 assert.equal(sends[1].caption,images[0].caption);
 assert.equal(sends[2].albumParentKey,parent);
 assert.equal(sends.length,3);
 provider.close();
});

test('bridge exige opt-in, limita tamanho e bloqueia repetição mesmo após aceite parcial',async()=>{
 const messages=[];let calls=0;
 const create=enableAlbums=>createBridge({enableAlbums,emit:m=>messages.push(m),providerFactory:async o=>({
  start(){o.onState('conectado');},close(){},
  async sendAlbum(jid,images){
   calls++;
   assert.equal(jid,'123@g.us');
   assert.equal(images[0].image.length,5242880);
   return {status:'uncertain',messageId:'parent',media:[{index:0,messageId:'child'}]};
  }
 })});
 const jpeg=Buffer.alloc(5242880);
 jpeg.set([255,216,255]);jpeg.set([255,217],jpeg.length-2);
 const item={image:jpeg.toString('base64'),caption:''};
 const message={...req(),request_id:'aaaaaaaa-1111-4111-8111-111111111111',action:'send_album',images:[item,item]};
 const disabled=create(false);
 await disabled.receive({action:'connect'});
 await disabled.receive(message);
 assert.equal(messages.at(-1).value.status,'rejected');
 await disabled.close();
 const bridge=create(true);
 await bridge.receive({action:'connect'});
 await bridge.receive({...message,images:[item,item,{image:'AAAA',caption:''}]});
 assert.equal(messages.at(-1).value.status,'rejected');
 assert.equal(calls,0);
 await bridge.receive(message);
 assert.deepEqual(messages.at(-1).value.media,[{index:0,messageId:'child'}]);
 await bridge.receive({...message,request_id:message.request_id.toUpperCase()});
 assert.equal(messages.at(-1).value.status,'uncertain');
 assert.equal(calls,1);
 await bridge.close();
});
