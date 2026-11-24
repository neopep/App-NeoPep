const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');
function setup(api){const {window}=parseHTML('<html><body><main></main></body></html>');let advance;window.NeoCloud={library:api};window.matchMedia=()=>({matches:false});const context={cloud:true,user:{id:'A'}};const ctx={window,document:window.document,Date,setTimeout,clearTimeout,setInterval:(fn,ms)=>{if(ms===6500)advance=fn;return 0}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/library.js','utf8'),ctx);const ui=window.NeoLibrary;window.document.querySelector('main').innerHTML=ui.home();return {ui,window,document:window.document,context,advance:()=>advance()};}
test('card carrega apenas destaques oficiais, escapa texto e aponta para Biblioteca/material',async()=>{const calls=[];const s=setup(async action=>{calls.push(action);return {materials:[{id:'one',title:'Primeiro <img onerror=x>',excerpt:'Leitura <script>x</script>',has_link:true},{id:'two',title:'Segundo',excerpt:'Outro material'}]}});await s.ui.loadHome(s.context);assert.deepEqual(calls,['featured']);assert.equal(s.document.querySelector('[data-library-home] img'),null);const link=s.document.querySelector('[data-material="one"]');assert.equal(link.dataset.communitySection,'library');assert.equal(link.dataset.go,'comunidade');s.document.querySelector('[data-library-step="1"]').click();assert.match(s.document.querySelector('[data-library-home]').textContent,/Segundo/);assert.equal(s.document.querySelector('[data-material="two"]').dataset.communitySection,'library');s.document.querySelector('[data-library-pause]').click();Object.defineProperty(s.document,'visibilityState',{value:'visible'});const query=s.document.querySelector.bind(s.document);s.document.querySelector=selector=>selector.includes(':hover')||selector.includes(':focus-within')?null:query(selector);s.advance();assert.ok(query('[data-material="one"]'));
});
test('troca de conta descarta resposta antiga e ausência de SQL mantém entrada da Biblioteca',async()=>{let resolveA;const s=setup(async()=>new Promise(resolve=>resolveA=resolve));const pending=s.ui.loadHome(s.context);s.ui.session({id:'B'});s.window.NeoCloud.library=async()=>({materials:[{id:'b',title:'Material atual',excerpt:'Texto'}]});await s.ui.loadHome({cloud:true,user:{id:'B'}});resolveA({materials:[{id:'a',title:'Antigo'}]});await pending;assert.ok(s.document.querySelector('[data-material="b"]'));assert.equal(s.document.querySelector('[data-material="a"]'),null);s.ui.session(null);s.document.querySelector('main').innerHTML=s.ui.home();assert.ok(s.document.querySelector('[data-community-section=library]'));assert.equal(s.document.querySelector('[data-material]'),null);
});

test('destaque solicita apenas a prévia privada do item atual, usa fallback e descarta a conta anterior',async()=>{
 const calls=[];
 const file={path:'member/cover.jpg',mime:'image/jpeg',allow_download:false};
 const s=setup(async(action,payload)=>{
  calls.push([action,payload?.id]);
  return action==='featured'?{materials:[{id:'one',title:'A'},{id:'two',title:'B'}]}:
   {material:{attachments:[file]}};
 });
 let resolve;
 s.window.NeoCloud.libraryMediaURL=async(item,download)=>{
  assert.equal(item,file);assert.equal(download,false);
  if(calls.at(-1)[1]==='two')return new Promise(r=>resolve=r);
  return 'https://private.test/image?token=temporary';
 };
 await s.ui.loadHome(s.context);
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['featured',undefined],['get','one']]);
 assert.match(s.document.querySelector('[data-library-home] img').src,/private\.test/);
 s.document.querySelector('[data-library-step="1"]').click();
 await new Promise(setImmediate);
 assert.equal(s.document.querySelector('[data-library-home] img'),null);
 s.ui.session(null);
 resolve('https://private.test/old-account');
 await new Promise(setImmediate);
 assert.equal(s.document.querySelector('[data-library-home] img'),null);
});
