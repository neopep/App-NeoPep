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
 assert.doesNotMatch(central,/Resultados de hoje/);assert.match(central,/Rascunhos sem data[\s\S]*?Rascunhos com data[\s\S]*?Publicações e resultados/);assert.match(central,/group_names/);assert.match(central,/Entrega confirmada a pelo menos um destinatário/);
 assert.match(central,/saved\?\.revision===item\.revision&&sameDraft\(saved\.draft,item\.draft\)/);
 assert.match(editor,/if\(publication&&draftIsClean\(\)&&!state.attempt&&\(!state.dispatchAttempt\|\|state.dispatchConfirmed\)\)/);
 assert.match(app,/Mais informações/);assert.match(app,/initial&&\(key!=='location'\|\|locationObservationEnabled\(\)\)/);assert.match(app,/initial&&values.pending&&\(key!=='location'\|\|locationObservationEnabled\(\)\)/);assert.match(sql,/send_error_code/);assert.match(central,/Falha informada pelo WhatsApp/);
 assert.match(sql,/m\.receipt_id=p_data->>'message_id' and m\.group_jid=p_data->>'group_jid'/);
});

test('agenda conserva falhas e ausência de entrega, só conclui recibos reais',()=>{const src=central.slice(central.indexOf(' function waBatchState('),central.indexOf(' function seriesProgress('));const {waBatchState,waNeedsAttention}=new Function(src+'return {waBatchState,waNeedsAttention}')();const b={states:['accepted'],message_count:1};assert.equal(waNeedsAttention(b),true);assert.equal(waBatchState({...b,server_ack_count:1}),'server_ack');assert.equal(waNeedsAttention({...b,send_error_count:1}),true);assert.equal(waNeedsAttention({...b,delivery_count:1}),false);assert.equal(waNeedsAttention({states:['refused']}),true);assert.equal(waNeedsAttention({states:['cancelled']}),false);assert.equal(waNeedsAttention({states:['accepted','accepted'],delivery_count:1}),true);});


test('resultados mistos permanecem na agenda e cada grupo tem seu estado',()=>{const src=central.slice(central.indexOf(' const escape='),central.indexOf(' const local='))+central.slice(central.indexOf(' const waLabels='),central.indexOf(' function seriesProgress('))+central.slice(central.indexOf(' function groupLine('),central.indexOf(' function canRepublish('));const {waBatchState,waNeedsAttention,groupResults,batchHistory}=new Function(src+'return {waBatchState,waNeedsAttention,groupResults,batchHistory}')();const b={due_at:'2026-11-27T20:33:00Z',states:['accepted','accepted'],message_count:2,delivery_count:1,send_error_count:1,group_results:[{name:'Mundo <pep>',states:['accepted'],message_count:1,send_error_count:1,send_error_codes:['421']},{name:'Teste NeoPep',states:['accepted'],message_count:1,delivery_count:1}]};assert.equal(waBatchState(b),'partial');assert.equal(waNeedsAttention(b),true);const html=groupResults(b);assert.match(html,/Mundo &lt;pep&gt;/);assert.match(html,/Código 421/);assert.match(html,/Teste NeoPep/);assert.match(html,/Entrega confirmada/);assert.match(batchHistory([b,{due_at:b.due_at,states:['cancelled']}]),/Cancelada/);assert.equal(groupResults({states:['accepted']}),'');});
