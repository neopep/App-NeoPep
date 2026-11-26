const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../release/pacote-final-20261125/20261126003000_geo_device_city.sql'),'utf8');
test('GPS municipal requer usuario autenticado e consentimento preexistente',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.neo_geo_device_city\(p_country text, p_region text, p_city text\)/i);
 assert.match(sql,/u uuid:=auth\.uid\(\)/);
 assert.match(sql,/WHERE user_id=u/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.neo_geo_device_city\(text,text,text\) FROM PUBLIC, anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.neo_geo_device_city\(text,text,text\) TO authenticated/);
});
test('localizacao GPS substitui apenas a estimativa IP sem latitude ou longitude gravadas',()=>{
 assert.match(sql,/first_location->>'source'='vercel_ip_approximate'/);
 assert.match(sql,/last_location=observation/);
 assert.match(sql,/last_location->>'source' is distinct from 'device_city'/i);
 assert.match(sql,/'source','device_city'/);
 assert.doesNotMatch(sql,/jsonb_build_object\([^)]*latitude|jsonb_build_object\([^)]*longitude/i);
 assert.doesNotMatch(sql,/insert into auth\.users|delete from neo_private\.account_geo/i);
});
