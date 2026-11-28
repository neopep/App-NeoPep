const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
const helpers=source.slice(source.indexOf(' // Native album draft contract.'),source.indexOf(' function formatted('));
const {albumDraftIssue,hasNativeAlbum,moveAlbumBlock}=new Function(helpers+';return {albumDraftIssue,hasNativeAlbum,moveAlbumBlock}')();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const pic=(n,group=100)=>({id:id(n),type:'image',album_id:id(group),text:''});
test('álbum nativo mantém 2–4 fotos contíguas, ids exclusivos e legendas individuais',()=>{
 for(const n of [2,3,4])assert.equal(albumDraftIssue(Array.from({length:n},(_,i)=>pic(i+1))),null);
 for(const rows of [[pic(1)],[pic(1),pic(2),pic(3),pic(4),pic(5)],[pic(1),{type:'text'},pic(2)],[pic(1),pic(1)],[pic(1),{...pic(2),text:'x'.repeat(1001)}]])assert.equal(albumDraftIssue(rows),'INVALID_ALBUM');
 assert.equal(hasNativeAlbum([{type:'image'}]),false);assert.equal(hasNativeAlbum([pic(1),pic(2)]),true);
});
test('ordem das fotos e dos blocos é preservada; álbum se move como unidade',()=>{
 const p=[pic(1),pic(2),{id:id(3),type:'text'},pic(4,200),pic(5,200)];
 assert.deepEqual(moveAlbumBlock(p,0,1).map(b=>b.id),[2,1,3,4,5].map(id));
 assert.deepEqual(moveAlbumBlock(p,1,1).map(b=>b.id),[3,1,2,4,5].map(id));
 assert.deepEqual(moveAlbumBlock(p,2,1).map(b=>b.id),[1,2,4,5,3].map(id));
 assert.equal(albumDraftIssue(moveAlbumBlock(p,2,1)),null);assert.equal(p[0].id,id(1));
});
test('album é somente rascunho até homologação e não usa fallback de upload',()=>{
 assert.match(source,/const allow=Boolean\(!hasNativeAlbum\(draft.blocks\)/);
 assert.match(source,/if\(hasNativeAlbum\(draft.blocks\)\)\{tell\('Envio nativo de álbum/);
 assert.match(source,/album_draft_capabilities/);
 assert.match(source,/block.album_id&&stored!==path/);
 assert.match(source,/data-editor="choose_album"/);
 assert.match(source,/data-editor="disband_album"/);
});
