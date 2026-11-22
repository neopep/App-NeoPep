import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../windows-bridge.mjs';

test('IPC guarda sessão local, invalida QR antigo e limita grupos aos metadados',async()=>{
 const messages=[];
 let hooks,render;
 const bridge=createBridge({
  emit:message=>messages.push(message),
  renderQr:()=>new Promise(resolve=>{render=resolve;}),
  providerFactory:async options=>{
   hooks=options;
   return {start(){},close(){},async forget(){return true;},
    async listGroups(){return [{id:'123@g.us',name:'Teste',members:7,participants:['omitido'],history:['omitido']},{id:'123@s.whatsapp.net'}]}}
  }
 });
 await bridge.receive({action:'connect',vault:'fixture'});
 assert.equal(hooks.serialized,'fixture');
 const old=hooks.onQr('qr-antigo');
 hooks.onState('conectado');
 render('antigo');
 await old;
 assert.equal(messages.some(item=>item.type==='qr'),false);
 hooks.onState('reconectando');
 const fresh=hooks.onQr('qr-novo');
 render('qr-atual');
 await fresh;
 assert.deepEqual(messages.at(-1),{type:'qr',value:'qr-atual'});
 hooks.onState('conectado');
 await bridge.receive({action:'groups'});
 assert.deepEqual(messages.at(-1),{type:'groups',value:[{id:'123@g.us',name:'Teste',members:7}]});
 hooks.onCredentials('vault-de-teste');
 assert.deepEqual(messages.at(-1),{type:'vault',value:'vault-de-teste'});
 await bridge.receive({action:'disconnect'});
 assert.deepEqual(messages.slice(-2),[{type:'vault',value:null},{type:'state',value:'desconectado'}]);
 hooks.onCredentials('sessão vencida');
 assert.equal(messages.at(-1).value,'desconectado');
 await bridge.close();
});

test('IPC reporta falhas sem logs sensíveis e informa revogação remota pendente',async()=>{
 const messages=[];
 const bridge=createBridge({emit:message=>messages.push(message),providerFactory:async hooks=>({
  start(){hooks.onState('conectado');},close(){},async forget(){return false;},
  async listGroups(){throw Error('conteúdo que não deve vazar');}
 })});
 await bridge.receive({action:'connect'});
 await bridge.receive({action:'groups'});
 assert.deepEqual(messages.at(-1),{type:'error',value:'grupos_indisponiveis'});
 await bridge.receive({action:'disconnect'});
 assert.deepEqual(messages.at(-1),{type:'state',value:'limpeza_local'});
 const before=messages.length;
 await bridge.receive({action:'send'});
 assert.equal(messages.length,before);
 await bridge.close();
});

test('provedor limita retentativas, reconecta após falha e apaga sessão revogada',async()=>{
 const {EventEmitter}=await import('node:events');
 const {createBaileysProvider}=await import('../whatsapp-provider.mjs');
 const states=[],vault=[],scheduled=[],sockets=[];
 const baileys={
  BufferJSON:{},DisconnectReason:{loggedOut:401,badSession:500,connectionReplaced:440,restartRequired:515},
  initAuthCreds:()=>({registered:true}),
  default:options=>{
   assert.equal(options.syncFullHistory,false);
   assert.equal(options.shouldSyncHistoryMessage(),false);
   const socket={ev:new EventEmitter(),end(){},async groupFetchAllParticipating(){return {fixture:{id:'123@g.us',subject:'Grupo teste',size:3}};}};
   sockets.push(socket);
   return socket;
  }
 };
 const provider=await createBaileysProvider(
  {onQr:()=>{},onState:state=>states.push(state),onCredentials:value=>vault.push(value)},
  {load:async()=>[baileys,{default:()=>({})}],schedule:(fn,delay)=>{scheduled.push({fn,delay});},cancel:()=>{}}
 );
 provider.start();
 function close(code){sockets.at(-1).ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:code}}}});}
 close(408);
 assert.equal(states.at(-1),'reconectando');
 assert.equal(scheduled.at(-1).delay,1000);
 scheduled.at(-1).fn();
 sockets.at(-1).ev.emit('connection.update',{connection:'open'});
 assert.equal(states.at(-1),'conectado');
 assert.deepEqual(await provider.listGroups(),[{id:'123@g.us',name:'Grupo teste',members:3}]);
 close(401);
 assert.equal(states.at(-1),'revogado');
 assert.equal(vault.at(-1),null);
 const next=await createBaileysProvider({onQr:()=>{},onState:state=>states.push(state)},
  {load:async()=>[baileys,{default:()=>({})}],schedule:(fn,delay)=>{scheduled.push({fn,delay});},cancel:()=>{}});
 next.start();
 for(let attempt=0;attempt<5;attempt++){close(503);scheduled.at(-1).fn();}
 close(503);
 assert.equal(states.at(-1),'rede_indisponivel');
 next.close();
});
