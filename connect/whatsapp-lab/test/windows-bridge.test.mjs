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
    account(){return {name:"Conta teste",number:"5511999999999",token:"omitido"};},
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
 assert.deepEqual(messages.at(-1),{type:'account',value:{name:'Conta teste',number:'5511999999999'}});
 await bridge.receive({action:'groups'});
 assert.deepEqual(messages.at(-2),{type:'groups_loading',value:null});
 assert.deepEqual(messages.at(-1),{type:'groups',value:[{id:'123@g.us',name:'Teste',members:7,addressing_mode:'unknown',role:'unknown',posting:'unknown',settings:'unknown'}]});
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
   const socket={user:{name:'Conta teste',id:'5511999999999:3@s.whatsapp.net'},ev:new EventEmitter(),end(){},async groupFetchAllParticipating(){return {fixture:{id:'123@g.us',subject:'Grupo teste',size:3}};}};
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
 assert.deepEqual(provider.account(),{name:'Conta teste',number:'5511999999999'});
 sockets.at(-1).user.id='123456789@lid';
 assert.deepEqual(provider.account(),{name:'Conta teste',number:''});
 assert.deepEqual(await provider.listGroups(),[{id:'123@g.us',name:'Grupo teste',members:3,addressing_mode:'unknown',role:'unknown',posting:'unknown',settings:'unknown'}]);
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

test('IPC exige JPEG limitado e envia uma imagem apenas ao grupo solicitado',async()=>{
 const sent=[],messages=[];
 const bridge=createBridge({emit:message=>messages.push(message),providerFactory:async hooks=>({
  start(){hooks.onState('conectado');},close(){},
  async sendImage(jid,caption,image){sent.push({jid,caption,image});return {messageId:'fixture'};}
 })});
 const request={action:'send_image',request_id:'11111111-1111-4111-8111-111111111111',group_jid:'123@g.us',text:'Legenda',
  image:Buffer.from([255,216,1,255,217]).toString('base64')};
 await bridge.receive(request);
 assert.equal(sent.length,0);
 await bridge.receive({action:'connect'});
 await bridge.receive({...request,image:'AAAB'});
 assert.equal(messages.at(-1).value.status,'rejected');
 await bridge.receive({...request,group_jid:'123@s.whatsapp.net'});
 assert.equal(messages.at(-1).value.status,'rejected');
 await bridge.receive(request);
 assert.deepEqual(sent,[{jid:'123@g.us',caption:'Legenda',image:Buffer.from([255,216,1,255,217])}]);
 assert.equal(messages.at(-1).value.status,'accepted');
 assert.equal(JSON.stringify(messages).includes(request.image),false);
 await bridge.close();
});

test('duas bridges isolam QR, cofre, o mesmo ID de grupo e desconexão',async()=>{
 const fixture=name=>{
  const events=[];let hooks;
  const bridge=createBridge({emit:event=>events.push(event),renderQr:async qr=>qr,
   providerFactory:async options=>{
    hooks=options;
    return {async start(){await hooks.onQr('QR '+name);hooks.onState('conectado');},
     close(){},async forget(){return true;},async listGroups(){return [{id:'123@g.us',name,members:1}];}};
   }});
  return {bridge,events,get hooks(){return hooks;}};
 };
 const test=fixture('TESTE'),production=fixture('PRODUÇÃO');
 await Promise.all([test.bridge.receive({action:'connect',vault:'cofre-teste'}),production.bridge.receive({action:'connect',vault:'cofre-producao'})]);
 assert.equal(test.hooks.serialized,'cofre-teste');
 assert.equal(production.hooks.serialized,'cofre-producao');
 assert.ok(test.events.some(e=>e.type==='qr'&&e.value==='QR TESTE'));
 assert.ok(production.events.some(e=>e.type==='qr'&&e.value==='QR PRODUÇÃO'));
 await Promise.all([test.bridge.receive({action:'groups'}),production.bridge.receive({action:'groups'})]);
 assert.deepEqual(test.events.at(-1).value,[{id:'123@g.us',name:'TESTE',members:1,addressing_mode:'unknown',role:'unknown',posting:'unknown',settings:'unknown'}]);
 assert.deepEqual(production.events.at(-1).value,[{id:'123@g.us',name:'PRODUÇÃO',members:1,addressing_mode:'unknown',role:'unknown',posting:'unknown',settings:'unknown'}]);
 const previous=production.events.length;
 await test.bridge.receive({action:'disconnect'});
 assert.equal(production.events.length,previous);
 await production.bridge.receive({action:'groups'});
 assert.equal(production.events.at(-1).type,'groups');
 await Promise.all([test.bridge.close(),production.bridge.close()]);
});

test('IPC preserva bytes PDF e MP4, rejeita nomes, MIME e destinos inválidos, e não repete resultado incerto',async()=>{
 const sent=[],messages=[];
 const bridge=createBridge({emit:message=>messages.push(message),providerFactory:async hooks=>({
  start(){hooks.onState('conectado');},close(){},
  async sendFile(jid,caption,bytes,mime,name){sent.push({jid,caption,bytes,mime,name});if(name==='incerto.pdf')throw Error('fixture');return {messageId:'fixture'};}
 })});
 const pdf=Buffer.from('%PDF-1.4\nfixture\n%%EOF\n');
 const mp4=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
 const request={action:'send_file',request_id:'11111111-1111-4111-8111-111111111111',group_jid:'123@g.us',text:'Fixture',mime:'application/pdf',name:'fixture.pdf',file:pdf.toString('base64')};
 await bridge.receive(request);assert.equal(sent.length,0);
 await bridge.receive({action:'connect'});
 for(const invalid of [{...request,name:'../fixture.pdf'},{...request,mime:'video/mp4'},{...request,file:'AAAB'},{...request,group_jid:'123@s.whatsapp.net'},{...request,file:Buffer.alloc(5*1024*1024+1).toString('base64')}]){
  await bridge.receive(invalid);assert.equal(messages.at(-1).value.status,'rejected');
 }
 assert.equal(sent.length,0);
 await bridge.receive(request);
 assert.deepEqual(sent[0],{jid:'123@g.us',caption:'Fixture',bytes:pdf,mime:'application/pdf',name:'fixture.pdf'});
 assert.equal(messages.at(-1).value.status,'accepted');
 await bridge.receive({...request,request_id:'22222222-2222-4222-8222-222222222222',mime:'video/mp4',name:'fixture.mp4',file:mp4.toString('base64')});
 assert.deepEqual(sent[1].bytes,mp4);
 const uncertain={...request,request_id:'33333333-3333-4333-8333-333333333333',name:'incerto.pdf'};
 await bridge.receive(uncertain);
 assert.equal(sent.length,3);assert.equal(messages.at(-1).value.status,'uncertain');
 await bridge.receive(uncertain);await bridge.receive(request);
 assert.equal(sent.length,3);assert.equal(messages.at(-1).value.status,'uncertain');
 assert.equal(JSON.stringify(messages).includes(request.file),false);
 await bridge.close();
});


test('diagnostico PN/LID não exporta participantes e não confunde domínios',async()=>{
 const {groupDiagnostics}=await import('../whatsapp-provider.mjs');
 const own=['5511999999999:3@s.whatsapp.net','12345@lid'];
 assert.deepEqual(groupDiagnostics({addressingMode:'pn',announce:true,restrict:false,participants:[{id:'999@lid',admin:'admin'},{id:'12345@lid',phoneNumber:'5511999999999@s.whatsapp.net',admin:'superadmin'}]},own),{addressing_mode:'pn',role:'superadmin',posting:'admins',settings:'all'});
 assert.deepEqual(groupDiagnostics({addressingMode:'lid',announce:false,participants:[{id:'12345@s.whatsapp.net',admin:'admin'}]},own),{addressing_mode:'lid',role:'unknown',posting:'all',settings:'unknown'});
});
