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
 assert.ok(html.indexOf('connect-navigation.js')<html.indexOf('admin-connect.js'));
 assert.ok(html.indexOf('whatsapp-navigation.js')<html.indexOf('admin-whatsapp.js'));
 assert.match(whatsapp,/form\.reset\(\);selectedJob=null;prepared=null;files=\[\];preview\(\);/);
 assert.match(connect,/installNeoConnectNavigation\(root\)/);
});
