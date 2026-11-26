const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const central=fs.readFileSync('dist/admin/campaign-central.js','utf8'),editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
const fn=central.slice(central.indexOf('  function localDrafts(){'),central.indexOf('  function localDraftCards(){'));
function fixture(entries,pending,publications=[]){
 const prefix='neo-campaign-editor:owner:whatsapp:group:',pointer='pointer',map=new Map(entries.map(([id,item])=>[prefix+id,JSON.stringify(item)]));
 if(pending)map.set(pointer,pending);
 const rows=vm.runInNewContext(fn+';localDrafts()',{account:'owner',channel:'whatsapp',current:'group',detail:{publications},localStorage:{length:map.size,key:i=>[...map.keys()][i],getItem:k=>map.get(k)},getLocal:k=>map.get(k),pointer:()=>pointer,removeLocal:k=>map.delete(k)});
 return {ids:Array.from(rows,r=>r.id),map};
}
const draft={title:'Documento',blocks:[{id:'a',type:'file',text:'Legenda',media_path:'owner/file.pdf'}],groups:['g']};
const savedDraft=JSON.stringify(draft);
test('publicação salva com legenda aberta sem alteração não vira rascunho local',()=>{
 const {ids,map}=fixture([['sent',{draft,savedDraft,compose:'Legenda',editing:'a'}]],'sent',[{id:'sent'}]);
 assert.deepEqual(ids,[]);assert.equal(map.has('pointer'),false);
});
test('mudanças reais e texto novo são preservados, inclusive legenda apagada',()=>{
 for(const [compose,editing] of [['Nova legenda','a'],['','a'],['Texto separado',null]]){
 const {ids}=fixture([['sent',{draft,savedDraft,compose,editing}]],'sent',[{id:'sent'}]);
 assert.deepEqual(ids,['sent']);
 }
 const {ids}=fixture([['sent',{draft:{...draft,title:'Alterado'},savedDraft}]],null,[{id:'sent'}]);assert.deepEqual(ids,['sent']);
});
test('ponteiro de rascunho novo ainda sem registro permanece recuperável',()=>{
 assert.deepEqual(fixture([],'new',[]).ids,['new']);
 assert.deepEqual(fixture([],'sent',[{id:'sent'}]).ids,[]);
});
test('envio confirmado limpa somente cópia local intacta e volta à Central',()=>{
 assert.match(editor,/if\(publication&&state\.dispatchConfirmed&&draftIsClean\(\)\)/);
 assert.match(editor,/localStorage\.getItem\(k\)===lastLocalWrite/);
 assert.match(editor,/state\.dispatchConfirmed=true;state\.dispatchAttempt=null/);
 assert.match(editor,/if\(publication&&persisted&&draftIsClean\(\)\)\{dialog\.close\(\);\}/);
 assert.match(central,/recoveryEditorId:item\.recoveryEditorId\|\|item\.editorId/);
 assert.match(editor,/account\+':'+state\.recoveryEditorId\+':'+id/);
});
