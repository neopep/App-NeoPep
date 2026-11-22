const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const ID='10000000-0000-4000-8000-000000000001';
function setup(navigator={}){const {window}=parseHTML('<html><body></body></html>');const calls=[],ctx={window,document:window.document,navigator,location:{href:'https://app.test/neo/?code=secret&payment_id=hidden#perfil'},URL,AbortController,File,Blob,fetch:async()=>new Response('file-content',{headers:{'Content-Type':'application/pdf'}})};window.NeoCloud={libraryMediaURL:async(f,download)=>{calls.push([f.path,download]);return 'https://private.test/signed'}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/library-shelf.js','utf8'),ctx);window.NeoLibraryShelf.session({id:'A'});return {ui:window.NeoLibraryShelf,document:window.document,window,ctx,calls};}
const row=()=>({id:ID,title:'Material de leitura',attachments:[{path:'A/doc.pdf',name:'Documento.pdf',mime:'application/pdf',allow_download:true}]});
test('link compartilhado aponta para a publicação e nunca contém tokens nem URL assinada',async()=>{const writes=[],s=setup({clipboard:{writeText:async value=>writes.push(value)}});await s.ui.shareLink(row());const url=new URL(writes[0]);assert.equal(url.origin,'https://app.test');assert.equal(url.pathname,'/neo/');assert.equal(url.searchParams.get('material'),ID);assert.equal(url.hash,'#comunidade');assert.equal(url.searchParams.has('code'),false);assert.equal(url.searchParams.has('payment_id'),false);assert.ok(!writes[0].includes('signed'));assert.equal(s.calls.length,0);});
test('compartilhamento nativo recebe somente o link interno e a troca de conta limpa o diálogo',async()=>{
 const sent=[],s=setup({share:async value=>sent.push(value)});
 await s.ui.shareLink(row());
 assert.equal(sent.length,1);
 assert.equal(sent[0].files,undefined);
 assert.equal(new URL(sent[0].url).searchParams.get('material'),ID);
 assert.equal(s.ui.shareFile,undefined);
 assert.equal(s.calls.length,0);
 const fallback=setup();
 await fallback.ui.shareLink(row());
 assert.ok(fallback.document.querySelector('[data-share-link]'));
 assert.equal(fallback.document.querySelector('a[download]'),null);
 fallback.ui.session({id:'B'});
 assert.equal(fallback.document.querySelector('dialog'),null);
});
