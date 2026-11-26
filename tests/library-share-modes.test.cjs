const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Library modes preserve original dispatch gate and permissions',()=>{
 const js=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8'),sql=fs.readFileSync('release/pacote-final-20261125/library_video_preview_queue_candidate.sql','utf8');
 for(const re of [/Capa \+ link/,/Prévia curta \+ link/,/Arquivo original/,/file.allow_download===true&&libraryFileDraftReady/,/cloud.libraryMediaURL\(file,true\)/,/short\?512000:5242880/,/linkFor\(\{type:'document',ref:s.row.id\}\)/,/video.muted=true;video.loop=true/])assert.match(js,re);
 assert.match(cloud,/p_source_path:path/);assert.match(sql,/j.source_path=p_source_path/);
 assert.match(js,/gates.whatsapp_rich\?\.originals_enabled===true/);
});

test('library picker resets cover and revalidates download permission with a freshly signed preview',()=>{
 const js=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
 assert.match(js,/p\.disabled=o\.disabled=true;p\.hidden=o\.hidden=false;\$\('\[data-editor="library_share_cover"\]'\)\.disabled=false/);
 const start=js.indexOf('  async function addLibraryFile(mode)'),end=js.indexOf('  async function searchCatalog',start),body=js.slice(start,end);
 assert.match(body,/latest\.allow_download!==true/);
 assert.match(body,/await cloud\.libraryVideoPreview\(s\.row\.id,file\.path\)/);
 assert.match(body,/const url=short\?refreshed\.url:/);
 assert.ok(body.indexOf('latest.allow_download!==true')<body.indexOf('await fetch(address.href'));
});
