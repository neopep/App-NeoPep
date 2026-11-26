const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const js=fs.readFileSync('dist/admin/campaign-central.js','utf8');
const helper=js.slice(js.indexOf(' // WhatsApp acceptance'),js.indexOf(' function canRepublish('));
const {waBatchState,waActive,waHistory,seriesProgress}=vm.runInNewContext(helper+';({waBatchState,waActive,waHistory,seriesProgress})');
const now=Date.parse('2026-11-26T18:00:00Z');
const b=(id,states,due_at='2026-11-27T12:00:00Z')=>({id,states,due_at});
test('WhatsApp distingue aceite completo, parcial, falha, incerteza e pendência',()=>{
 for(const [states,expected] of [[['accepted'],'accepted'],[['accepted','cancelled'],'partial'],[['accepted','refused'],'partial'],[['refused'],'refused'],[['uncertain'],'uncertain'],[['started'],'in_progress'],[['waiting'],'scheduled'],[['cancelled'],'cancelled'],[[],'unknown']])assert.equal(waBatchState(b('x',states),now),expected);
 assert.equal(waBatchState(b('x',['waiting'],'2026-11-25T12:00:00Z'),now),'waiting');
 assert.equal(waActive(b('x',['accepted','waiting'])),true);
 assert.equal(waHistory(b('x',['accepted','waiting'])),false);
 assert.equal(waHistory(b('x',['accepted'])),true);
});
test('recorrência conta ocorrências e não mensagens; preserva datas futuras e desconhecidas',()=>{
 const pubs=[{id:'a',batches:[b('1',['accepted','accepted'])]},{id:'b',batches:[b('2',['waiting'])]},{id:'c',batches:[b('3',['accepted','refused'])]},{id:'d',batches:[b('4',['cancelled'])]}];
 const occurrences=['a','b','c','d','e'].map((id,i)=>({publication_id:id,batch_id:String(i+1),local_time:'2026-11-'+(26+i)+'T09:00'}));
 const p=seriesProgress(occurrences,pubs,now);
 assert.deepEqual([p.sent,p.pending,p.failed,p.cancelled,p.total],[1,1,2,1,5]);assert.equal(p.next.publication_id,'b');
});
test('agenda e histórico usam metadados do servidor e mantêm recibos por ocorrência',()=>{
 assert.match(js,/Enviado ao WhatsApp/);
 assert.match(js,/Origem não registrada/);
 assert.match(js,/batch\.configured_at/);
 assert.match(js,/batch\.sent_at/);
 assert.match(js,/item\.configured_at/);
 assert.match(js,/seriesProgress\(item\.occurrences,all\)/);
 assert.match(js,/Ver calendário de envios/);
 assert.match(js,/pub\.batches\.some\(waActive\)/);
 assert.match(js,/pub\.batches\.some\(waHistory\)/);
 assert.match(js,/Ver tentativas e recibos/);
});
