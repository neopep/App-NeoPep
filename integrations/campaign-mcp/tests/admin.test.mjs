import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');

test('card fica acima dos canais e o diálogo conserva o formulário existente',()=>{
 const {window}=parseHTML('<html><body><section><div class="neo-campaign-toolbar">App WhatsApp</div><input value="Rascunho"></section></body></html>');
 const root=window.document.querySelector('section');
 const input=root.querySelector('input');
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
 assert.equal(root.querySelector('input'),input);
 assert.equal(input.value,'Rascunho');
 assert.match(dialog.textContent,/Cloudflare.*Aguardando homologação/s);
 assert.match(dialog.textContent,/Vercel.*Planejado/s);
 assert.match(read('dist/admin/index.html'),/admin-connect-ai\.js\?v=2.*admin\.js\?v=132/s);
});
