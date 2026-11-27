import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');

test('card fica acima dos canais e o diálogo conserva o formulário existente',()=>{
 const {window}=parseHTML('<html><body><section><div class="neo-campaign-toolbar">App WhatsApp</div><input value="Rascunho"></section></body></html>');
 const root=window.document.querySelector('section');
 const input=root.querySelector('input[value=Rascunho]');
 vm.runInNewContext(read('dist/admin/admin-connect-ai.js'),{window,document:window.document});
 window.NeoAdminConnectAI.mount(root);
 window.NeoAdminConnectAI.mount(root);
 const trigger=root.querySelector('[data-connect-ai-open]');
 assert.equal(root.querySelectorAll('[data-connect-ai-open]').length,1);
 assert.equal(trigger.nextElementSibling.className,'neo-campaign-toolbar');
 const dialog=root.querySelector('dialog');
 dialog.showModal=()=>dialog.setAttribute('open','');
 trigger.click();
 assert.equal(dialog.hasAttribute('open'),true);
 assert.equal(root.querySelector('input[value=Rascunho]'),input);
 assert.equal(input.value,'Rascunho');
 assert.match(dialog.textContent,/Cloudflare.*Servidor MCP de produção conectado/s);
 assert.match(dialog.textContent,/Vercel.*Interface administrativa/s);
 const select=dialog.querySelector('[data-connect-ai-client]');
 Object.defineProperty(select,'value',{value:'claude'});
 select.dispatchEvent(new window.Event('change'));
 assert.match(dialog.querySelector('[data-connect-ai-guide]').href,/support.claude.com/);
 assert.equal(dialog.querySelectorAll('button[disabled]').length,1);
 assert.equal(dialog.querySelector('[data-connect-ai-address]').value,'https://connect-teste.neopep.com.br/mcp');
 const environment=dialog.querySelector('[data-connect-ai-environment]');
 Object.defineProperty(environment,'value',{value:'production'});
 environment.dispatchEvent(new window.Event('change'));
 assert.equal(dialog.querySelector('[data-connect-ai-address]').value,'https://connect.neopep.com.br/mcp');
 assert.ok(dialog.querySelector('[data-connect-ai-surface]'));
 assert.match(read('dist/admin/index.html'),/admin-connect-ai\.js\?v=8.*admin\.js\?v=132/s);
});

test('consentimento exige clique e conexões só são revogadas após confirmação',async()=>{
 const {window}=parseHTML('<html><body><section><div class="neo-campaign-toolbar"></div></section></body></html>');
 const root=window.document.querySelector('section'),calls=[];
 window.location={href:'https://teste.app.neopep.com.br/admin/?connectAiRequest=client_id%3Dfixture&connectAiCsrf=proof&connectAiExpires=123',
  assign:url=>calls.push(['redirect',url])};
 window.confirm=()=>true;
 window.NeoCloud={connectAIAvailable:true,
  approveConnectAI:async(...args)=>{calls.push(['approve',...args]);return 'https://client.example/callback';},
  connectAIConnections:async(action,id)=>{calls.push([action,id]);return action==='list'?[{
   id:'id-fixture',client_id:'fixture',expires_at:'2099-01-01'
  }]:{id};}};
 window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};
 vm.runInNewContext(read('dist/admin/admin-connect-ai.js'),{window,document:window.document,URL,URLSearchParams});
 window.NeoAdminConnectAI.mount(root);
 assert.deepEqual(calls,[]);
 const dialog=root.querySelector('dialog');
 assert.equal(dialog.hasAttribute('open'),true);
 dialog.querySelector('[data-connect-ai-consent] button').click();
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['approve','client_id=fixture','proof','123'],['redirect','https://client.example/callback']]);
 const details=dialog.querySelector('[data-connect-ai-connections]');
 details.open=true;
 details.dispatchEvent(new window.Event('toggle'));
 await new Promise(setImmediate);
 details.querySelector('button').click();
 await new Promise(setImmediate);
 assert.deepEqual(calls.slice(2),[['list',undefined],['revoke','id-fixture'],['list',undefined]]);
});

test('base administrativa exibe guia, nove métodos e vinte referências sem anunciar escrita',()=>{
 const {window}=parseHTML('<html><body><section><div class="neo-campaign-toolbar"></div></section></body></html>');
 const root=window.document.querySelector('section');
 window.location={href:'https://teste.app.neopep.com.br/admin/',origin:'https://teste.app.neopep.com.br'};
 window.NeoCloud=null;
 vm.runInNewContext(read('dist/admin/connect-ai-knowledge.js'),{window});
 vm.runInNewContext(read('dist/admin/admin-connect-ai.js'),{window,document:window.document,URL,URLSearchParams});
 window.NeoAdminConnectAI.mount(root);
 const panel=root.querySelector('[data-connect-ai-knowledge]');
 assert.match(panel.textContent,/2026-11-27.6/);
 assert.match(panel.textContent,/Especialistas criativos \(9\)/);
 assert.match(panel.textContent,/Referências externas \(20\)/);
 assert.match(panel.textContent,/somente leitura/);
 assert.equal(panel.querySelectorAll('a').length,20);
 assert.equal(window.NeoConnectAIKnowledge.guide_receipt,undefined);
 assert.equal(window.NeoConnectAIKnowledge.available_tools,undefined);
 const input=panel.querySelector('input[type=search]');input.value='Artemis';input.dispatchEvent(new window.Event('input'));
 assert.equal(panel.querySelectorAll('a').length,1);
 assert.match(panel.querySelector('a').textContent,/Artemis/);
});
