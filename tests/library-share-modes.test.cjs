const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Library modes preserve original dispatch gate and permissions',()=>{
 const js=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8'),sql=fs.readFileSync('release/pacote-final-20261125/library_video_preview_queue_candidate.sql','utf8');
 for(const re of [/Capa \+ link/,/Prévia curta \+ link/,/Arquivo original/,/s.policy.original===true&&libraryFileDraftReady/,/cloud.libraryCampaignOriginalURL\(s.row.id,latest\)/,/short\?512000:originalLimit\(file\.mime\)/,/linkFor\(\{type:'document',ref:s.row.id\}\)/,/video.muted=true;video.loop=true/])assert.match(js,re);
 assert.match(cloud,/p_source_path:path/);assert.match(sql,/j.source_path=p_source_path/);
 assert.match(js,/gates.whatsapp_rich\?\.originals_enabled===true/);
});

test('library picker resets cover and revalidates explicit campaign permission with a freshly signed preview',()=>{
 const js=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
 assert.match(js,/p\.disabled=o\.disabled=true;p\.hidden=o\.hidden=false;\$\('\[data-editor="library_share_cover"\]'\)\.disabled=false/);
 const start=js.indexOf('  async function addLibraryFile(mode)'),end=js.indexOf('  async function searchCatalog',start),body=js.slice(start,end);
 assert.match(body,/if\(!policy\|\|policy&&\(short\?policy.preview!==true:policy.original!==true\)\)/);assert.doesNotMatch(body,/latest\.allow_download!==true/);
 assert.match(body,/await cloud\.libraryVideoPreview\(s\.row\.id,file\.path\)/);
 assert.match(body,/const url=short\?refreshed\.url:/);
 assert.ok(body.indexOf("await cloud.libraryCampaignShare('authorize'")<body.indexOf('await fetch(address.href'));
});

test('library controls are independent and save explicit mode atomically',()=>{const community=fs.readFileSync('dist/community.js','utf8'),editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),sql=fs.readFileSync('release/campanhas-entrega-edicao-20261127/library_independent_permissions_candidate.sql','utf8');assert.match(community,/Permitir download do arquivo<\/label>/);assert.match(community,/Uso em campanhas/);assert.match(community,/expected_campaign_mode/);assert.match(sql,/alter column campaign_share_mode set default 'cover'/);assert.match(sql,/where campaign_share_mode='inherit'/);assert.match(sql,/library_campaign_save_attachment\(entry,pid\)/);assert.match(sql,/item.user_id is distinct from auth.uid\(\)/);assert.doesNotMatch(editor,/Usar permissão de download/);assert.doesNotMatch(editor,/cloud.libraryMediaURL\(file,true\)/);});
