const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('library limits use server capacity, preserve legacy defaults and do not bypass plan',()=>{
 const js=fs.readFileSync('dist/community.js','utf8'),sdk=fs.readFileSync('src/cloud.js','utf8'),sql=fs.readFileSync('release/pacote-final-20261125/library_upload_200mb_candidate.sql','utf8');
 const start=js.indexOf(' function libraryFileLimit('),end=js.indexOf(' function materialEditorForm(',start);
 const limits=data=>new Function('data',js.slice(start,end)+';return libraryFileLimit;')(data);
 assert.equal(limits({})('video/mp4'),52428800);assert.equal(limits({})('application/pdf'),10485760);
 assert.equal(limits({library_upload_limits:{video:209715200,pdf:52428800}})('video/mp4'),209715200);
 assert.equal(limits({library_upload_limits:{video:999999999}})('video/mp4'),52428800);
 assert.match(sdk,/neo_library_upload_limits_v1/);assert.match(sdk,/file.size>limits\[kind\]/);
 assert.match(sql,/least\(209715200,cap\)/);assert.match(sql,/public.neo_admin_access\(\)/);assert.match(sql,/before insert or update of size,mime/i);
 assert.doesNotMatch(sql,/update\s+storage\.buckets/i);
});
