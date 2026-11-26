'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8'),sql=fs.readFileSync('release/pacote-final-20261125/campaign_catalog_thumbnails_candidate.sql','utf8');
test('catalog grid does not download originals; price and private thumbnails',()=>{
 const listing=editor.slice(editor.indexOf('  async function searchCatalog(){'),editor.indexOf("  dialog.addEventListener('keydown'",editor.indexOf('  async function searchCatalog(){')));
 assert.match(listing,/catalogPrice\(row\)/);assert.match(listing,/campaignThumbnailURL/);assert.match(listing,/catalogPool/);
 assert.doesNotMatch(listing,/libraryMediaURL|shopPhotoURL|pdfCover|videoCover|fetch\(/);
 assert.match(editor,/async function prepareCatalogThumbs/);assert.match(editor,/160\/Math.max/);assert.match(cloud,/blob.size>65536/);
 assert.match(sql,/neo_campaign_thumbnail_read/);assert.match(sql,/neo_library_media_access/);assert.match(sql,/neo_shop_photo/);assert.match(sql,/public.neo_admin_access/);
 assert.match(sql,/false,65536,array\['image\/jpeg'\]/);assert.doesNotMatch(sql,/for update to authenticated/i);
});
