const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),{parseHTML}=require('linkedom');
test('ativação pendente não pede permissão nem oferece sucesso fictício',()=>{const {window}=parseHTML('<html><body></body></html>');const ctx={window,document:window.document,setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},queueMicrotask,navigator:{},matchMedia:()=>({matches:false}),Notification:{permission:'default'}};window.NEO_CONFIG={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/push.js','utf8'),ctx);const html=window.NeoPush.panel({cloud:true});assert.match(html,/Ativação pendente/);assert.match(html,/data-push="enable" disabled/);assert.match(window.NeoPush.panel({cloud:false}),/Entre na conta/)});
test('logout remove inscrição própria no servidor e cancela assinatura do dispositivo',async()=>{const {window}=parseHTML('<html><body></body></html>');const calls=[];const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/a'}),unsubscribe:async()=>{calls.push('unsubscribe');return true}};window.PushManager={};window.Notification={};window.NeoCloud={user:{id:'A'},pushDevice:async(action,value)=>calls.push(action+':'+value.endpoint)};const ctx={window,document:window.document,setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},queueMicrotask,navigator:{serviceWorker:{getRegistration:async()=>({active:{},update:async()=>{},pushManager:{getSubscription:async()=>sub}})}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/push.js','utf8'),ctx);await window.NeoPush.detach();assert.deepEqual(calls,['remove:https://web.push.apple.com/a','unsubscribe'])});

test('push de conversa privada exibe título, remetente e texto da mensagem',async()=>{
 const listeners={},shown=[];
 const self={
  registration:{scope:'https://app.neopep.com.br/',showNotification:async(title,options)=>shown.push({title,options})},
  location:{origin:'https://app.neopep.com.br'},
  addEventListener:(name,fn)=>{listeners[name]=fn;}
 };
 vm.runInNewContext(fs.readFileSync('dist/sw.js','utf8'),{self,URL,Set,Request,Response});
 async function push(payload){
  const pending=[];
  listeners.push({data:{json:()=>payload},waitUntil:p=>pending.push(p)});
  await Promise.all(pending);
  return shown.at(-1);
 }
 const message=await push({
  tag:'00000000-0000-4000-8000-000000000010',
  kind:'support',title:'Mensagem de Ana',body:'Olá, recebi sua mensagem.'
 });
 assert.equal(message.title,'Mensagem de Ana');
 assert.equal(message.options.body,'Olá, recebi sua mensagem.');
 assert.equal(message.options.data.target,'support');
 assert.equal(message.options.tag,'00000000-0000-4000-8000-000000000010');
 const withoutPreview=await push({kind:'support'});
 assert.equal(withoutPreview.title,'NeoPep');
 assert.equal(withoutPreview.options.body,'Você tem uma nova mensagem privada.');
 const other=await push({kind:'reminder',title:'Texto indevido',body:'Conteúdo indevido'});
 assert.equal(other.title,'NeoPep');
 assert.match(other.options.body,/lembretes/);
});
