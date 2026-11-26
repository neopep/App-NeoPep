const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('legacy heartbeat compatibility is bounded, fingerprinted, and never enables dispatch',()=>{
 const sql=fs.readFileSync('release/pacote-final-20261125/campaign_official_dispatch_0215_candidate.sql','utf8');
 assert.match(sql,/62d9843fac2b58925416672f52e2d2f5/);
 assert.match(sql,/12ecf778c210b178a68e34c3826c420d/);
 assert.match(sql,/cardinality\(string_to_array\(definition,anchor\)\)<>2/);
 assert.ok(sql.includes("d.version in ('0.2.13','0.2.14','0.2.15')"));
 assert.match(sql,/dispatch_compatibility_requires_quiescence/);
 assert.match(sql,/originals_must_remain_disabled/);
 assert.doesNotMatch(sql,/\bupdate\s+neo_private\.(campaign_dispatch_config|campaign_wa_rich_control)/i);
 assert.match(sql,/execute replace\(definition,anchor,replacement\)/);
});
