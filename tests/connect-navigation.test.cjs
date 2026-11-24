const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');

function load(script,html){
 const {window,document}=parseHTML(html);
 const scope={document,window,console};
 vm.runInNewContext(fs.readFileSync(script,'utf8'),scope);
 return {document,window,scope};
}
function click(window,node){node.dispatchEvent(new window.Event('click',{bubbles:true}));}
test('Connect move pausa para simulação e preserva a aba após atualização',()=>{
 const html='<div id="connect"><p data-connect-status></p><div data-connect-content>'+
 '<h4>Instaladores aprovados</h4><p>Sem versão</p>'+
 '<h4>Computadores</h4><p>Simulação pausada.</p><button data-connect="pause">Retomar simulação</button><article>Computador</article>'+
 '<h4>Contas simuladas</h4><form><input name="identity"></form>'+
 '<h4>Autorização por grupo</h4><form><input name="group"></form>'+
 '<h4>Fila de simulação</h4><form><input name="id"></form><p>Simulado</p>'+
 '<details><summary>Tentativas e auditoria</summary><p>Auditoria</p></details></div></div>';
 const {document,window,scope}=load('dist/admin/connect-navigation.js',html);
 const root=document.querySelector('#connect');
 scope.installNeoConnectNavigation(root);
 const selected=()=>root.querySelector('[data-neo-connect-tabs] [aria-pressed="true"]').dataset.neoConnectView;
 assert.equal(selected(),'overview');
 assert.equal(root.querySelector('[data-connect="pause"]').closest('[data-neo-connect-panel]').dataset.neoConnectPanel,'simulation');
 click(window,root.querySelector('[data-neo-connect-view="simulation"]'));
 assert.equal(selected(),'simulation');
 assert.equal(root.querySelector('[data-neo-connect-panel="devices"]').hidden,true);
 const body=root.querySelector('[data-connect-content]');
 body.innerHTML='<h4>Instaladores aprovados</h4><h4>Computadores</h4><p>Simulação habilitada.</p><button data-connect="pause">Pausar simulação</button><h4>Contas simuladas</h4><h4>Autorização por grupo</h4><h4>Fila de simulação</h4><p>Simulado</p><details><summary>Tentativas e auditoria</summary></details>';
 scope.installNeoConnectNavigation(root);
 assert.equal(selected(),'simulation');
 assert.equal(root.querySelector('[data-connect="pause"]').textContent,'Pausar simulação');
 assert.equal(root.querySelectorAll('[data-neo-connect-tabs]').length,1);
});
test('WhatsApp separa grupos, publicações e Connect sem perder campos',()=>{
 const html='<div id="whatsapp"><p data-wa-status></p><p data-wa-reminders></p>'+
 '<details data-wa-connect><summary>NeoPep Connect</summary><div data-connect-root></div></details>'+
 '<details><summary>Grupos cadastrados</summary><form data-wa-group><input name="name"></form></details>'+
 '<form data-wa-publication><select name="campaign_id"></select></form>'+
 '<fieldset><div data-wa-queue></div></fieldset></div>';
 const {document,window,scope}=load('dist/admin/whatsapp-navigation.js',html);
 const root=document.querySelector('#whatsapp');
 scope.installNeoWhatsappNavigation(root);
 assert.equal(root.querySelector('[data-wa-publication]').closest('[data-neo-wa-panel]').dataset.neoWaPanel,'publications');
 assert.equal(root.querySelector('[data-wa-group]').closest('[data-neo-wa-panel]').dataset.neoWaPanel,'groups');
 click(window,root.querySelector('[data-neo-wa-view="connect"]'));
 assert.equal(root.querySelector('[data-wa-connect]').open,true);
 assert.equal(root.querySelector('[data-neo-wa-panel="groups"]').hidden,true);
 click(window,root.querySelector('[data-neo-wa-view="groups"]'));
 assert.equal(root.dataset.waPage,'groups');
 assert.equal(root.querySelector('[data-neo-wa-panel="groups"]').hidden,false);
});
test('A página carrega scripts na ordem correta e limpa o formulário após salvar',()=>{
 const html=fs.readFileSync('dist/admin/index.html','utf8');
 const whatsapp=fs.readFileSync('dist/admin/admin-whatsapp.js','utf8');
 const connect=fs.readFileSync('dist/admin/admin-connect.js','utf8');
 assert.ok(!html.includes('connect-navigation.js'));
 assert.ok(html.indexOf('admin-connect.js')<html.indexOf('admin-whatsapp.js'));
 assert.ok(html.indexOf('whatsapp-navigation.js')<html.indexOf('admin-whatsapp.js'));
 assert.match(whatsapp,/form\.reset\(\);selectedJob=null;prepared=null;files=\[\];preview\(\);/);
 assert.match(connect,/switchConnectTab\(activeTab\)/);
 assert.doesNotMatch(connect,/installNeoConnectNavigation/);
});

test('Atualizações cadastra somente rascunhos e não oferece download para eles',async()=>{
 const {document,window,scope}=load('dist/admin/connect-navigation.js','<div id="connect"></div>');
 const root=document.querySelector('#connect');
 const values={version:'0.2.3',artifact:'ensaio-0.2.3-9224ae0aa963',bytes:'50072576',
  sha256:'a'.repeat(64),signature:Buffer.alloc(384).toString('base64'),notes:'<teste>'};
 scope.esc=value=>String(value).replaceAll('<','&lt;');
 scope.FormData=class{*[Symbol.iterator](){yield*Object.entries(values);}};
 vm.runInNewContext(fs.readFileSync('dist/admin/admin-connect.js','utf8'),scope);
 const releases=[];
 const actions=[];
 const cloud={
  connectAdmin:async()=>({releases,accounts:[],devices:[],sessions:[],groups:[],tasks:[],audit:[]}),
  campaignWhatsApp:async()=>[],
  async connectUpdateAdmin(action,data){
   actions.push(action);
   if(action==='register'){
    assert.deepEqual({...data},{...values,bytes:50072576});
    releases.push({...data,distribution_state:'draft'});
   }
   return {releases};
  }
 };
 const panel=scope.mountNeoConnect(root,cloud);
 await panel.load();
 click(window,root.querySelector('[data-connect-tab="updates"]'));
 const form=root.querySelector('[data-connect-form="update_register"]');
 form.reset=()=>{};
 const submit=()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 const signature=values.signature;
 values.signature='inválida';
 submit();
 assert.deepEqual(actions,['list']);
 values.signature=signature;
 submit();
 submit();
 await new Promise(setImmediate);
 assert.deepEqual(actions,['list','register','list']);
 assert.match(root.querySelector('[data-connect-updates]').textContent,/0\.2\.3 · Rascunho/);
 assert.equal(root.querySelector('[data-connect-updates] script'),null);
 assert.equal(root.querySelector('[data-connect="download"][data-version="0.2.3"]'),null);
 assert.equal(root.querySelector('[data-connect-pane="updates"]').hidden,false);
 assert.equal(root.querySelector('[data-connect-status]').textContent,'Rascunho cadastrado.');
});

test('Atualizações fica indisponível sem acesso à RPC administrativa',async()=>{
 const {document,scope}=load('dist/admin/connect-navigation.js','<div id="connect"></div>');
 const root=document.querySelector('#connect');
 scope.esc=String;
 vm.runInNewContext(fs.readFileSync('dist/admin/admin-connect.js','utf8'),scope);
 const cloud={connectAdmin:async()=>({releases:[],accounts:[],devices:[],groups:[],tasks:[],audit:[]}),
  campaignWhatsApp:async()=>[]};
 await scope.mountNeoConnect(root,cloud).load();
 assert.ok(root.querySelector('[data-connect-tab="updates"]'));
 assert.equal(Boolean(root.querySelector('[data-connect-form="update_register"]')),false);
 const restricted=document.createElement('div');
 document.body.append(restricted);
 cloud.connectUpdateAdmin=async()=>{throw new Error('Administrador obrigatório');};
 await scope.mountNeoConnect(restricted,cloud).load();
 assert.equal(restricted.querySelector('[data-connect-form="update_register"]'),null);
 assert.match(restricted.querySelector('[data-connect-updates]').textContent,/indisponível/);
});

test('Atualizações exige política do servidor e confirmação para aprovar e bloquear',async()=>{
 const {document,window,scope}=load('dist/admin/connect-navigation.js','<div id="connect"></div>');
 const root=document.querySelector('#connect');
 scope.esc=String;
 scope.FormData=class{*[Symbol.iterator](){}};
 let confirmed=false;
 const confirmations=[];
 scope.confirm=message=>{confirmations.push(message);return confirmed;};
 vm.runInNewContext(fs.readFileSync('dist/admin/admin-connect.js','utf8'),scope);
 const release={version:'0.2.3',distribution_state:'draft',artifact:'ensaio-0.2.3-9224ae0aa963',
  bytes:50072576,sha256:'a'.repeat(64),approved_at:'2020-01-01T12:00:00Z'};
 let policy;
 const calls=[],audit=[];
 const cloud={
  connectAdmin:async()=>({releases:[{...release}],accounts:[],devices:[],sessions:[],groups:[],tasks:[],audit:[]}),
  campaignWhatsApp:async()=>[],
  async connectUpdateAdmin(action,data){
   if(action==='list')return {approval_policy:policy,releases:[{...release}],audit};
   calls.push([action,{...data}]);
   release.distribution_state=action==='approve'?'approved':'blocked';
   audit.push({event:'update_'+action,release_version:release.version,release_result:'ok',actor_id:'admin'});
   return {ok:true};
  }
 };
 const panel=scope.mountNeoConnect(root,cloud);
 await panel.load();
 const section=()=>root.querySelector('[data-connect-updates]');
 const approve=()=>section().querySelector('[data-connect-form="update_approve"]');
 const submit=()=>approve().dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 assert.match(section().textContent,/Rascunho/);
 assert.match(section().textContent,/Aprovação —/);
 assert.ok(approve().querySelector('button').hasAttribute('disabled'));
 submit();
 assert.equal(confirmations.length,0);
 policy=1;
 await panel.load();
 assert.equal(approve().querySelector('input').hasAttribute('checked'),false);
 submit();
 assert.match(confirmations[0],/opcional/);
 assert.deepEqual(calls,[]);
 confirmed=true;
 submit();
 submit();
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['approve',{version:'0.2.3',required:false}]]);
 assert.match(section().textContent,/Aprovada/);
 const block=()=>section().querySelector('[data-connect="update_block"]');
 confirmed=false;
 click(window,block());
 assert.equal(calls.length,1);
 confirmed=true;
 click(window,block());
 click(window,block());
 await new Promise(setImmediate);
 assert.deepEqual(calls[1],['block',{version:'0.2.3'}]);
 assert.equal(calls.length,2);
 assert.match(section().textContent,/Bloqueada/);
 assert.match(section().textContent,/Bloqueio de atualização · Versão 0\.2\.3 · Concluída · Administrador admin/);
 assert.equal(block(),null);
 assert.equal(root.querySelector('[data-connect="download"][data-version="0.2.3"]'),null);
});

test('Connect alterna as oito abas com um painel independente e preserva a aba ao atualizar',async()=>{
 const {document,window,scope}=load('dist/admin/admin-connect.js','<div id="connect"></div>');
 const root=document.querySelector('#connect');
 scope.esc=String;
 const panel=scope.mountNeoConnect(root,{
  connectAdmin:async()=>({releases:[],accounts:[],devices:[],groups:[],tasks:[],audit:[]}),
  connectWaConnections:async()=>[],
  campaignWhatsApp:async()=>[]
 });
 await panel.load();
 const tabs=[...root.querySelectorAll('[role=tab]')];
 assert.equal(tabs.length,8);
 for(const tab of tabs){
  click(window,tab);
  assert.equal(tab.getAttribute('aria-selected'),'true');
  assert.deepEqual([...root.querySelectorAll('[role=tabpanel]:not([hidden])')].map(pane=>pane.id),
   [tab.getAttribute('aria-controls')]);
 }
 await panel.load();
 assert.equal(root.querySelector('[aria-selected=true]').textContent,'Ajuda');
 assert.equal(root.querySelectorAll('.neo-connect-tabs').length,1);
});
