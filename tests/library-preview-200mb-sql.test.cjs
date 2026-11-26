const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('preview capacity migration preserves authentication and bounded source/output',()=>{
 const sql=fs.readFileSync('release/pacote-final-20261125/library_video_preview_200mb_candidate.sql','utf8');
 assert.ok(sql.includes("p_secret !~ '^[0-9a-f]{64}$'"));
 assert.ok(sql.includes("~ '^[0-9]{1,9}$'"));
 assert.equal((sql.match(/209715200/g)||[]).length,2);
 assert.match(sql,/interval '25 minutes'/);assert.match(sql,/512000/);assert.match(sql,/preview_worker_must_be_inactive/);
 assert.doesNotMatch(sql,/set\s+enabled\s*=\s*true/i);
});