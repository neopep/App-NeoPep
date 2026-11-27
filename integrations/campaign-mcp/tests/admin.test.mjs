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
 assert.match(dialog.textContent,/Cloudflare.*Aguardando homologação/s);
 assert.match(dialog.textContent,/Vercel.*Planejado/s);
 const select=dialog.querySelector('[data-connect-ai-client]');
 Object.defineProperty(select,'value',{value:'claude'});
 select.dispatchEvent(new window.Event('change'));
 assert.match(dialog.querySelector('[data-connect-ai-guide]').href,/support.claude.com/);
 assert.equal(dialog.querySelectorAll('button[disabled]').length,2);
 assert.equal(dialog.querySelector('[data-connect-ai-address]').value,'https://connect-teste.neopep.com.br/mcp');
 const environment=dialog.querySelector('[data-connect-ai-environment]');
 Object.defineProperty(environment,'value',{value:'production'});
 environment.dispatchEvent(new window.Event('change'));
 assert.equal(dialog.querySelector('[data-connect-ai-address]').value,'https://connect.neopep.com.br/mcp');
 assert.ok(dialog.querySelector('[data-connect-ai-surface]'));
 assert.match(read('dist/admin/index.html'),/admin-connect-ai\.js\?v=3.*admin\.js\?v=132/s);
});
