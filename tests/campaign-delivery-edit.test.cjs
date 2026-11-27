const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const central=fs.readFileSync('dist/admin/campaign-central.js','utf8'),editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),app=fs.readFileSync('dist/app.js','utf8');
const sql=fs.readFileSync('release/campanhas-entrega-edicao-20261127/campaign_delivery_edit_candidate.sql','utf8');
test('agendamento futuro só é editável se não começou',()=>{
 const src=central.slice(central.indexOf(' function stableDraft('),central.indexOf(' function groupLine('));
 const {sameDraft,canEditScheduled}=new Function(src+'return {sameDraft,canEditScheduled}')();
 assert.equal(sameDraft('{"b":2,"a":1}',{a:1,b:2}),true);assert.equal(sameDraft('{"a":1}',{a:2}),false);
 const pub={batches:[{origin:'schedule',due_at:'2026-11-27T21:00:00Z',states:['waiting']}]},now=Date.parse('2026-11-27T18:00:00Z');
 assert.equal(canEditScheduled(pub,now),true);
 pub.batches[0].states=['started'];assert.equal(canEditScheduled(pub,now),false);
 pub.batches[0].states=['waiting'];pub.batches[0].origin='recurring';assert.equal(canEditScheduled(pub,now),false);
 assert.match(sql,/m\.state<>'waiting' or m\.attempts<>0/);assert.match(sql,/campaign-rich-owner:/);
});
test('grupos, entrega explícita, recuperação local e consentimento visível',()=>{
 assert.match(central,/Resultados de hoje/);assert.match(central,/group_names/);assert.match(central,/Entrega confirmada a pelo menos um destinatário/);
 assert.match(central,/saved\?\.revision===item\.revision&&sameDraft\(saved\.draft,item\.draft\)/);
 assert.match(editor,/if\(publication&&draftIsClean\(\)\)/);
 assert.match(app,/Mais informações/);assert.match(app,/initial&&key!=='location'/);
 assert.match(sql,/m\.receipt_id=p_data->>'message_id' and m\.group_jid=p_data->>'group_jid'/);
});
