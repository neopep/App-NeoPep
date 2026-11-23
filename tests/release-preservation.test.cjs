// Release gates: static regression checks for the last approved NeoPep features.
// Intentionally fail until all workstreams are reconciled. These assertions are
// a minimum source-level safeguard, NOT a substitute for functional/RLS/iOS tests.
// Run: node --test tests/release-preservation.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function read(name){try{return fs.readFileSync(path.join(root,name),'utf8');}
catch(error){if(error.code==='ENOENT')return '';throw error;}}
function present(name){assert.ok(fs.existsSync(path.join(root,name)),name+' ausente da candidata');}
function contains(name,pattern,label){
 const content=read(name);assert.ok(content,name+' ausente da candidata');
 assert.match(content,pattern,label+' ausente em '+name);
}
test('LOJA P0: duplicar produto e gerenciar sem expor produto oculto',()=>{
 contains('dist/shop.js',/duplicate_product/,'duplicação de produto');
 contains('dist/shop.js',/visibility_mode/,'modo de visibilidade');
 contains('dist/shop.js',/shop_store_hidden\s*!==\s*true/,'filtro de vitrine inclusive para admin');
 contains('dist/shop.js',/shop-manage-list/,'inventário administrativo independente');
});
test('LOJA P0: preservar a migração adicional de ocultação para administradores',()=>{
 const name='supabase/migrations/20261123234500_shop_store_admin_visibility.sql';
 present(name);
 contains(name,/shop_store_hidden/,'marcador retornado pelo backend');
 contains(name,/shop_product_blocked\(actor/,'visibilidade por membro');
});
test('CAMPANHAS P0: oito abas do NeoPep Connect',()=>{
 const name='dist/admin/admin-connect.js';
 contains(name,/neo-connect-tabs/,'navegação do Connect');
 for(const text of ['Visão geral','Computadores','Atualizações','Contas','Vínculos','Simulação','Histórico','Ajuda']){
  assert.ok(read(name).includes(text),'Aba '+text+' ausente');
 }
});
test('CAMPANHAS P0: grupos sincronizados e RPC compatível com banco já migrado',()=>{
 contains('dist/admin/admin-whatsapp.js',/mountSyncedCampaignGroups/,'seleção de grupos sincronizados');
 contains('dist/admin/admin-whatsapp.js',/campaignWhatsAppSync/,'integração de seleção e destinatários');
 contains('src/cloud.js',/neo_campaign_wa_sync/,'contrato da RPC');
});
test('BIBLIOTECA P0: player imersivo carregado antes do visualizador de arquivos',()=>{
 present('dist/library-video.js');
 const html=read('dist/index.html');
 const player=html.indexOf('library-video.js');
 const library=html.indexOf('library-files.js');
 assert.ok(player>=0 && library>player,'O script imersivo deve carregar antes de library-files.js');
 contains('dist/library-files.js',/NeoLibraryVideo/,'abertura no player imersivo');
 contains('dist/style.css',/library-video-dialog/,'layout imersivo');
 contains('dist/sw.js',/library-video.js/,'arquivo do player no shell PWA');
});
test('ALIMENTAÇÃO: reserva aprovada no Início sem funcionalidade simulada',()=>{
 contains('src/app.js',/Minha alimentação/,'card Minha alimentação');
 contains('src/app.js',/Em breve/,'sinalização de funcionalidade futura');
});
test('CADASTRO: solicitação voluntária de geolocalização do dispositivo',()=>{
 contains('src/app.js',/(navigator\.geolocation|\.getCurrentPosition\s*\()/,'geolocalização nativa opcional');
});
